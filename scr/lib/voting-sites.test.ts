import { describe, expect, it } from "vitest";
import { normalizeVotingUrl } from "./voting-sites";

describe("voting-site URLs", () => {
  it("accepts and normalizes HTTP and HTTPS voting links", () => {
    expect(normalizeVotingUrl(" https://votes.example/server ")).toBe(
      "https://votes.example/server",
    );
    expect(normalizeVotingUrl("http://votes.example")).toBe(
      "http://votes.example/",
    );
  });

  it("rejects unsupported or malformed protocols", () => {
    expect(normalizeVotingUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeVotingUrl("ftp://votes.example")).toBeNull();
    expect(normalizeVotingUrl("not a URL")).toBeNull();
  });
});
