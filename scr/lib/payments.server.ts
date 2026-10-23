import "@tanstack/react-start/server-only";
import type {
  CreateUpiCheckoutOrderInput,
  GetUpiOrderDetailsInput,
} from "@/lib/payments";
import { isValidMinecraftName } from "@/lib/minecraft";
import { buildUpiPaymentUri, isValidUpiVpa } from "@/lib/upi";

async function requiredEnv(name: string) {
  const { requiredServerEnv } = await import("@/lib/server-env.server");
  const fallback =
    name === "VITE_SUPABASE_URL"
      ? import.meta.env["VITE_SUPABASE_URL"]
      : name === "VITE_SUPABASE_ANON_KEY"
        ? import.meta.env["VITE_SUPABASE_ANON_KEY"]
        : undefined;
  return requiredServerEnv(name, fallback);
}

export async function getClients(accessToken: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const [url, anonKey, serviceKey] = await Promise.all([
    requiredEnv("VITE_SUPABASE_URL"),
    requiredEnv("VITE_SUPABASE_ANON_KEY"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  ]);
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sign in before placing an order.");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, authClient, user: data.user };
}

async function merchantVpa() {
  const vpa = await requiredEnv("MERCHANT_UPI_ID");
  if (!isValidUpiVpa(vpa))
    throw new Error("MERCHANT_UPI_ID must be a valid UPI ID.");
  return vpa;
}

export async function createUpiCheckoutOrderImpl(
  data: CreateUpiCheckoutOrderInput,
) {
  const vpa = await merchantVpa();
  const { admin, user } = await getClients(data.accessToken);
  const productIds = data.items.map((item) => item.productId);
  const { data: products, error: productError } = await admin
    .from("products")
    .select("id,name,price_paise,enabled,single,delivery_commands")
    .in("id", productIds);
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
  if (products.some((product) => !product.delivery_commands?.length))
    throw new Error(
      "One or more products are missing Minecraft delivery commands. Contact the store admin.",
    );
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

  const productById = new Map(products.map((product) => [product.id, product]));
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
  if (totalPaise < 100) throw new Error("The order total must be at least ₹1.");

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
    .select("id,expires_at")
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
        delivery_commands: product.delivery_commands,
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

  return {
    orderId: order.id,
    amountPaise: totalPaise,
    vpa,
    upiUri: buildUpiPaymentUri({
      vpa,
      amountPaise: totalPaise,
      orderId: order.id,
    }),
    expiresAt: order.expires_at,
    status: "pending" as const,
  };
}

export async function getUpiOrderDetailsImpl(data: GetUpiOrderDetailsInput) {
  const { admin, user } = await getClients(data.accessToken);
  const { data: order, error } = await admin
    .from("orders")
    .select("id,total_paise,status,expires_at")
    .eq("id", data.orderId)
    .eq("user_id", user.id)
    .single();
  if (error || !order) throw new Error("Order not found in your account.");
  const status = order.status as
    "pending" | "paid" | "completed" | "rejected" | "cancelled" | "refunded";
  const vpa = status === "pending" ? await merchantVpa() : "";
  return {
    orderId: order.id,
    amountPaise: order.total_paise,
    vpa,
    upiUri:
      status === "pending" && new Date(order.expires_at).getTime() > Date.now()
        ? buildUpiPaymentUri({
            vpa,
            amountPaise: order.total_paise,
            orderId: order.id,
          })
        : null,
    expiresAt: order.expires_at,
    status,
  };
}
