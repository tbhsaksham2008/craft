import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { InfoPage } from "@/components/site/InfoPage";
import { site } from "@/config/site";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/support")({
  head: () =>
    seo("Support", "Get help with Craft SMP store orders and your account."),
  component: () => (
    <InfoPage
      title="Support"
      sub="Find the right next step for account, payment, or reward questions."
    >
      <p>
        First check the{" "}
        <Link to="/faq" className="text-ink underline">
          FAQ
        </Link>{" "}
        and your account's{" "}
        <Link to="/account" className="text-ink underline">
          order history
        </Link>
        . If you still need help, use one of the contact options below.
      </p>

      <div className="flex flex-wrap gap-3">
        {site.supportEmail && (
          <Button asChild variant="hero" size="lg">
            <a href={`mailto:${site.supportEmail}`}>Email support</a>
          </Button>
        )}
        {site.discordUrl && (
          <Button asChild variant="glass" size="lg">
            <a href={site.discordUrl} target="_blank" rel="noreferrer">
              Ask on Discord
            </a>
          </Button>
        )}
        {!site.supportEmail && !site.discordUrl && (
          <p className="w-full rounded-xl border bg-muted px-4 py-3 text-sm">
            Direct support contact details are not configured yet. Check the FAQ
            and your account order history for updates. The site owner can add
            an email or community link when support is available.
          </p>
        )}
      </div>

      <h2>Include these details</h2>
      <ul>
        <li>Your order ID, if you have one.</li>
        <li>Your Minecraft username and the product involved.</li>
        <li>A short description of what happened and when.</li>
        <li>
          For a payment issue, the payment date, amount, and provider reference
          if available.
        </li>
      </ul>

      <h2>Keep your account and payment safe</h2>
      <p>
        Never share your password, one-time verification code, full card or bank
        number, or UPI PIN. Support does not need those details to find an
        order. If you believe someone has accessed your account, change your
        password through the account sign-in provider and contact support with
        the affected order IDs.
      </p>

      <h2>Order and delivery updates</h2>
      <p>
        Payment notifications and in-game fulfillment are separate steps. Orders
        marked paid may remain queued until the Minecraft server processes the
        rewards. Payment status is not confirmed directly with your bank or UPI
        provider, so check the transaction in your UPI app. Check your order
        history before contacting us. Read the{" "}
        <Link to="/refunds" className="text-ink underline">
          Refund Policy
        </Link>{" "}
        for the rules that apply to purchases.
      </p>
    </InfoPage>
  ),
});
