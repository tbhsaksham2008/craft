import { describe, expect, it } from "vitest";
import { getPublicServerStatus, isValidServerHeartbeat } from "./server-status";

describe("Minecraft plugin server status", () => {
  it("accepts valid online and offline heartbeats", () => {
    expect(
      isValidServerHeartbeat({
        online: true,
        onlinePlayers: 4,
        maxPlayers: 50,
      }),
    ).toBe(true);
    expect(
      isValidServerHeartbeat({
        online: false,
        onlinePlayers: 0,
        maxPlayers: 50,
      }),
    ).toBe(true);
  });

  it("rejects invalid or impossible player counts", () => {
    expect(
      isValidServerHeartbeat({
        online: false,
        onlinePlayers: 2,
        maxPlayers: 50,
      }),
    ).toBe(false);
    expect(
      isValidServerHeartbeat({
        online: true,
        onlinePlayers: 6,
        maxPlayers: 5,
      }),
    ).toBe(false);
    expect(
      isValidServerHeartbeat({
        online: true,
        onlinePlayers: 1.5,
        maxPlayers: 10,
      }),
    ).toBe(false);
    expect(isValidServerHeartbeat(null)).toBe(false);
  });

  it("marks missing and stale heartbeats unavailable or offline", () => {
    expect(getPublicServerStatus(null)).toMatchObject({
      available: false,
      online: false,
      players: null,
    });
    expect(
      getPublicServerStatus(
        {
          online: true,
          online_players: 3,
          max_players: 20,
          updated_at: new Date(0).toISOString(),
        },
        181_000,
      ),
    ).toMatchObject({
      available: false,
      online: false,
      players: { online: 0, max: 20 },
    });
  });

  it("returns fresh player counts from the plugin heartbeat", () => {
    expect(
      getPublicServerStatus(
        {
          online: true,
          online_players: 3,
          max_players: 20,
          updated_at: new Date(100_000).toISOString(),
        },
        101_000,
      ),
    ).toMatchObject({
      available: true,
      online: true,
      players: { online: 3, max: 20 },
    });
  });
});
