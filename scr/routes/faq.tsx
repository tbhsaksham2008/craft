import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { InfoPage } from "@/components/site/InfoPage";
import { faqs } from "@/data/faq";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/faq")({
  head: () =>
    seo(
      "FAQ",
      "Answers about joining Craft SMP, store purchases, payments, and reward delivery.",
    ),
  component: () => (
    <InfoPage
      title="Frequently Asked Questions"
      sub="Guidance for joining the server, using the store, and checking on an order."
    >
      <p>
        Start with the topic that matches your question. For order-specific
        help, keep your order ID handy and visit{" "}
        <Link to="/support" className="text-ink underline">
          Support
        </Link>
        .
      </p>
      <Accordion
        type="single"
        collapsible
        className="rounded-2xl border bg-card px-5 shadow-soft"
      >
        {faqs.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left font-semibold">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="mt-0">Still need help?</h2>
        <p>
          For an account or payment issue, include the order ID and Minecraft
          username. Never include your password or payment credentials.
        </p>
        <Link to="/support" className="font-semibold text-ink underline">
          View support options
        </Link>
      </div>
    </InfoPage>
  ),
});
