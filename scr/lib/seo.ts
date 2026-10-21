export const seo = (title: string, description: string) => ({
  meta: [
    { title: `${title} | Craft SMP` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | Craft SMP` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
