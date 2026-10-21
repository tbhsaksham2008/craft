import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { discountPct, isOnSale, type Product } from "@/data/products";
import { formatPrice } from "@/config/site";
import { cn } from "@/lib/utils";

export const tintBg: Record<Product["tint"], string> = {
  sky: "bg-sky/60",
  primary: "bg-primary/50",
  lilac: "bg-lilac/50",
  blush: "bg-blush/60",
  lavender: "bg-lavender",
};

export function PriceDisplay({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-xl font-bold">
        {product.price > 0 ? formatPrice(product.price) : "Price to be set"}
      </span>
      {isOnSale(product) && (
        <span className="text-sm text-muted-foreground line-through">
          {formatPrice(product.originalPrice!)}
        </span>
      )}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
      {isOnSale(product) && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-blush px-2.5 py-1 text-xs font-bold">
          -{discountPct(product)}%
        </span>
      )}
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className={cn(
          "relative flex h-44 items-center justify-center pixel-grid",
          tintBg[product.tint],
        )}
      >
        <img
          src={product.image}
          alt=""
          loading="lazy"
          width={816}
          height={816}
          className="h-32 w-32 object-contain drop-shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl">{product.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {product.description}
        </p>
        <PriceDisplay product={product} className="mt-4" />
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" className="flex-1 rounded-xl">
            <Link to="/product/$id" params={{ id: product.id }}>
              View details
            </Link>
          </Button>
          <Button
            variant="hero"
            className="flex-1"
            onClick={() => add(product)}
            disabled={product.price <= 0}
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart /> Add
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
