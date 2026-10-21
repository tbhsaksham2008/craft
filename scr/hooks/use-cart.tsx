import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  activeProducts,
  productFromRecord,
  type Product,
} from "@/data/products";
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
  const [raw, setRaw] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<Product[]>(activeProducts());
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setRaw(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(raw));
  }, [raw, loaded]);
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
  }, []);

  const value = useMemo<CartCtx>(() => {
    const lines = raw.flatMap((l) => {
      const product = catalog.find((item) => item.id === l.id && item.enabled);
      return product ? [{ ...l, product }] : [];
    });
    return {
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      subtotal:
        Math.round(
          lines.reduce((s, l) => s + l.qty * l.product.price, 0) * 100,
        ) / 100,
      open,
      setOpen,
      add: (p) => {
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
  }, [raw, open, catalog]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
