import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/bundles")({
  head: () => seo("Crate Bundles", "Stack keys together and save versus buying individually."),
  component: () => (
    <>
      <PageHeader title="Crate Bundles" sub="Stack keys together and save versus buying individually." />
      <StoreBrowser category="bundles" />
    </>
  ),
});
