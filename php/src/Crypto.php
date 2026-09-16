<?php

declare(strict_types=1);

namespace Mridul\Payments;

/**
 * CCAvenue's cipher.
 *
 * AES-128-CBC, the key a raw MD5 of the working key, and a fixed published IV.
 * This is their scheme, not a choice — it is what their gateway will decrypt,
 * so it is what must be sent. CCAvenue's own PHP kit does the same thing by
 * way of a hand-rolled `hextobin(md5($key))`; `md5($key, true)` is the same
 * sixteen bytes without the detour.
 *
 * Be clear-eyed about what this does and does not give you. A constant IV and
 * no MAC mean this is encryption without authentication: it hides the contents
 * and proves the sender held the working key, but it does not prove that a
 * given message is fresh, or that it was produced for this transaction rather
 * than replayed from an earlier one. So a decrypted response is treated here
 * as a HINT about which order is being discussed — never as proof of payment.
 * The proof is `CCAvenue::orderStatus()`, which asks CCAvenue over our own
 * connection.
 */
final class Crypto
{
    /** CCAvenue's published initialisation vector: the bytes 0x00 … 0x0f. */
    private const IV = "\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f";

    private const CIPHER = 'aes-128-cbc';

    public static function encrypt(string $plainText, string $workingKey): string
    {
        $cipherText = openssl_encrypt(
            $plainText,
            self::CIPHER,
            md5($workingKey, true),
            OPENSSL_RAW_DATA,
            self::IV,
        );

        if ($cipherText === false) {
            throw new \RuntimeException('Could not encrypt the payment request.');
        }

        return bin2hex($cipherText);
    }

    public static function decrypt(string $cipherText, string $workingKey): string
    {
        $raw = @hex2bin(trim($cipherText));
        if ($raw === false || $raw === '') {
            // Not hex at all. Somebody posted rubbish at the callback, which is
            // an ordinary thing to happen to a public URL.
            throw new \RuntimeException('The payment response was not readable.');
        }

        $plainText = openssl_decrypt(
            $raw,
            self::CIPHER,
            md5($workingKey, true),
            OPENSSL_RAW_DATA,
            self::IV,
        );

        if ($plainText === false) {
            throw new \RuntimeException('The payment response did not decrypt.');
        }

        return $plainText;
    }

    /**
     * CCAvenue's payload is a flat `a=1&b=2` string with no escaping of its
     * own, so a value containing `&` or `=` would silently become two fields —
     * or, with a crafted address line, a field that was never meant to be sent
     * at all. Strip those, and the newlines that would break the format.
     */
    public static function toPayload(array $fields): string
    {
        $parts = [];
        foreach ($fields as $name => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $clean = trim(str_replace(['&', '=', "\r", "\n"], ' ', (string) $value));
            $parts[] = $name . '=' . $clean;
        }

        return implode('&', $parts);
    }

    /** @return array<string, string> */
    public static function fromPayload(string $payload): array
    {
        $out = [];
        foreach (explode('&', $payload) as $pair) {
            $at = strpos($pair, '=');
            if ($at === false || $at === 0) {
                continue;
            }
            $out[trim(substr($pair, 0, $at))] = trim(substr($pair, $at + 1));
        }

        return $out;
    }
}
