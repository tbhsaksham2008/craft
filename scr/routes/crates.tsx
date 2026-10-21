import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/crates")({
  head: () => seo("Crate Keys", "Unlock rare loot with Craft SMP crate keys."),
  component: () => (
    <>
      <PageHeader
        title="Crate Keys"
        sub="Unlock rare loot with a key for every adventurer."
      />
      <StoreBrowser category="crates" />
    </>
  ),
});
