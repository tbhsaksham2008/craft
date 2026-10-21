// Central, editable site configuration. Leave links empty until real ones exist.
export const site = {
  name: "Craft SMP",
  serverAddress: "craftsmp.cc",
  // Public status API (no key needed). Set to "" to disable live status.
  statusApi: "https://api.mcsrvstat.us/3/",
  discordUrl: "", // e.g. "https://discord.gg/your-invite"
  supportEmail: "", // e.g. "support@yourdomain.com"
  currency: "INR",
};

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: site.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
