import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/Reveal";
import { StoreBrowser } from "@/components/site/StoreBrowser";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/cosmetics")({
  head: () => seo("Cosmetics", "Trails, tags and flair to make your character stand out."),
  component: () => (
    <>
      <PageHeader title="Cosmetics" sub="Trails, tags and flair to make your character stand out." />
      <StoreBrowser category="cosmetics" />
    </>
  ),
});
