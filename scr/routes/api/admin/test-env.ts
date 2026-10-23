import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { getServerEnv } from "@/lib/server-env.server";
import { isValidUpiVpa } from "@/lib/upi";

const envNames = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MERCHANT_UPI_ID",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GMAIL_ACCOUNT_EMAIL",
  "MINECRAFT_PLUGIN_TOKEN",
  "FAMPAY_NOTIFICATION_DKIM_DOMAIN",
] as const;

type EnvName = (typeof envNames)[number];

function configuredValue(name: EnvName) {
  if (name === "VITE_SUPABASE_URL") {
    return (getServerEnv(name) ?? import.meta.env["VITE_SUPABASE_URL"])?.trim();
  }
  if (name === "VITE_SUPABASE_ANON_KEY") {
    return (
      getServerEnv(name) ?? import.meta.env["VITE_SUPABASE_ANON_KEY"]
    )?.trim();
  }
  return getServerEnv(name)?.trim();
}

function requiredValue(
  name: Exclude<EnvName, "FAMPAY_NOTIFICATION_DKIM_DOMAIN">,
) {
  const value = configuredValue(name);
  if (!value || value === "MINECRAFT_PLUGIN_TOKEN") {
    throw new Error(`${name} is missing or still has its placeholder value.`);
  }
  return value;
}

async function testGmailIntegration() {
  const clientId = requiredValue("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = requiredValue("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = requiredValue("GMAIL_REFRESH_TOKEN");
  const expectedEmail = requiredValue("GMAIL_ACCOUNT_EMAIL").toLowerCase();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) {
    throw new Error(
      `Google OAuth rejected the configured client credentials or refresh token (HTTP ${tokenResponse.status}).`,
    );
  }
  const tokenPayload: { access_token?: string } = await tokenResponse.json();
  if (!tokenPayload.access_token) {
    throw new Error("Google OAuth did not return an access token.");
  }

  const profileResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!profileResponse.ok) {
    throw new Error(
      `Gmail API could not read the authorized mailbox (HTTP ${profileResponse.status}).`,
    );
  }
  const profile: { emailAddress?: string } = await profileResponse.json();
  if (profile.emailAddress?.toLowerCase() !== expectedEmail) {
    throw new Error(
      "The authorized Gmail mailbox does not match GMAIL_ACCOUNT_EMAIL.",
    );
  }
}

async function runEnvTest(name: EnvName, accessToken: string) {
  const url = requiredValue("VITE_SUPABASE_URL");
  const anonKey = requiredValue("VITE_SUPABASE_ANON_KEY");
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } =
    await authClient.auth.getUser(accessToken);
  if (authError || !userData.user) {
    throw new Error("Sign in with an admin account before testing settings.");
  }
  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  if (profileError || profile?.role !== "admin") {
    throw new Error("Admin access is required to test environment settings.");
  }

  switch (name) {
    case "VITE_SUPABASE_URL": {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:") {
        throw new Error("VITE_SUPABASE_URL must use HTTPS.");
      }
      const response = await fetch(
        `${url.replace(/\/+$/, "")}/auth/v1/health`,
        {
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Supabase Auth health check failed (HTTP ${response.status}).`,
        );
      }
      return "Supabase Auth is reachable.";
    }
    case "VITE_SUPABASE_ANON_KEY":
      return "The anon key successfully authenticated this admin session.";
    case "SUPABASE_SERVICE_ROLE_KEY": {
      const serviceKey = requiredValue(name);
      const adminClient = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await adminClient
        .from("profiles")
        .select("id")
        .limit(1);
      if (error) {
        throw new Error(`Service-role database check failed: ${error.message}`);
      }
      return "Service-role key can access the Supabase database.";
    }
    case "MERCHANT_UPI_ID": {
      const upiId = requiredValue(name);
      if (!isValidUpiVpa(upiId)) {
        throw new Error("MERCHANT_UPI_ID is not a valid UPI ID.");
      }
      return "Merchant UPI ID has a valid format.";
    }
    case "GOOGLE_OAUTH_CLIENT_ID":
    case "GOOGLE_OAUTH_CLIENT_SECRET":
    case "GMAIL_REFRESH_TOKEN":
    case "GMAIL_ACCOUNT_EMAIL":
      await testGmailIntegration();
      return "Google OAuth and Gmail access work, and the mailbox matches.";
    case "MINECRAFT_PLUGIN_TOKEN":
      requiredValue(name);
      return "Token is configured. This checks configuration only, not whether a Minecraft server is online.";
    case "FAMPAY_NOTIFICATION_DKIM_DOMAIN": {
      const domain = configuredValue(name);
      if (!domain) {
        return "Optional setting is unset; the integration uses its famapp.in default.";
      }
      if (
        !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i.test(
          domain,
        )
      ) {
        throw new Error(
          "FAMPAY_NOTIFICATION_DKIM_DOMAIN is not a valid domain.",
        );
      }
      return "Optional DKIM domain has a valid format.";
    }
  }
}

export const Route = createFileRoute("/api/admin/test-env")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body: unknown = await request.json();
          if (!body || typeof body !== "object") {
            return Response.json(
              { error: "A test request is required." },
              { status: 400 },
            );
          }
          const { name, accessToken } = body as {
            name?: unknown;
            accessToken?: unknown;
          };
          if (
            typeof name !== "string" ||
            !envNames.includes(name as EnvName) ||
            typeof accessToken !== "string" ||
            !accessToken
          ) {
            return Response.json(
              { error: "The test request is invalid." },
              { status: 400 },
            );
          }
          const message = await runEnvTest(name as EnvName, accessToken);
          return Response.json({ success: true, message });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Environment test failed.";
          return Response.json(
            { success: false, error: message },
            { status: 400 },
          );
        }
      },
    },
  },
});
