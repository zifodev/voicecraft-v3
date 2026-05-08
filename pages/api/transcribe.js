// pages/api/transcribe.js
import multiparty from 'multiparty'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import os from 'os'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export const config = { api: { bodyParser: false, responseLimit: '200mb' } }

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form({ maxFilesSize: 200 * 1024 * 1024 })
    form.parse(req, (err, fields, files) => {
      if (err) reject(err); else resolve({ fields, files })
    })
  })
}

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(audioPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' })

  const tmpDir = os.tmpdir()
  const id = Date.now()
  const videoPath = path.join(tmpDir, `vc_v_${id}.mp4`)
  const audioPath = path.join(tmpDir, `vc_a_${id}.mp3`)

  try {
    const { files } = await parseForm(req)
    const videoFile = files.video?.[0]
    if (!videoFile) return res.status(400).json({ error: 'No video uploaded' })

    fs.copyFileSync(videoFile.path, videoPath)
    await extractAudio(videoPath, audioPath)

    // Create FormData with the audio file
    const formData = new FormData()
    formData.append('file', fs.createReadStream(audioPath), {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    })
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'json')

    // Send to Groq
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq error:', err)
      return res.status(response.status).json({ error: 'Transcription failed: ' + err })
    }

    const data = await response.json()

    // Cleanup
    ;[videoPath, audioPath, videoFile.path].forEach(f => { try { fs.unlinkSync(f) } catch {} })

    return res.status(200).json({ transcript: data.text || '' })
  } catch (e) {
    ;[videoPath, audioPath].forEach(f => { try { fs.unlinkSync(f) } catch {} })
    console.error('Transcribe error:', e)
    return res.status(500).json({ error: e.message || 'Failed' })
  }
}
