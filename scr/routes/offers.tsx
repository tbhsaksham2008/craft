import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/offers")({
  head: () => seo("Special Offers", "Limited-time discounts across the Craft SMP store."),
  component: () => (
    <>
      <PageHeader title="Special Offers" sub="Limited-time discounts across the Craft SMP store." />
      <StoreBrowser saleOnly />
    </>
  ),
});
