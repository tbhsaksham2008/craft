alter table public.products
  drop constraint if exists products_price_paise_check;

update public.products
set enabled = false
where category = 'ranks'
  and id in ('vip', 'vip-plus', 'mvp', 'mvp-plus', 'elite', 'legend');

alter table public.products
  add constraint products_price_paise_check check (
    price_paise between 0 and 10000000
  );

insert into public.products (
  id, name, category, price_paise, original_price_paise, description, perks,
  image_key, featured, enabled, single, tint
) values
  (
    'bee', 'Bee', 'ranks', 0, null,
    'Permanent Bee rank perks and commands for Craft SMP.',
    array[
      '[Bee] tag in chat, TAB, and nametag', 'Bee role on Discord',
      'Yellow colored name and nametag', '5 sethomes', '10 player shops',
      '2 particle effects', '2 particle styles', '4 chat emojis',
      '4 player holograms', '2 lines per hologram', '1 particle active at a time',
      '1 player glow color', '5 player warps', '12 shop stock pages',
      'Add a colored glow to your player', 'Send in-game messages from Discord',
      'Keep inventory on death',
      '/feed — fully replenish hunger (15m cooldown)',
      '/sit — makes your player sit on the ground',
      '/craft — opens a portable crafting bench', '/loom — opens a portable loom',
      '/nickname — changes your username in chat',
      '/keepinv-on/off — turns keep inventory on or off',
      '/particles — opens the particles menu', '/glow — opens the glow colors menu',
      '/emojis — shows your available emojis', 'Purchase reward: 32 Emeralds',
      'Purchase reward: 5 XP Levels'
    ],
    'rank', false, false, true, 'sky'
  ),
  (
    'fox', 'Fox', 'ranks', 0, null,
    'Permanent Fox rank perks and commands for Craft SMP.',
    array[
      '[Fox] tag in chat, TAB, and nametag', 'Fox role on Discord',
      'Orange colored name and nametag', '10 sethomes', '15 player shops',
      '6 particle effects', '6 particle styles', '7 chat emojis',
      '8 player holograms', '3 lines per hologram', '1 particle active at a time',
      '3 player glow colors', '10 player warps', '15 shop stock pages',
      'Add a colored or blinking glow to your player',
      'Send in-game messages from Discord', 'Keep inventory on death',
      'Create signs with colorful text (& and RGB colors)',
      '/feed — fully replenish hunger (15m cooldown)',
      '/sit — makes your player sit on the ground',
      '/craft — opens a portable crafting bench', '/loom — opens a portable loom',
      '/nickname — changes your username in chat',
      '/keepinv-on/off — turns keep inventory on or off',
      '/particles — opens the particles menu', '/glow — opens the glow colors menu',
      '/emojis — shows your available emojis',
      '/grindstone — opens a portable grindstone',
      '/hat — puts any selected block onto your head',
      '/bellyflop — makes your player do a bellyflop',
      '/disposal — opens a portable trash can', '/near — shows nearby players',
      '/unenchant — removes a specific enchantment',
      'Purchase reward: 64 Emeralds', 'Purchase reward: 10 XP Levels'
    ],
    'rank', false, false, true, 'lilac'
  ),
  (
    'parrot', 'Parrot', 'ranks', 0, null,
    'Permanent Parrot rank perks and commands for Craft SMP.',
    array[
      '[Parrot] tag in chat, TAB, and nametag', 'Parrot role on Discord',
      'Pink colored name and nametag', '20 sethomes', '35 player shops',
      '12 particle effects', '12 particle styles', '15 chat emojis',
      '14 player holograms', '4 lines per hologram', '2 particles active at a time',
      '6 player glow colors', '8 custom glow effects', '20 player warps',
      '20 shop stock pages',
      '10 land claim flags: InfiniteArrows, NoCombatLoot, NoElytra, NoEnterPlayer, NoFireSpread, NoMobDamage, NoMobSpawns, NoSnowForm, NoAnvilDamage, NoBlockForm',
      'Add a colored or blinking glow to your player', 'Change hologram text size',
      'Send in-game messages from Discord', 'Keep inventory on death',
      'Keep XP levels on death', 'Send colored messages in chat',
      'Create signs with colorful text', 'Enable warp visit notifications',
      'Shop virtually at player shops',
      '/feed — fully replenish hunger (15m cooldown)',
      '/sit — makes your player sit on the ground',
      '/craft — opens a portable crafting bench', '/loom — opens a portable loom',
      '/nickname — changes your name in chat',
      '/keepinv-on/off — turns keep inventory on or off',
      '/particles — opens the particles menu', '/glow — opens the glow colors menu',
      '/emojis — shows your available emojis',
      '/grindstone — opens a portable grindstone',
      '/hat — puts any selected block onto your head',
      '/bellyflop — makes your player do a bellyflop',
      '/disposal — opens a portable trash can', '/near — shows nearby players',
      '/unenchant — removes a specific enchantment',
      '/setclaimflag — adds a special flag to your land claim',
      '/smithingtable — opens a portable smithing table',
      '/cartographytable — opens a portable cartography table',
      '/heal — fully replenish hunger and health (15m cooldown)',
      '/thru — teleports through the block or wall you are looking at',
      '/enderchest — opens a portable ender chest',
      '/crawl — makes your player start crawling on the ground',
      '/condense — converts uncondensed items into blocks',
      '/jump — teleports you where you are looking (30s cooldown)',
      '/warpnotifyvisit-on|off — toggles warp visit notifications',
      'Purchase reward: 5,000 Claim Blocks', 'Purchase reward: 1 Diamond Key',
      'Purchase reward: 20 XP Levels'
    ],
    'rank', false, false, true, 'lavender'
  ),
  (
    'wolf', 'Wolf', 'ranks', 0, null,
    'Permanent Wolf rank perks and commands for Craft SMP.',
    array[
      '[Wolf] tag in chat, TAB, and nametag', 'Wolf role on Discord',
      'Blue colored name and nametag', 'Unlimited sethomes',
      'Unlimited player shops', 'All particle effects', 'All particle styles',
      'All chat emojis', '20 player holograms', '6 lines per hologram',
      '3 particles active at a time', 'All player glow colors',
      '30 custom glow effects', '30 player warps', '25 shop stock pages',
      '42 land claim flags: InfiniteArrows, NoCombatLoot, NoElytra, NoEnterPlayer, NoFireSpread, NoItemPickup, NoMobDamage, NoMobSpawns, NoSnowForm, NoAnvilDamage, NoBlockForm, AllowPvP, KeepInventory, KeepLevel, ChangeBiome, ExitMessage, NoBlockGravity, NoBlockSpread, NoChorusFruit, NoEnderPearl, NoExplosionDamage, NoFallDamage, NoFireDamage, NoFlight, NoFluidFlow, NoGrowth, NoIceForm, NoItemDrop, NoLeafDecay, NoOpenDoors, NoPetDamage, NotifyEnter, ProtectNamedMobs, ExitActionbar, EnterActionbar, NoBlockFade, PlayerTime, PlayerWeather, NotifyExit, NoCoralDeath, NoCropTrampling, NoMonsterSpawns',
      'Add a colored, blinking, or rainbow glow to your player',
      'Change hologram text size', 'Send in-game messages from Discord',
      'Land claims never expire', 'Keep inventory on death',
      'Keep XP levels on death', 'Send colored messages in chat',
      'Create signs with colorful text', 'Enable warp visit notifications',
      'Pick up spawners with Silk Touch (12h cooldown)',
      'Bypass random teleport cooldown', 'Shop virtually at player shops',
      '/feed — fully replenish hunger (15m cooldown)',
      '/itemname — rename a held item with colors and effects (&0-9, &a-f)',
      '/sit — makes your player sit on the ground',
      '/craft — opens a portable crafting bench from anywhere',
      '/loom — opens a portable loom from anywhere',
      '/nickname — changes your username in chat',
      '/keepinv-on/off — turns keep inventory on or off',
      '/particles — choose from 50+ different particles',
      '/glow — apply a colorful glow to your player',
      '/emojis — shows your available emojis',
      '/grindstone — opens a portable grindstone from anywhere',
      '/hat — puts any selected block onto your head',
      '/bellyflop — makes your player do a bellyflop',
      '/disposal — opens a portable trash can', '/near — shows nearby players',
      '/unenchant — removes a specific enchantment',
      '/setclaimflag — adds a special flag to your land claim',
      '/smithingtable — opens a portable smithing table from anywhere',
      '/cartographytable — opens a portable cartography table from anywhere',
      '/heal — fully replenish hunger and health (15m cooldown)',
      '/thru — teleports through the block or wall you are looking at',
      '/enderchest — opens a portable ender chest from anywhere',
      '/crawl — makes your player start crawling on the ground',
      '/lay — makes your player lay on the ground',
      '/condense — converts uncondensed items in your inventory into blocks',
      '/jump — teleports you where you are looking (30s cooldown)',
      '/warpnotifyvisit-on|off — toggles warp visit notifications',
      '/tptoggle — toggles teleport requests from other players',
      '/anvil — opens a portable anvil from anywhere',
      '/stonecutter — opens a portable stonecutter from anywhere',
      '/ptime — changes the time for your player',
      '/firework — creates fireworks with custom trails, effects, and powers',
      '/beezooka — throws an exploding bee where you are looking',
      '/skull — spawns a player head as wearable item (4h cooldown)',
      '/repair — fully repairs item durability (12h cooldown)',
      '/seen — checks when a player was last online',
      'Purchase reward: 8,000 Claim Blocks', 'Purchase reward: 1 Emerald Key',
      'Purchase reward: 40 XP Levels'
    ],
    'rank', false, false, true, 'primary'
  )
on conflict (id) do update
set name = excluded.name,
    category = excluded.category,
    price_paise = excluded.price_paise,
    original_price_paise = excluded.original_price_paise,
    description = excluded.description,
    perks = excluded.perks,
    image_key = excluded.image_key,
    featured = excluded.featured,
    enabled = excluded.enabled,
    single = excluded.single,
    tint = excluded.tint,
    updated_at = now();

update public.products
set enabled = true
where id in ('bee', 'fox', 'parrot', 'wolf');
