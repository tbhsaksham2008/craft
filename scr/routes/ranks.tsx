import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/ranks")({
  head: () => seo("Ranks", "Permanent ranks packed with perks, homes and prestige."),
  component: () => (
    <>
      <PageHeader title="Ranks" sub="Permanent ranks packed with perks, homes and prestige." />
      <StoreBrowser category="ranks" />
    </>
  ),
});
