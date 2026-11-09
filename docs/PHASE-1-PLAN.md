# Phase 1 Implementation Plan

## First-run experience
1. Connect YouTube with OAuth.
2. Fetch the authenticated user's channels and show an account picker.
3. Persist the selected channel per workspace.
4. Never ask the user to paste OAuth tokens into the UI.

## Studio
- Remotion source input: paste TSX/JSX or upload a ZIP project.
- Inspect Remotion compositions and read width, height, and duration.
- Detect 9:16 or 16:9 automatically; permit a manual override.
- Show the detected composition and preview before rendering.
- Render with Remotion in a separate Node.js worker, not in the browser.

## Voice Engine
Two mutually exclusive input modes:
- Narration: send text to ElevenLabs from the server, save the returned audio asset, then make it available to the Remotion composition.
- Upload audio: accept a user-provided ElevenLabs export or other supported audio file and attach it to the project.

Voice settings:
- Voice ID, model ID, stability, similarity boost, style, speaker boost, and speed only when supported by the selected model.
- Preview generation and regeneration.
- Audio sync and subtitle generation are independent toggles.

## Project settings
- Auto ElevenLabs: on/off.
- Auto render: on/off.
- Auto audio sync: on/off.
- Auto subtitles: on/off.
- Shorts niche, daily target, and publish time.
- Long-Form niche, interval (default every 2-3 days), ready-only publishing rule, and publish time.
- Timezone default: Asia/Jakarta.

## Publishing preparation
Per-video fields:
- Title
- Description
- Tags
- Thumbnail upload or generated thumbnail asset
- Target YouTube channel
- Visibility and scheduled publish time

Publishing itself remains disabled until the rendering and account integrations are tested.

## Security and reliability
- Store API keys and OAuth credentials only on the server.
- Encrypt credentials at rest.
- Validate ZIP size, file types, and archive paths.
- Execute user-supplied Remotion code in an isolated worker with CPU, memory, time, filesystem, and network limits.
- Persist render jobs and make them retryable.
- Do not delete source assets until output is verified.
