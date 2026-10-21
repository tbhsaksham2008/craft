import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/site/InfoPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/refunds")({
  head: () =>
    seo(
      "Refund Policy",
      "All Craft SMP store purchases are final; review the policy before ordering.",
    ),
  component: () => (
    <InfoPage
      title="Refund Policy"
      sub="Please review this policy before completing a purchase."
    >
      <div className="rounded-xl border border-blush bg-blush/20 p-4 font-semibold">
        All purchases are final. We do not offer refunds for virtual products,
        except where a refund is required by applicable law.
      </div>

      <h2>Virtual purchases are non-refundable</h2>
      <p>
        Products sold through the Craft SMP store are digital perks or items.
        Once an order is placed, you cannot cancel it for a refund because you
        changed your mind, no longer play, did not use the item, or expected a
        different gameplay experience. A purchase also does not qualify for a
        refund because of a server ban, suspension, rule violation, or
        subsequent balance change.
      </p>

      <h2>Check your order before paying</h2>
      <p>
        Before completing checkout, confirm the product, price in INR, and
        Minecraft username. Orders submitted with an incorrect username are not
        refundable. If you notice a mistake, contact support promptly; we can
        check whether the order can still be corrected, but a change is not
        guaranteed once fulfillment begins.
      </p>

      <h2>Payment or delivery questions</h2>
      <p>
        If you were charged but cannot find the order, see an apparent duplicate
        charge, or have an order that remains queued, contact us through the{" "}
        <Link to="/support" className="text-ink underline">
          Support page
        </Link>{" "}
        so we can investigate the transaction and order status. This review does
        not guarantee a refund. Do not send passwords, full card or bank
        details, or UPI PINs.
      </p>
      <p>
        Verified orders may be placed in a fulfillment queue; payment
        confirmation does not mean an in-game item has already been delivered.
        If a refund is required by applicable law, that legal requirement takes
        precedence over this policy.
      </p>

      <h2>Payment disputes</h2>
      <p>
        Please contact support about a store or order issue before initiating a
        payment dispute, so we can review the order details. You remain free to
        contact your payment provider as appropriate. Fraudulent or abusive use
        of the payment system may result in account or server restrictions,
        subject to applicable law.
      </p>

      <h2>Questions</h2>
      <p>
        For questions about an order, include its order ID, Minecraft username,
        and payment reference if available. See the{" "}
        <Link to="/faq" className="text-ink underline">
          FAQ
        </Link>{" "}
        for common purchase and delivery questions.
      </p>
    </InfoPage>
  ),
});
