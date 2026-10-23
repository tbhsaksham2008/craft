import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CircleDollarSign,
  Search,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  XCircle,
} from "lucide-react";
import { InfoPage } from "@/components/site/InfoPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { scanGmailPaymentNotifications } from "@/lib/gmail-payments";
import { seo } from "@/lib/seo";
import type { Category, Product } from "@/data/products";
import { formatPrice } from "@/config/site";

type ProductRow = Omit<Product, "price" | "originalPrice" | "image"> & {
  price_paise: number;
  original_price_paise: number | null;
  image_key: "rank" | "coins" | "crate";
  image_url: string | null;
  delivery_commands: string[];
};

function productImageStoragePath(imageUrl: string | null) {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    const prefix = "/storage/v1/object/public/product-images/";
    if (!url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

type DiscountRow = {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  expires_at: string | null;
};

type QueueRow = {
  id: string;
  status: "queued" | "processing" | "delivered" | "failed";
  attempts: number;
  last_error: string | null;
  order_items: {
    name: string;
    quantity: number;
    orders: { minecraft_username: string; id: string } | null;
  } | null;
};

type OrderHistoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price_paise: number;
};

type OrderHistoryRow = {
  id: string;
  user_id: string;
  minecraft_username: string;
  status:
    "pending" | "paid" | "completed" | "rejected" | "cancelled" | "refunded";
  currency: string;
  subtotal_paise: number;
  discount_paise: number;
  total_paise: number;
  discount_code: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  customer_email: string | null;
  items: OrderHistoryItem[];
};

type GmailPaymentEventRow = {
  id: string;
  gmail_message_id: string;
  sender: string | null;
  received_at: string | null;
  transaction_id: string | null;
  utr: string | null;
  amount_paise: number | null;
  currency: string | null;
  payment_status: "received" | "ambiguous";
  dkim_pass: boolean;
  sender_auth_pass: boolean;
  order_id_hint: string | null;
  review_status: "manual_review" | "reviewed" | "rejected";
  review_reason: string;
  admin_review_reason: string | null;
};

type OrderFilter = "all" | OrderHistoryRow["status"];

const envVarTests = [
  { name: "VITE_SUPABASE_URL", label: "Supabase URL" },
  { name: "VITE_SUPABASE_ANON_KEY", label: "Supabase anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service-role key" },
  { name: "MERCHANT_UPI_ID", label: "Merchant UPI ID" },
  { name: "GOOGLE_OAUTH_CLIENT_ID", label: "Google OAuth client ID" },
  { name: "GOOGLE_OAUTH_CLIENT_SECRET", label: "Google OAuth client secret" },
  { name: "GMAIL_REFRESH_TOKEN", label: "Gmail refresh token" },
  { name: "GMAIL_ACCOUNT_EMAIL", label: "Gmail account email" },
  { name: "MINECRAFT_PLUGIN_TOKEN", label: "Minecraft plugin token" },
  {
    name: "FAMPAY_NOTIFICATION_DKIM_DOMAIN",
    label: "FamPay DKIM domain (optional)",
  },
] as const;

type EnvVarName = (typeof envVarTests)[number]["name"];
const secretEnvNames: readonly EnvVarName[] = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "MINECRAFT_PLUGIN_TOKEN",
];

const emptyProduct = {
  id: "",
  name: "",
  category: "ranks" as Category,
  price: "",
  originalPrice: "",
  description: "",
  perks: "",
  deliveryCommands: "",
  imageKey: "rank",
  featured: false,
  enabled: true,
  single: false,
  tint: "sky",
};

export const Route = createFileRoute("/admin")({
  head: () =>
    seo("Admin", "Manage Craft SMP products, discounts and fulfillment."),
  component: AdminPage,
});

function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [orders, setOrders] = useState<OrderHistoryRow[]>([]);
  const [gmailEvents, setGmailEvents] = useState<GmailPaymentEventRow[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [orderLimit, setOrderLimit] = useState(50);
  const [form, setForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [productToRemove, setProductToRemove] = useState<ProductRow | null>(
    null,
  );
  const [removingProduct, setRemovingProduct] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("10");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [scanningGmail, setScanningGmail] = useState(false);
  const [testingEnvVariable, setTestingEnvVariable] =
    useState<EnvVarName | null>(null);
  const [envTestResults, setEnvTestResults] = useState<
    Partial<Record<EnvVarName, { success: boolean; message: string }>>
  >({});
  const [envValues, setEnvValues] = useState<
    Partial<Record<EnvVarName, string>>
  >({});
  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareApiToken, setCloudflareApiToken] = useState("");
  const [savingEnvVariable, setSavingEnvVariable] = useState<EnvVarName | null>(
    null,
  );
  const [savingOrderStatus, setSavingOrderStatus] = useState<string | null>(
    null,
  );
  const scanningGmailRef = useRef(false);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(imageFile);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

  const refresh = useCallback(
    async (requestedOrderLimit = orderLimit) => {
      if (!supabase) return;
      setError("");
      setRefreshing(true);
      try {
        const [
          productResult,
          discountResult,
          queueResult,
          orderResult,
          gmailEventResult,
        ] = await Promise.all([
          supabase.from("products").select("*").order("name"),
          supabase
            .from("discount_codes")
            .select("id,code,percent_off,active,expires_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("fulfillment_queue")
            .select(
              "id,status,attempts,last_error,order_items(name,quantity,orders(minecraft_username,id))",
            )
            .order("created_at", { ascending: true }),
          supabase
            .from("orders")
            .select(
              "id,user_id,minecraft_username,status,currency,subtotal_paise,discount_paise,total_paise,discount_code,created_at,expires_at,paid_at",
            )
            .order("created_at", { ascending: false })
            .range(0, requestedOrderLimit - 1),
          supabase
            .from("gmail_payment_events")
            .select(
              "id,gmail_message_id,sender,received_at,transaction_id,utr,amount_paise,currency,payment_status,dkim_pass,sender_auth_pass,order_id_hint,review_status,review_reason,admin_review_reason",
            )
            .order("received_at", { ascending: false })
            .limit(1000),
        ]);
        const issue =
          productResult.error ??
          discountResult.error ??
          queueResult.error ??
          orderResult.error ??
          gmailEventResult.error;
        if (issue) throw issue;
        const orderRows = orderResult.data ?? [];
        const userIds = [...new Set(orderRows.map((order) => order.user_id))];
        const orderIds = orderRows.map((order) => order.id);
        const [profileResult, itemResult] =
          orderRows.length > 0
            ? await Promise.all([
                supabase.from("profiles").select("id,email").in("id", userIds),
                supabase
                  .from("order_items")
                  .select("id,order_id,name,quantity,unit_price_paise")
                  .in("order_id", orderIds),
              ])
            : [
                { data: [], error: null },
                { data: [], error: null },
              ];
        const historyError = profileResult.error ?? itemResult.error;
        if (historyError) throw historyError;
        const emailByUserId = new Map(
          (profileResult.data ?? []).map((profile) => [
            profile.id,
            profile.email,
          ]),
        );
        const itemsByOrderId = new Map<string, OrderHistoryItem[]>();
        for (const item of itemResult.data ?? []) {
          const historyItem = {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit_price_paise: item.unit_price_paise,
          };
          const orderItems = itemsByOrderId.get(item.order_id) ?? [];
          orderItems.push(historyItem);
          itemsByOrderId.set(item.order_id, orderItems);
        }
        setProducts(productResult.data ?? []);
        setDiscounts(discountResult.data ?? []);
        setQueue((queueResult.data ?? []) as unknown as QueueRow[]);
        setGmailEvents(
          (gmailEventResult.data ?? []) as unknown as GmailPaymentEventRow[],
        );
        setOrders(
          orderRows.map((order) => ({
            ...order,
            customer_email: emailByUserId.get(order.user_id) ?? null,
            items: itemsByOrderId.get(order.id) ?? [],
          })),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? `Admin data could not be loaded: ${loadError.message}`
            : "Admin data could not be loaded.",
        );
      } finally {
        setRefreshing(false);
      }
    },
    [orderLimit],
  );

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setChecking(false);
      return;
    }
    let active = true;
    void client.auth
      .getUser()
      .then(async ({ data, error: authError }) => {
        if (!active) return;
        if (authError || !data.user) {
          setAuthorized(false);
          setChecking(false);
          return;
        }
        const { data: profile, error: profileError } = await client
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (!active) return;
        if (profileError)
          setError(`Could not verify admin access: ${profileError.message}`);
        setAuthorized(profile?.role === "admin");
        setChecking(false);
        if (profile?.role === "admin") await refresh();
      })
      .catch((authError: unknown) => {
        if (!active) return;
        setError(
          authError instanceof Error
            ? `Could not verify admin access: ${authError.message}`
            : "Could not verify admin access.",
        );
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    setNotice("");
    const pricePaise = Math.round(Number(form.price) * 100);
    const originalPricePaise = form.originalPrice
      ? Math.round(Number(form.originalPrice) * 100)
      : null;
    const deliveryCommands = form.deliveryCommands
      .split("\n")
      .map((command) => command.trim())
      .filter(Boolean);
    if (
      form.enabled &&
      pricePaise > 0 &&
      (!deliveryCommands.length ||
        deliveryCommands.length > 10 ||
        deliveryCommands.some((command) => {
          const withoutSupportedTokens = command.replace(
            /\{(?:player|quantity|order_id|item_id)\}/g,
            "",
          );
          return (
            command.length > 256 ||
            !command.includes("{player}") ||
            !/^[A-Za-z0-9_:.{} -]+$/.test(command) ||
            /[{}]/.test(withoutSupportedTokens)
          );
        }))
    ) {
      setError(
        "Enabled paid products need at least one safe delivery command with a {player} placeholder.",
      );
      return;
    }
    if (
      !Number.isInteger(pricePaise) ||
      pricePaise < 0 ||
      (pricePaise === 0 && form.category !== "ranks") ||
      pricePaise > 10000000 ||
      (originalPricePaise !== null &&
        (!Number.isInteger(originalPricePaise) ||
          pricePaise === 0 ||
          originalPricePaise < pricePaise ||
          originalPricePaise > 10000000))
    ) {
      setError(
        "Enter a valid INR price and ensure the original price is not lower than the sale price.",
      );
      return;
    }
    const payload = {
      id: form.id.trim().toLowerCase(),
      name: form.name.trim(),
      category: form.category,
      price_paise: pricePaise,
      original_price_paise: originalPricePaise,
      description: form.description.trim(),
      perks: form.perks
        .split("\n")
        .map((perk) => perk.trim())
        .filter(Boolean),
      delivery_commands: deliveryCommands,
      image_key: form.imageKey,
      featured: form.featured,
      enabled: form.enabled,
      single: form.single,
      tint: form.tint,
      updated_at: new Date().toISOString(),
    };
    let uploadedImagePath: string | null = null;
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const extension =
          imageFile.type === "image/jpeg"
            ? "jpg"
            : imageFile.type === "image/webp"
              ? "webp"
              : "png";
        uploadedImagePath = `${payload.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(uploadedImagePath, imageFile, {
            contentType: imageFile.type,
            cacheControl: "31536000",
            upsert: false,
          });
        if (uploadError)
          throw new Error(
            `Could not upload product image: ${uploadError.message}`,
          );
        imageUrl = supabase.storage
          .from("product-images")
          .getPublicUrl(uploadedImagePath).data.publicUrl;
      }
      const savedPayload = imageUrl
        ? { ...payload, image_url: imageUrl }
        : payload;
      const result = editingId
        ? await supabase
            .from("products")
            .update(savedPayload)
            .eq("id", editingId)
        : await supabase.from("products").insert(savedPayload);
      if (result.error) throw result.error;
      setNotice("Product saved.");
      setForm(emptyProduct);
      setImageFile(null);
      setCurrentImageUrl("");
      setEditingId(null);
      await refresh();
    } catch (saveError) {
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage
          .from("product-images")
          .remove([uploadedImagePath]);
        if (cleanupError)
          console.error(
            "Could not clean up failed product image upload",
            cleanupError,
          );
      }
      setError(
        saveError instanceof Error
          ? `Could not save product: ${saveError.message}`
          : "Could not save product.",
      );
    }
  };

  const editProduct = (product: ProductRow) => {
    setEditingId(product.id);
    setImageFile(null);
    setCurrentImageUrl(product.image_url ?? "");
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: (product.price_paise / 100).toFixed(2),
      originalPrice: product.original_price_paise
        ? (product.original_price_paise / 100).toFixed(2)
        : "",
      description: product.description,
      perks: product.perks.join("\n"),
      deliveryCommands: product.delivery_commands.join("\n"),
      imageKey: product.image_key,
      featured: product.featured ?? false,
      enabled: product.enabled,
      single: product.single ?? false,
      tint: product.tint,
    });
  };

  const selectProductImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setImageFile(null);
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageFile(null);
      setError("Product images must be 5 MB or smaller.");
      return;
    }
    setError("");
    setImageFile(file);
  };

  const removeProduct = async () => {
    if (!supabase || !productToRemove) return;
    setRemovingProduct(true);
    setError("");
    setNotice("");
    try {
      const { data: priorItems, error: lookupError } = await supabase
        .from("order_items")
        .select("id")
        .eq("product_id", productToRemove.id)
        .limit(1);
      if (lookupError)
        throw new Error(
          `Could not check the product's order history: ${lookupError.message}`,
        );

      if (priorItems?.length) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", productToRemove.id);
        if (updateError) throw updateError;
        setNotice(
          `${productToRemove.name} was removed from the shop. It remains in past order records.`,
        );
      } else {
        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .eq("id", productToRemove.id);
        if (deleteError) throw deleteError;

        const imagePath = productImageStoragePath(productToRemove.image_url);
        if (imagePath) {
          const { error: storageError } = await supabase.storage
            .from("product-images")
            .remove([imagePath]);
          if (storageError) {
            console.error(
              "Product was deleted but its image could not be removed",
              storageError,
            );
            setNotice(
              `${productToRemove.name} was deleted, but its uploaded image could not be removed.`,
            );
          } else {
            setNotice(`${productToRemove.name} was deleted.`);
          }
        } else {
          setNotice(`${productToRemove.name} was deleted.`);
        }
      }

      if (editingId === productToRemove.id) {
        setEditingId(null);
        setForm(emptyProduct);
        setImageFile(null);
        setCurrentImageUrl("");
      }
      setProductToRemove(null);
      await refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? `Could not remove product: ${removeError.message}`
          : "Could not remove product.",
      );
    } finally {
      setRemovingProduct(false);
    }
  };

  const createDiscount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    try {
      const { error: insertError } = await supabase
        .from("discount_codes")
        .insert({
          code: code.trim().toUpperCase(),
          percent_off: Number(percentOff),
        });
      if (insertError) throw insertError;
      setNotice("Discount code created.");
      setCode("");
      await refresh();
    } catch (insertError) {
      setError(
        insertError instanceof Error
          ? `Could not create discount code: ${insertError.message}`
          : "Could not create discount code.",
      );
    }
  };

  const scanPaymentEmail = useCallback(async () => {
    if (!supabase || scanningGmailRef.current) return;
    scanningGmailRef.current = true;
    setScanningGmail(true);
    setError("");
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session)
        throw new Error("Sign in with an admin account first.");
      const result = await scanGmailPaymentNotifications({
        data: { accessToken: sessionData.session.access_token },
      });
      setNotice(result.message);
      await refresh();
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? `Could not scan Gmail: ${scanError.message}`
          : "Could not scan Gmail.",
      );
    } finally {
      scanningGmailRef.current = false;
      setScanningGmail(false);
    }
  }, [refresh]);

  const testEnvironmentVariable = async (name: EnvVarName) => {
    if (!supabase) return;
    setTestingEnvVariable(name);
    setEnvTestResults((current) => ({
      ...current,
      [name]: undefined,
    }));
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error("Sign in with an admin account first.");
      }
      const response = await fetch("/api/admin/test-env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "test",
          name,
          accessToken: sessionData.session.access_token,
        }),
      });
      const result: {
        success?: boolean;
        message?: string;
        error?: string;
      } = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? `Test failed (HTTP ${response.status}).`,
        );
      }
      setEnvTestResults((current) => ({
        ...current,
        [name]: { success: true, message: result.message ?? "Test passed." },
      }));
    } catch (testError) {
      setEnvTestResults((current) => ({
        ...current,
        [name]: {
          success: false,
          message:
            testError instanceof Error
              ? testError.message
              : "Environment variable test failed.",
        },
      }));
    } finally {
      setTestingEnvVariable(null);
    }
  };

  const saveEnvironmentVariable = async (name: EnvVarName) => {
    if (!supabase) return;
    const value = envValues[name];
    if (!value?.trim()) {
      setEnvTestResults((current) => ({
        ...current,
        [name]: { success: false, message: "Enter a value to save." },
      }));
      return;
    }
    setSavingEnvVariable(name);
    setEnvTestResults((current) => ({ ...current, [name]: undefined }));
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error("Sign in with an admin account first.");
      }
      const response = await fetch("/api/admin/test-env", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save",
          name,
          value,
          accountId: cloudflareAccountId,
          apiToken: cloudflareApiToken,
          accessToken: sessionData.session.access_token,
        }),
      });
      const result: {
        success?: boolean;
        message?: string;
        error?: string;
      } = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(
          result.error ?? `Save failed (HTTP ${response.status}).`,
        );
      }
      setEnvValues((current) => ({ ...current, [name]: "" }));
      setEnvTestResults((current) => ({
        ...current,
        [name]: { success: true, message: result.message ?? "Value saved." },
      }));
    } catch (saveError) {
      setEnvTestResults((current) => ({
        ...current,
        [name]: {
          success: false,
          message:
            saveError instanceof Error
              ? saveError.message
              : "Could not update the Worker variable.",
        },
      }));
    } finally {
      setSavingEnvVariable(null);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [authorized, refresh]);

  const updateOrderStatus = async (
    event: FormEvent<HTMLFormElement>,
    orderId: string,
  ) => {
    event.preventDefault();
    if (!supabase) return;
    const status = String(new FormData(event.currentTarget).get("status"));
    const currentOrder = orders.find((order) => order.id === orderId);
    if (status === "completed" && currentOrder?.status === "completed") {
      setNotice("This order was completed after server delivery.");
      return;
    }
    if (
      !["pending", "paid", "rejected", "refunded", "cancelled"].includes(status)
    ) {
      setError("Choose a valid order status.");
      return;
    }
    setSavingOrderStatus(orderId);
    setError("");
    try {
      const { data: updated, error: updateError } = await supabase.rpc(
        "set_admin_order_status",
        { p_order_id: orderId, p_status: status },
      );
      if (updateError) throw updateError;
      if (!updated) {
        setNotice("Order status was already set to that value.");
      } else {
        setNotice(
          status === "paid"
            ? "Order marked paid and added to the fulfillment queue."
            : `Order status changed to ${status}.`,
        );
      }
      await refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? `Could not update order status: ${updateError.message}`
          : "Could not update order status.",
      );
    } finally {
      setSavingOrderStatus(null);
    }
  };

  const activeProductCount = products.filter(
    (product) => product.enabled,
  ).length;
  const inactiveProductCount = products.length - activeProductCount;
  const activeDiscountCount = discounts.filter(
    (discount) => discount.active,
  ).length;
  const openQueueCount = queue.filter(
    (item) => item.status === "queued" || item.status === "processing",
  ).length;
  const paidOrders = orders.filter(
    (order) => order.status === "paid" || order.status === "completed",
  );
  const paidRevenuePaise = paidOrders.reduce(
    (sum, order) => sum + order.total_paise,
    0,
  );
  const filteredOrders = orders.filter((order) => {
    if (orderFilter !== "all" && order.status !== orderFilter) return false;
    const term = orderSearch.trim().toLowerCase();
    if (!term) return true;
    return [
      order.id,
      order.minecraft_username,
      order.customer_email ?? "",
      order.discount_code ?? "",
      ...order.items.map((item) => item.name),
    ].some((value) => value.toLowerCase().includes(term));
  });

  return (
    <InfoPage
      title="Admin dashboard"
      sub="Manage your catalog, discount codes and reward delivery queue."
    >
      {!isSupabaseConfigured ? (
        <p className="rounded-2xl border bg-card p-6">
          Configure Supabase before using the admin dashboard.
        </p>
      ) : checking ? (
        <p className="rounded-2xl border bg-card p-6">Checking admin access…</p>
      ) : !authorized ? (
        <div className="rounded-2xl border bg-card p-6">
          <p role="alert">
            This account does not have admin access. Sign in with an admin
            account to continue.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/account">Go to account</Link>
          </Button>
        </div>
      ) : (
        <div className="admin-dashboard space-y-8">
          <section className="admin-enter relative overflow-hidden rounded-[2rem] border border-white/70 bg-brand p-6 shadow-glow sm:p-9">
            <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full bg-white/35 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 right-1/3 size-64 rounded-full bg-lilac/50 blur-3xl" />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
                  <ShieldCheck className="size-4" /> ADMIN CONTROL CENTER
                </p>
                <h2 className="mt-3 text-3xl sm:text-4xl">
                  Your server,{" "}
                  <span className="text-gradient">in control.</span>
                </h2>
                <p className="mt-2 max-w-xl text-sm text-foreground/70">
                  Keep products, promotions, and player rewards running
                  smoothly.
                </p>
              </div>
              <Button
                type="button"
                variant="glass"
                className="rounded-xl bg-white/50"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                <RefreshCw
                  className={refreshing ? "size-4 animate-spin" : "size-4"}
                />
                {refreshing ? "Refreshing…" : "Refresh dashboard"}
              </Button>
            </div>
            <div className="admin-orb" aria-hidden="true" />
          </section>

          <section
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Store overview"
          >
            {[
              {
                label: "Products in shop",
                value: activeProductCount,
                detail: `${inactiveProductCount} hidden`,
                Icon: Package,
                color: "bg-sky/50",
              },
              {
                label: "Active discounts",
                value: activeDiscountCount,
                detail: `${discounts.length} total codes`,
                Icon: Tags,
                color: "bg-lilac/50",
              },
              {
                label: "Open deliveries",
                value: openQueueCount,
                detail: `${queue.length} queue entries`,
                Icon: ClipboardList,
                color: "bg-blush/60",
              },
              {
                label: "Paid revenue",
                value: formatPrice(paidRevenuePaise / 100),
                detail: `${paidOrders.length} paid orders loaded`,
                Icon: CircleDollarSign,
                color: "bg-success/15",
              },
              {
                label: "Order history",
                value: orders.length,
                detail: `Latest ${orderLimit} orders`,
                Icon: CalendarDays,
                color: "bg-primary/35",
              },
            ].map(({ label, value, detail, Icon, color }, index) => (
              <article
                key={label}
                className={`admin-enter admin-stagger-${index + 1} rounded-2xl border bg-card p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-glow`}
              >
                <span
                  className={`grid size-10 place-items-center rounded-xl ${color}`}
                >
                  <Icon className="size-5" />
                </span>
                <p className="mt-4 text-2xl font-bold">{value}</p>
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </article>
            ))}
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive p-4 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl border border-success p-4 text-sm"
            >
              {notice}
            </p>
          )}
          <section className="admin-enter admin-stagger-1 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Payments
            </p>
            <h2 className="mt-1 text-2xl">Automatic payment processing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Incoming messages from no-reply@famapp.in are assigned to the
              newest pending order created before the message arrived. The
              message contents, amount, and sender authenticity are not
              independently verified. Confirm the transfer in your payment
              provider before relying on the order status. The Paper server
              scans every 30 seconds; orders become completed after delivery is
              acknowledged.
            </p>
          </section>

          <section className="admin-enter admin-stagger-1 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Payment notifications
                </p>
                <h2 className="mt-1 text-2xl">Payment notification inbox</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Review parsed notification details against the transaction in
                  your payment provider. Email notifications do not
                  independently confirm that funds were received.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={scanningGmail || refreshing}
                onClick={() => void scanPaymentEmail()}
              >
                <RefreshCw
                  className={`size-4 ${scanningGmail ? "animate-spin" : ""}`}
                />
                {scanningGmail ? "Scanning…" : "Scan Gmail"}
              </Button>
            </div>
            {gmailEvents.length ? (
              <ul className="mt-4 space-y-4">
                {gmailEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {event.payment_status === "received"
                            ? "Received-payment notification parsed"
                            : "Ambiguous payment email"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {event.received_at
                            ? new Date(event.received_at).toLocaleString()
                            : "Received time unavailable"}{" "}
                          · Sender authentication{" "}
                          {event.sender_auth_pass
                            ? "passed (aligned SPF, DKIM, or DMARC)"
                            : "not verified"}
                          {" · DKIM "}
                          {event.dkim_pass ? "passed" : "not verified"}
                        </p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          Sender: {event.sender ?? "unavailable"} · Gmail
                          message {event.gmail_message_id}
                        </p>
                      </div>
                      <span
                        className={`h-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                          event.admin_review_reason?.startsWith(
                            "Automatically accepted:",
                          )
                            ? "bg-success/10 text-success"
                            : event.review_status === "rejected"
                              ? "bg-muted text-muted-foreground"
                              : event.review_status === "reviewed"
                                ? "bg-sky/30 text-foreground"
                                : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {event.admin_review_reason?.startsWith(
                          "Automatically accepted:",
                        )
                          ? "auto-accepted"
                          : event.review_status === "manual_review"
                            ? "not auto-approved"
                            : event.review_status}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Parsed amount
                        </dt>
                        <dd>
                          {event.amount_paise === null
                            ? "Unclear"
                            : formatPrice(event.amount_paise / 100)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Order ID explicitly present in email
                        </dt>
                        <dd className="break-all font-mono">
                          {event.order_id_hint ??
                            "None; amount is not used to match"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Transaction ID
                        </dt>
                        <dd className="break-all font-mono">
                          {event.transaction_id ?? "Not parsed"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">UTR</dt>
                        <dd className="break-all font-mono">
                          {event.utr ?? "Not parsed"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {event.admin_review_reason ?? event.review_reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                No Gmail payment notifications have been scanned yet.
              </p>
            )}
          </section>

          <section className="admin-enter admin-stagger-1 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Sales & customers
                </p>
                <h2 className="mt-1 text-2xl">Order history</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recent purchases, payment status, and player details.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="relative">
                  <span className="sr-only">Search orders</span>
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={orderSearch}
                    onChange={(event) => setOrderSearch(event.target.value)}
                    placeholder="Search player, email, item…"
                    className="w-60 rounded-xl pl-9"
                  />
                </label>
                <select
                  aria-label="Filter orders by status"
                  value={orderFilter}
                  onChange={(event) =>
                    setOrderFilter(event.target.value as OrderFilter)
                  }
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                [
                  "Paid",
                  orders.filter((order) => order.status === "paid").length,
                ],
                [
                  "Completed",
                  orders.filter((order) => order.status === "completed").length,
                ],
                [
                  "Pending",
                  orders.filter((order) => order.status === "pending").length,
                ],
                [
                  "Rejected",
                  orders.filter((order) => order.status === "rejected").length,
                ],
                [
                  "Refunded",
                  orders.filter((order) => order.status === "refunded").length,
                ],
                [
                  "Cancelled",
                  orders.filter((order) => order.status === "cancelled").length,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border bg-muted/35 px-4 py-3"
                >
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {filteredOrders.map((order) => {
                const StatusIcon =
                  order.status === "paid" || order.status === "completed"
                    ? CheckCircle2
                    : order.status === "pending"
                      ? Clock3
                      : XCircle;
                const statusClass =
                  order.status === "paid" || order.status === "completed"
                    ? "bg-success/10 text-success"
                    : order.status === "pending"
                      ? "bg-amber-500/10 text-amber-700"
                      : order.status === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground";
                return (
                  <article
                    key={order.id}
                    className="rounded-2xl border p-4 transition-all duration-200 hover:border-primary/30 hover:bg-muted/20 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand">
                          <Package className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {order.minecraft_username}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {order.customer_email ?? "Email unavailable"}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            Order {order.id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatPrice(order.total_paise / 100)}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass}`}
                        >
                          <StatusIcon className="size-3.5" />
                          {order.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 border-t pt-4 text-sm md:grid-cols-[1fr_auto]">
                      <div className="space-y-1.5">
                        {order.items.length ? (
                          order.items.map((item) => (
                            <p
                              key={item.id}
                              className="flex flex-wrap justify-between gap-3"
                            >
                              <span>
                                {item.quantity} × {item.name}
                              </span>
                              <span className="text-muted-foreground">
                                {formatPrice(
                                  (item.unit_price_paise * item.quantity) / 100,
                                )}
                              </span>
                            </p>
                          ))
                        ) : (
                          <p className="text-muted-foreground">
                            No item details recorded.
                          </p>
                        )}
                        {order.discount_code && (
                          <p className="text-xs text-muted-foreground">
                            Discount code: {order.discount_code} (−
                            {formatPrice(order.discount_paise / 100)})
                          </p>
                        )}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground md:text-right">
                        <p>
                          Placed {new Date(order.created_at).toLocaleString()}
                        </p>
                        {order.paid_at && (
                          <p>Paid {new Date(order.paid_at).toLocaleString()}</p>
                        )}
                        {order.status === "pending" &&
                          new Date(order.expires_at).getTime() <=
                            Date.now() && (
                            <p className="font-semibold text-amber-700">
                              Payment request expired
                            </p>
                          )}
                      </div>
                    </div>
                    <form
                      className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-4"
                      onSubmit={(event) =>
                        void updateOrderStatus(event, order.id)
                      }
                    >
                      <label className="sr-only" htmlFor={`status-${order.id}`}>
                        Change order status
                      </label>
                      <select
                        id={`status-${order.id}`}
                        name="status"
                        defaultValue={order.status}
                        className="h-9 rounded-lg border bg-background px-3 text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="completed" disabled>
                          Completed (server-confirmed)
                        </option>
                        <option value="rejected">Rejected</option>
                        <option value="refunded">Refunded</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={savingOrderStatus === order.id}
                      >
                        {savingOrderStatus === order.id
                          ? "Saving…"
                          : "Save status"}
                      </Button>
                    </form>
                  </article>
                );
              })}
              {!filteredOrders.length && (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {orders.length
                    ? "No orders match your search or status filter."
                    : "No orders have been placed yet."}
                </p>
              )}
            </div>
            {orders.length === orderLimit && (
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={refreshing}
                  onClick={() => setOrderLimit((limit) => limit + 50)}
                >
                  Load more orders
                </Button>
              </div>
            )}
          </section>

          <section className="admin-enter admin-stagger-1 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Catalog
                </p>
                <h2 className="mt-1 text-2xl">
                  {editingId ? "Edit product" : "Add a product"}
                </h2>
              </div>
              {!editingId && (
                <span className="grid size-11 place-items-center rounded-xl bg-brand">
                  <Plus className="size-5" />
                </span>
              )}
            </div>
            <form
              onSubmit={(event) => void saveProduct(event)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="product-id">Product ID</Label>
                <Input
                  id="product-id"
                  value={form.id}
                  disabled={Boolean(editingId)}
                  onChange={(event) =>
                    setForm({ ...form, id: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <select
                  id="product-category"
                  className="h-10 rounded-xl border bg-background px-3"
                  value={form.category}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category: event.target.value as Category,
                    })
                  }
                >
                  {["ranks", "coins", "crates", "bundles", "cosmetics"].map(
                    (item) => (
                      <option key={item}>{item}</option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Price (INR)</Label>
                <Input
                  id="product-price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-original">
                  Original price (optional, INR)
                </Label>
                <Input
                  id="product-original"
                  inputMode="decimal"
                  value={form.originalPrice}
                  onChange={(event) =>
                    setForm({ ...form, originalPrice: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="product-delivery-commands">
                  Delivery commands (one per line)
                </Label>
                <textarea
                  id="product-delivery-commands"
                  className="min-h-24 rounded-xl border bg-background p-3 font-mono text-sm"
                  value={form.deliveryCommands}
                  onChange={(event) =>
                    setForm({ ...form, deliveryCommands: event.target.value })
                  }
                  placeholder="lp user {player} parent set bee"
                  aria-describedby="product-delivery-help"
                />
                <p
                  id="product-delivery-help"
                  className="text-xs text-muted-foreground"
                >
                  Runs as console when the player joins. Each line needs a{" "}
                  {"{player}"} placeholder and uses a restricted safe character
                  set. Commands are snapshotted into each new order.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-image">Product image</Label>
                <Input
                  id="product-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={selectProductImage}
                  className="h-auto py-2"
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, or WebP · up to 5 MB. Leave empty to keep the
                  existing image or use the category default.
                </p>
                {(imagePreview || currentImageUrl) && (
                  <img
                    src={imagePreview || currentImageUrl}
                    alt="Product image preview"
                    className="mt-2 size-24 rounded-xl border bg-muted object-contain p-2"
                  />
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="product-description">Description</Label>
                <Input
                  id="product-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="product-perks">Perks (one per line)</Label>
                <textarea
                  id="product-perks"
                  className="min-h-24 rounded-xl border bg-background p-3 text-sm"
                  value={form.perks}
                  onChange={(event) =>
                    setForm({ ...form, perks: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) =>
                      setForm({ ...form, enabled: event.target.checked })
                    }
                  />{" "}
                  Enabled
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) =>
                      setForm({ ...form, featured: event.target.checked })
                    }
                  />{" "}
                  Featured
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.single}
                    onChange={(event) =>
                      setForm({ ...form, single: event.target.checked })
                    }
                  />{" "}
                  Limited to one per cart
                </label>
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" variant="hero">
                  {editingId ? "Save changes" : "Add product"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyProduct);
                      setImageFile(null);
                      setCurrentImageUrl("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            <ul className="mt-6 divide-y border-t">
              {products.map((product) => (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border bg-muted">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="size-full object-contain p-1"
                        />
                      ) : (
                        <Package className="size-5 text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate">{product.name}</strong>
                      <span className="text-muted-foreground">
                        {product.price_paise > 0
                          ? formatPrice(product.price_paise / 100)
                          : "Price to be set"}{" "}
                        · {product.category}
                      </span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.enabled
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {product.enabled ? "Live" : "Hidden"}
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editProduct(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setProductToRemove(product)}
                      aria-label={`Remove ${product.name} from shop`}
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {products.length === 0 && (
              <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No products yet. Add your first product using the form above.
              </p>
            )}
            <AlertDialog
              open={Boolean(productToRemove)}
              onOpenChange={(open) => {
                if (!open && !removingProduct) setProductToRemove(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove this product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {productToRemove?.name} will be removed from the shop. If it
                    appears in past orders, it will be hidden instead so order
                    history is preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={removingProduct}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={removingProduct}
                    onClick={(event) => {
                      event.preventDefault();
                      void removeProduct();
                    }}
                  >
                    {removingProduct ? "Removing…" : "Remove product"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>

          <section className="admin-enter admin-stagger-2 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Promotions
            </p>
            <h2 className="mt-1 text-2xl">Discount codes</h2>
            <form
              onSubmit={(event) => void createDiscount(event)}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <div className="space-y-2">
                <Label htmlFor="discount-code">Code</Label>
                <Input
                  id="discount-code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  minLength={3}
                  maxLength={32}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-percent">Percent off</Label>
                <Input
                  id="discount-percent"
                  type="number"
                  min={1}
                  max={99}
                  value={percentOff}
                  onChange={(event) => setPercentOff(event.target.value)}
                  required
                />
              </div>
              <Button type="submit">Create code</Button>
            </form>
            <ul className="mt-4 divide-y">
              {discounts.map((discount) => (
                <li
                  key={discount.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    <strong>{discount.code}</strong> · {discount.percent_off}% ·{" "}
                    {discount.active ? "Active" : "Inactive"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        if (!supabase)
                          throw new Error("Supabase is not configured.");
                        const { error: updateError } = await supabase
                          .from("discount_codes")
                          .update({ active: !discount.active })
                          .eq("id", discount.id);
                        if (updateError) throw updateError;
                        await refresh();
                      } catch (updateError) {
                        setError(
                          updateError instanceof Error
                            ? updateError.message
                            : "Could not update the discount code.",
                        );
                      }
                    }}
                  >
                    {discount.active ? "Deactivate" : "Activate"}
                  </Button>
                </li>
              ))}
            </ul>
            {discounts.length === 0 && (
              <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                No discount codes yet. Create one above to launch a promotion.
              </p>
            )}
          </section>

          <section className="admin-enter admin-stagger-3 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Fulfillment
            </p>
            <h2 className="mt-1 text-2xl">Reward delivery queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Queue items are created only after an admin confirms payment. No
              Minecraft worker is connected, so this dashboard cannot confirm or
              mark rewards as delivered.
            </p>
            {queue.length ? (
              <ul className="mt-4 divide-y">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {item.order_items?.quantity} × {item.order_items?.name}
                      </p>
                      <p className="text-muted-foreground">
                        Player:{" "}
                        {item.order_items?.orders?.minecraft_username ??
                          "Unknown"}{" "}
                        · {item.status} · attempts: {item.attempts}
                      </p>
                      {item.last_error && (
                        <p className="text-destructive">{item.last_error}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No paid orders are waiting for fulfillment.
              </p>
            )}
          </section>

          <section className="admin-enter admin-stagger-3 rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-glow">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Configuration
            </p>
            <h2 className="mt-1 text-2xl">Environment variable tests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Test each setting separately. Secret values are checked on the
              server and never displayed. OAuth client tests require the client
              ID and secret; Gmail tests also require the refresh token.
            </p>
            <div className="mt-5 grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cloudflare-account-id">
                  Cloudflare account ID
                </Label>
                <Input
                  id="cloudflare-account-id"
                  autoComplete="off"
                  value={cloudflareAccountId}
                  onChange={(event) =>
                    setCloudflareAccountId(event.target.value)
                  }
                  placeholder="32-character account ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cloudflare-api-token">
                  Cloudflare API token
                </Label>
                <Input
                  id="cloudflare-api-token"
                  type="password"
                  autoComplete="new-password"
                  value={cloudflareApiToken}
                  onChange={(event) =>
                    setCloudflareApiToken(event.target.value)
                  }
                  placeholder="Workers Scripts Write permission"
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                The API token is kept only in this page's memory and sent over
                HTTPS when saving. It is not stored by this app. Updates are
                applied to the{" "}
                <code className="font-mono">craft-smp-store</code> Worker as
                secret bindings. VITE_ variables are embedded in the browser
                during build and require a new build to take effect there.
              </p>
            </div>
            <ul className="mt-4 divide-y">
              {envVarTests.map(({ name, label }) => {
                const result = envTestResults[name];
                const isTesting = testingEnvVariable === name;
                const isSaving = savingEnvVariable === name;
                return (
                  <li
                    key={name}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Input
                          aria-label={`New value for ${label}`}
                          autoComplete="new-password"
                          type={
                            secretEnvNames.includes(name) ? "password" : "text"
                          }
                          value={envValues[name] ?? ""}
                          onChange={(event) =>
                            setEnvValues((current) => ({
                              ...current,
                              [name]: event.target.value,
                            }))
                          }
                          placeholder="Enter value to add or replace"
                          className="max-w-md"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            savingEnvVariable !== null ||
                            testingEnvVariable !== null ||
                            !cloudflareAccountId.trim() ||
                            !cloudflareApiToken.trim() ||
                            !envValues[name]?.trim()
                          }
                          onClick={() => void saveEnvironmentVariable(name)}
                        >
                          {isSaving ? "Saving…" : "Add / update"}
                        </Button>
                      </div>
                      {result && (
                        <p
                          className={`mt-1 flex items-start gap-1.5 text-sm ${
                            result.success
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                          role="status"
                        >
                          {result.success ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                          ) : (
                            <XCircle className="mt-0.5 size-4 shrink-0" />
                          )}
                          <span>{result.message}</span>
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        testingEnvVariable !== null ||
                        savingEnvVariable !== null
                      }
                      onClick={() => void testEnvironmentVariable(name)}
                    >
                      <RefreshCw
                        className={`size-4 ${isTesting ? "animate-spin" : ""}`}
                      />
                      {isTesting ? "Testing…" : "Test"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </InfoPage>
  );
}
