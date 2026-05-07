// pages/api/tts.js
export const config = { api: { responseLimit: '10mb' } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { script, voiceId } = req.body
  if (!script || !voiceId) return res.status(400).json({ error: 'script and voiceId required' })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ELEVENLABS_API_KEY not set' })

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    })
    if (!response.ok) {
      let msg = `ElevenLabs error (${response.status})`
      try { const j = await response.json(); msg = j?.detail?.message || j?.detail || msg } catch {}
      return res.status(response.status).json({ error: msg })
    }
    const audioBuffer = await response.arrayBuffer()
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', audioBuffer.byteLength)
    res.status(200).send(Buffer.from(audioBuffer))
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
