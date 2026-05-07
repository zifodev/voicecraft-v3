// pages/api/merge.js
import multiparty from 'multiparty'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
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

function mergeAV(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(['-map 0:v:0', '-map 1:a:0', '-c:v copy', '-c:a aac', '-shortest'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const tmpDir = os.tmpdir()
  const id = Date.now()
  const videoIn = path.join(tmpDir, `m_v_${id}.mp4`)
  const audioIn = path.join(tmpDir, `m_a_${id}.mp3`)
  const videoOut = path.join(tmpDir, `m_o_${id}.mp4`)

  try {
    const { files } = await parseForm(req)
    const videoFile = files.video?.[0]
    const audioFile = files.audio?.[0]
    if (!videoFile || !audioFile) return res.status(400).json({ error: 'video and audio required' })

    fs.copyFileSync(videoFile.path, videoIn)
    fs.copyFileSync(audioFile.path, audioIn)

    await mergeAV(videoIn, audioIn, videoOut)

    const stat = fs.statSync(videoOut)
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', 'attachment; filename="voicecraft_output.mp4"')
    const stream = fs.createReadStream(videoOut)
    stream.pipe(res)
    stream.on('end', () => {
      ;[videoIn, audioIn, videoOut, videoFile.path, audioFile.path].forEach(f => { try { fs.unlinkSync(f) } catch {} })
    })
  } catch (e) {
    ;[videoIn, audioIn, videoOut].forEach(f => { try { fs.unlinkSync(f) } catch {} })
    console.error('Merge error:', e)
    return res.status(500).json({ error: e.message || 'Merge failed' })
  }
}
