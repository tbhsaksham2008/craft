import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/coins")({
  head: () => seo("Coins", "Top up your in-game balance for the shop and auction house."),
  component: () => (
    <>
      <PageHeader title="Coins" sub="Top up your in-game balance for the shop and auction house." />
      <StoreBrowser category="coins" />
    </>
  ),
});
