# Deploying to Cloudflare Workers

This project builds a Cloudflare Worker with Nitro. Use Cloudflare Workers
Builds connected to the Git repository, or deploy from a local terminal with
Wrangler.

## Connect the repository

1. In Cloudflare, create a Worker using **Workers Builds** and connect this
   repository.
2. Set the project root to `/`.
3. Select Bun as the package manager, use `bun run build` as the build command,
   and `bunx wrangler deploy --config wrangler.jsonc` as the deploy command.
4. Add the public Supabase settings below to the build environment before the
   first deployment.
5. Add the runtime variables and secrets in the Worker's **Settings →
   Variables and Secrets**. Do not put private credentials in build variables.

The root `wrangler.jsonc` points Wrangler to Nitro's generated Worker entry and
static assets. It enables Node.js compatibility for server-side dependencies
and preserves variables added in the Cloudflare dashboard on later deploys.
The Worker entry passes Cloudflare's request-scoped `env` bindings to server
code; local development continues to read server values from `.env`.

## Build variables

These `VITE_` settings are included in the browser bundle by Vite. They are
public configuration, not secrets. Add them to the Cloudflare build
environment, then rebuild and deploy after changing them:

| Name                     | Value                         |
| ------------------------ | ----------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL          |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

Never use a Supabase service-role key as the anon key.

## Worker variables

Add these under the Worker’s **Settings → Variables and Secrets → Variables**:

| Name                              | Required           | Purpose                                          |
| --------------------------------- | ------------------ | ------------------------------------------------ |
| `MERCHANT_UPI_ID`                 | Yes                | UPI destination used to create payment requests  |
| `GOOGLE_OAUTH_CLIENT_ID`          | For Gmail scanning | Google OAuth client ID                           |
| `GMAIL_ACCOUNT_EMAIL`             | For Gmail scanning | Mailbox authorized by the refresh token          |
| `FAMPAY_NOTIFICATION_DKIM_DOMAIN` | Optional           | Domain used when parsing authentication metadata |

## Worker secrets

Add these under **Settings → Variables and Secrets → Secrets**. Keep each value
server-side; never add a `VITE_` prefix:

| Name                         | Required           | Purpose                                |
| ---------------------------- | ------------------ | -------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`  | Yes                | Privileged server-side database access |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For Gmail scanning | Google OAuth client secret             |
| `GMAIL_REFRESH_TOKEN`        | For Gmail scanning | Authorized Gmail mailbox access        |
| `MINECRAFT_PLUGIN_TOKEN`     | For game delivery  | Shared secret used by the Paper plugin |

The Gmail and Minecraft integrations are optional if you are not using those
features. Keep `MINECRAFT_PLUGIN_TOKEN` identical to the Paper plugin's token.
Never place the Supabase service-role key in the Minecraft server or plugin.

## Admin environment editor

The admin dashboard can add or replace runtime Worker bindings for the
`craft-smp-store` Worker. To use it, provide the Cloudflare account ID and an
API token with the narrowest available **Workers Scripts Write** permission.
The token is sent to the server only for the requested update, held in page
memory, and not saved by the app. Do not use this editor on a production site
unless you trust every admin account and have restricted the Cloudflare token
to this Worker where possible.

Cloudflare does not reveal existing secret values. Enter a new value to add or
replace a binding; the editor cannot display or recover the current secret.
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are also compiled into the
browser bundle, so updating their Worker bindings does not change the deployed
client bundle. Update the Workers Builds build variables and rebuild to change
the client-side Supabase configuration.

## Deploy and verify

The repository includes Wrangler as a development dependency. From a local
terminal, run:

```sh
bun run deploy:cloudflare
```

For a local Cloudflare runtime preview, first copy `.dev.vars.example` to
`.dev.vars` and enter local server values. Keep `.dev.vars` private; Git ignores
it. Set the public Supabase build values in `.env`, then run:

```sh
bun run preview:cloudflare
```

Confirm the homepage, checkout, sign-in, and admin routes load after deployment.
Also verify that Supabase authentication redirects use the deployed site URL,
that the site URL is listed in Supabase's allowed redirect URLs, and that the
Minecraft plugin is configured with the deployed HTTPS URL.

Do not rely on `process.env` for deployed Worker configuration. Add server
variables and secrets as Worker bindings under **Settings → Variables and
Secrets**, or use Wrangler to set secrets. For example:

```sh
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.jsonc
bunx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --config wrangler.jsonc
bunx wrangler secret put GMAIL_REFRESH_TOKEN --config wrangler.jsonc
bunx wrangler secret put MINECRAFT_PLUGIN_TOKEN --config wrangler.jsonc
```

After adding or changing bindings, redeploy the Worker (for a Workers Builds
deployment, trigger a new deployment). Gmail scanning still needs the Gmail
API/OAuth setup, and reward delivery requires the Paper plugin to be installed
and running.
