# Craft Store Delivery plugin

This Paper plugin checks for paid store orders when a Minecraft player joins,
runs the product's configured console command templates, and acknowledges each
delivered order item to the store. An order becomes `completed` only after all
its queue entries are acknowledged as delivered.

## Requirements

- Paper 26.3 and Java 25.
- LuckPerms and/or ExcellentCrates installed for the configured commands.
- The store web app deployed over HTTPS with the Minecraft delivery migrations
  applied.

## Configure product rewards

In the admin product editor, enter one console command per line. Every command
must include `{player}`. Supported placeholders are `{player}`, `{quantity}`,
`{order_id}`, and `{item_id}`. The admin editor only accepts letters, numbers,
spaces, dots, colons, underscores, braces, and hyphens. Do not prefix commands
with `/`.

For example, use the exact command syntax supported by your installed plugin:

```text
lp user {player} parent set bee
```

Products without a delivery command cannot be purchased. Commands are copied
onto the order item at checkout, so editing a product later does not change
existing orders.

## Build and install

From this directory, build the plugin jar:

```powershell
gradle build
```

Copy `build/libs/craft-store-delivery-1.0.0.jar` into the Paper server's
`plugins` directory and start the server once. Edit
`plugins/CraftStoreDelivery/config.yml`:

```yaml
store:
  api-url: "https://your-deployed-store.example"
  token: "the-same-random-secret-as-MINECRAFT_PLUGIN_TOKEN"
  request-timeout-seconds: 10
  join-delay-ticks: 20
  payment-scan-cooldown-seconds: 300

announcements:
  purchase-message:
    - "&8&m----------------------------------------"
    - "&6&lSTORE &8> &e{player} &fbought"
    - "&a&l{quantity}x {item}"
    - "&8&m----------------------------------------"
```

Each configured purchase-message line is broadcast to everyone after the
player's store reward commands succeed. Use `{player}` for the buyer's username,
`{item}` for the product name, and `{quantity}` for the purchased quantity.
Minecraft `&` color codes are supported. Set the list to `[]` to disable
purchase announcements.

Set `MINECRAFT_PLUGIN_TOKEN` in the store's server-only environment to the same
strong random secret. Never commit or share that token, and do not put the
service-role key in the plugin. Restart the web app and Paper after setting the
secret.

The plugin reports the server's online player count and capacity to the store
on startup, every 60 seconds, and when players join or leave. The homepage
considers status stale after three minutes without a heartbeat. Apply the
server-status migration with `supabase db push` before enabling this feature.

When a player joins, the plugin asks the store to scan Gmail. Scans are
rate-limited by `payment-scan-cooldown-seconds` (300 seconds by default), so a
busy server does not repeatedly scan Gmail for every joining player. No Gmail
scan is scheduled while the server is idle. Each email from `no-reply@famapp.in`
is assigned to the newest pending order created before the email. Message
content, sender authenticity, order ID, amount, and transaction reference are
not independently verified. Confirm the transfer in the payment provider
before relying on the order status. Matching emails first mark the order
`paid`; the plugin delivers rewards on the player's next join and then the
order becomes `completed`.

## Delivery failure handling

Commands run as the server console on the main server thread. A queue entry
that fails is marked failed for admin inspection and is not automatically
retried, which avoids accidentally duplicating item grants. Ensure commands
are correct and test them on a non-production server before selling a product.
