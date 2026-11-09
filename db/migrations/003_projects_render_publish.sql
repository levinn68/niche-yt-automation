CREATE TABLE IF NOT EXISTS niche_yt.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('9:16','16:9','custom')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS niche_yt.render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  project_id UUID REFERENCES niche_yt.projects(id) ON DELETE SET NULL,
  queue_job_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  output_key TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS niche_yt.publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  queue_job_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  privacy_status TEXT NOT NULL DEFAULT 'private' CHECK (privacy_status IN ('private','unlisted','public')),
  publish_at TIMESTAMPTZ,
  youtube_video_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','published','failed','cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS render_jobs_workspace_created_idx ON niche_yt.render_jobs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS publish_jobs_workspace_created_idx ON niche_yt.publish_jobs(workspace_id, created_at DESC);
ALTER TABLE niche_yt.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_yt.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE niche_yt.publish_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA niche_yt FROM PUBLIC, anon, authenticated;
