import "@tanstack/react-start/server-only";
import { requiredServerEnv } from "@/lib/server-env.server";

const siteverifyUrl =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
function containsControlCharacters(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

type SiteverifyResponse = {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
  "error-codes"?: unknown;
};

export class TurnstileVerificationError extends Error {
  constructor() {
    super("Verification could not be completed. Please try again.");
    this.name = "TurnstileVerificationError";
  }
}

export async function verifyTurnstileToken(
  token: unknown,
  expectedAction: string,
): Promise<void> {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 2048 ||
    token.trim() !== token ||
    /\s/.test(token) ||
    containsControlCharacters(token)
  ) {
    throw new TurnstileVerificationError();
  }

  let secret: string;
  try {
    secret = requiredServerEnv("TURNSTILE_SECRET_KEY");
  } catch (error) {
    console.error("Turnstile secret configuration is unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new TurnstileVerificationError();
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(siteverifyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: controller.signal,
    });
    if (!response.ok) throw new TurnstileVerificationError();

    let result: SiteverifyResponse;
    try {
      result = (await response.json()) as SiteverifyResponse;
    } catch {
      throw new TurnstileVerificationError();
    }

    if (
      result.success !== true ||
      result.hostname !== "store.craftsmp.cc" ||
      result.action !== expectedAction
    ) {
      const errorCodes = Array.isArray(result["error-codes"])
        ? result["error-codes"].filter(
            (code): code is string => typeof code === "string",
          )
        : [];
      console.warn("Turnstile verification rejected", {
        action: expectedAction,
        hostname:
          typeof result.hostname === "string" ? result.hostname : "missing",
        errorCodes,
      });
      throw new TurnstileVerificationError();
    }
  } catch (error) {
    if (error instanceof TurnstileVerificationError) throw error;
    console.warn("Turnstile Siteverify request failed", {
      action: expectedAction,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw new TurnstileVerificationError();
  } finally {
    clearTimeout(timeout);
  }
}
