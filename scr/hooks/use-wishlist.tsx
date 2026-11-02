import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

type WishlistContextValue = {
  productIds: string[];
  loading: boolean;
  toggle: (productId: string) => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [productIds, setProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session || !supabase) {
      setProductIds([]);
      return;
    }

    let active = true;
    setLoading(true);
    void supabase
      .from("wishlists")
      .select("product_id")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Saved items could not be loaded.");
        else setProductIds((data ?? []).map((item) => item.product_id));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const toggle = useCallback(
    async (productId: string) => {
      if (!session || !supabase) {
        toast.error("Sign in to save items for later.");
        return;
      }

      const saved = productIds.includes(productId);
      setProductIds((ids) =>
        saved ? ids.filter((id) => id !== productId) : [productId, ...ids],
      );
      const query = saved
        ? supabase
            .from("wishlists")
            .delete()
            .eq("product_id", productId)
            .eq("user_id", session.user.id)
        : supabase.from("wishlists").insert({ product_id: productId });
      const { error } = await query;

      if (error) {
        setProductIds((ids) =>
          saved ? [productId, ...ids] : ids.filter((id) => id !== productId),
        );
        toast.error("That saved item could not be updated.");
      }
    },
    [productIds, session],
  );

  return (
    <WishlistContext.Provider value={{ productIds, loading, toggle }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const wishlist = useContext(WishlistContext);
  if (!wishlist) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }
  return wishlist;
}
