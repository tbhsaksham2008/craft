import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from "./razorpay.server";

const originalKeySecret = process.env["RAZORPAY_KEY_SECRET"];
const originalWebhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];

afterEach(() => {
  if (originalKeySecret === undefined)
    delete process.env["RAZORPAY_KEY_SECRET"];
  else process.env["RAZORPAY_KEY_SECRET"] = originalKeySecret;
  if (originalWebhookSecret === undefined)
    delete process.env["RAZORPAY_WEBHOOK_SECRET"];
  else process.env["RAZORPAY_WEBHOOK_SECRET"] = originalWebhookSecret;
});

describe("Razorpay signature verification", () => {
  it("validates checkout signatures and rejects mismatches", () => {
    const message = "order_123|pay_456";
    const secret = "test-key-secret";
    process.env["RAZORPAY_KEY_SECRET"] = secret;
    const signature = createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    expect(verifyRazorpaySignature(message, signature)).toBe(true);
    expect(verifyRazorpaySignature(`${message}!`, signature)).toBe(false);
  });

  it("validates webhook signatures against the exact raw body", () => {
    const body = '{"event":"payment.captured"}';
    const secret = "test-webhook-secret";
    process.env["RAZORPAY_WEBHOOK_SECRET"] = secret;
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    expect(verifyRazorpayWebhookSignature(body, signature)).toBe(true);
    expect(verifyRazorpayWebhookSignature(`${body}\n`, signature)).toBe(false);
  });

  it("rejects malformed signatures", () => {
    process.env["RAZORPAY_KEY_SECRET"] = "test-key-secret";

    expect(verifyRazorpaySignature("message", "not-a-signature")).toBe(false);
  });
});
