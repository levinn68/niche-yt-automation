# NICHE YT Studio

AI-assisted video production workspace for Remotion rendering and ElevenLabs voice generation.

## Phase 1 scope
- YouTube account selection UI (connection flow to be wired)
- Remotion code/ZIP intake and automatic 9:16 / 16:9 composition detection
- ElevenLabs narration generation and existing audio upload
- Voice, render, subtitle, and audio-sync settings
- Video metadata and thumbnail preparation workspace
- Separate Shorts and Long-Form production schedules

## Planned architecture
- Next.js web dashboard
- Node.js rendering API and isolated Remotion workers
- Remotion + FFmpeg
- ElevenLabs API (server-side only)
- PostgreSQL for projects/settings/jobs
- Object storage for source assets, audio, thumbnails, and MP4 outputs

## Security
Never expose YouTube OAuth tokens or ElevenLabs API keys in browser code. Uploaded Remotion projects must be validated and rendered in an isolated worker with resource and network limits.

## Development
```bash
npm install
npm run dev
```

Integrations require server credentials and OAuth configuration before they can perform live actions.