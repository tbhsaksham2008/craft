# Craft SMP roadmap

## Implemented

- [x] Design system, responsive navigation, footer, and homepage
- [x] Store, category pages, product details, search, sorting, and filters
- [x] Persisted local cart, cart drawer, and checkout flow
- [x] Community, support, FAQ, legal pages, and 404
- [x] Supabase email/password accounts and Google/Discord OAuth flows
- [x] Profiles with Minecraft usernames and customer order history
- [x] Database catalog and discount codes, with server-side price and code validation
- [x] Admin dashboard for products, discount codes, and fulfillment queue
- [x] Admin product image uploads to a public Supabase Storage bucket
- [x] Admin product removal, preserving products referenced by order history
- [x] Supabase row-level security for customer data and admin-only management
- [x] INR pricing stored in paise, with legacy USD prices converted at ₹83/USD and rounded to whole rupees
- [x] Custom Bee, Fox, Parrot, and Wolf ranks with their supplied perks; unpriced ranks are visible but not purchasable
- [x] Razorpay order creation, server-side payment verification, and signed webhook handling
- [x] Paid orders create idempotent reward-fulfillment queue entries

## Setup required before production use

1. Copy `.env.example` to `.env` and fill in the Supabase URL, anon key, service-role key, Razorpay key ID, key secret, and webhook secret. Never expose or commit `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET`.
2. If `supabase/config.toml` does not exist yet, initialize the CLI with `supabase init`; then link the project with `supabase link --project-ref <project-ref>` and apply all migrations with `supabase db push`. Migrations seed the product catalog, upgrade an existing USD/PayPal schema and convert product/order values at the fixed ₹83/USD rate, replace sample ranks, and configure the public product image bucket with admin-only uploads.
3. Enable email/password, Google, and Discord providers in Supabase Authentication. Add the local app URL (`http://localhost:8080/**`) to the allowed redirect URLs, and configure each OAuth provider to use Supabase's `/auth/v1/callback` URL.
4. Promote the first admin account in the Supabase SQL editor after it has signed up:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@example.com');
   ```

5. Open `/admin` and set prices for the Bee, Fox, Parrot, and Wolf products before accepting purchases. Ranks without a price remain visible as "Price to be set" and cannot be added to the cart or purchased.
6. Configure Razorpay test credentials and a webhook for `payment.captured` at `https://<your-app-host>/api/razorpay/webhook`; set the generated webhook secret in `.env`. Complete end-to-end tests before switching to live credentials.
7. Restart the app after changing environment variables. Without configured Supabase/Razorpay values, account and payment actions remain unavailable; no real payment can be taken.

## Remaining external integration

- [ ] Connect the fulfillment queue to the Minecraft server. The server plugin/API details are not available yet, so the app does not send commands or claim that rewards have been delivered. Paid items remain queued until an admin updates their status.

### Proposed plugin contract

- A server-side worker should claim only `queued` entries for paid orders, transition them to `processing`, and acknowledge each `order_item_id` at most once.
- Deliver the product identified by `product_id` to the order's validated `minecraft_username`; use the order item ID as the idempotency key so retries cannot grant duplicate rewards.
- Authenticate worker requests with a server-held secret or signed requests. Never expose the Supabase service-role key or Razorpay credentials to a game client or plugin distributed to players.
- On success, mark the queue entry `delivered`; on a retryable failure, record the error and retry with a bounded backoff; leave permanent failures visible for admin resolution.
- Before implementing the adapter, choose the plugin platform (for example Paper/Spigot or a proxy), reward-command format, and secure connectivity method.
