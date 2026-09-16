<?php

declare(strict_types=1);

/**
 * Known-answer test for the CCAvenue cipher.
 *
 * Run this ON THE SERVER before putting the payment path live:
 *
 *     php php/test-crypto.php
 *
 * The expected ciphertexts below were produced by an independent
 * implementation of CCAvenue's scheme (AES-128-CBC, raw-MD5 key, their fixed
 * IV). If this file prints PASS, the PHP here agrees with it byte for byte,
 * which means the encryption is right — the one part of this integration that
 * fails silently rather than loudly if it is wrong.
 *
 * A wrong cipher does not throw. It produces a request CCAvenue rejects with
 * an unhelpful page, or worse, a response that decrypts to rubbish that then
 * gets parsed. This is the cheapest possible way to rule that out.
 *
 * It uses a fake working key and touches no network and no database, so it is
 * safe to run anywhere, any number of times.
 */

require __DIR__ . '/src/Crypto.php';

use Mridul\Payments\Crypto;

const WORKING_KEY = 'TESTWORKINGKEY000000000000000000';

$cases = [
    [
        'name'     => 'a payment request',
        'plain'    => 'merchant_id=12345&order_id=MR-2026-000007&amount=5200.00&currency=INR',
        'expected' => '6114e13a4f5c0efbbd3d19c0cc19ce60f2fa6c9b1fe49aac817bcdb0f0e6de78'
                    . 'c6eaf7c32965771c108786d6370cc3d5e645e233ced1bbfe6531323d17be4c5a'
                    . '7d6acdbeb3a98b928fd38e5a50f7d3ae',
    ],
    [
        'name'     => 'a status enquiry',
        'plain'    => 'order_no=MR-2026-000007',
        'expected' => 'cfa45f6de9b75c1005ea494aa330bf506b1712dd10dc76264b5208d8a8d29603',
    ],
];

$failures = 0;

if (!extension_loaded('openssl')) {
    echo "FAIL  the openssl extension is not loaded — nothing here can work.\n";
    exit(1);
}

foreach ($cases as $case) {
    $actual = Crypto::encrypt($case['plain'], WORKING_KEY);

    // hash_equals, not ===. It costs nothing here and means this file is not
    // an example of the habit you do not want copied into the response path.
    if (hash_equals($case['expected'], $actual)) {
        echo "PASS  encrypt: {$case['name']}\n";
    } else {
        $failures++;
        echo "FAIL  encrypt: {$case['name']}\n";
        echo "        expected {$case['expected']}\n";
        echo "        got      {$actual}\n";
    }

    $roundTrip = Crypto::decrypt($actual, WORKING_KEY);
    if (hash_equals($case['plain'], $roundTrip)) {
        echo "PASS  decrypt: {$case['name']}\n";
    } else {
        $failures++;
        echo "FAIL  decrypt: {$case['name']}\n";
        echo "        expected {$case['plain']}\n";
        echo "        got      {$roundTrip}\n";
    }
}

// A field value carrying the payload's own separators must not be able to
// invent a field. This is the injection case for CCAvenue's flat format.
$payload = Crypto::toPayload([
    'billing_name'    => 'A&B=Traders',
    'billing_address' => "12 Main Road\r\nAlwal",
    'amount'          => '5200.00',
]);
$parsed = Crypto::fromPayload($payload);

if (count($parsed) === 3 && !str_contains($parsed['billing_name'], '&')) {
    echo "PASS  separators in a value cannot invent a field\n";
} else {
    $failures++;
    echo "FAIL  separators in a value leaked into the payload: {$payload}\n";
}

// Rubbish posted at the callback must raise, not return something parseable.
foreach (['not-hex-at-all', '', 'deadbeef'] as $rubbish) {
    try {
        Crypto::decrypt($rubbish, WORKING_KEY);
        $failures++;
        echo "FAIL  decrypt accepted rubbish: " . var_export($rubbish, true) . "\n";
    } catch (Throwable) {
        echo "PASS  decrypt rejects rubbish: " . var_export($rubbish, true) . "\n";
    }
}

echo "\n" . ($failures === 0
    ? "All checks passed. The cipher agrees with CCAvenue's scheme.\n"
    : "{$failures} check(s) FAILED. Do not take payments until this passes.\n");

exit($failures === 0 ? 0 : 1);
