# Supabase schema

Sixteen migrations, applied in filename order. Every table has row-level security
enabled, and a table with RLS on and no matching policy denies by default — so
a table I forgot to write a policy for fails closed, not open.

| File | Contents |
|---|---|
| `0001_foundation.sql` | Enums, `profiles`, `admin_roles`, the two role helpers |
| `0002_media.sql` | `media` — one row per file |
| `0003_catalogue.sql` | Categories, collections, products, images, variants, inventory |
| `0004_content.sql` | Hero banners, homepage sections, journal, story, settings |
| `0005_commerce.sql` | Addresses, carts, wishlists, coupons, `validate_coupon` |
| `0006_orders.sql` | Orders, order items, payments, shipments, tracking, stock movement |
| `0007_ops.sql` | Notifications, webhook events, audit log, shipping rules, `media_usage` |
| `0008_storage.sql` | Storage buckets and their policies |
| `0009_editorial.sql` | The last of the hardcoded content, and the shipping figures |
| `0010_nav_and_quotes.sql` | Which collections appear in the nav, and the header quotes |
| `0011_sold_out.sql` | Mark a product sold out without touching its stock |
| `0012_testimonials.sql` | Customer reviews |
| `0013_testimonials_section.sql` | The reviews row on the homepage |
| `0014_testimonial_media.sql` | A photo on a review |
| `0015_order_numbers.sql` | `next_order_number()` — the human-facing reference |
| `0016_order_placement.sql` | `place_order`, `admin_set_order_status`, `admin_customers` |

## The four rules this schema enforces

**1. A browser cannot set a price.**
Customers have `SELECT` on their own orders and nothing else — no `INSERT`, no
`UPDATE`, on `orders`, `order_items` or `payments`. Orders are written by the
server with the service role, after it has read prices from `products`,
validated the coupon and calculated shipping. There is no code path where a
request body decides an amount.

On top of that, `0006` revokes `UPDATE` on `orders` and grants it back only on
`status`, `notes` and `cancelled_at` — `0016` adds `payment_method` and
`staff_notes` to that list and nothing else. RLS chooses rows; column
privileges choose columns. An order manager can advance an order but cannot
rewrite what it cost.

`0016` is where an order actually gets created, and it did not need the
service-role key to do it. `place_order` is a SECURITY DEFINER function granted
to `authenticated`: the customer still has no `INSERT` on any of these tables,
and all they can do is ask for that one transaction. It reads the unit price
from `products`, re-validates the discount code against its own subtotal, reads
the shipping charge from `settings`, locks and decrements `inventory` row by
row, and writes the total itself. The browser chooses which variant and how
many; everything else it sends is ignored or re-derived. The same shape covers
the admin: `admin_customers()` reads the `auth.users` columns no client role
can see and checks the caller's role itself, so the admin app never needs a key
that bypasses these policies.

**2. A customer sees only their own data.**
`profiles`, `addresses`, `carts`, `cart_items`, `wishlists`, `orders` and
`payments` all gate on `auth.uid()` in both `USING` and `WITH CHECK`. The
second half matters: without it, a customer could update their own row to point
at someone else's id.

**3. Knowing the admin URL grants nothing.**
Staff access runs through `has_admin_role()`, which reads `admin_roles`. Your
five roles map to the tables they own — `catalog_manager` cannot touch orders,
`content_manager` cannot touch products, `support` is read-only everywhere, and
only `super_admin` can write `admin_roles` itself. That last one is the whole
game: write access to the role table is the ability to grant yourself anything.

**4. Stock moves on verified payment.**
`mark_order_paid()` is the only thing that deducts inventory, and it is not
granted to `anon` or `authenticated`. It is idempotent, because Razorpay's
webhook can arrive twice or race the browser redirect — a second call to an
already-confirmed order returns without touching stock.

## Two design notes

**Money is a `bigint` count of paise.** Never a float, never a string. Razorpay
charges in paise, and integer arithmetic keeps totals exact. `orders` carries a
check constraint that the total actually adds up, and `order_items` that each
line does.

**Coupons have no read policy at all.** The only way a client learns anything
is `validate_coupon(code, subtotal)`, a `SECURITY DEFINER` function. A shopper
can test a code they were given; they cannot list the ones they were not.

## Applying it

With the Supabase CLI, from the repo root:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

```bash
supabase db push
```

Or paste each file into the SQL editor in order. `0008` needs privileges on the
`storage` schema, which both routes have.

Then grant yourself the top role — replace the email with yours:

```sql
insert into public.admin_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'you@example.com';
```

## Verifying RLS actually holds

Worth doing before trusting any of it. In the SQL editor:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<some-user-uuid>"}';
select count(*) from public.orders;   -- expect only that user's orders
insert into public.orders default values;  -- expect: permission denied
```

## Not yet done

- **No seed data.** The 20 products currently live in
  `packages/database/src/seed-data.ts`. Porting them belongs with wiring the
  repository, so the two stay in step.
- **Unrun.** These migrations have not been executed against a live Postgres —
  see the note in the handover. Apply to a scratch project first.
- **No generated types.** `supabase gen types typescript` once the project
  exists; those replace the hand-written types in `@mridul/types`.
