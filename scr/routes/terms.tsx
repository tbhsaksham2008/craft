import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/site/InfoPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    seo(
      "Terms of Service",
      "Terms for using the Craft SMP website, store, and virtual items.",
    ),
  component: () => (
    <InfoPage
      title="Terms of Service"
      sub="Please read these terms before using the store or placing an order."
    >
      <p>
        These terms apply to your use of the Craft SMP website and store. By
        using the site or placing an order, you agree to follow them and the
        server rules. If you do not agree, do not use the store.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <p>
        You are responsible for providing accurate account and Minecraft
        username details, keeping your sign-in credentials private, and activity
        carried out through your account. If you are not legally able to make a
        purchase where you live, ask a parent or guardian to review and complete
        it for you.
      </p>

      <h2>2. Virtual products and orders</h2>
      <p>
        Store products are digital perks or items intended for use on Craft SMP.
        They have no cash value, cannot be exchanged for cash, and are not
        physical goods. Product descriptions explain the listed features; review
        them before ordering.
      </p>
      <p>
        Prices are displayed in Indian rupees (INR). An order is subject to
        checkout availability, payment verification, and the store's acceptance
        of that order. A payment confirmation alone does not mean an in-game
        reward has already been delivered. Verified orders may enter a
        fulfillment queue, and processing can take time.
      </p>

      <h2>3. Minecraft username and fulfillment</h2>
      <p>
        You must enter the correct Minecraft username for the intended
        recipient. We cannot guarantee that a username can be changed after an
        order is submitted or fulfillment begins. Keep your order confirmation
        for reference and contact support if an order appears incorrect or
        remains queued.
      </p>
      <p>
        Delivery depends on server availability and fulfillment operations. We
        do not promise an instant delivery time. Do not place an order if you
        are unable to accept these conditions.
      </p>

      <h2>4. Server rules and fair play</h2>
      <p>
        Purchases do not grant an exemption from Craft SMP rules, moderation
        decisions, or gameplay restrictions. Do not use the store, account, or
        server to commit fraud, disrupt service, exploit a bug, or interfere
        with other players. A suspension, ban, or loss of access due to rule
        violations does not create a refund entitlement under this policy.
      </p>

      <h2>5. Availability and changes</h2>
      <p>
        Products, prices, and perks may change, be balanced, or become
        unavailable as the server evolves. We will not intentionally describe a
        product in a misleading way, but gameplay balance changes do not convert
        virtual items into cash or create a refund entitlement. We may pause
        checkout or cancel an order that cannot reasonably be processed, subject
        to applicable law.
      </p>

      <h2>6. Payments and refunds</h2>
      <p>
        Checkout may display a UPI payment request. A UPI intent, email, UTR, or
        screenshot does not itself confirm settlement; an order is marked paid
        only after the payment is independently reconciled. Refunds are not
        offered for completed purchases except where required by applicable law.
        Read the{" "}
        <Link to="/refunds" className="text-ink underline">
          Refund Policy
        </Link>{" "}
        for details. Never send payment credentials or passwords to support.
      </p>

      <h2>7. Privacy and site availability</h2>
      <p>
        Use of account and order information is described in our{" "}
        <Link to="/privacy" className="text-ink underline">
          Privacy Policy
        </Link>
        . We may temporarily limit access for maintenance, security, or service
        issues. We are not responsible for interruptions outside our reasonable
        control.
      </p>

      <h2>8. Contact and updates</h2>
      <p>
        For order or account questions, use the{" "}
        <Link to="/support" className="text-ink underline">
          Support page
        </Link>
        . These terms may be updated when the store or server changes; the
        current version on this page applies to future use and orders. Nothing
        in these terms removes rights that cannot legally be excluded.
      </p>
    </InfoPage>
  ),
});
