import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/site/InfoPage";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    seo(
      "Privacy Policy",
      "How Craft SMP uses account, order, and payment-related information.",
    ),
  component: () => (
    <InfoPage
      title="Privacy Policy"
      sub="A practical overview of the information used to run the Craft SMP website and store."
    >
      <p>
        This policy describes the information that may be processed when you
        browse the site, sign in, contact support, or place an order. We use it
        to operate the account and store features, verify orders, coordinate
        fulfillment, and help protect the service.
      </p>

      <h2>Information you provide</h2>
      <ul>
        <li>
          <strong>Account details:</strong> information such as your email
          address and account identifier when you register or sign in.
        </li>
        <li>
          <strong>Order details:</strong> your Minecraft username, products,
          order total, currency, order status, and relevant timestamps.
        </li>
        <li>
          <strong>Support messages:</strong> the details you choose to share
          when asking for help, such as an order ID or payment reference.
        </li>
      </ul>

      <h2>Payment information</h2>
      <p>
        Checkout displays a UPI payment request. The store does not collect UPI
        credentials or PINs. If Gmail-assisted review is configured, an admin
        may request limited Gmail read access to collect payment-notification
        evidence. Parsed email metadata and transaction references are stored
        for manual reconciliation; email content alone does not verify
        settlement. Do not send full card, bank, or UPI credentials to us.
      </p>

      <h2>Information stored by your browser</h2>
      <p>
        The site may use browser storage for necessary functions such as
        remembering your shopping cart. Sign-in may also use session
        technologies required to keep you authenticated. You can clear browser
        storage, but doing so may remove saved cart contents or sign you out.
      </p>

      <h2>How information is used</h2>
      <ul>
        <li>To create and secure accounts and provide store features.</li>
        <li>
          To calculate and confirm orders, prevent payment mismatches, and
          maintain order history.
        </li>
        <li>
          To coordinate reward fulfillment using the Minecraft username on the
          order.
        </li>
        <li>
          To respond to support requests, investigate errors, and protect the
          site against abuse.
        </li>
      </ul>

      <h2>Service providers and access</h2>
      <p>
        Website infrastructure, database, authentication, and payment processing
        may be provided by third-party services needed to operate the store.
        Information is shared with those services only as needed for their
        function. Authorized store administrators may access order information
        to manage orders and support requests. We do not sell personal
        information.
      </p>

      <h2>Retention and your choices</h2>
      <p>
        Account and order records may be retained for as long as needed to
        provide the service, maintain purchase history, resolve disputes,
        protect against fraud, and meet applicable record-keeping obligations.
        You can avoid providing optional information, but required account or
        order details are needed for the related features. For a privacy or
        account request, contact us through the{" "}
        <Link to="/support" className="text-ink underline">
          Support page
        </Link>
        ; we may need to verify your account before responding.
      </p>

      <h2>Children and policy changes</h2>
      <p>
        The store is not intended to encourage children to make purchases
        without a parent or guardian's involvement. If you believe a child has
        submitted personal information or made a purchase, contact support. We
        may update this policy as the service changes; the current version will
        be posted here.
      </p>

      <h2>Contact</h2>
      <p>
        Available support contact methods are listed on the{" "}
        <Link to="/support" className="text-ink underline">
          Support page
        </Link>
        . Please include only the information needed to resolve your request and
        never include passwords or payment credentials.
      </p>
    </InfoPage>
  ),
});
