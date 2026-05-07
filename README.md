# VOICECRAFT v3 — Fully Automatic AI Video Voice Pipeline

Upload your video → AI does everything → Download final video with clean AI voice.

**No manual transcript typing!** Whisper auto-extracts your speech.

## Pipeline
1. **Whisper** auto-transcribes your speech from the video
2. **Claude** cleans grammar + removes fillers + translates if needed
3. **ElevenLabs** generates a smooth professional AI voice
4. **FFmpeg** merges the new audio into your original video

## Deploy to Vercel

### Required API Keys (Environment Variables)
| Name | Where to get | Free? |
|------|-------------|-------|
| `GROQ_API_KEY` | https://console.groq.com — sign up, create key | ✅ Free, generous limits |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com | ~$5 minimum credit |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io → Profile → API Key | Starter $5/mo |

### Deploy steps
1. Push to GitHub
2. Import on Vercel (auto-detects Next.js)
3. Settings → Environment Variables → add all 3 keys
4. Redeploy

## Local development
```bash
npm install
cp .env.example .env.local
# Add your 3 keys
npm run dev
```
