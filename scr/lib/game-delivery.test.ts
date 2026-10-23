import { describe, expect, it } from "vitest";
import {
  expandDeliveryCommands,
  parseDeliveryCompletion,
  parseMinecraftUsername,
} from "@/lib/game-delivery.server";

describe("Minecraft delivery API validation", () => {
  it("accepts Java usernames and rejects command-like usernames", () => {
    expect(parseMinecraftUsername("Player_123")).toBe("Player_123");
    expect(() => parseMinecraftUsername("Player;op Admin")).toThrow(
      "A valid Minecraft username is required.",
    );
  });

  it("expands only supported placeholders in product commands", () => {
    expect(
      expandDeliveryCommands(["lp user {player} parent set bee"], {
        player: "Player_123",
        quantity: 1,
        orderId: "order-id",
        itemId: "item-id",
      }),
    ).toEqual(["lp user Player_123 parent set bee"]);
  });

  it("rejects commands missing a player or containing unsupported syntax", () => {
    expect(() =>
      expandDeliveryCommands(["lp user {player}; op {player}"], {
        player: "Player_123",
        quantity: 1,
        orderId: "order-id",
        itemId: "item-id",
      }),
    ).toThrow("Product delivery commands are missing or invalid.");
    expect(() =>
      expandDeliveryCommands(["lp user {player} {unsupported}"], {
        player: "Player_123",
        quantity: 1,
        orderId: "order-id",
        itemId: "item-id",
      }),
    ).toThrow("Product delivery commands are missing or invalid.");
  });

  it("validates delivery acknowledgements", () => {
    expect(
      parseDeliveryCompletion({
        queueId: "b5eec5b0-5df9-4b3f-8eb6-7498adabc123",
        success: true,
      }),
    ).toMatchObject({ success: true, error: null });
    expect(() =>
      parseDeliveryCompletion({ queueId: "invalid", success: true }),
    ).toThrow("The delivery result is invalid.");
  });
});
