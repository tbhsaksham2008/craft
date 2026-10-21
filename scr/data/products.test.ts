import { describe, expect, it } from "vitest";
import {
  convertUsdToRupees,
  productFromRecord,
  productImages,
  products,
  type ProductRecord,
} from "./products";

describe("productFromRecord", () => {
  it("converts a database row to the store's display model", () => {
    const record: ProductRecord = {
      id: "crate-epic",
      name: "Epic Crate Key",
      category: "crates",
      price_paise: 29000,
      original_price_paise: 41400,
      description: "Unlock an Epic Crate.",
      perks: ["1 key"],
      image_key: "crate",
      image_url: null,
      featured: true,
      enabled: true,
      single: false,
      tint: "lilac",
    };

    expect(productFromRecord(record)).toEqual({
      id: "crate-epic",
      name: "Epic Crate Key",
      category: "crates",
      price: 290,
      originalPrice: 414,
      description: "Unlock an Epic Crate.",
      perks: ["1 key"],
      image: productImages.crate,
      featured: true,
      enabled: true,
      single: false,
      tint: "lilac",
    });
    expect(
      productFromRecord({
        ...record,
        image_url:
          "https://example.supabase.co/storage/v1/object/public/product-images/test.webp",
      }).image,
    ).toBe(
      "https://example.supabase.co/storage/v1/object/public/product-images/test.webp",
    );
  });
});

describe("INR catalog prices", () => {
  it("converts former USD prices at ₹83 per dollar and rounds to whole rupees", () => {
    expect(convertUsdToRupees(4.99)).toBe(414);
    expect(convertUsdToRupees(0.99)).toBe(82);
  });
});

describe("rank catalog", () => {
  it("replaces sample ranks with the custom ranks awaiting prices", () => {
    const ranks = products.filter((product) => product.category === "ranks");

    expect(ranks.map((product) => product.id)).toEqual([
      "bee",
      "fox",
      "parrot",
      "wolf",
    ]);
    expect(
      ranks.every((product) => product.price === 0 && product.enabled),
    ).toBe(true);
    expect(ranks.find((product) => product.id === "wolf")?.perks).toContain(
      "Purchase reward: 1 Emerald Key",
    );
  });
});
