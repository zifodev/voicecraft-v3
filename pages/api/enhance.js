// pages/api/enhance.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { rawText, targetLang } = req.body
  if (!rawText) return res.status(400).json({ error: 'rawText required' })

  const LANGS = { en:'English',es:'Spanish',fr:'French',de:'German',hi:'Hindi',ar:'Arabic',zh:'Chinese',ja:'Japanese',pt:'Portuguese',ko:'Korean' }
  const langLabel = LANGS[targetLang] || 'English'
  const translate = targetLang !== 'en' ? `After cleaning, translate into ${langLabel}.` : 'Output in English.'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Rewrite this raw spoken transcript into a clean, natural voiceover script:
- Remove all filler words (um, uh, like, basically, you know, so, etc.)
- Fix all grammar and sentence structure
- Keep the same meaning, tone, and personality
- Make it flow smoothly when read aloud
- Do NOT add new content
${translate}

Raw:
"""
${rawText}
"""

Return ONLY the cleaned script.`
        }]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(500).json({ error: err?.error?.message || 'Claude error' })
    }
    const data = await response.json()
    return res.status(200).json({ cleanScript: data.content?.[0]?.text?.trim() || rawText })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
