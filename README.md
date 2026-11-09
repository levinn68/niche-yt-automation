# NICHE YT Studio

AI-assisted video production workspace for Remotion projects and ElevenLabs voice generation.

## Current foundation

- Dark Next.js studio dashboard
- Remotion TSX/JSX paste and ZIP upload UI
- Server-side project inspection endpoint for pasted code and ZIP archives
- Initial 9:16 / 16:9 aspect-ratio detection
- ElevenLabs text-to-speech API endpoint (server-side API key)
- Audio upload and local browser preview
- Separate Shorts and Long-Form niche/schedule controls
- Per-video title, description, and thumbnail preparation UI
- YouTube OAuth start/callback flow with CSRF state validation
- Google account email and YouTube channel discovery
- AES-256-GCM encrypted access/refresh token storage in PostgreSQL
- Channel-list API for the connected workspace
- Health endpoint for integration environment variables

## Database setup

The YouTube account migration creates a dedicated `niche_yt` PostgreSQL schema. It does not create tables in `public`.

Apply `db/migrations/001_youtube_accounts.sql` to the dedicated NICHE YT Supabase project using the SQL Editor or migration tooling. The server-side PostgreSQL connection must use a role allowed to access the private schema (normally the Supabase `postgres` role). Do not expose database credentials to the browser.

Required server environment variables:

- `DATABASE_URL`
- `APP_ENCRYPTION_KEY` (32-byte hex or base64)
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REDIRECT_URI`
- `APP_URL`

Optional:

- `YOUTUBE_WORKSPACE_ID` (defaults to `default`)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_DEFAULT_VOICE_ID`

Add the exact callback URL to the Google Cloud OAuth client. Never commit API keys, database URLs, or OAuth secrets.

## Important limitations

- Project inspection is not a Remotion render. The source is not executed by the Next.js app.
- A dedicated isolated Node.js Remotion worker is still required for real MP4 rendering.
- Uploaded audio and thumbnail previews currently live in browser memory; persistent project storage is not wired yet.
- The connected channel list is available from the API; the visual channel picker and per-channel selection are still pending.
- The account model is single-workspace. Multi-user authentication and workspace isolation are not implemented.
- Publishing, scheduled uploads, persistent project storage, and queue processing are not enabled yet.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Planned architecture

- Next.js web dashboard
- Isolated Node.js Remotion rendering worker
- Remotion + FFmpeg
- ElevenLabs API
- PostgreSQL for projects, settings, and jobs
- Cloudflare R2 for source assets, audio, thumbnails, and MP4 outputs
- Redis + BullMQ for render and publishing queues

## Security

Uploaded Remotion projects contain executable JavaScript. Never execute them inside the public Next.js web process. The render worker must be isolated with filesystem, network, CPU, memory, and execution-time limits.
