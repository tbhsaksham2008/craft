import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  activeProducts,
  productFromRecord,
  type Product,
} from "@/data/products";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export interface CartLine {
  id: string;
  qty: number;
}
interface CartCtx {
  lines: (CartLine & { product: Product })[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (o: boolean) => void;
  add: (p: Product) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "craftsmp-cart";
export const MAX_QTY = 99;

export function CartProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [raw, setRaw] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<Product[]>(activeProducts());
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const storageKey = session ? `${KEY}:${session.user.id}` : null;

  useEffect(() => {
    if (authLoading) return;
    if (!session || !storageKey) {
      setRaw([]);
      setOpen(false);
      setLoadedForUser(null);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (
        Array.isArray(saved) &&
        saved.every(
          (line) =>
            line &&
            typeof line.id === "string" &&
            Number.isInteger(line.qty) &&
            line.qty > 0,
        )
      ) {
        setRaw(saved);
      } else {
        throw new Error("Saved cart data is invalid.");
      }
    } catch (error) {
      console.error("Could not restore your cart", error);
      toast.error("Could not restore your cart. Start a new cart.");
      setRaw([]);
    }
    setLoadedForUser(session.user.id);
  }, [authLoading, session, storageKey]);

  useEffect(() => {
    if (session && storageKey && loadedForUser === session.user.id)
      localStorage.setItem(storageKey, JSON.stringify(raw));
  }, [raw, loadedForUser, session, storageKey]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase
      .from("products")
      .select("*")
      .eq("enabled", true)
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error) {
            console.error("Could not load current product prices", error);
            toast.error(
              "Live product prices could not be loaded. Please refresh before checkout.",
            );
          } else {
            setCatalog((data ?? []).map((record) => productFromRecord(record)));
          }
        },
        (error: unknown) => {
          if (!active) return;
          console.error("Could not load current product prices", error);
          toast.error(
            "Live product prices could not be loaded. Please refresh before checkout.",
          );
        },
      );
    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<CartCtx>(() => {
    const lines = session
      ? raw.flatMap((l) => {
          const product = catalog.find(
            (item) => item.id === l.id && item.enabled,
          );
          return product ? [{ ...l, product }] : [];
        })
      : [];
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal:
        Math.round(
          lines.reduce((s, l) => s + l.qty * l.product.price, 0) * 100,
        ) / 100,
      open,
      setOpen: (nextOpen) => {
        if (nextOpen && !session) {
          toast.info(
            <div className="flex items-center gap-3">
              <span>Sign in to use your cart.</span>
              <Button asChild size="sm" variant="outline">
                <Link to="/account">Sign in</Link>
              </Button>
            </div>,
          );
          return;
        }
        setOpen(nextOpen);
      },
      add: (p) => {
        if (!session) {
          toast.info(
            <div className="flex items-center gap-3">
              <span>Sign in to add items to your cart.</span>
              <Button asChild size="sm" variant="outline">
                <Link to="/account">Sign in</Link>
              </Button>
            </div>,
          );
          return;
        }
        if (p.price <= 0) {
          toast.info(`${p.name} will be available after its price is set`);
          return;
        }
        const existing = raw.find((l) => l.id === p.id);
        if (existing && p.single) {
          toast.info(`${p.name} is already in your cart`);
          setOpen(true);
          return;
        }
        setRaw((r) =>
          existing
            ? r.map((l) =>
                l.id === p.id ? { ...l, qty: Math.min(MAX_QTY, l.qty + 1) } : l,
              )
            : [...r, { id: p.id, qty: 1 }],
        );
        toast.success(`${p.name} added to cart`);
      },
      setQty: (id, qty) =>
        setRaw((r) =>
          r.map((l) =>
            l.id === id
              ? { ...l, qty: Math.max(1, Math.min(MAX_QTY, qty)) }
              : l,
          ),
        ),
      remove: (id) => {
        setRaw((r) => r.filter((l) => l.id !== id));
        toast("Removed from cart");
      },
      clear: () => setRaw([]),
    };
  }, [raw, open, catalog, session]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
