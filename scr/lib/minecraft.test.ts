import { describe, expect, it } from "vitest";
import { isValidMinecraftName } from "./minecraft";

describe("isValidMinecraftName", () => {
  it("accepts 3–16 letters, digits and underscores", () => {
    expect(isValidMinecraftName("Steve_123")).toBe(true);
  });
  it("rejects names shorter than 3 or longer than 16", () => {
    expect(isValidMinecraftName("ab")).toBe(false);
    expect(isValidMinecraftName("a".repeat(17))).toBe(false);
  });
  it("rejects spaces and symbols", () => {
    expect(isValidMinecraftName("bad name")).toBe(false);
    expect(isValidMinecraftName("hey!")).toBe(false);
  });
});
