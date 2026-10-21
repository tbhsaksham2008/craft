import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import {
  fetchRazorpayPayment,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay.server";

type RazorpayWebhook = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
};

function requiredEnv(name: string) {
  const value =
    name === "VITE_SUPABASE_URL"
      ? (import.meta.env["VITE_SUPABASE_URL"] ?? process.env[name])
      : process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

async function readRawBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_000_000) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function handleRazorpayWebhook(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return new Response("Expected a JSON webhook event.", { status: 415 });
  const rawBody = await readRawBody(request);
  if (rawBody === null)
    return new Response("Missing or oversized webhook event.", {
      status: 400,
    });
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature))
    return new Response("Invalid Razorpay signature.", { status: 400 });

  let event: RazorpayWebhook;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhook;
  } catch {
    return new Response("Invalid webhook JSON.", { status: 400 });
  }
  if (event.event !== "payment.captured")
    return new Response(null, { status: 204 });

  const reportedPayment = event.payload?.payment?.entity;
  if (
    !reportedPayment?.id ||
    !reportedPayment.order_id ||
    typeof reportedPayment.amount !== "number" ||
    !reportedPayment.currency
  )
    return new Response("Missing payment details.", { status: 400 });

  const payment = await fetchRazorpayPayment(reportedPayment.id);
  if (
    payment.id !== reportedPayment.id ||
    payment.order_id !== reportedPayment.order_id ||
    payment.amount !== reportedPayment.amount ||
    payment.currency !== reportedPayment.currency ||
    payment.status !== "captured" ||
    payment.currency !== "INR"
  )
    return new Response("Payment details do not match.", { status: 400 });

  const admin = createClient(
    requiredEnv("VITE_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,total_paise,status")
    .eq("razorpay_order_id", payment.order_id)
    .single();
  if (orderError || !order) {
    console.error(
      "Verified Razorpay payment has no matching order",
      payment.order_id,
      orderError,
    );
    return new Response("Order not found.", { status: 404 });
  }
  if (payment.amount !== order.total_paise)
    return new Response("Payment amount does not match.", { status: 400 });
  if (order.status === "paid") return new Response(null, { status: 204 });
  if (order.status !== "pending")
    return new Response("Order is no longer pending.", { status: 409 });

  const { error: completionError } = await admin.rpc("complete_paid_order", {
    p_order_id: order.id,
    p_payment_id: payment.id,
  });
  if (completionError) {
    console.error(
      "Could not finalize verified Razorpay order",
      completionError,
    );
    return new Response("Order finalization failed.", { status: 500 });
  }
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/api/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleRazorpayWebhook(request);
        } catch (error) {
          console.error("Razorpay webhook failed", error);
          return new Response("Webhook processing failed.", { status: 500 });
        }
      },
    },
  },
});
