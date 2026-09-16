<?php

declare(strict_types=1);

/**
 * Where CCAvenue sends the customer back to.
 *
 * ===========================================================================
 * READ THIS BEFORE CHANGING ANYTHING IN THIS FILE
 *
 * This is the only script in the shop where the question "was this paid for?"
 * gets answered. Everything else downstream — stock, dispatch, the invoice —
 * believes whatever is decided here.
 *
 * Three facts about this request shape every line below:
 *
 *   1. IT IS PUBLIC. Anyone on the internet can POST here, as many times as
 *      they like, with anything at all in the body. There is no session, no
 *      login, and no way to add one: it is a cross-site form POST made by the
 *      customer's browser, and browsers do not send session cookies on those.
 *
 *   2. THE BODY IS NOT EVIDENCE. It travelled through a machine the customer
 *      controls. It is decrypted only to learn WHICH ORDER is being discussed.
 *      Whether that order was paid is then asked of CCAvenue directly, over
 *      our own TLS connection, in `orderStatus()`. If the two disagree, the
 *      one that did not come through the customer's browser wins.
 *
 *      In particular: never confirm an order because `order_status` in the
 *      posted payload says Success. That field is under the sender's control
 *      in exactly the case you are defending against.
 *
 *   3. IT MAY ARRIVE TWICE, OR NEVER. Both are ordinary. Confirming is
 *      idempotent in the database, so a replay changes nothing. An order that
 *      never comes back stays pending_payment with its stock held — visible,
 *      and settleable by a person.
 *
 * The amount is checked twice over: here against the order row, and again
 * inside `confirm_online_payment`, which refuses an order whose total
 * disagrees with what the gateway says was paid.
 * ===========================================================================
 */

require __DIR__ . '/../src/Config.php';
require __DIR__ . '/../src/Crypto.php';
require __DIR__ . '/../src/CCAvenue.php';
require __DIR__ . '/../src/Orders.php';

use Mridul\Payments\CCAvenue;
use Mridul\Payments\Config;
use Mridul\Payments\Orders;

/** Log for us; never for the customer, and never with a secret in it. */
function note(string $message): void
{
    error_log('[ccavenue] ' . $message);
}

/**
 * Send the customer somewhere and stop.
 *
 * 303, not 302: this is the reply to a POST, and 303 is what tells the browser
 * to follow it with a GET. A 302 leaves some browsers re-posting the payment
 * body at the destination.
 *
 * The path is built here from a fixed origin and never from anything in the
 * request, so this cannot be turned into an open redirect that lands somebody
 * on a lookalike site straight after paying.
 */
function leave(string $origin, string $path): never
{
    header('Location: ' . $origin . $path, true, 303);
    exit;
}

// Anything but a POST is not a payment result. Answer plainly rather than
// falling through the logic below with an empty body.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit('This address accepts payment results only.');
}

try {
    $config = Config::fromEnvironment();
} catch (Throwable $e) {
    note('not configured: ' . $e->getMessage());
    http_response_code(503);
    exit('Payments are unavailable. Please contact the shop.');
}

$origin = $config->origin;

$encResp = (string) ($_POST['encResp'] ?? $_POST['enc_response'] ?? '');
if ($encResp === '') {
    // CCAvenue posts nothing back when the customer leaves before a
    // transaction exists. There is no order to fail, only somebody to send
    // somewhere sensible.
    leave($origin, '/account?payment=cancelled');
}

$gateway = new CCAvenue($config);

// -- Step 1: which order? ----------------------------------------------------
// This is ALL the posted body is used for.
try {
    $hint = $gateway->readResponse($encResp);
} catch (Throwable $e) {
    note('payload did not decrypt: ' . $e->getMessage());
    leave($origin, '/account?payment=unreadable');
}

$orderNumber = (string) ($hint['order_id'] ?? $hint['order_no'] ?? '');
if (!Orders::looksLikeOrderNumber($orderNumber)) {
    note('payload named no usable order');
    leave($origin, '/account?payment=unreadable');
}

try {
    $orders = new Orders($config);
} catch (Throwable $e) {
    note('database unreachable: ' . $e->getMessage());
    leave($origin, '/account?payment=pending');
}

$order = $orders->findByNumber($orderNumber);
if ($order === null) {
    note('no such order: ' . $orderNumber);
    leave($origin, '/account?payment=unknown');
}

// Already settled, most likely by an earlier copy of this same callback.
if ($order['status'] !== 'pending_payment') {
    leave($origin, '/order/' . rawurlencode($order['order_number']));
}

// -- Step 2: what actually happened? -----------------------------------------
// The authority. Everything above was a hint about which row to look at.
try {
    $truth = $gateway->orderStatus($orderNumber);
} catch (Throwable $e) {
    // We do not know. Failing the order here could throw away a real payment
    // and release a saree somebody has paid for, so it is left exactly as it
    // is for a person to settle.
    note('status check failed for ' . $orderNumber . ': ' . $e->getMessage());
    leave($origin, '/order/' . rawurlencode($order['order_number']) . '?payment=pending');
}

$paidPaise = $truth['amountPaise'];
$amountAgrees = $paidPaise !== null && $paidPaise === $order['total_paise'];

// -- Step 3: act -------------------------------------------------------------
if ($truth['paid'] && $amountAgrees) {
    try {
        $orders->confirm(
            $order['id'],
            // What the GATEWAY said, so the database can disagree with it.
            $paidPaise,
            $truth['trackingId'] ?? $orderNumber,
            $truth['bankReference'],
            $truth['paymentMode'],
        );
    } catch (Throwable $e) {
        note('confirm refused for ' . $orderNumber . ': ' . $e->getMessage());
        leave($origin, '/order/' . rawurlencode($order['order_number']) . '?payment=pending');
    }

    leave($origin, '/order/' . rawurlencode($order['order_number']) . '?payment=paid');
}

if ($truth['paid'] && !$amountAgrees) {
    // Paid — but not the amount this order is for. Confirming would accept a
    // price the shop never set. Left standing, loudly, for a person.
    note(sprintf(
        'AMOUNT MISMATCH on %s: gateway %s, order %d',
        $orderNumber,
        var_export($paidPaise, true),
        $order['total_paise'],
    ));
    leave($origin, '/order/' . rawurlencode($order['order_number']) . '?payment=mismatch');
}

// Declined, cancelled or abandoned. Release the stock so the piece goes back
// on the shelf instead of being held for an order nobody paid for.
try {
    $orders->fail($order['id'], $truth['message'] ?? $truth['status']);
} catch (Throwable $e) {
    note('could not release ' . $orderNumber . ': ' . $e->getMessage());
}

leave($origin, '/checkout?payment=failed');
