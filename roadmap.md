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
- [x] Public voting page with admin-managed, enable/disable voting sites
- [x] Supabase row-level security for customer data and admin-only management
- [x] INR pricing stored in paise, with legacy USD prices converted at ₹83/USD and rounded to whole rupees
- [x] Custom Bee, Fox, Parrot, and Wolf ranks with their supplied perks; unpriced ranks are visible but not purchasable
- [x] Server-priced UPI payment intents and unique expiring orders
- [x] Gmail notification processing for the configured sender; an eligible notification is assigned to the newest pending order created before it
- [x] Admin order-status editing with an audit trail and fulfillment queueing when marked paid
- [x] Paper delivery plugin claims paid rewards on player join and completes orders after delivery acknowledgement
- [x] Admin product editor supports safe per-product console command templates snapshotted into order items

## Setup required before production use

For Cloudflare Workers hosting, configure the repository using the steps in
[`CLOUDFLARE.md`](./CLOUDFLARE.md). Add public Supabase settings to the build
environment and server credentials to Worker Variables and Secrets.

1. Copy `.env.example` to `.env` and configure the Supabase URL, anon key, service-role key, and merchant UPI ID. Gmail OAuth is optional for UPI checkout; automatic Gmail matching is unavailable until Gmail is configured. The merchant VPA, Google OAuth client secret, Gmail refresh token, and service-role key must remain server-only. A Google API key is not sufficient for private Gmail access.
2. If `supabase/config.toml` does not exist yet, initialize the CLI with `supabase init`; then link the project with `supabase link --project-ref <project-ref>` and apply all migrations with `supabase db push`. Migrations seed the product catalog, upgrade an existing USD/PayPal schema and convert product/order values at the fixed ₹83/USD rate, replace sample ranks, and configure the public product image bucket with admin-only uploads.
3. Enable email/password, Google, and Discord providers in Supabase Authentication. Add the local app URL (`http://localhost:8080/**`) to the allowed redirect URLs, and configure each OAuth provider to use Supabase's `/auth/v1/callback` URL.
4. Promote the first admin account in the Supabase SQL editor after it has signed up:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@example.com');
   ```

5. Open `/admin` and set prices for the Bee, Fox, Parrot, and Wolf products before accepting purchases. Ranks without a price remain visible as "Price to be set" and cannot be added to the cart or purchased.
6. To configure Gmail payment-notification processing:
   - In Google Cloud Console, create/select a project, enable the Gmail API, configure the OAuth consent screen, and add the mailbox account as a test user while the app is in testing.
   - Create an OAuth 2.0 client ID and client secret. In Google's OAuth 2.0 Playground, enable its option to use your own OAuth credentials, enter that client ID/secret, authorize only `https://www.googleapis.com/auth/gmail.readonly`, exchange the authorization code, and copy the refresh token. A Google API key alone cannot authorize access to private Gmail.
   - Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `GMAIL_ACCOUNT_EMAIL` in the server environment only. `GMAIL_ACCOUNT_EMAIL` must exactly match the mailbox used to authorize the refresh token. Never use a `VITE_` prefix for these values.
   - Gmail scanning processes messages from `no-reply@famapp.in`. Set `FAMPAY_NOTIFICATION_DKIM_DOMAIN` only if you want authentication details included in parsed notification metadata; they are not used to assign orders.
   - Gmail's `gmail.readonly` scope is restricted. Complete Google's applicable OAuth app verification and security assessment requirements before production use; review current Google policies for the app's publishing status.
7. The first Gmail scan imports recent notifications and saves a history cursor for later scans. The Paper plugin scans every 30 seconds while online; checkout also requests a scan while a pending order is open, and admins can scan manually. An email from `no-reply@famapp.in` is assigned to the newest pending order created before its received time. The assignment does not check message content, authentication, order ID, amount, or transaction reference. It is not confirmation of settlement by the payment provider; independently verify every transfer before relying on an order's paid status.
   - If Gmail reports an expired history cursor, do not silently reset it; reconcile the missed inbox interval manually before reinitializing the cursor.
8. UPI expiry controls how long a payment intent is offered. Do not pay an expired request. Admins can change an order's status from order history; marking an order paid queues its rewards.
9. Restart the app after changing environment variables. Without Supabase and a merchant UPI ID, checkout is unavailable.

## Minecraft delivery setup

1. Apply `20261023030000_completed_order_status.sql`, `20261023040000_minecraft_delivery.sql`, and `20261023050000_gmail_sender_only_auto_approval.sql` after the previous migrations.
2. Set a strong random `MINECRAFT_PLUGIN_TOKEN` in the deployed web app's server-only environment. Use the same value in the Paper plugin's `plugins/CraftStoreDelivery/config.yml`. Do not use or expose the Supabase service-role key in the plugin.
3. Build/install the plugin from `minecraft-plugin/README.md`. Configure the public HTTPS store URL and keep the shared token private in the Paper server's plugin config.
4. Edit each enabled, priced product in `/admin` and add one console command per line. Every command must contain `{player}` and may also use `{quantity}`, `{order_id}`, and `{item_id}`. Test command syntax with LuckPerms/ExcellentCrates on a staging server before selling.
5. An email from the configured FamApp sender assigns the newest pending order created before the email to `paid`; rewards are delivered on that player's next join. The order becomes `completed` only after all queue entries are acknowledged. Failed entries remain visible for admin inspection and are not automatically retried.

The Paper plugin scans Gmail every 30 seconds while the game server is online. Email assignment does not validate message content, order ID, amount, sender authenticity, or transaction reference, and it does not confirm settlement with a payment provider. Confirm each transfer independently. An assigned email marks the order paid, not completed; completion waits for server delivery.

### Proposed plugin contract

- A server-side worker should claim only `queued` entries for paid orders, transition them to `processing`, and acknowledge each `order_item_id` at most once.
- Deliver the product identified by `product_id` to the order's validated `minecraft_username`; use the order item ID as the idempotency key so retries cannot grant duplicate rewards.
- Configure real reward commands for each product and test the Paper plugin against the live server, LuckPerms, and ExcellentCrates. The plugin source is a starting integration and must be tested with the exact server and command versions before production use. Never expose service-role keys, Google OAuth credentials, or worker secrets to a game client or plugin distributed to players.
- On success, mark the queue entry `delivered`; on a retryable failure, record the error and retry with a bounded backoff; leave permanent failures visible for admin resolution.
- Use only admin-configured product commands with validated Minecraft usernames and server-side plugin authentication. Never execute commands supplied by a player, payment email, or UTR.

## Payment verification boundary

- A UPI intent/QR only pre-fills a payment request; it is not a FamApp merchant API and does not confirm settlement.
- Gmail integration is scanned every 30 seconds by the Paper server and stores message identifiers and parsed metadata, not message bodies. Every email from `no-reply@famapp.in` is assigned to the newest pending order created before it; content, authentication, order ID, amount, and transaction reference are not checked.
- Email assignment is not authoritative settlement verification: sender addresses can be spoofed, unrelated or duplicate emails can mark unintended orders paid, and UPI QR/intents do not confirm that funds settled. Confirm transfers independently and use a supported provider verification interface before relying on automated settlement in production.
- FamApp/FamPay official merchant verification/API access has not been established. Use a supported provider verification interface before relying on automated payment settlement in production.
