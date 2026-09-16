<?php

declare(strict_types=1);

namespace Mridul\Payments;

/**
 * Secrets, and where they are allowed to live.
 *
 * Read from the environment, never from a constant in a file under the web
 * root. On shared hosting a stray `.php.bak`, a misconfigured handler or a
 * directory listing turns a hardcoded working key into a public one, and the
 * working key is the entire authentication of this integration — whoever holds
 * it can compose a payment response that decrypts perfectly.
 *
 * Set them in the panel's environment variables, or in an .htaccess with
 * SetEnv, or in a file OUTSIDE the document root that is included before this.
 *
 * Nothing here is ever echoed. `describe()` exists so a misconfiguration can be
 * diagnosed without printing the secret it is complaining about.
 */
final class Config
{
    private function __construct(
        public readonly string $merchantId,
        public readonly string $accessCode,
        public readonly string $workingKey,
        public readonly bool $test,
        public readonly string $origin,
        public readonly string $dsn,
        public readonly string $dbUser,
        public readonly string $dbPassword,
    ) {
    }

    public static function fromEnvironment(): self
    {
        $required = [
            'CCAVENUE_MERCHANT_ID',
            'CCAVENUE_ACCESS_CODE',
            'CCAVENUE_WORKING_KEY',
            'STOREFRONT_ORIGIN',
            'ORDERS_DSN',
            'ORDERS_DB_USER',
            'ORDERS_DB_PASSWORD',
        ];

        $missing = [];
        $values = [];
        foreach ($required as $name) {
            $value = getenv($name);
            if ($value === false || $value === '') {
                $missing[] = $name;
                continue;
            }
            $values[$name] = $value;
        }

        if ($missing !== []) {
            // The names, never the values.
            throw new \RuntimeException(
                'Payment configuration is incomplete. Missing: ' . implode(', ', $missing)
            );
        }

        return new self(
            merchantId: $values['CCAVENUE_MERCHANT_ID'],
            accessCode: $values['CCAVENUE_ACCESS_CODE'],
            workingKey: $values['CCAVENUE_WORKING_KEY'],
            test: getenv('CCAVENUE_ENV') === 'test',
            origin: rtrim($values['STOREFRONT_ORIGIN'], '/'),
            dsn: $values['ORDERS_DSN'],
            dbUser: $values['ORDERS_DB_USER'],
            dbPassword: $values['ORDERS_DB_PASSWORD'],
        );
    }

    /** Safe to log: says what is configured without saying what it is. */
    public function describe(): string
    {
        return sprintf(
            'merchant=%s mode=%s origin=%s workingKey=%d chars',
            $this->merchantId,
            $this->test ? 'test' : 'live',
            $this->origin,
            strlen($this->workingKey),
        );
    }
}
