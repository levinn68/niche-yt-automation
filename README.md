# NICHE YT Studio

AI-assisted YouTube video production workspace built with Next.js, Remotion, Gemini, ElevenLabs, Supabase PostgreSQL, BullMQ, and Cloudflare R2.

## Implemented in the repository

### Phase 1 — Studio foundation
- Next.js dark dashboard
- Remotion TSX/JSX paste and ZIP inspection
- YouTube OAuth with CSRF state validation and encrypted token storage
- YouTube channel list and persisted selected-channel picker
- ElevenLabs text-to-speech endpoint
- Separate Shorts and Long-Form settings
- Password-protected studio session using an HttpOnly signed cookie

### Phase 2 — Render engine foundation
- Dedicated Node.js worker under `worker/`
- Remotion bundle, composition selection, H.264 MP4 render
- BullMQ render queue with retry/backoff and progress
- Cloudflare R2-compatible object storage adapter
- Render enqueue and job status API routes
- Dockerfile with FFmpeg and Chromium

### Phase 3 — AI production foundation
- Gemini API route that generates a complete Remotion starter composition
- Visual style presets in the dashboard, including Doodle Animation
- ElevenLabs narration endpoint and existing audio upload UI
- Shorts 9:16 / Long-Form 16:9 generation choice

### Phase 4 — Publishing foundation
- BullMQ publishing queue
- YouTube Data API upload worker
- Selected-channel validation before upload
- Private/unlisted/public privacy choices
- Scheduled publishing via YouTube `publishAt`
- Retry/backoff for transient queue failures

## Database

Private PostgreSQL schema: `niche_yt`. Migrations:
1. `db/migrations/001_youtube_accounts.sql`
2. `db/migrations/002_selected_youtube_channel.sql`
3. `db/migrations/003_projects_render_publish.sql`

The live Supabase project currently has the schema, account/channel tables, selected channel column, projects, render jobs, and publish jobs. RLS is enabled and the schema remains inaccessible to `anon` and `authenticated`; the app and worker use server-side PostgreSQL connections.

## Setup

1. Install app dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill server-side secrets.
3. Run the app: `npm run dev`
4. Configure Google Cloud OAuth and add the callback URL.
5. Deploy the Next.js app from repository root.
6. Deploy the worker using `worker/Dockerfile` with `worker` as its build context.
7. Attach Redis and configure Cloudflare R2.
8. Upload all required variables from [ENVIRONMENT_CHECKLIST.md](./ENVIRONMENT_CHECKLIST.md).

## Important deployment and security requirements

- Do not commit secrets or expose server credentials in `NEXT_PUBLIC_*` variables.
- The render and publish API routes require the signed studio session.
- The worker API requires a long random bearer token.
- The worker needs access to Supabase, Redis, R2, Google OAuth credentials, and the encryption key.
- User-provided Remotion source is executable code. The current worker is a queue-based render foundation, **not** a hardened multi-tenant sandbox. Before accepting arbitrary public uploads, isolate each render in a disposable container/VM with a non-root user, no privileged mounts, restricted network egress, CPU/memory/process/time limits, and per-job cleanup.
- Build, deploy, live MP4 rendering, YouTube upload, and scheduled publication have not yet been verified end-to-end. Configure environment variables and run the smoke-test checklist before enabling public traffic.
