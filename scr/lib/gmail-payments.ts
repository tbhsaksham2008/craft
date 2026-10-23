import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getClients } from "@/lib/payments";
import {
  parseGmailMessage,
  type GmailMessage,
} from "@/lib/payment-providers/gmail";

const scanInput = z.object({ accessToken: z.string().min(1) });

type GmailProfile = { emailAddress: string; historyId: string };
type GmailHistoryResponse = {
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string } }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
};
type GmailListResponse = {
  messages?: Array<{ id?: string }>;
  nextPageToken?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

async function gmailRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    console.error("Gmail API request failed", response.status, path);
    throw new Error(`Gmail API request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

async function createGmailAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: requiredEnv("GMAIL_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    console.error("Google OAuth refresh failed", response.status);
    throw new Error(
      `Could not authorize Gmail API access (${response.status}).`,
    );
  }
  const result: { access_token?: string } = await response.json();
  if (!result.access_token)
    throw new Error("Google OAuth response did not include an access token.");
  return result.access_token;
}

async function requireAdmin(accessToken: string) {
  const { admin, authClient, user } = await getClients(accessToken);
  const { data: profile, error } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error || profile?.role !== "admin")
    throw new Error("Admin access required to scan payment email.");
  return admin;
}

export const scanGmailPaymentNotifications = createServerFn({
  method: "POST",
})
  .validator(scanInput)
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.accessToken);
    const sender = requiredEnv("FAMPAY_NOTIFICATION_SENDER").toLowerCase();
    const dkimDomain = requiredEnv(
      "FAMPAY_NOTIFICATION_DKIM_DOMAIN",
    ).toLowerCase();
    const expectedMailbox = requiredEnv("GMAIL_ACCOUNT_EMAIL").toLowerCase();
    const googleAccessToken = await createGmailAccessToken();
    const profile = await gmailRequest<GmailProfile>(
      "profile",
      googleAccessToken,
    );
    if (profile.emailAddress.toLowerCase() !== expectedMailbox)
      throw new Error(
        "The Gmail refresh token is authorized for a different mailbox than GMAIL_ACCOUNT_EMAIL. Set GMAIL_ACCOUNT_EMAIL to the mailbox used to authorize the refresh token, or create a refresh token for the configured mailbox.",
      );

    const { data: checkpoint, error: checkpointError } = await admin
      .from("gmail_payment_checkpoints")
      .select("history_id")
      .eq("id", true)
      .maybeSingle();
    if (checkpointError)
      throw new Error(
        `Could not read Gmail history checkpoint: ${checkpointError.message}`,
      );

    const messageIds = new Set<string>();
    let latestHistoryId = profile.historyId;
    let pageToken: string | undefined;
    do {
      const parameters = new URLSearchParams({
        q: `from:${sender} newer_than:30d`,
        maxResults: "500",
      });
      if (pageToken) parameters.set("pageToken", pageToken);
      const result = await gmailRequest<GmailListResponse>(
        `messages?${parameters.toString()}`,
        googleAccessToken,
      );
      for (const message of result.messages ?? []) {
        if (message.id) messageIds.add(message.id);
      }
      pageToken = result.nextPageToken;
      if (messageIds.size > 5000)
        throw new Error(
          "More than 5000 recent matching messages were found. Narrow the Gmail search before processing.",
        );
    } while (pageToken);

    if (checkpoint) {
      let historyPageToken: string | undefined;
      latestHistoryId = checkpoint.history_id;
      do {
        const parameters = new URLSearchParams({
          startHistoryId: checkpoint.history_id,
          historyTypes: "messageAdded",
          maxResults: "500",
        });
        if (historyPageToken) parameters.set("pageToken", historyPageToken);
        const history = await gmailRequest<GmailHistoryResponse>(
          `history?${parameters.toString()}`,
          googleAccessToken,
        );
        for (const change of history.history ?? []) {
          for (const addition of change.messagesAdded ?? []) {
            if (addition.message?.id) messageIds.add(addition.message.id);
          }
        }
        historyPageToken = history.nextPageToken;
        latestHistoryId = history.historyId ?? latestHistoryId;
        if (messageIds.size > 5000)
          throw new Error(
            "More than 5000 new messages were found. Check Gmail configuration before processing.",
          );
      } while (historyPageToken);
    }

    let processed = 0;
    let ignoredNonMatchingSenders = 0;
    let autoApproved = 0;
    for (const messageId of messageIds) {
      const metadata = await gmailRequest<GmailMessage>(
        `messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=From`,
        googleAccessToken,
      );
      const fromHeader = metadata.payload?.headers?.find(
        (header) => header.name.toLowerCase() === "from",
      )?.value;
      const senderFromHeader = (
        fromHeader?.match(/<([^>]+)>/)?.[1] ?? fromHeader
      )
        ?.trim()
        .toLowerCase();
      if (senderFromHeader !== sender) {
        ignoredNonMatchingSenders += 1;
        continue;
      }
      const message = await gmailRequest<GmailMessage>(
        `messages/${encodeURIComponent(messageId)}?format=full`,
        googleAccessToken,
      );
      const candidate = parseGmailMessage(message, {
        configuredSender: sender,
        configuredDkimDomain: dkimDomain,
      });
      const orderIdHint = candidate.orderIdHint;
      const { data: eventId, error } = await admin.rpc(
        "record_gmail_payment_event",
        {
          p_gmail_message_id: message.id,
          p_sender: candidate.sender,
          p_received_at: candidate.receivedAt,
          p_transaction_id: candidate.transactionId,
          p_utr: candidate.utr,
          p_amount_paise: candidate.amountPaise,
          p_currency: candidate.currency,
          p_payment_status: candidate.paymentStatus,
          p_dkim_pass: candidate.dkimPass,
          p_authentication_result: candidate.authenticationResult,
          p_order_id_hint: orderIdHint,
          p_review_reason: candidate.reviewReason,
        },
      );
      if (error)
        throw new Error(`Could not store Gmail evidence: ${error.message}`);
      if (!eventId)
        throw new Error("Gmail evidence was stored without an event ID.");
      const { data: wasAutoApproved, error: approvalError } = await admin.rpc(
        "auto_approve_gmail_payment_event",
        {
          p_event_id: eventId,
          p_expected_sender: sender,
          p_sender_authenticated: candidate.senderAuthenticated,
        },
      );
      if (approvalError)
        throw new Error(
          `Could not automatically reconcile Gmail evidence: ${approvalError.message}`,
        );
      if (wasAutoApproved) autoApproved += 1;
      processed += 1;
    }

    const checkpointUpdate = {
      history_id: latestHistoryId,
      updated_at: new Date().toISOString(),
    };
    const { error: checkpointSaveError } = checkpoint
      ? await admin
          .from("gmail_payment_checkpoints")
          .update(checkpointUpdate)
          .eq("id", true)
      : await admin.from("gmail_payment_checkpoints").insert({
          id: true,
          ...checkpointUpdate,
        });
    if (checkpointSaveError)
      throw new Error(
        `Could not save Gmail history checkpoint: ${checkpointSaveError.message}`,
      );

    return {
      initialized: !checkpoint,
      processed,
      autoApproved,
      ignoredNonMatchingSenders,
      message: checkpoint
        ? `${autoApproved} exact-order payment${autoApproved === 1 ? " was" : "s were"} automatically accepted. Recent matching notifications and new messages were scanned; unmatched or unverified notifications remain pending.`
        : `Gmail history baseline saved. ${autoApproved} exact-order payment${autoApproved === 1 ? " was" : "s were"} automatically accepted from recent matching notifications; unmatched or unverified notifications remain pending.`,
    };
  });
