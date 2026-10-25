import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/store")({
  head: () => seo("All Products", "Browse every rank, crate key, coin pack and cosmetic on Craft SMP."),
  component: () => (
    <>
      <PageHeader title="All Products" sub="Browse every rank, crate key, coin pack and cosmetic on Craft SMP." />
      <StoreBrowser  />
    </>
  ),
});
