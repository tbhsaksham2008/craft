export const adminSectionIds = [
  "overview",
  "payments",
  "orders",
  "shop",
  "vote",
  "promotions",
  "fulfillment",
  "test",
] as const;

export type AdminSection = (typeof adminSectionIds)[number];

export function isAdminSection(value: string): value is AdminSection {
  return adminSectionIds.some((section) => section === value);
}
