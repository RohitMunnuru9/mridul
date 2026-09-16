<?php

declare(strict_types=1);

namespace Mridul\Payments;

/**
 * Talking to CCAvenue.
 *
 * Two directions, and they are not equally trustworthy.
 *
 *   buildRequest()  — what we send the customer's browser off with.
 *   readResponse()  — what the browser brings back. A HINT.
 *   orderStatus()   — what CCAvenue tells us directly. THE ANSWER.
 *
 * The distinction is the whole point of this class. The response in the middle
 * travelled through a machine the customer controls: it can be replayed,
 * modified in flight if TLS is stripped, dropped entirely because they closed
 * the tab on the bank's page, or simply never sent. Decrypting it proves only
 * that whoever composed it held the working key at some point — not that this
 * payment, for this order, for this amount, just succeeded.
 *
 * `orderStatus()` is a request we make, to a host we name, over a connection
 * we verify. That is the one worth believing.
 */
final class CCAvenue
{
    private const TRANSACTION_HOST_LIVE = 'https://secure.ccavenue.com';
    private const TRANSACTION_HOST_TEST = 'https://test.ccavenue.com';
    private const API_HOST_LIVE = 'https://api.ccavenue.com';
    private const API_HOST_TEST = 'https://apitest.ccavenue.com';

    public function __construct(private readonly Config $config)
    {
    }

    /**
     * The form fields the browser POSTs to CCAvenue.
     *
     * `$amountPaise` comes from the order row, never from the request. The
     * conversion to rupees happens here, once — CCAvenue's amount field is
     * rupees with two decimals.
     *
     * @param array{name:string,email:string,phone:string,line1:string,city:string,state:string,pincode:string} $billing
     * @return array{action:string,encRequest:string,accessCode:string}
     */
    public function buildRequest(
        string $orderNumber,
        int $amountPaise,
        array $billing,
    ): array {
        $payload = Crypto::toPayload([
            'merchant_id'     => $this->config->merchantId,
            'order_id'        => $orderNumber,
            'amount'          => number_format($amountPaise / 100, 2, '.', ''),
            'currency'        => 'INR',
            'redirect_url'    => $this->config->origin . '/payment/callback.php',
            'cancel_url'      => $this->config->origin . '/payment/callback.php',
            'language'        => 'EN',
            'billing_name'    => $billing['name'],
            'billing_address' => $billing['line1'],
            'billing_city'    => $billing['city'],
            'billing_state'   => $billing['state'],
            'billing_zip'     => $billing['pincode'],
            'billing_country' => 'India',
            // CCAvenue rejects the +91 prefix; ten digits on their own.
            'billing_tel'     => preg_replace('/^\+91/', '', $billing['phone']) ?? '',
            'billing_email'   => $billing['email'],
        ]);

        $host = $this->config->test ? self::TRANSACTION_HOST_TEST : self::TRANSACTION_HOST_LIVE;

        return [
            'action'     => $host . '/transaction/transaction.do?command=initiateTransaction',
            'encRequest' => Crypto::encrypt($payload, $this->config->workingKey),
            'accessCode' => $this->config->accessCode,
        ];
    }

    /**
     * Read the redirect the browser brought back.
     *
     * Used ONLY to learn which order is being talked about. The caller must
     * not act on `order_status` from here.
     *
     * @return array<string, string>
     */
    public function readResponse(string $encResp): array
    {
        return Crypto::fromPayload(Crypto::decrypt($encResp, $this->config->workingKey));
    }

    /**
     * Ask CCAvenue whether this order was really paid.
     *
     * Their status API answers in JSON wrapped around an encrypted payload,
     * and the exact shape has varied between versions — so the parsing is
     * forgiving about where fields sit, and anything that cannot be read
     * becomes an exception rather than a guess. The caller treats an exception
     * as "do not confirm", never as "failed".
     *
     * @return array{paid:bool,orderNumber:string,amountPaise:?int,status:string,trackingId:?string,bankReference:?string,paymentMode:?string,message:?string}
     */
    public function orderStatus(string $orderNumber): array
    {
        $host = $this->config->test ? self::API_HOST_TEST : self::API_HOST_LIVE;

        $body = http_build_query([
            'enc_request'   => Crypto::encrypt(
                json_encode(['order_no' => $orderNumber], JSON_THROW_ON_ERROR),
                $this->config->workingKey,
            ),
            'access_code'   => $this->config->accessCode,
            'request_type'  => 'JSON',
            'response_type' => 'JSON',
            'command'       => 'orderStatusTracker',
            'version'       => '1.2',
        ]);

        $curl = curl_init($host . '/apis/servlet/DoWebTrans');
        curl_setopt_array($curl, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            // Non-negotiable. Without these, a DNS or routing attacker could
            // answer this question instead of CCAvenue — and this answer is
            // what money changes hands on.
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_FOLLOWLOCATION => false,
        ]);

        $raw = curl_exec($curl);
        $error = curl_error($curl);
        $code = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        if ($raw === false || $error !== '') {
            throw new \RuntimeException('Could not reach CCAvenue: ' . $error);
        }
        if ($code !== 200) {
            throw new \RuntimeException('CCAvenue status check returned HTTP ' . $code);
        }

        return $this->readStatus($this->unwrap((string) $raw));
    }

    /** Pull the encrypted payload out of whichever envelope came back. */
    private function unwrap(string $raw): array
    {
        $encrypted = Crypto::fromPayload($raw)['enc_response'] ?? null;

        if ($encrypted === null) {
            $envelope = json_decode($raw, true);
            if (is_array($envelope)) {
                $encrypted = $envelope['enc_response'] ?? $envelope['encResponse'] ?? null;
            }
        }

        if (!is_string($encrypted) || $encrypted === '') {
            throw new \RuntimeException('CCAvenue status response could not be read.');
        }

        $plain = Crypto::decrypt($encrypted, $this->config->workingKey);

        $parsed = json_decode($plain, true);
        if (is_array($parsed)) {
            $order = $parsed['Order_Status_Result'] ?? $parsed['order_status_result'] ?? $parsed;
            if (is_array($order)) {
                return $order;
            }
        }

        // Older versions answer in the flat format.
        return Crypto::fromPayload($plain);
    }

    /** @param array<string, mixed> $fields */
    private function readStatus(array $fields): array
    {
        $status = (string) ($fields['order_status'] ?? $fields['order_bank_response'] ?? 'Unknown');

        $amount = $fields['order_amt'] ?? $fields['amount'] ?? null;
        $amountPaise = null;
        if ($amount !== null && is_numeric($amount)) {
            // Round rather than cast: (int) (float) '52.00' * 100 has bitten
            // people for as long as floats have existed.
            $amountPaise = (int) round(((float) $amount) * 100);
        }

        return [
            'paid'          => strcasecmp($status, 'Success') === 0,
            'orderNumber'   => (string) ($fields['order_no'] ?? $fields['order_id'] ?? ''),
            'amountPaise'   => $amountPaise,
            'status'        => $status,
            'trackingId'    => isset($fields['reference_no']) ? (string) $fields['reference_no']
                : (isset($fields['tracking_id']) ? (string) $fields['tracking_id'] : null),
            'bankReference' => isset($fields['order_bank_ref_no']) ? (string) $fields['order_bank_ref_no']
                : (isset($fields['bank_ref_no']) ? (string) $fields['bank_ref_no'] : null),
            'paymentMode'   => isset($fields['order_option']) ? (string) $fields['order_option']
                : (isset($fields['payment_mode']) ? (string) $fields['payment_mode'] : null),
            'message'       => isset($fields['status_message']) ? (string) $fields['status_message']
                : (isset($fields['failure_message']) ? (string) $fields['failure_message'] : null),
        ];
    }
}
