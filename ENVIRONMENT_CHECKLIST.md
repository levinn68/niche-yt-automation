# NICHE YT Studio — Environment Checklist

Upload these values to the relevant hosting service later. Never commit actual secrets to GitHub.

## Next.js app (Vercel)
- `APP_URL`: public app URL
- `STUDIO_PASSWORD`: private studio login password
- `STUDIO_SESSION_SECRET`: random secret, minimum 32 characters
- `DATABASE_URL`: Supabase PostgreSQL connection string (server-side only; use the Supabase pooler appropriate for serverless)
- `APP_ENCRYPTION_KEY`: 32-byte hex or base64 key
- `YOUTUBE_WORKSPACE_ID`: optional workspace key, default `default`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`: `https://<app-domain>/api/auth/youtube/callback`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_DEFAULT_VOICE_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`: optional, default `gemini-2.5-flash`
- `RENDER_WORKER_URL`: private worker URL
- `WORKER_API_TOKEN`: same secret as worker service

## Node.js render worker (Railway or isolated container host)
- `PORT`: default 8080
- `WORKER_API_TOKEN`: random secret, minimum 32 characters
- `REDIS_URL`: private Redis connection URL
- `DATABASE_URL`: same Supabase PostgreSQL URL, server-side only
- `APP_ENCRYPTION_KEY`: same 32-byte key used by the app, required to decrypt YouTube OAuth tokens
- `YOUTUBE_WORKSPACE_ID`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`
- `S3_ENDPOINT`: Cloudflare R2 S3 endpoint
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `RENDER_CONCURRENCY`: start at 1

## Supabase
Project: `nozefqkvofoqbvcmdoow`, region Singapore.
Apply migrations in order:
1. `db/migrations/001_youtube_accounts.sql`
2. `db/migrations/002_selected_youtube_channel.sql`
3. `db/migrations/003_projects_render_publish.sql`

The current live database has all three migration effects applied. Keep `niche_yt` private; do not grant Data API access to `anon` or `authenticated`.

## Google Cloud OAuth
- Configure OAuth consent screen.
- Add authorized redirect URI exactly matching `YOUTUBE_REDIRECT_URI`.
- Enable YouTube Data API v3.
- OAuth scopes requested: YouTube readonly + upload, openid, email.

## Deployment notes
- Deploy Next.js from repository root.
- Deploy worker using `worker/Dockerfile` with `worker` as build context/root directory.
- Attach a private Redis service and configure `REDIS_URL`.
- Configure Cloudflare R2 bucket and S3 credentials.
- Do not expose the worker publicly without its bearer token.
- User-provided Remotion code is executable. Before accepting untrusted uploads, isolate each render in a disposable sandbox/container with no privileged mounts, restricted network egress, CPU/memory/time limits, and non-root user. The current worker is a queue-based foundation, not a hardened multi-tenant sandbox.
