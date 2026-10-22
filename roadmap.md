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
- [x] Server-priced UPI payment intents and unique expiring orders
- [x] Manual UPI reconciliation with admin identity, decision reason, and transaction deduplication
- [x] Admin-triggered Gmail evidence ingestion using Gmail history cursors; email does not mark orders paid
- [x] Only manually reconciled orders create idempotent reward-fulfillment queue entries

## Setup required before production use

1. Copy `.env.example` to `.env` and configure the Supabase URL, anon key, service-role key, and merchant UPI ID. Gmail OAuth is optional for UPI checkout; until configured, use the bank/merchant records for manual reconciliation. The merchant VPA, Google OAuth client secret, Gmail refresh token, and service-role key must remain server-only. A Google API key is not sufficient for private Gmail access.
2. If `supabase/config.toml` does not exist yet, initialize the CLI with `supabase init`; then link the project with `supabase link --project-ref <project-ref>` and apply all migrations with `supabase db push`. Migrations seed the product catalog, upgrade an existing USD/PayPal schema and convert product/order values at the fixed ₹83/USD rate, replace sample ranks, and configure the public product image bucket with admin-only uploads.
3. Enable email/password, Google, and Discord providers in Supabase Authentication. Add the local app URL (`http://localhost:8080/**`) to the allowed redirect URLs, and configure each OAuth provider to use Supabase's `/auth/v1/callback` URL.
4. Promote the first admin account in the Supabase SQL editor after it has signed up:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@example.com');
   ```

5. Open `/admin` and set prices for the Bee, Fox, Parrot, and Wolf products before accepting purchases. Ranks without a price remain visible as "Price to be set" and cannot be added to the cart or purchased.
6. To configure Gmail-assisted evidence collection:
   - In Google Cloud Console, create/select a project, enable the Gmail API, configure the OAuth consent screen, and add the mailbox account as a test user while the app is in testing.
   - Create an OAuth 2.0 client ID and client secret. In Google's OAuth 2.0 Playground, enable its option to use your own OAuth credentials, enter that client ID/secret, authorize only `https://www.googleapis.com/auth/gmail.readonly`, exchange the authorization code, and copy the refresh token. A Google API key alone cannot authorize access to private Gmail.
   - Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `GMAIL_ACCOUNT_EMAIL` in the server environment only. Never use a `VITE_` prefix for these values.
   - Set `FAMPAY_NOTIFICATION_SENDER` and `FAMPAY_NOTIFICATION_DKIM_DOMAIN` from the original message's full Gmail headers, not a screenshot or a visible From name. The configured DKIM check is an evidence-quality signal, not proof of payment.
   - Gmail's `gmail.readonly` scope is restricted. Complete Google's applicable OAuth app verification and security assessment requirements before production use; review current Google policies for the app's publishing status.
7. The first admin Gmail scan only establishes a history cursor; later admin-triggered scans import new emails as manual-review evidence. Gmail notifications and user-submitted UTRs are not authoritative settlement proof and never mark orders paid. Independently reconcile every payment in the bank/merchant records before approving it.
   - If Gmail reports an expired history cursor, do not silently reset it; reconcile the missed inbox interval manually before reinitializing the cursor.
8. UPI expiry controls how long a payment intent is offered. Do not pay an expired request. An admin may reconcile a late-submitted claim only when independent bank/merchant records show the exact amount and transaction settled during that order's validity window.
9. Restart the app after changing environment variables. Without Supabase and a merchant UPI ID, checkout is unavailable.

## Remaining external integration

- [ ] Connect the fulfillment queue to the Minecraft server. The server's existing permissions/rank plugin and reward delivery contract are not identified yet, so the app does not send commands or claim that rewards have been delivered.

### Proposed plugin contract

- A server-side worker should claim only `queued` entries for paid orders, transition them to `processing`, and acknowledge each `order_item_id` at most once.
- Deliver the product identified by `product_id` to the order's validated `minecraft_username`; use the order item ID as the idempotency key so retries cannot grant duplicate rewards.
- Connect the reward queue to the actual Minecraft rank/permissions plugin and server-side worker. The provided perk list describes ranks but does not specify the server's plugin API or permission groups. Never expose service-role keys, Google OAuth credentials, or worker secrets to a game client or plugin distributed to players.
- On success, mark the queue entry `delivered`; on a retryable failure, record the error and retry with a bounded backoff; leave permanent failures visible for admin resolution.
- Before implementing the Paper 26.3 adapter, identify the permission/rank plugin, exact rank group IDs, purchase reward rules, and a secure server-to-app connectivity method. Do not execute commands supplied by a player, payment email, or UTR.

## Payment verification boundary

- A UPI intent/QR only pre-fills a payment request; it is not a FamApp merchant API and does not confirm settlement.
- Gmail integration is an admin-triggered, incremental evidence collector. It stores message identifiers and parsed metadata, not message bodies, and requires a passing configured DKIM result to improve evidence quality.
- Emails, sender headers, DKIM, transaction IDs, UTRs, and screenshots can be spoofed or duplicated and are never sufficient by themselves to mark an order paid. Approval requires an admin to independently reconcile the exact amount and transaction reference against bank/merchant records.
- FamApp/FamPay official merchant verification/API access has not been established. Do not enable automatic settlement claims without an official, supported provider verification interface.
