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
- Health endpoint that reports which integration environment variables are present

## Important current limitations

- Project inspection is not a Remotion render. The source is not executed by the Next.js app.
- A dedicated isolated Node.js Remotion worker is still required for real MP4 rendering.
- Uploaded audio and thumbnail previews currently live in browser memory; persistent project storage is not wired yet.
- YouTube OAuth and channel picker are not connected yet.
- Publishing, scheduled uploads, database persistence, and queue processing are not enabled yet.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure these server-side variables for ElevenLabs:

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