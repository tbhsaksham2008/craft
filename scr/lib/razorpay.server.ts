import { createHmac, timingSafeEqual } from "node:crypto";

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function razorpayAuthorization() {
  return `Basic ${Buffer.from(
    `${requiredEnv("RAZORPAY_KEY_ID")}:${requiredEnv("RAZORPAY_KEY_SECRET")}`,
  ).toString("base64")}`;
}

async function razorpayRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      authorization: razorpayAuthorization(),
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    console.error("Razorpay request failed", response.status, path);
    throw new Error(`Razorpay request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function verifyRazorpaySignature(message: string, signature: string) {
  const expected = createHmac("sha256", requiredEnv("RAZORPAY_KEY_SECRET"))
    .update(message)
    .digest();
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const received = Buffer.from(signature, "hex");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
) {
  const expected = createHmac("sha256", requiredEnv("RAZORPAY_WEBHOOK_SECRET"))
    .update(rawBody)
    .digest();
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const received = Buffer.from(signature, "hex");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function createRazorpayOrder(input: {
  amount: number;
  receipt: string;
}) {
  return razorpayRequest<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amount,
      currency: "INR",
      receipt: input.receipt,
    }),
  });
}

export function fetchRazorpayPayment(paymentId: string) {
  return razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}`,
  );
}

export function captureRazorpayPayment(paymentId: string, amount: number) {
  return razorpayRequest<RazorpayPayment>(
    `/payments/${encodeURIComponent(paymentId)}/capture`,
    {
      method: "POST",
      body: JSON.stringify({ amount, currency: "INR" }),
    },
  );
}

export function getRazorpayKeyId() {
  return requiredEnv("RAZORPAY_KEY_ID");
}
