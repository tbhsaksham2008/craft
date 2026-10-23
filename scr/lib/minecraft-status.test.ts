import { describe, expect, it } from "vitest";
import {
  hasMinecraftAddressLookupError,
  isMinecraftServerAddressConfigured,
} from "./minecraft-status";

describe("Minecraft server address configuration", () => {
  it("recognizes a configured public hostname or address", () => {
    expect(isMinecraftServerAddressConfigured("play.example.net")).toBe(true);
    expect(isMinecraftServerAddressConfigured("192.0.2.10:25565")).toBe(true);
  });

  it("recognizes empty and placeholder addresses as unconfigured", () => {
    expect(isMinecraftServerAddressConfigured("")).toBe(false);
    expect(isMinecraftServerAddressConfigured(" Not set ")).toBe(false);
    expect(isMinecraftServerAddressConfigured("Not set yet")).toBe(false);
    expect(isMinecraftServerAddressConfigured("not configured")).toBe(false);
    expect(isMinecraftServerAddressConfigured("example.com")).toBe(false);
  });

  it("recognizes a DNS lookup failure as a server setup issue", () => {
    expect(
      hasMinecraftAddressLookupError({
        online: false,
        debug: {
          errors: [
            { type: "ip", message: "DNS lookup failed: no IP detected." },
          ],
        },
      }),
    ).toBe(true);
    expect(hasMinecraftAddressLookupError({ online: false })).toBe(false);
  });
});
