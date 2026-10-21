import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/config/site";
import { tintBg } from "./ProductCard";
import { cn } from "@/lib/utils";

export function QtyControl({ id, qty, single }: { id: string; qty: number; single?: boolean | undefined }) {
  const { setQty } = useCart();
  if (single) return <span className="text-xs text-muted-foreground">One per player</span>;
  return (
    <div className="inline-flex items-center rounded-lg border bg-card">
      <button className="p-1.5 disabled:opacity-40" onClick={() => setQty(id, qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity"><Minus className="size-3.5" /></button>
      <span className="w-7 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
      <button className="p-1.5" onClick={() => setQty(id, qty + 1)} aria-label="Increase quantity"><Plus className="size-3.5" /></button>
    </div>
  );
}

export function CartDrawer() {
  const { open, setOpen, lines, subtotal, remove } = useCart();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="font-display text-2xl">Your cart</SheetTitle>
          <SheetDescription>Items are kept on this device until you check out.</SheetDescription>
        </SheetHeader>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="grid size-20 place-items-center rounded-2xl bg-brand animate-float"><ShoppingBag className="size-9" /></div>
            <p className="font-display text-xl">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">Grab a rank, some keys or coins to get started.</p>
            <Button asChild variant="hero" onClick={() => setOpen(false)}><Link to="/store">Browse the store</Link></Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto p-5">
              {lines.map((l) => (
                <li key={l.id} className="flex gap-3 rounded-xl border bg-card p-3">
                  <div className={cn("grid size-16 shrink-0 place-items-center rounded-lg", tintBg[l.product.tint])}>
                    <img src={l.product.image} alt="" className="size-12 object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold leading-tight">{l.product.name}</p>
                      <p className="font-semibold">{formatPrice(l.product.price * l.qty)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <QtyControl id={l.id} qty={l.qty} single={l.product.single} />
                      <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${l.product.name}`}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t p-5">
              <div className="flex justify-between text-lg font-semibold"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <p className="text-xs text-muted-foreground">Discounts and taxes are calculated at checkout.</p>
              <Button asChild variant="hero" size="lg" className="w-full" onClick={() => setOpen(false)}><Link to="/checkout">Checkout</Link></Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
