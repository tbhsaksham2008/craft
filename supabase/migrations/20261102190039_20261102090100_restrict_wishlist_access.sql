/*
# Restrict wishlist table access to signed-in players

1. Modified Tables
- `wishlists` keeps the same columns and data.
- Anonymous table privileges are removed.
- Authenticated players retain only SELECT, INSERT, and DELETE privileges.

2. Security
- Anonymous clients cannot reach the wishlist table through the Data API.
- Existing authenticated owner-scoped row policies remain the source of row authorization.

3. Important Notes
- This change does not delete or alter any saved items.
- Service-side administration is not needed for this player-only feature.
*/

REVOKE ALL ON public.wishlists FROM anon;
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
