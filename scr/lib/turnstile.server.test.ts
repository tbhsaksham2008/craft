import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from "./turnstile.server";

const originalSecret = process.env["TURNSTILE_SECRET_KEY"];

function siteverifyResponse(overrides: Record<string, unknown> = {}): Response {
  return Response.json({
    success: true,
    hostname: "store.craftsmp.cc",
    action: "store",
    ...overrides,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (originalSecret === undefined) {
    delete process.env["TURNSTILE_SECRET_KEY"];
  } else {
    process.env["TURNSTILE_SECRET_KEY"] = originalSecret;
  }
});

describe("Turnstile server verification", () => {
  it("accepts a successful token for the configured hostname and action", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";
    const fetchMock = vi.fn().mockResolvedValue(siteverifyResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken("valid-token", "store"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          secret: "test-secret",
          response: "valid-token",
        }),
      }),
    );
  });

  it.each(["", null, "   ", "bad token", "x".repeat(2049)])(
    "rejects missing or malformed token %s without calling Siteverify",
    async (token) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(verifyTurnstileToken(token, "store")).rejects.toBeInstanceOf(
        TurnstileVerificationError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    { success: false, "error-codes": ["invalid-input-response"] },
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { hostname: "attacker.example" },
    { action: "account" },
  ])(
    "rejects invalid, expired, replayed, or mismatched responses",
    async (result) => {
      process.env["TURNSTILE_SECRET_KEY"] = "test-secret";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(siteverifyResponse(result)),
      );
      await expect(
        verifyTurnstileToken("present-token", "store"),
      ).rejects.toBeInstanceOf(TurnstileVerificationError);
    },
  );

  it("rejects the second use of a token", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(siteverifyResponse())
      .mockResolvedValueOnce(
        siteverifyResponse({
          success: false,
          "error-codes": ["timeout-or-duplicate"],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken("one-use-token", "store"),
    ).resolves.toBeUndefined();
    await expect(
      verifyTurnstileToken("one-use-token", "store"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });

  it("fails closed on malformed Siteverify responses and HTTP failures", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 })),
    );

    await expect(
      verifyTurnstileToken("token-one", "store"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
    await expect(
      verifyTurnstileToken("token-two", "store"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });

  it("fails closed when Siteverify cannot be reached", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(
      verifyTurnstileToken("offline-token", "store"),
    ).rejects.toBeInstanceOf(TurnstileVerificationError);
  });

  it("aborts and fails closed when Siteverify times out", async () => {
    process.env["TURNSTILE_SECRET_KEY"] = "test-secret";
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const verification = verifyTurnstileToken("slow-token", "store");
    const verificationResult = expect(verification).rejects.toBeInstanceOf(
      TurnstileVerificationError,
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await verificationResult;
  });
});
