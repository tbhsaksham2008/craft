/*
# Create editable public announcement

1. New Tables
- `site_announcements` stores the single announcement shown below the public navigation.
- `id` is the fixed `global` key for the site-wide announcement.
- `message` contains the announcement text shown to visitors.
- `enabled` controls whether the announcement bar is visible.
- `updated_at` records the last admin change.

2. Security
- Row-level security is enabled.
- Anonymous and authenticated visitors can read enabled announcements only.
- Authenticated administrators can read, create, update, and delete the announcement.
- Admin access is checked using the server-controlled `role` claim in `auth.jwt()` app metadata.
- Anonymous clients receive SELECT access only; write permissions are not granted.

3. Important Notes
- The migration seeds one editable announcement so the bar has useful content immediately.
- The fixed key keeps the admin editor focused on one global announcement instead of creating multiple banners accidentally.
- The admin claim must be managed by the authentication server and is not taken from user-editable metadata.
*/

CREATE TABLE IF NOT EXISTS public.site_announcements (
  id text PRIMARY KEY,
  message text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_announcements TO authenticated;

DROP POLICY IF EXISTS "Visitors can read enabled announcements" ON public.site_announcements;
CREATE POLICY "Visitors can read enabled announcements"
  ON public.site_announcements FOR SELECT
  TO anon, authenticated
  USING (
    enabled = true
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can create announcements" ON public.site_announcements;
CREATE POLICY "Admins can create announcements"
  ON public.site_announcements FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update announcements" ON public.site_announcements;
CREATE POLICY "Admins can update announcements"
  ON public.site_announcements FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.site_announcements;
CREATE POLICY "Admins can delete announcements"
  ON public.site_announcements FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

INSERT INTO public.site_announcements (id, message, enabled)
VALUES ('global', 'Welcome to Craft SMP — jump in and start your next adventure.', true)
ON CONFLICT (id) DO NOTHING;
