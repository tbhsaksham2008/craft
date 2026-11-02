/*
# Restrict public announcement write access

1. Modified Tables
- `site_announcements` keeps its existing announcement rows and columns.
- Anonymous clients retain SELECT access only.
- Anonymous INSERT, UPDATE, and DELETE privileges are removed.

2. Security
- Public visitors can read enabled announcement content.
- Only authenticated administrators that satisfy the existing JWT app-metadata policy can write announcement content.

3. Important Notes
- No announcement data is deleted or changed by this migration.
*/

REVOKE ALL ON public.site_announcements FROM anon;
GRANT SELECT ON public.site_announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_announcements TO authenticated;
