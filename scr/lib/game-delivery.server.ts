import { createClient } from "@supabase/supabase-js";

const minecraftUsernamePattern = /^[A-Za-z0-9_]{3,16}$/;
const commandPattern = /^[A-Za-z0-9_:.{} -]+$/;

type QueueRow = {
  id: string;
  order_item_id: string;
  attempts: number;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  delivery_commands: string[];
};

type OrderRow = {
  id: string;
  status: string;
  minecraft_username: string;
};

export type DeliveryClaim = {
  queueId: string;
  orderItemId: string;
  orderId: string;
  productName: string;
  quantity: number;
  commands: string[];
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

async function tokensMatch(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftByte = left[index];
    const rightByte = right[index];
    if (leftByte === undefined || rightByte === undefined) return false;
    difference |= leftByte ^ rightByte;
  }
  return difference === 0 && provided.length > 0;
}

export async function getGameDeliveryClient(request: Request) {
  const expectedToken = requiredEnv("MINECRAFT_PLUGIN_TOKEN");
  const providedToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!providedToken || !(await tokensMatch(providedToken, expectedToken))) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return createClient(
    requiredEnv("VITE_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function isValidMinecraftUsername(username: string) {
  return minecraftUsernamePattern.test(username);
}

export function expandDeliveryCommands(
  commands: string[],
  values: {
    player: string;
    quantity: number;
    orderId: string;
    itemId: string;
  },
) {
  const supportedTokens = /\{(?:player|quantity|order_id|item_id)\}/g;
  if (
    !Array.isArray(commands) ||
    commands.length === 0 ||
    commands.length > 10 ||
    commands.some(
      (command) =>
        typeof command !== "string" ||
        command.length > 256 ||
        !command.includes("{player}") ||
        !commandPattern.test(command) ||
        /[{}]/.test(command.replace(supportedTokens, "")),
    )
  ) {
    throw new Error("Product delivery commands are missing or invalid.");
  }

  return commands.map((command) =>
    command
      .replaceAll("{player}", values.player)
      .replaceAll("{quantity}", String(values.quantity))
      .replaceAll("{order_id}", values.orderId)
      .replaceAll("{item_id}", values.itemId),
  );
}

export function parseMinecraftUsername(value: unknown) {
  if (typeof value !== "string" || !isValidMinecraftUsername(value)) {
    throw new Error("A valid Minecraft username is required.");
  }
  return value;
}

export function parseDeliveryCompletion(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("A delivery result is required.");
  }
  const body = value as Record<string, unknown>;
  const queueId = body["queueId"];
  const success = body["success"];
  const error = body["error"];
  if (
    typeof queueId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      queueId,
    ) ||
    typeof success !== "boolean" ||
    (error !== undefined && typeof error !== "string")
  ) {
    throw new Error("The delivery result is invalid.");
  }
  return {
    queueId,
    success,
    error: typeof error === "string" ? error.trim().slice(0, 1000) : null,
  };
}

export type { OrderItemRow, OrderRow, QueueRow };
