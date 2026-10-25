import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getTurnstileSiteKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const { requiredServerEnv } = await import("@/lib/server-env.server");
    return requiredServerEnv("TURNSTILE_SITE_KEY");
  },
);

export const verifyAccountTurnstile = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(1).max(2048),
    }),
  )
  .handler(async ({ data }) => {
    const { verifyTurnstileToken } = await import("@/lib/turnstile.server");
    await verifyTurnstileToken(data.token, "account");
    return { verified: true };
  });
