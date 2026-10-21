import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PriceDisplay,
  ProductGrid,
  tintBg,
} from "@/components/site/ProductCard";
import {
  activeProducts,
  categories,
  discountPct,
  getProduct,
  isOnSale,
  productFromRecord,
  type Product,
} from "@/data/products";
import { useCart } from "@/hooks/use-cart";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/product/$id")({
  loader: ({ params }) => ({ product: getProduct(params.id) ?? null }),
  head: ({ loaderData }) =>
    loaderData?.product
      ? seo(loaderData.product.name, loaderData.product.description)
      : { meta: [{ title: "Product | Craft SMP" }] },
  component: ProductPage,
});

function ProductPage() {
  const { product: initialProduct } = Route.useLoaderData();
  const { id } = Route.useParams();
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [loading, setLoading] = useState(
    !initialProduct && isSupabaseConfigured,
  );
  const [loadError, setLoadError] = useState("");
  const { add } = useCart();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;
    void supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("enabled", true)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error)
            setLoadError(`Product could not be loaded: ${error.message}`);
          else setProduct(data ? productFromRecord(data) : null);
          setLoading(false);
        },
        (error: unknown) => {
          if (!active) return;
          setLoadError(
            error instanceof Error
              ? `Product could not be loaded: ${error.message}`
              : "Product could not be loaded.",
          );
          setLoading(false);
        },
      );
    return () => {
      active = false;
    };
  }, [id]);

  if (loading)
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted-foreground">
        Loading product…
      </div>
    );
  if (!product)
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="text-3xl">Product not found</h1>
        <p className="mt-2 text-muted-foreground">
          {loadError || "This item may have been removed from the store."}
        </p>
        <Button asChild variant="hero" className="mt-6">
          <Link to="/store">Browse the store</Link>
        </Button>
      </div>
    );

  const cat = categories.find((c) => c.id === product.category);
  if (!cat) return null;
  const related = activeProducts()
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {loadError}
        </p>
      )}
      <Link
        to={cat.path}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {cat.label}
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div
          className={cn(
            "relative grid aspect-square place-items-center rounded-[2rem] pixel-grid shadow-glow",
            tintBg[product.tint],
          )}
        >
          {isOnSale(product) && (
            <span className="absolute right-5 top-5 rounded-full bg-blush px-3 py-1 font-bold">
              -{discountPct(product)}%
            </span>
          )}
          <img
            src={product.image}
            alt={product.name}
            width={816}
            height={816}
            className="w-2/3 animate-float drop-shadow-xl"
          />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-ink">
            {cat.label}
          </p>
          <h1 className="mt-2 text-4xl md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {product.description}
          </p>
          <PriceDisplay
            product={product}
            className="mt-6 [&>span:first-child]:text-3xl"
          />
          <ul className="mt-6 space-y-2">
            {product.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-primary">
                  <Check className="size-3.5" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
          <Button
            variant="hero"
            size="lg"
            className="mt-8 w-full sm:w-auto"
            onClick={() => add(product)}
            disabled={product.price <= 0}
          >
            <ShoppingCart />
            {product.price > 0 ? "Add to cart" : "Price to be set"}
          </Button>
          {product.single && (
            <p className="mt-3 text-sm text-muted-foreground">
              Limited to one per player.
            </p>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-3xl">You might also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
