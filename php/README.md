# CCAvenue payment security, in PHP

The security-critical half of the CCAvenue integration, written for a PHP
server. It is the same design as the TypeScript version in
`packages/payments/src/ccavenue.ts` and
`apps/storefront/app/api/payment/ccavenue/callback/route.ts` — use one or the
other, not both pointed at the same orders.

Requires **PHP 8.1+** (it uses `readonly` properties and `never` returns), with
the `openssl`, `curl` and `pdo_pgsql` extensions.

## The one idea

> A payment result that arrives through the customer's browser is a **hint**
> about which order is being discussed. It is never proof that money moved.

CCAvenue's reply is AES-encrypted, so decrypting it proves somebody held the
working key. It does **not** prove the message is fresh, is for this
transaction, or was not replayed — the scheme has a constant IV and no MAC. And
the request arrives at a public URL that anybody can POST to, any number of
times.

So `callback.php` decrypts the body only far enough to read an order number,
and then asks CCAvenue **over its own TLS connection** (`orderStatus()`)
whether that order was paid. That answer is what money changes hands on.

Everything else follows from it:

| Guard | Where |
|---|---|
| Amount must match the order | `callback.php`, then again in `confirm_online_payment` |
| Repeat callbacks change nothing | `confirm_online_payment` is idempotent |
| Abandoned payment releases stock | `fail_online_payment` |
| Certificates verified on the status call | `CURLOPT_SSL_VERIFYPEER` + `VERIFYHOST => 2` |
| No open redirect after paying | `leave()` builds from a fixed origin |
| Fields cannot be injected into the payload | `Crypto::toPayload()` strips `&`, `=`, newlines |
| Order number shape checked before any query | `Orders::looksLikeOrderNumber()` |

## Before it goes live

**1. Run the cipher test on the server.**

```bash
php php/test-crypto.php
```

It must print `All checks passed`. A wrong cipher fails silently rather than
loudly, and this is the cheapest way to rule it out. No network, no database,
fake key — safe to run anywhere.

**2. Put the secrets in the environment, never in a file under the web root.**

```
CCAVENUE_MERCHANT_ID    CCAVENUE_ACCESS_CODE    CCAVENUE_WORKING_KEY
CCAVENUE_ENV=test       STOREFRONT_ORIGIN       ORDERS_DSN
ORDERS_DB_USER          ORDERS_DB_PASSWORD
```

`ORDERS_DSN` looks like
`pgsql:host=…;port=5432;dbname=postgres;sslmode=require`.

On shared hosting a stray `.php.bak` or a misconfigured handler turns a
hardcoded working key into a public one — and the working key is the entire
authentication of this integration.

**3. Give the database user the least it can do.**

Do not reuse the Supabase service role or the table owner. Make a role with
exactly this and nothing more:

```sql
create role mridul_payments login password '…';
grant connect on database postgres to mridul_payments;
grant usage on schema public to mridul_payments;
grant select on public.orders to mridul_payments;
grant execute on function public.confirm_online_payment(
  uuid, text, text, bigint, text, text, text) to mridul_payments;
grant execute on function public.fail_online_payment(uuid, text)
  to mridul_payments;
```

That role cannot read a customer, cannot change a price, and cannot confirm an
order except through the function that checks the amount.

**4. Only `public/` may be reachable over the web.** Point the vhost at
`php/public/`, or if the whole folder must sit inside the web root, block the
rest:

```apache
# php/src/.htaccess  and  php/.htaccess
Require all denied
```

Then confirm it: `curl https://yoursite/php/src/Config.php` must **not** return
the file.

**5. Register the callback with CCAvenue** as both the redirect and cancel URL:

```
https://yoursite/payment/callback.php
```

It must be HTTPS. On plain HTTP the payment result crosses the network in the
clear and the whole chain is only as good as the encryption around it.

**6. Test in their sandbox first** — `CCAVENUE_ENV=test` — end to end: a
successful payment, a declined one, and a closed tab. The third is the one
people skip and the one that leaves stock held.

## What is deliberately not here

- **No order creation.** Orders are priced and written by `place_order` in the
  database, from the catalogue. Nothing in PHP decides an amount.
- **No card data.** It is typed on CCAvenue's page. It never reaches this
  server, which is what keeps you out of PCI scope.
- **No "mark paid" endpoint.** There is no way to reach confirmation except by
  the status check succeeding.

## Still untested

I could not run this — there is no PHP on the machine it was written on, so it
has not been syntax-checked or executed. Step 1 above is the first thing to
run, and the sandbox test in step 6 is what proves the rest.

The CCAvenue API details (endpoints, the status-response envelope) are from
their published integration and have varied between versions. The parser
accepts several shapes and treats anything unreadable as *not paid* — but check
them against the documentation for your own account.
