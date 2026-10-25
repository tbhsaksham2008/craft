# Craft SMP Store plugins

This project builds two alternative Paper plugin jars from the same tested
delivery implementation:

- **CraftStoreDelivery** delivers paid store rewards and does not report server
  status.
- **CraftStoreStatusDelivery** does the same delivery work and also reports
  online player counts to the store website.

Install exactly one jar on a server. Both connect to the same order queue, so
running both would duplicate polling and status updates. Both deliver rewards
when players join and periodically check players who remain online.

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

From this directory, build both plugin jars:

```powershell
gradle build
gradle deliveryOnlyJar
```

The outputs are:

- `build/libs/craft-store-delivery-1.0.0.jar`
- `build/libs/craft-store-status-delivery-1.0.0.jar`

Choose one jar and copy it into the Paper server's `plugins` directory. Start
the server once, then edit the generated `config.yml` in the matching plugin
folder (`plugins/CraftStoreDelivery/` or
`plugins/CraftStoreStatusDelivery/`):

```yaml
store:
  api-url: "https://your-deployed-store.example"
  token: "the-same-random-secret-as-MINECRAFT_PLUGIN_TOKEN"
  request-timeout-seconds: 10
  join-delay-ticks: 20
  online-delivery-poll-seconds: 60
  payment-scan-cooldown-seconds: 300

status:
  enabled: true

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

The delivery-only jar sets `status.enabled: false`; the status+delivery jar
sets it to `true`. Do not change this setting unless you intend to change the
selected jar's features. `online-delivery-poll-seconds` controls how often
online players are checked for newly paid rewards (minimum 10 seconds).

Set `MINECRAFT_PLUGIN_TOKEN` in the store's server-only environment to the same
strong random secret. Never commit or share that token, and do not put the
service-role key in the plugin. Restart the web app and Paper after setting the
secret.

The status+delivery plugin reports the server's online player count and
capacity to the store on startup, every 60 seconds, and when players join or
leave. The homepage considers status stale after three minutes without a
heartbeat. Apply the server-status migration before enabling this feature.

When players are online, the plugin periodically asks the store to scan Gmail
and then checks the online players for paid orders. Scans are rate-limited by
`payment-scan-cooldown-seconds` (300 seconds by default), so busy servers do not
repeatedly scan Gmail. No periodic scan is made while the server is idle; a
scan is triggered when a player joins. Each email from
`no-reply@famapp.in` is assigned to the newest pending order created before the
email. Message content, sender authenticity, order ID, amount, and transaction
reference are not independently verified. Confirm the transfer in the payment
provider before relying on the order status. Matching emails mark the order
`paid`; an online player receives their reward on the next poll without
rejoining, and the order becomes `completed` after successful delivery.

## Bedrock / Geyser usernames

Checkout and delivery accept Java names and Geyser/Floodgate names that include
the server's configured Bedrock prefix. If your Geyser prefix is `.`, enter the
Bedrock player's name with that leading dot (for example `.saksham`). Configure
the same prefix in Geyser/Floodgate and use the exact Bukkit player name in
store orders; reward commands receive that name through `{player}`.

## Delivery failure handling

Commands run as the server console on the main server thread. A queue entry
that fails is marked failed for admin inspection and is not automatically
retried, which avoids accidentally duplicating item grants. Ensure commands
are correct and test them on a non-production server before selling a product.
