export type ServerHeartbeat = {
  online: boolean;
  onlinePlayers: number;
  maxPlayers: number;
};

export type StoredServerStatus = {
  online: boolean;
  online_players: number;
  max_players: number;
  updated_at: string;
} | null;

export type PublicServerStatus = {
  available: boolean;
  online: boolean;
  players: { online: number; max: number } | null;
  updatedAt: string | null;
};

const heartbeatMaxAgeMs = 180_000;
const allowedClockSkewMs = 60_000;

export function isValidServerHeartbeat(
  value: unknown,
): value is ServerHeartbeat {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.online === "boolean" &&
    Number.isInteger(body.onlinePlayers) &&
    Number.isInteger(body.maxPlayers) &&
    typeof body.onlinePlayers === "number" &&
    typeof body.maxPlayers === "number" &&
    body.onlinePlayers >= 0 &&
    body.maxPlayers >= 0 &&
    body.onlinePlayers <= body.maxPlayers &&
    body.maxPlayers <= 100_000 &&
    (body.online || body.onlinePlayers === 0)
  );
}

export function getPublicServerStatus(
  status: StoredServerStatus,
  now = Date.now(),
): PublicServerStatus {
  if (!status) {
    return {
      available: false,
      online: false,
      players: null,
      updatedAt: null,
    };
  }
  const updatedAtMs = Date.parse(status.updated_at);
  const available =
    Number.isFinite(updatedAtMs) &&
    updatedAtMs - now <= allowedClockSkewMs &&
    now - updatedAtMs <= heartbeatMaxAgeMs;
  const online = available && status.online;
  return {
    available,
    online,
    players: {
      online: online ? status.online_players : 0,
      max: status.max_players,
    },
    updatedAt: Number.isFinite(updatedAtMs) ? status.updated_at : null,
  };
}
