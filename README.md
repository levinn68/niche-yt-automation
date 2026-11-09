# NICHE YT Studio

AI-assisted video production workspace for Remotion projects and ElevenLabs voice generation.

## Current Phase 1 foundation

- Dark Next.js studio dashboard
- Remotion TSX/JSX paste and ZIP upload UI
- Server-side project inspection endpoint for pasted code and ZIP archives
- Initial 9:16 / 16:9 aspect-ratio detection
- ElevenLabs text-to-speech API endpoint (server-side API key)
- Audio upload and local browser preview
- Separate Shorts and Long-Form niche/schedule controls
- Per-video title, description, and thumbnail preparation UI
- YouTube OAuth start/callback flow with CSRF state validation\n- Google account email and YouTube channel discovery\n- Encrypted access/refresh token storage in PostgreSQL (AES-256-GCM)\n- Channel-list API for the connected workspace\n- Health endpoint that reports which integration environment variables are present

## Important current limitations

- Project inspection is not a Remotion render. The source is not executed by the Next.js app.
- A dedicated isolated Node.js Remotion worker is still required for real MP4 rendering.
- Uploaded audio and thumbnail previews currently live in browser memory; persistent project storage is not wired yet.
- YouTube OAuth requires Google Cloud OAuth credentials, a PostgreSQL database, the SQL migration, and a 32-byte encryption key. The connected channel list is available from the API; the visual channel picker and per-channel selection are still pending.\n- This initial account model is single-workspace (`YOUTUBE_WORKSPACE_ID`); multi-user authentication and workspace isolation are not implemented.
- Publishing, scheduled uploads, database persistence, and queue processing are not enabled yet.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apply `db/migrations/001_youtube_accounts.sql` to PostgreSQL, then configure `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `DATABASE_URL`, `APP_ENCRYPTION_KEY` (32-byte hex or base64), and optionally `YOUTUBE_WORKSPACE_ID`. Add the exact callback URL to the Google Cloud OAuth client.\n\nConfigure these server-side variables for ElevenLabs:

```env
ELEVENLABS_API_KEY=your_key
ELEVENLABS_DEFAULT_VOICE_ID=your_voice_id
```

The UI also accepts a Voice ID per generation request. Never commit API keys or OAuth secrets.

## Planned architecture

- Next.js web dashboard
- Node.js isolated Remotion rendering worker
- Remotion + FFmpeg
- ElevenLabs API
- PostgreSQL for projects/settings/jobs
- Cloudflare R2 for source assets, audio, thumbnails, and MP4 outputs
- Redis + BullMQ for render and publishing queues

## Security

Uploaded Remotion projects contain executable JavaScript. Never execute them inside the public Next.js web process. The render worker must be isolated with filesystem, network, CPU, memory, and execution-time limits.