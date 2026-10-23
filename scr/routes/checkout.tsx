import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CircleAlert,
  CreditCard,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/site/Reveal";
import { QtyControl } from "@/components/site/CartDrawer";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/config/site";
import { isValidMinecraftName } from "@/lib/minecraft";
import { scanGmailForCheckoutOrder } from "@/lib/gmail-payments";
import { createUpiCheckoutOrder, getUpiOrderDetails } from "@/lib/payments";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { seo } from "@/lib/seo";

type PendingPayment = {
  orderId: string;
  amountPaise: number;
  vpa: string;
  upiUri: string | null;
  expiresAt: string;
  status:
    "pending" | "paid" | "completed" | "rejected" | "cancelled" | "refunded";
};

export const Route = createFileRoute("/checkout")({
  head: () =>
    seo(
      "Checkout",
      "Review your order and enter the Minecraft username that will receive it.",
    ),
  component: Checkout,
});

function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [session, setSession] =
    useState<
      Awaited<
        ReturnType<NonNullable<typeof supabase>["auth"]["getSession"]>
      >["data"]["session"]
    >(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const valid = isValidMinecraftName(name);
  const activeOrderId = payment?.orderId;
  const activePaymentStatus = payment?.status;
  const activeAccessToken = session?.access_token;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((sessionError: unknown) => {
        setError(
          sessionError instanceof Error
            ? `Could not restore your session: ${sessionError.message}`
            : "Could not restore your session.",
        );
      });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || payment) return;
    const savedOrderId = window.sessionStorage.getItem("craft-upi-order-id");
    if (!savedOrderId) return;

    let active = true;
    void getUpiOrderDetails({
      data: { accessToken: session.access_token, orderId: savedOrderId },
    }).then(
      (details) => {
        if (active) setPayment(details);
      },
      (restoreError: unknown) => {
        window.sessionStorage.removeItem("craft-upi-order-id");
        if (active) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : "Could not restore your pending UPI order.",
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [payment, session]);

  useEffect(() => {
    if (
      !activeAccessToken ||
      !activeOrderId ||
      activePaymentStatus !== "pending"
    )
      return;
    let active = true;
    let timer: number | undefined;
    const scanForPayment = async () => {
      try {
        await scanGmailForCheckoutOrder({
          data: {
            accessToken: activeAccessToken,
            orderId: activeOrderId,
          },
        });
      } catch (pollError) {
        if (active) {
          console.error("Could not refresh checkout payment status", pollError);
          setError(
            "Payment status could not be refreshed. Check your order history or contact support.",
          );
        }
      } finally {
        if (active)
          timer = window.setTimeout(() => void scanForPayment(), 30_000);
      }
    };

    void scanForPayment();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeAccessToken, activeOrderId, activePaymentStatus]);

  useEffect(() => {
    if (
      !activeAccessToken ||
      !activeOrderId ||
      activePaymentStatus !== "pending"
    )
      return;
    let active = true;
    const pollOrderStatus = async () => {
      try {
        const details = await getUpiOrderDetails({
          data: {
            accessToken: activeAccessToken,
            orderId: activeOrderId,
          },
        });
        if (active) setPayment(details);
      } catch (pollError) {
        if (active) {
          setError(
            pollError instanceof Error
              ? `Could not refresh payment status: ${pollError.message}`
              : "Could not refresh payment status.",
          );
        }
      }
    };
    const timer = window.setInterval(() => void pollOrderStatus(), 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeAccessToken, activeOrderId, activePaymentStatus]);

  useEffect(() => {
    if (!payment?.upiUri) {
      setQrDataUrl("");
      return;
    }
    let active = true;
    void QRCode.toDataURL(payment.upiUri, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    }).then(
      (dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      },
      (qrError: unknown) => {
        if (active)
          setError(
            qrError instanceof Error
              ? `Could not render the payment QR code: ${qrError.message}`
              : "Could not render the payment QR code.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [payment]);

  useEffect(() => {
    if (!payment) return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [payment]);

  const validateDiscount = async () => {
    if (!supabase || !discountCode.trim()) return;
    setError("");
    setMessage("");
    try {
      const { data, error: discountError } = await supabase.rpc(
        "validate_discount_code",
        { p_code: discountCode },
      );
      if (discountError) throw discountError;
      if (!data?.length) {
        setDiscountPercent(0);
        setError("That discount code is invalid or expired.");
      } else {
        setDiscountPercent(data[0].percent_off);
        setMessage(
          `${data[0].percent_off}% discount applied. The server will verify the code again when your order is created.`,
        );
      }
    } catch (discountError) {
      setDiscountPercent(0);
      setError(
        discountError instanceof Error
          ? `Could not validate the discount code: ${discountError.message}`
          : "Could not validate the discount code.",
      );
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setError("");
    if (!valid || !confirmed || !session?.access_token || !lines.length) return;
    setBusy(true);
    try {
      const result = await createUpiCheckoutOrder({
        data: {
          accessToken: session.access_token,
          minecraftUsername: name,
          items: lines.map((line) => ({
            productId: line.id,
            quantity: line.qty,
          })),
          discountCode: discountCode.trim() || undefined,
        },
      });
      window.sessionStorage.setItem("craft-upi-order-id", result.orderId);
      setPayment(result);
      clear();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not create your UPI order.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (payment) {
    if (payment.status === "paid" || payment.status === "completed") {
      return (
        <>
          <PageHeader
            title={
              payment.status === "completed"
                ? "Order completed!"
                : "Payment received!"
            }
            sub="Thank you for supporting Craft SMP."
          />
          <div className="mx-auto max-w-2xl px-4 py-12">
            <section className="space-y-5 rounded-2xl border bg-card p-8 text-center shadow-soft sm:p-12">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-success/10 text-success">
                <span className="text-3xl" aria-hidden="true">
                  ✓
                </span>
              </div>
              <h2 className="text-2xl font-bold">
                {payment.status === "completed"
                  ? "Your rewards have been delivered."
                  : "Your payment is confirmed."}
              </h2>
              <p className="text-muted-foreground">
                {payment.status === "completed"
                  ? "Thanks for your purchase! Your order has been delivered in-game."
                  : "Thanks for your payment! Your rewards are queued and will be delivered the next time you join the server."}
              </p>
              <p className="break-all font-mono text-xs text-muted-foreground">
                Order {payment.orderId}
              </p>
              <Button asChild variant="hero">
                <Link to="/account">View order history</Link>
              </Button>
            </section>
          </div>
        </>
      );
    }
    if (
      payment.status === "rejected" ||
      payment.status === "cancelled" ||
      payment.status === "refunded"
    ) {
      return (
        <>
          <PageHeader
            title="Order status updated"
            sub="Thank you for visiting Craft SMP."
          />
          <div className="mx-auto max-w-2xl px-4 py-12">
            <section className="space-y-5 rounded-2xl border bg-card p-8 text-center shadow-soft sm:p-12">
              <h2 className="text-2xl font-bold">
                This order is {payment.status}.
              </h2>
              <p className="text-muted-foreground">
                Contact store support if you believe this status is incorrect.
              </p>
              <Button asChild variant="outline">
                <Link to="/account">View order history</Link>
              </Button>
            </section>
          </div>
        </>
      );
    }
    const paymentExpired = currentTime >= new Date(payment.expiresAt).getTime();
    const maskedVpa =
      payment.vpa.length > 7
        ? `${"*".repeat(payment.vpa.length - 7)}${payment.vpa.slice(-7)}`
        : payment.vpa;
    return (
      <>
        <PageHeader
          title="Complete your payment"
          sub={`Order ${payment.orderId.slice(0, 8).toUpperCase()}`}
        />
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <div className="flex items-center justify-between gap-4 border-b px-6 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-muted text-foreground">
                  <CreditCard className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold">UPI payment</h2>
                  <p className="text-sm text-muted-foreground">
                    {paymentExpired ? "Request expired" : "Awaiting payment"}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {paymentExpired ? "Expired" : "Pending"}
              </span>
            </div>
            <div className="p-6 sm:p-8">
              <div className="grid gap-8 sm:grid-cols-[260px_1fr]">
                <div className="grid min-h-60 place-items-center rounded-2xl border bg-white p-4">
                  {payment.upiUri && !paymentExpired && qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR code for the exact UPI order amount"
                      width={240}
                      height={240}
                    />
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">
                      {paymentExpired
                        ? "This payment request has expired."
                        : "Preparing your payment QR code…"}
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Amount due
                    </p>
                    <p className="mt-1 text-4xl font-bold tracking-tight">
                      {formatPrice(payment.amountPaise / 100)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Merchant UPI ID
                    </p>
                    <p className="break-all font-mono text-sm font-semibold">
                      {maskedVpa}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="break-all font-mono text-xs">
                      {payment.orderId}
                    </p>
                  </div>
                  {payment.upiUri && !paymentExpired && (
                    <Button asChild variant="hero" className="w-full">
                      <a href={payment.upiUri}>Open a UPI app</a>
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Request expires{" "}
                    {new Date(payment.expiresAt).toLocaleString()}.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            </section>
          )}
        </div>
      </>
    );
  }

  if (!lines.length) {
    return (
      <>
        <PageHeader title="Checkout" />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-muted-foreground">
            {message || "Your cart is empty."}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button asChild variant="hero" className="mt-4">
            <Link to="/store">Browse the store</Link>
          </Button>
        </div>
      </>
    );
  }

  const subtotalPaise = Math.round(subtotal * 100);
  const discountPaise = Math.floor((subtotalPaise * discountPercent) / 100);
  const total = (subtotalPaise - discountPaise) / 100;

  return (
    <>
      <PageHeader
        title="Checkout"
        sub="Review your order and delivery details."
      />
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <ol
          aria-label="Checkout progress"
          className="mx-auto flex max-w-xl items-center justify-center gap-3 text-sm"
        >
          <li className="flex items-center gap-2 font-semibold text-foreground">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              1
            </span>
            Details
          </li>
          <li aria-hidden="true" className="h-px w-12 bg-border sm:w-20" />
          <li className="flex items-center gap-2 text-muted-foreground">
            <span className="grid size-8 place-items-center rounded-full border bg-card">
              2
            </span>
            Payment
          </li>
        </ol>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px] lg:gap-8">
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-7 rounded-2xl border bg-card p-6 shadow-soft sm:p-8"
          noValidate
        >
          <div className="flex items-center gap-3 border-b pb-5">
            <span className="grid size-11 place-items-center rounded-xl bg-muted">
              <PackageCheck className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Delivery details</h2>
              <p className="text-sm text-muted-foreground">
                Choose the Minecraft account for your rewards.
              </p>
            </div>
          </div>
          {!isSupabaseConfigured ? (
            <div className="flex gap-3 rounded-xl border border-blush bg-blush/25 p-4 text-sm">
              <CircleAlert className="size-5 shrink-0" />
              <p>
                <strong>Online payments are temporarily unavailable.</strong>{" "}
                Please check back soon.
              </p>
            </div>
          ) : !session ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted p-4 text-sm">
              <p>
                Sign in before checkout so your purchase is saved to your order
                history.
              </p>
              <Button asChild variant="hero">
                <Link to="/account">Sign in</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="mc">Minecraft username</Label>
              <Input
                id="mc"
                value={name}
                onChange={(event) => setName(event.target.value.trim())}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Steve"
                maxLength={16}
                className="h-11 rounded-xl"
                aria-invalid={touched && !valid}
                aria-describedby="mc-help"
              />
              <p
                id="mc-help"
                className={
                  touched && !valid
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
                }
              >
                {touched && !valid
                  ? "Use 3–16 letters, numbers or underscores."
                  : "Exact Java Edition username, case-sensitive."}
              </p>
            </div>
          )}
          {valid && (
            <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <img
                src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/48`}
                alt=""
                width={48}
                height={48}
                className="rounded-lg"
              />
              <p className="text-sm">
                Rewards will be sent to <strong>{name}</strong>
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="discount">Discount code</Label>
            <div className="flex gap-2">
              <Input
                id="discount"
                value={discountCode}
                onChange={(event) => {
                  setDiscountCode(event.target.value.toUpperCase());
                  setDiscountPercent(0);
                  setMessage("");
                }}
                maxLength={32}
                placeholder="Enter a code"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!supabase || !discountCode.trim()}
                onClick={() => void validateDiscount()}
              >
                Apply
              </Button>
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
              className="mt-0.5"
            />
            I confirm this is the correct account to receive the purchase.
          </label>
          {touched && !confirmed && (
            <p className="text-sm text-destructive">
              Please confirm the receiving account.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-success">
              {message}
            </p>
          )}
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={!isSupabaseConfigured || !session || busy}
          >
            {busy ? "Please wait…" : "Create UPI payment request"}
          </Button>
        </form>

        <aside className="h-fit space-y-5 rounded-2xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-muted">
                <ShoppingBag className="size-5" />
              </span>
              <h2 className="text-xl font-semibold">Order summary</h2>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {lines.reduce((count, line) => count + line.qty, 0)} items
            </span>
          </div>
          <ul className="space-y-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{line.product.name}</p>
                  <QtyControl
                    id={line.id}
                    qty={line.qty}
                    single={line.product.single}
                  />
                </div>
                <span className="font-semibold">
                  {formatPrice(line.product.price * line.qty)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="space-y-3 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Discount</dt>
              <dd>
                {discountPercent ? `−${formatPrice(discountPaise / 100)}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
