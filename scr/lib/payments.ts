import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidMinecraftName } from "@/lib/minecraft";
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  verifyRazorpaySignature,
} from "@/lib/razorpay.server";

const orderInput = z.object({
  accessToken: z.string().min(1),
  minecraftUsername: z
    .string()
    .refine(isValidMinecraftName, "Enter a valid Minecraft username."),
  items: z
    .array(
      z.object({
        productId: z.string().min(2).max(64),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  discountCode: z.string().max(32).optional(),
});

const verificationInput = z.object({
  accessToken: z.string().min(1),
  razorpayOrderId: z.string().min(1).max(128),
  razorpayPaymentId: z.string().min(1).max(128),
  razorpaySignature: z.string().regex(/^[a-f\d]{64}$/i),
});

function requiredEnv(name: string) {
  const value =
    name === "VITE_SUPABASE_URL"
      ? (import.meta.env["VITE_SUPABASE_URL"] ?? process.env[name])
      : name === "VITE_SUPABASE_ANON_KEY"
        ? (import.meta.env["VITE_SUPABASE_ANON_KEY"] ?? process.env[name])
        : process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

async function getClients(accessToken: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = requiredEnv("VITE_SUPABASE_URL");
  const anonKey = requiredEnv("VITE_SUPABASE_ANON_KEY");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sign in before placing an order.");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, user: data.user };
}

export const createRazorpayCheckoutOrder = createServerFn({ method: "POST" })
  .validator(orderInput)
  .handler(async ({ data }) => {
    const { admin, user } = await getClients(data.accessToken);
    const { data: products, error: productError } = await admin
      .from("products")
      .select("id,name,price_paise,enabled,single")
      .in(
        "id",
        data.items.map((item) => item.productId),
      );
    if (productError)
      throw new Error(`Could not validate your cart: ${productError.message}`);
    if (
      !products ||
      products.length !== data.items.length ||
      products.some((product) => !product.enabled)
    ) {
      throw new Error(
        "One or more products are unavailable. Refresh your cart and try again.",
      );
    }
    if (products.some((product) => product.price_paise < 1))
      throw new Error("One or more products do not have a price set yet.");
    if (
      products.some(
        (product) =>
          product.single &&
          data.items.find((item) => item.productId === product.id)?.quantity !==
            1,
      )
    ) {
      throw new Error("A limited item can only be purchased once per order.");
    }

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const subtotalPaise = data.items.reduce(
      (sum, item) =>
        sum + productById.get(item.productId)!.price_paise * item.quantity,
      0,
    );
    if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise > 2_147_483_647)
      throw new Error("This cart total exceeds the supported checkout limit.");
    let discountCode: string | null = null;
    let discountPaise = 0;
    if (data.discountCode?.trim()) {
      const { data: discounts, error: discountError } = await admin.rpc(
        "validate_discount_code",
        { p_code: data.discountCode },
      );
      if (discountError)
        throw new Error(
          `Could not validate the discount code: ${discountError.message}`,
        );
      if (!discounts?.length)
        throw new Error("That discount code is invalid or expired.");
      discountCode = discounts[0].code;
      discountPaise = Math.floor(
        (subtotalPaise * discounts[0].percent_off) / 100,
      );
    }
    const totalPaise = subtotalPaise - discountPaise;
    if (totalPaise < 100)
      throw new Error("The order total must be at least ₹1.");

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        minecraft_username: data.minecraftUsername,
        currency: "INR",
        subtotal_paise: subtotalPaise,
        discount_paise: discountPaise,
        total_paise: totalPaise,
        discount_code: discountCode,
      })
      .select("id")
      .single();
    if (orderError)
      throw new Error(`Could not create the order: ${orderError.message}`);

    const { error: itemsError } = await admin.from("order_items").insert(
      data.items.map((item) => {
        const product = productById.get(item.productId)!;
        return {
          order_id: order.id,
          product_id: product.id,
          name: product.name,
          unit_price_paise: product.price_paise,
          quantity: item.quantity,
        };
      }),
    );
    if (itemsError) {
      const { error: cleanupError } = await admin
        .from("orders")
        .delete()
        .eq("id", order.id);
      if (cleanupError)
        console.error("Could not clean up incomplete order", cleanupError);
      throw new Error(`Could not save the order items: ${itemsError.message}`);
    }

    try {
      const razorpayOrder = await createRazorpayOrder({
        amount: totalPaise,
        receipt: order.id,
      });
      const { error: linkError } = await admin
        .from("orders")
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq("id", order.id);
      if (linkError)
        throw new Error(
          `Could not link the Razorpay order: ${linkError.message}`,
        );
      return {
        keyId: getRazorpayKeyId(),
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      };
    } catch (error) {
      const { error: cancelError } = await admin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("status", "pending");
      if (cancelError)
        console.error("Could not cancel failed checkout order", cancelError);
      throw error;
    }
  });

export const verifyRazorpayCheckoutPayment = createServerFn({
  method: "POST",
})
  .validator(verificationInput)
  .handler(async ({ data }) => {
    const { admin, user } = await getClients(data.accessToken);
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,total_paise,status")
      .eq("razorpay_order_id", data.razorpayOrderId)
      .eq("user_id", user.id)
      .single();
    if (orderError || !order)
      throw new Error("This Razorpay order is not linked to your account.");
    if (order.status === "paid") return { paid: true };
    if (order.status !== "pending")
      throw new Error("This order can no longer be completed.");
    if (
      !verifyRazorpaySignature(
        `${data.razorpayOrderId}|${data.razorpayPaymentId}`,
        data.razorpaySignature,
      )
    ) {
      throw new Error("Razorpay payment signature is invalid.");
    }

    let payment = await fetchRazorpayPayment(data.razorpayPaymentId);
    if (
      payment.order_id === data.razorpayOrderId &&
      payment.status === "authorized" &&
      payment.amount === order.total_paise &&
      payment.currency === "INR"
    ) {
      payment = await captureRazorpayPayment(
        data.razorpayPaymentId,
        order.total_paise,
      );
    }
    if (
      payment.order_id !== data.razorpayOrderId ||
      payment.status !== "captured" ||
      payment.amount !== order.total_paise ||
      payment.currency !== "INR"
    ) {
      throw new Error(
        "Razorpay could not verify the completed payment details.",
      );
    }

    const { error: completionError } = await admin.rpc("complete_paid_order", {
      p_order_id: order.id,
      p_payment_id: payment.id,
    });
    if (completionError)
      throw new Error(
        `Payment succeeded but order finalization failed: ${completionError.message}`,
      );
    return { paid: true };
  });
