ALTER TABLE niche_yt.youtube_accounts
  ADD COLUMN IF NOT EXISTS selected_channel_id TEXT;

-- The application uses a server-side PostgreSQL connection. Keep this schema
-- private; do not grant anon/authenticated access through the Supabase Data API.
REVOKE ALL ON SCHEMA niche_yt FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA niche_yt FROM PUBLIC, anon, authenticated;
