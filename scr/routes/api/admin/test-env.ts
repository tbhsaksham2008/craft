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
const workerScriptName = "craft-smp-store";

async function setWorkerSecret(input: {
  accountId: string;
  apiToken: string;
  name: EnvName;
  value: string;
}) {
  if (!/^[a-f0-9]{32}$/i.test(input.accountId)) {
    throw new Error("Enter a valid 32-character Cloudflare account ID.");
  }
  if (!input.apiToken.trim()) {
    throw new Error(
      "Enter a Cloudflare API token with Workers Scripts Write permission.",
    );
  }
  if (!input.value.trim() || input.value.length > 10_000) {
    throw new Error("Enter a value between 1 and 10,000 characters.");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/workers/scripts/${workerScriptName}/secrets`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${input.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        text: input.value,
        type: "secret_text",
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const result: {
    success?: boolean;
    errors?: Array<{ message?: string }>;
  } = await response.json();
  if (!response.ok || !result.success) {
    const errorMessage = result.errors
      ?.map((error) => error.message)
      .filter((message): message is string => Boolean(message))
      .join("; ");
    throw new Error(
      errorMessage ||
        `Cloudflare rejected the update (HTTP ${response.status}).`,
    );
  }
}

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
  if (
    !value ||
    value === name ||
    value === "MINECRAFT_PLUGIN_TOKEN" ||
    value.startsWith("YOUR_") ||
    value.startsWith("REPLACE_WITH_")
  ) {
    throw new Error(
      `${name} is missing or still has its placeholder value. Set server credentials in Cloudflare Worker Settings > Variables and Secrets (runtime bindings), not only under Builds.`,
    );
  }
  return value;
}

function optionalDependencyValue(
  name: Exclude<EnvName, "FAMPAY_NOTIFICATION_DKIM_DOMAIN">,
) {
  try {
    return requiredValue(name);
  } catch {
    throw new Error(
      `Cannot test this setting until ${name} is configured as a Worker runtime binding.`,
    );
  }
}

async function testGoogleOAuthClient() {
  const clientId = requiredValue("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = optionalDependencyValue("GOOGLE_OAUTH_CLIENT_SECRET");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: "craft-env-test-invalid-refresh-token",
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tokenResult: { error?: string } = await tokenResponse.json();
  if (tokenResult.error === "invalid_grant") {
    return "Google OAuth client ID and secret were accepted.";
  }
  if (tokenResult.error === "invalid_client") {
    throw new Error("Google rejected the OAuth client ID or client secret.");
  }
  if (!tokenResponse.ok) {
    throw new Error(
      `Google OAuth client check failed: ${tokenResult.error ?? `HTTP ${tokenResponse.status}`}.`,
    );
  }
  throw new Error(
    "Google OAuth returned an unexpected successful response to the credential check.",
  );
}

async function testGmailMailbox() {
  const clientId = optionalDependencyValue("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = optionalDependencyValue("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = optionalDependencyValue("GMAIL_REFRESH_TOKEN");
  const profileResponse = await fetch("https://oauth2.googleapis.com/token", {
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
  const tokenPayload: { access_token?: string; error?: string } =
    await profileResponse.json();
  if (!profileResponse.ok || !tokenPayload.access_token) {
    throw new Error(
      `Gmail refresh token could not be used: ${tokenPayload.error ?? `HTTP ${profileResponse.status}`}.`,
    );
  }
  return tokenPayload.access_token;
}

async function testGmailAccountEmail() {
  const expectedEmail = requiredValue("GMAIL_ACCOUNT_EMAIL").toLowerCase();
  const accessToken = await testGmailMailbox();
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Gmail profile check failed (HTTP ${response.status}).`);
  }
  const profile: { emailAddress?: string } = await response.json();
  if (!profile.emailAddress) {
    throw new Error("Gmail did not return the authorized mailbox address.");
  }
  if (profile.emailAddress.toLowerCase() !== expectedEmail) {
    throw new Error(
      "The authorized Gmail mailbox does not match GMAIL_ACCOUNT_EMAIL.",
    );
  }
  return "GMAIL_ACCOUNT_EMAIL matches the mailbox authorized by the refresh token.";
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
          headers: { apikey: anonKey },
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
      await testGoogleOAuthClient();
      return "Google OAuth client ID is accepted with the configured client secret.";
    case "GOOGLE_OAUTH_CLIENT_SECRET":
      await testGoogleOAuthClient();
      return "Google OAuth client secret is accepted with the configured client ID.";
    case "GMAIL_REFRESH_TOKEN":
      await testGmailMailbox();
      return "Gmail refresh token successfully authorized the mailbox.";
    case "GMAIL_ACCOUNT_EMAIL":
      return await testGmailAccountEmail();
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
          const { name, accessToken, action } = body as {
            name?: unknown;
            accessToken?: unknown;
            action?: unknown;
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
          const url = requiredValue("VITE_SUPABASE_URL");
          const anonKey = requiredValue("VITE_SUPABASE_ANON_KEY");
          const authClient = createClient(url, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userData, error: authError } =
            await authClient.auth.getUser(accessToken);
          if (authError || !userData.user) {
            return Response.json(
              { success: false, error: "Sign in before testing settings." },
              { status: 401 },
            );
          }
          const { data: profile, error: profileError } = await authClient
            .from("profiles")
            .select("role")
            .eq("id", userData.user.id)
            .single();
          if (profileError || profile?.role !== "admin") {
            return Response.json(
              { success: false, error: "Admin access is required." },
              { status: 403 },
            );
          }
          if (action === "save") {
            const { accountId, apiToken, value } = body as {
              accountId?: unknown;
              apiToken?: unknown;
              value?: unknown;
            };
            if (
              typeof accountId !== "string" ||
              typeof apiToken !== "string" ||
              typeof value !== "string"
            ) {
              return Response.json(
                {
                  error:
                    "Account ID, API token, and variable value are required.",
                },
                { status: 400 },
              );
            }
            await setWorkerSecret({
              accountId,
              apiToken,
              name: name as EnvName,
              value,
            });
            return Response.json({
              success: true,
              message:
                "Cloudflare accepted the secret update and created a Worker version. VITE_ values are build-time and still need a new build to update the browser bundle.",
            });
          }
          if (action !== undefined && action !== "test") {
            return Response.json(
              { error: "Choose a valid environment variable action." },
              { status: 400 },
            );
          }
          const message = await runEnvTest(name as EnvName, accessToken);
          return Response.json({ success: true, message });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Environment test failed.";
          const status =
            message.startsWith("Missing server configuration:") ||
            message.includes("is missing or still has its placeholder value")
              ? 503
              : 400;
          return Response.json({ success: false, error: message }, { status });
        }
      },
    },
  },
});
