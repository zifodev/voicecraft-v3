// pages/api/voices.js
export default async function handler(req, res) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return res.status(200).json({ voices: [], keyMissing: true })
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey }
    })
    if (!response.ok) return res.status(200).json({ voices: [], keyError: true })
    const data = await response.json()
    const voices = (data.voices || []).map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      desc: [v.labels?.accent, v.labels?.description, v.category].filter(Boolean).join(' · ') || 'Custom'
    }))
    return res.status(200).json({ voices, keyOk: true })
  } catch (e) {
    return res.status(500).json({ error: e.message, voices: [] })
  }
}
