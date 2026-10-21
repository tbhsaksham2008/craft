import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  activeProducts,
  categories,
  isOnSale,
  productFromRecord,
  type Category,
  type Product,
} from "@/data/products";
import { ProductGrid } from "./ProductCard";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Sort = "featured" | "price-asc" | "price-desc" | "name";

export function StoreBrowser({
  category,
  saleOnly,
}: {
  category?: Category;
  saleOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">(category ?? "all");
  const [sort, setSort] = useState<Sort>("featured");
  const [catalog, setCatalog] = useState<Product[]>(activeProducts());
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;
    void supabase
      .from("products")
      .select("*")
      .eq("enabled", true)
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error)
            setCatalogError(
              `The live catalog could not be loaded: ${error.message}`,
            );
          else
            setCatalog((data ?? []).map((record) => productFromRecord(record)));
        },
        (error: unknown) => {
          if (active)
            setCatalogError(
              error instanceof Error
                ? `The live catalog could not be loaded: ${error.message}`
                : "The live catalog could not be loaded.",
            );
        },
      );
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => {
    let l = catalog;
    if (saleOnly) l = l.filter(isOnSale);
    if (cat !== "all") l = l.filter((p) => p.category === cat);
    if (q.trim())
      l = l.filter((p) =>
        (p.name + p.description).toLowerCase().includes(q.toLowerCase()),
      );
    const s = [...l];
    if (sort === "price-asc") s.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") s.sort((a, b) => b.price - a.price);
    if (sort === "name") s.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "featured")
      s.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return s;
  }, [q, cat, sort, saleOnly, catalog]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {!category && (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by category"
          >
            {[{ id: "all" as const, label: "All" }, ...categories].map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                aria-pressed={cat === c.id}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  cat === c.id
                    ? "bg-brand border-transparent shadow-soft"
                    : "bg-card hover:bg-accent",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 md:ml-auto">
          <label className="relative">
            <span className="sr-only">Search products</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-10 w-48 rounded-xl bg-card pl-9"
            />
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-10 rounded-xl border bg-card px-3 text-sm"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </div>
      {catalogError && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {catalogError}
        </p>
      )}
      {list.length ? (
        <ProductGrid products={list} />
      ) : (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-muted-foreground">
          No products match your search.
        </div>
      )}
    </div>
  );
}
