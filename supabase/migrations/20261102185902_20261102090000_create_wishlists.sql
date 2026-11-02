/*
# Create private product wishlists

1. New Tables
- `wishlists` stores one saved product per player.
- `user_id` identifies the signed-in player and defaults to the current account.
- `product_id` stores the stable catalog product identifier.
- `created_at` records when the item was saved.
- The composite primary key prevents duplicate saved products for one player.

2. Security
- Row-level security is enabled on `wishlists`.
- Only authenticated players can read, add, or remove their own saved products.
- Anonymous visitors cannot access wishlist data.
- The Data API receives only the CRUD permissions required by the client.

3. Important Notes
- The product identifier is stored as text so the wishlist works with both the seeded catalog and deployments where catalog tables are provisioned separately.
- Wishlist rows contain no payment, profile, or order information.
*/

CREATE TABLE IF NOT EXISTS public.wishlists (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;

DROP POLICY IF EXISTS "Users can view their own wishlists" ON public.wishlists;
CREATE POLICY "Users can view their own wishlists"
  ON public.wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to their own wishlists" ON public.wishlists;
CREATE POLICY "Users can add to their own wishlists"
  ON public.wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from their own wishlists" ON public.wishlists;
CREATE POLICY "Users can remove from their own wishlists"
  ON public.wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
