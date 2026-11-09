CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Keep NICHE YT data isolated from public and from other projects' schemas.
CREATE SCHEMA IF NOT EXISTS niche_yt;
REVOKE ALL ON SCHEMA niche_yt FROM PUBLIC;
REVOKE ALL ON SCHEMA niche_yt FROM anon, authenticated;
GRANT USAGE, CREATE ON SCHEMA niche_yt TO postgres;

CREATE TABLE IF NOT EXISTS niche_yt.youtube_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL UNIQUE,
  google_email TEXT,
  refresh_token_enc TEXT,
  access_token_enc TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS niche_yt.youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES niche_yt.youtube_accounts(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, channel_id)
);

CREATE INDEX IF NOT EXISTS youtube_channels_account_idx
  ON niche_yt.youtube_channels(account_id);

REVOKE ALL ON ALL TABLES IN SCHEMA niche_yt FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA niche_yt TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA niche_yt
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
