import rankImg from "@/assets/rank.png";
import coinsImg from "@/assets/coins.png";
import crateImg from "@/assets/crate.png";

export type Category = "ranks" | "coins" | "crates" | "bundles" | "cosmetics";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  originalPrice?: number | undefined;
  description: string;
  perks: string[];
  image: string;
  featured?: boolean | undefined;
  enabled: boolean;
  /** Only one per cart (e.g. ranks are permanent). */
  single?: boolean | undefined;
  tint: "sky" | "lilac" | "blush" | "lavender" | "primary";
}

export const USD_TO_INR_RATE = 83;
export const convertUsdToRupees = (usd: number) =>
  Math.round(usd * USD_TO_INR_RATE);

export const productImages = {
  rank: rankImg,
  coins: coinsImg,
  crate: crateImg,
} as const;

export type ProductRecord = Omit<
  Product,
  "price" | "originalPrice" | "image"
> & {
  price_paise: number;
  original_price_paise: number | null;
  image_key: keyof typeof productImages;
  image_url: string | null;
};

export const productFromRecord = (record: ProductRecord): Product => ({
  id: record.id,
  name: record.name,
  category: record.category,
  price: record.price_paise / 100,
  originalPrice:
    record.original_price_paise == null
      ? undefined
      : record.original_price_paise / 100,
  description: record.description,
  perks: record.perks,
  image: record.image_url || productImages[record.image_key],
  featured: record.featured,
  enabled: record.enabled,
  single: record.single,
  tint: record.tint,
});

export const categories: {
  id: Category;
  label: string;
  path: string;
  blurb: string;
  image: string;
}[] = [
  {
    id: "ranks",
    label: "Ranks",
    path: "/ranks",
    blurb: "Permanent perks & prestige",
    image: rankImg,
  },
  {
    id: "coins",
    label: "Coins",
    path: "/coins",
    blurb: "In-game currency packs",
    image: coinsImg,
  },
  {
    id: "crates",
    label: "Crate Keys",
    path: "/crates",
    blurb: "Unlock rare loot",
    image: crateImg,
  },
  {
    id: "bundles",
    label: "Crate Bundles",
    path: "/bundles",
    blurb: "More keys, better value",
    image: crateImg,
  },
  {
    id: "cosmetics",
    label: "Cosmetics",
    path: "/cosmetics",
    blurb: "Trails, tags & flair",
    image: rankImg,
  },
];

const rank = (
  id: string,
  name: string,
  perks: string[],
  tint: Product["tint"],
): Product => ({
  id,
  name,
  category: "ranks",
  price: 0,
  perks,
  tint,
  image: rankImg,
  enabled: true,
  single: true,
  description: `Permanent ${name} rank perks and commands for Craft SMP.`,
});

export const products: Product[] = [
  rank(
    "bee",
    "Bee",
    [
      "[Bee] tag in chat, TAB, and nametag",
      "Bee role on Discord",
      "Yellow colored name and nametag",
      "5 sethomes",
      "10 player shops",
      "2 particle effects",
      "2 particle styles",
      "4 chat emojis",
      "4 player holograms",
      "2 lines per hologram",
      "1 particle active at a time",
      "1 player glow color",
      "5 player warps",
      "12 shop stock pages",
      "Add a colored glow to your player",
      "Send in-game messages from Discord",
      "Keep inventory on death",
      "Command: /feed — fully replenish hunger (15m cooldown)",
      "Command: /sit — makes your player sit on the ground",
      "Command: /craft — opens a portable crafting bench",
      "Command: /loom — opens a portable loom",
      "Command: /nickname — changes your username in chat",
      "Command: /keepinv-on/off — turns keep inventory on or off",
      "Command: /particles — opens the particles menu",
      "Command: /glow — opens the glow colors menu",
      "Command: /emojis — shows your available emojis",
      "Purchase reward: 32 Emeralds",
      "Purchase reward: 5 XP Levels",
    ],
    "sky",
  ),
  rank(
    "fox",
    "Fox",
    [
      "[Fox] tag in chat, TAB, and nametag",
      "Fox role on Discord",
      "Orange colored name and nametag",
      "10 sethomes",
      "15 player shops",
      "6 particle effects",
      "6 particle styles",
      "7 chat emojis",
      "8 player holograms",
      "3 lines per hologram",
      "1 particle active at a time",
      "3 player glow colors",
      "10 player warps",
      "15 shop stock pages",
      "Add a colored or blinking glow to your player",
      "Send in-game messages from Discord",
      "Keep inventory on death",
      "Create signs with colorful text (& and RGB colors)",
      "Command: /feed — fully replenish hunger (15m cooldown)",
      "Command: /sit — makes your player sit on the ground",
      "Command: /craft — opens a portable crafting bench",
      "Command: /loom — opens a portable loom",
      "Command: /nickname — changes your username in chat",
      "Command: /keepinv-on/off — turns keep inventory on or off",
      "Command: /particles — opens the particles menu",
      "Command: /glow — opens the glow colors menu",
      "Command: /emojis — shows your available emojis",
      "Command: /grindstone — opens a portable grindstone",
      "Command: /hat — puts a selected block onto your head",
      "Command: /bellyflop — makes your player do a bellyflop",
      "Command: /disposal — opens a portable trash can",
      "Command: /near — shows nearby players",
      "Command: /unenchant — removes a specific enchantment",
      "Purchase reward: 64 Emeralds",
      "Purchase reward: 10 XP Levels",
    ],
    "lilac",
  ),
  rank(
    "parrot",
    "Parrot",
    [
      "[Parrot] tag in chat, TAB, and nametag",
      "Parrot role on Discord",
      "Pink colored name and nametag",
      "20 sethomes",
      "35 player shops",
      "12 particle effects",
      "12 particle styles",
      "15 chat emojis",
      "14 player holograms",
      "4 lines per hologram",
      "2 particles active at a time",
      "6 player glow colors",
      "8 custom glow effects",
      "20 player warps",
      "20 shop stock pages",
      "10 land claim flags: InfiniteArrows, NoCombatLoot, NoElytra, NoEnterPlayer, NoFireSpread, NoMobDamage, NoMobSpawns, NoSnowForm, NoAnvilDamage, NoBlockForm",
      "Add a colored or blinking glow to your player",
      "Change hologram text size",
      "Send in-game messages from Discord",
      "Keep inventory on death",
      "Keep XP levels on death",
      "Send colored messages in chat",
      "Create signs with colorful text",
      "Enable warp visit notifications",
      "Shop virtually at player shops",
      "Command: /feed — fully replenish hunger (15m cooldown)",
      "Command: /sit — makes your player sit on the ground",
      "Command: /craft — opens a portable crafting bench",
      "Command: /loom — opens a portable loom",
      "Command: /nickname — changes your name in chat",
      "Command: /keepinv-on/off — turns keep inventory on or off",
      "Command: /particles — opens the particles menu",
      "Command: /glow — opens the glow colors menu",
      "Command: /emojis — shows your available emojis",
      "Command: /grindstone — opens a portable grindstone",
      "Command: /hat — puts a selected block onto your head",
      "Command: /bellyflop — makes your player do a bellyflop",
      "Command: /disposal — opens a portable trash can",
      "Command: /near — shows nearby players",
      "Command: /unenchant — removes a specific enchantment",
      "Command: /setclaimflag — adds a special flag to your land claim",
      "Command: /smithingtable — opens a portable smithing table",
      "Command: /cartographytable — opens a portable cartography table",
      "Command: /heal — fully replenish hunger and health (15m cooldown)",
      "Command: /thru — teleports through the block or wall you are looking at",
      "Command: /enderchest — opens a portable ender chest",
      "Command: /crawl — makes your player crawl on the ground",
      "Command: /condense — converts uncondensed items into blocks",
      "Command: /jump — teleports you where you are looking (30s cooldown)",
      "Command: /warpnotifyvisit-on|off — toggles warp visit notifications",
      "Purchase reward: 5,000 Claim Blocks",
      "Purchase reward: 1 Diamond Key",
      "Purchase reward: 20 XP Levels",
    ],
    "lavender",
  ),
  rank(
    "wolf",
    "Wolf",
    [
      "[Wolf] tag in chat, TAB, and nametag",
      "Wolf role on Discord",
      "Blue colored name and nametag",
      "Unlimited sethomes",
      "Unlimited player shops",
      "All particle effects",
      "All particle styles",
      "All chat emojis",
      "20 player holograms",
      "6 lines per hologram",
      "3 particles active at a time",
      "All player glow colors",
      "30 custom glow effects",
      "30 player warps",
      "25 shop stock pages",
      "42 land claim flags: InfiniteArrows, NoCombatLoot, NoElytra, NoEnterPlayer, NoFireSpread, NoItemPickup, NoMobDamage, NoMobSpawns, NoSnowForm, NoAnvilDamage, NoBlockForm, AllowPvP, KeepInventory, KeepLevel, ChangeBiome, ExitMessage, NoBlockGravity, NoBlockSpread, NoChorusFruit, NoEnderPearl, NoExplosionDamage, NoFallDamage, NoFireDamage, NoFlight, NoFluidFlow, NoGrowth, NoIceForm, NoItemDrop, NoLeafDecay, NoOpenDoors, NoPetDamage, NotifyEnter, ProtectNamedMobs, ExitActionbar, EnterActionbar, NoBlockFade, PlayerTime, PlayerWeather, NotifyExit, NoCoralDeath, NoCropTrampling, NoMonsterSpawns",
      "Add a colored, blinking, or rainbow glow to your player",
      "Change hologram text size",
      "Send in-game messages from Discord",
      "Land claims never expire",
      "Keep inventory on death",
      "Keep XP levels on death",
      "Send colored messages in chat",
      "Create signs with colorful text",
      "Enable warp visit notifications",
      "Pick up spawners with Silk Touch (12h cooldown)",
      "Bypass random teleport cooldown",
      "Shop virtually at player shops",
      "Command: /feed — fully replenish hunger (15m cooldown)",
      "Command: /itemname — rename held items with colors and effects (&0-9, &a-f)",
      "Command: /sit — makes your player sit on the ground",
      "Command: /craft — open a portable crafting bench from anywhere",
      "Command: /loom — open a portable loom from anywhere",
      "Command: /nickname — changes your username in chat",
      "Command: /keepinv-on/off — turns keep inventory on or off",
      "Command: /particles — choose from 50+ different particles",
      "Command: /glow — apply a colorful glow to your player",
      "Command: /emojis — shows your available emojis",
      "Command: /grindstone — open a portable grindstone from anywhere",
      "Command: /hat — puts a selected block onto your head",
      "Command: /bellyflop — makes your player do a bellyflop",
      "Command: /disposal — opens a portable trash can",
      "Command: /near — shows nearby players",
      "Command: /unenchant — removes a specific enchantment",
      "Command: /setclaimflag — adds a special flag to your land claim",
      "Command: /smithingtable — open a portable smithing table from anywhere",
      "Command: /cartographytable — open a portable cartography table from anywhere",
      "Command: /heal — fully replenish hunger and health (15m cooldown)",
      "Command: /thru — teleport through the block or wall you are looking at",
      "Command: /enderchest — open a portable ender chest from anywhere",
      "Command: /crawl — makes your player crawl on the ground",
      "Command: /lay — makes your player lay on the ground",
      "Command: /condense — converts uncondensed items in your inventory into blocks",
      "Command: /jump — teleports you where you are looking (30s cooldown)",
      "Command: /warpnotifyvisit-on|off — toggles warp visit notifications",
      "Command: /tptoggle — toggle teleport requests from other players",
      "Command: /anvil — open a portable anvil from anywhere",
      "Command: /stonecutter — open a portable stonecutter from anywhere",
      "Command: /ptime — changes the time for your player",
      "Command: /firework — create fireworks with custom trails, effects, and powers",
      "Command: /beezooka — throw an exploding bee where you are looking",
      "Command: /skull — spawn a player's head as a wearable item (4h cooldown)",
      "Command: /repair — fully repair item durability (12h cooldown)",
      "Command: /seen — check when a player was last online",
      "Purchase reward: 8,000 Claim Blocks",
      "Purchase reward: 1 Emerald Key",
      "Purchase reward: 40 XP Levels",
    ],
    "primary",
  ),

  ...(
    [
      [500, convertUsdToRupees(2.99)],
      [1000, convertUsdToRupees(4.99)],
      [2500, convertUsdToRupees(10.99)],
      [5000, convertUsdToRupees(19.99)],
    ] as const
  ).map(([amt, price], i): Product => ({
    id: `coins-${amt}`,
    name: `${amt.toLocaleString()} Coins`,
    category: "coins",
    price,
    image: coinsImg,
    enabled: true,
    tint: (["sky", "primary", "lavender", "lilac"] as const)[i] ?? "sky",
    featured: amt === 2500,
    originalPrice: amt === 5000 ? convertUsdToRupees(24.99) : undefined,
    description: `Top up your balance with ${amt.toLocaleString()} coins to spend in /shop and the auction house.`,
    perks: ["Delivered to your balance", "Works with /shop & /ah"],
  })),

  ...(
    [
      ["common", "Common", convertUsdToRupees(0.99), "sky"],
      ["rare", "Rare", convertUsdToRupees(1.99), "primary"],
      ["epic", "Epic", convertUsdToRupees(3.49), "lilac"],
      ["legendary", "Legendary", convertUsdToRupees(5.99), "blush"],
    ] as const
  ).map(([id, n, price, tint]): Product => ({
    id: `crate-${id}`,
    name: `${n} Crate Key`,
    category: "crates",
    price,
    image: crateImg,
    enabled: true,
    tint,
    featured: id === "legendary",
    description: `Open a ${n} Crate at /warp crates for a chance at ${n.toLowerCase()} loot.`,
    perks: ["1 key", "Open at /warp crates"],
  })),

  {
    id: "bundle-starter",
    name: "Starter Key Bundle",
    category: "bundles",
    price: convertUsdToRupees(6.99),
    originalPrice: convertUsdToRupees(9.95),
    image: crateImg,
    enabled: true,
    tint: "sky",
    description: "A mix of keys to kickstart your adventure.",
    perks: ["3 Common keys", "2 Rare keys", "1 Epic key"],
  },
  {
    id: "bundle-mythic",
    name: "Mythic Key Bundle",
    category: "bundles",
    price: convertUsdToRupees(19.99),
    originalPrice: convertUsdToRupees(29.9),
    image: crateImg,
    enabled: true,
    tint: "lilac",
    featured: true,
    description: "Stacked with high-tier keys for serious loot hunters.",
    perks: ["3 Epic keys", "3 Legendary keys"],
  },

  {
    id: "cos-trail",
    name: "Starlight Trail",
    category: "cosmetics",
    price: convertUsdToRupees(3.99),
    image: rankImg,
    enabled: true,
    tint: "lavender",
    single: true,
    description: "A shimmering particle trail that follows your every step.",
    perks: ["Permanent", "Toggle with /trails"],
  },
  {
    id: "cos-tag",
    name: "Custom Chat Tag",
    category: "cosmetics",
    price: convertUsdToRupees(2.49),
    image: rankImg,
    enabled: true,
    tint: "blush",
    single: true,
    description: "Show off a custom tag next to your name in chat.",
    perks: ["Up to 8 characters", "Change once a month"],
  },
];

export const activeProducts = () => products.filter((p) => p.enabled);
export const getProduct = (id: string) =>
  products.find((p) => p.id === id && p.enabled);
export const isOnSale = (p: Product) =>
  !!p.originalPrice && p.originalPrice > p.price;
export const discountPct = (p: Product) =>
  p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
