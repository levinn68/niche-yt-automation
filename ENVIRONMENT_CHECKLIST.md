# Creator Studio — Environment Checklist

Upload these values to the relevant hosting service later. Never commit actual secrets to GitHub.

## Next.js app (Vercel)

Required:
- `STUDIO_PASSWORD`: current dashboard login password. The repository still implements password login; Google Sign-In (GSI) has not yet replaced this flow in code.
- `STUDIO_SESSION_SECRET`: random secret, minimum 32 characters, used to sign the HttpOnly studio session.
- `DATABASE_URL`: Supabase PostgreSQL connection string (server-side only; use the Supabase pooler appropriate for serverless).
- `APP_ENCRYPTION_KEY`: 32-byte hex or base64 key used to encrypt stored YouTube OAuth tokens.
- `YOUTUBE_CLIENT_ID`: Google OAuth Web application client ID.
- `YOUTUBE_CLIENT_SECRET`: Google OAuth client secret.
- `YOUTUBE_REDIRECT_URI`: exact production callback URL, `https://<app-domain>/api/auth/youtube/callback`.
- `ELEVENLABS_API_KEY`: ElevenLabs API key for narration.
- `ELEVENLABS_DEFAULT_VOICE_ID`: default narration voice.
- `GEMINI_API_KEY`: Gemini API key for Remotion source generation.
- `RENDER_WORKER_URL`: Railway worker base URL.
- `WORKER_API_TOKEN`: shared bearer token; must match the Railway worker value.

Recommended:
- `APP_URL`: production app URL. The YouTube callback currently falls back to the incoming request origin if this is omitted.

Optional overrides (omit to use defaults):
- `YOUTUBE_WORKSPACE_ID`: defaults to `default`.
- `GEMINI_MODEL`: defaults to `gemini-2.5-flash`.

## Node.js render/publish worker (Railway)

Required:
- `WORKER_API_TOKEN`: same secret as Vercel, minimum 32 characters.
- `REDIS_URL`: private Redis connection URL for BullMQ.
- `DATABASE_URL`: same Supabase PostgreSQL URL as Vercel.
- `APP_ENCRYPTION_KEY`: same 32-byte key as Vercel, required to decrypt YouTube OAuth tokens.
- `YOUTUBE_CLIENT_ID`: same Google OAuth client ID.
- `YOUTUBE_CLIENT_SECRET`: same Google OAuth client secret.
- `YOUTUBE_REDIRECT_URI`: same exact callback URL as Vercel.
- `S3_ENDPOINT`: Cloudflare R2 S3 endpoint.
- `S3_BUCKET`: R2 bucket name.
- `S3_ACCESS_KEY_ID`: R2 access key.
- `S3_SECRET_ACCESS_KEY`: R2 secret key.

Optional overrides:
- `YOUTUBE_WORKSPACE_ID`: defaults to `default`.
- `RENDER_CONCURRENCY`: defaults to `1`.
- `PORT`: Railway provides this automatically; the worker falls back to `8080` locally.

## Not required at the moment
- `NODE_ENV`: set automatically by the hosting platform.
- `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL`: no OpenAI thumbnail-generation route currently uses them, so do not configure them until that feature is implemented.
- `STUDIO_PASSWORD` is **not removable yet**: despite the earlier GSI plan, the current repository still authenticates the dashboard with this variable. Remove it only after GSI login and server-side session verification have been implemented and tested.

## Supabase
Project: `nozefqkvofoqbvcmdoow`, region Singapore.
Migrations 001, 002, and 003 have already been applied. Keep schema `niche_yt` private; do not grant Data API access to `anon` or `authenticated`.

## Google Cloud OAuth
- Create one OAuth 2.0 Client ID of type **Web application** for the studio owner.
- Add the exact production callback URL to Authorized redirect URIs: `https://<your-app-domain>/api/auth/youtube/callback`.
- Enable YouTube Data API v3.
- Each creator connects their YouTube account through the separate **Connect YouTube** OAuth flow.
- While the OAuth consent screen is in Testing, only listed test users can connect.

## Deployment notes
- Deploy Next.js from repository root.
- Deploy worker using `worker/Dockerfile` with `worker` as the build context/root directory.
- Attach a private Redis service and configure `REDIS_URL`.
- Configure the Cloudflare R2 bucket and S3 credentials.
- Do not expose the worker publicly without its bearer token.
- User-provided Remotion source executes in the worker. The current worker is a queue-based foundation, not a hardened multi-tenant sandbox. Isolate each render before accepting untrusted public uploads.

Build, deployment, live MP4 rendering, YouTube upload, and scheduled publication still require end-to-end smoke testing.
