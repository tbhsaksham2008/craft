export type FamAppNotificationCandidate = {
  sender: string | null;
  receivedAt: string | null;
  transactionId: string | null;
  utr: string | null;
  amountPaise: number | null;
  currency: "INR" | null;
  paymentStatus: "received" | "ambiguous";
  dkimPass: boolean;
  authenticationResult: string | null;
  orderIdHint: string | null;
  reviewReason: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function findTextBody(payload: GmailMessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data)
    return decodeBase64Url(payload.body.data);
  return (payload.parts ?? []).map(findTextBody).filter(Boolean).join("\n");
}

function findHtmlBody(payload: GmailMessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/html" && payload.body?.data)
    return decodeBase64Url(payload.body.data);
  return (payload.parts ?? []).map(findHtmlBody).filter(Boolean).join("\n");
}

export type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    mimeType?: string;
    parts?: GmailMessagePart[];
  };
};

function htmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8377;|&(?:#x20b9|#8377);/gi, "₹")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const codePoint = Number(code);
      return Number.isInteger(codePoint) &&
        codePoint >= 0 &&
        codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n");
}

function extractAmount(text: string) {
  const match = text.match(
    /successfully\s+received[\s\S]{0,50}?₹\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  const capturedAmount = match?.[1];
  if (!capturedAmount) return null;
  const rupees = Number(capturedAmount.replace(/,/g, ""));
  const paise = Math.round(rupees * 100);
  return Number.isFinite(rupees) && Number.isSafeInteger(paise) && paise > 0
    ? paise
    : null;
}

export function parseFamAppNotification(input: {
  headers: Array<{ name: string; value: string }>;
  receivedAt: string | null;
  body: string;
  configuredSender: string;
  configuredDkimDomain: string;
}): FamAppNotificationCandidate {
  const headers = new Map<string, string>();
  for (const header of input.headers) {
    const name = header.name.toLowerCase();
    if (!headers.has(name)) headers.set(name, header.value.trim());
  }
  const fromHeader = headers.get("from") ?? null;
  const sender = fromHeader?.match(/<([^>]+)>/)?.[1] ?? fromHeader;
  const normalizedSender =
    sender && sender.trim().length <= 254 ? sender.trim().toLowerCase() : null;
  const authenticationResult = headers.get("authentication-results") ?? null;
  const escapedDomain = input.configuredDkimDomain.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const trustedAuthenticationResult =
    authenticationResult?.match(/^mx\.google\.com;\s*(.*)$/i)?.[1] ?? "";
  const dkimResult =
    trustedAuthenticationResult.match(/(?:^|[;\s])dkim=pass\b([^;]*)/i)?.[1] ??
    "";
  const dkimPass = new RegExp(
    `(?:^|\\s)header\\.d=${escapedDomain}(?:\\s|$)`,
    "i",
  ).test(dkimResult);

  const text = htmlToText(input.body);
  const transactionId =
    text.match(/transaction\s+id\s*:?\s*([A-Z0-9_-]{5,128})/i)?.[1] ?? null;
  const utr = text.match(/\butr\s*:?\s*([A-Z0-9_-]{6,128})/i)?.[1] ?? null;
  const orderIdHint =
    text.match(
      /\border(?:\s+id)?\s*[:#]?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
    )?.[1] ?? null;
  const amountPaise = extractAmount(text);
  const received = /successfully\s+received/i.test(text);
  const reasons: string[] = [];

  if (
    !normalizedSender ||
    normalizedSender !== input.configuredSender.toLowerCase()
  )
    reasons.push("Sender did not match the configured notification address.");
  if (!dkimPass)
    reasons.push(
      "A passing DKIM result for the configured domain was not present.",
    );
  if (!received || amountPaise === null)
    reasons.push(
      "The received-payment status or amount was missing or ambiguous.",
    );
  if (!transactionId && !utr)
    reasons.push(
      "No transaction ID or UTR was present in the expected format.",
    );

  return {
    sender: normalizedSender,
    receivedAt: input.receivedAt,
    transactionId,
    utr,
    amountPaise,
    currency: amountPaise === null ? null : "INR",
    paymentStatus: received && amountPaise !== null ? "received" : "ambiguous",
    dkimPass,
    authenticationResult,
    orderIdHint,
    reviewReason: reasons.length
      ? reasons.join(" ")
      : "Email is evidence only; independently reconcile settlement before approving.",
  };
}

export function parseGmailMessage(
  message: GmailMessage,
  input: {
    configuredSender: string;
    configuredDkimDomain: string;
  },
) {
  const headers = message.payload?.headers ?? [];
  const body =
    findTextBody(message.payload) ||
    findHtmlBody(message.payload) ||
    (message.payload?.body?.data
      ? decodeBase64Url(message.payload.body.data)
      : "");
  const receivedDate = message.internalDate
    ? new Date(Number(message.internalDate))
    : null;
  const receivedAt =
    receivedDate && !Number.isNaN(receivedDate.getTime())
      ? receivedDate.toISOString()
      : null;

  return parseFamAppNotification({
    headers,
    body,
    receivedAt,
    configuredSender: input.configuredSender,
    configuredDkimDomain: input.configuredDkimDomain,
  });
}

export function decodeGmailBodyForTesting(value: string) {
  return decodeBase64Url(value);
}
