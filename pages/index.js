import { useState, useRef, useCallback, useEffect } from 'react'
import Head from 'next/head'

const STEPS = ['upload','transcribe','enhance','voice','merge','done']
const LBL = { upload:'Upload', transcribe:'Transcript', enhance:'Edit Script', voice:'Voice', merge:'Merge', done:'Done' }
const PROG = { upload:0, transcribe:20, enhance:40, voice:60, merge:80, done:100 }

const LANGS = [
  {code:'en',label:'English'},{code:'es',label:'Spanish'},{code:'fr',label:'French'},
  {code:'de',label:'German'},{code:'hi',label:'Hindi'},{code:'ar',label:'Arabic'},
  {code:'zh',label:'Chinese'},{code:'ja',label:'Japanese'},{code:'pt',label:'Portuguese'},{code:'ko',label:'Korean'},
]

const FALLBACK_VOICES = [
  {voice_id:'21m00Tcm4TlvDq8ikWAM',name:'Rachel',desc:'Calm · American'},
  {voice_id:'AZnzlk1XvdvUeBnXmlld',name:'Domi',desc:'Strong · American'},
  {voice_id:'EXAVITQu4vr4xnSDxMaL',name:'Bella',desc:'Soft · American'},
  {voice_id:'TxGEqnHWrfWFTfGW9XjX',name:'Josh',desc:'Deep · American'},
  {voice_id:'onwK4e9ZLuTAKqWW03F9',name:'Daniel',desc:'British'},
]

const Spinner = ({size=28}) => <div style={{width:size,height:size,border:'2px solid #1a1a1a',borderTop:'2px solid #00e5a0',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}}/>
const Tag = ({children,color='#00e5a0'}) => <span style={{padding:'2px 8px',borderRadius:4,fontSize:10,background:`${color}18`,color,border:`1px solid ${color}40`,letterSpacing:1,fontWeight:600}}>{children}</span>
const Lbl = ({children}) => <div style={{fontSize:9,color:'#3a3a3a',letterSpacing:1.5,textTransform:'uppercase',marginBottom:7}}>{children}</div>
const Card = ({children,accent,style={}}) => <div style={{background:'#0a0a0a',border:`1px solid ${accent?'#0f2a1f':'#141414'}`,borderRadius:12,padding:18,marginBottom:14,...style}}>{children}</div>

const Btn = ({onClick,disabled,loading,children,secondary,small,color}) => (
  <button onClick={onClick} disabled={disabled||loading} style={{
    width:small?'auto':'100%', padding:small?'8px 16px':'14px',
    fontFamily:'inherit',fontWeight:700,letterSpacing:small?1:2,fontSize:small?10:12,
    borderRadius:8,cursor:disabled||loading?'not-allowed':'pointer',transition:'all .2s',
    background:secondary?'transparent':color||(disabled||loading?'#0f2a1f':'#00e5a0'),
    color:secondary?'#555':color?(disabled||loading?'#333':'#000'):(disabled||loading?'#1a4a30':'#000'),
    border:secondary?'1px solid #1e1e1e':'none',
    display:'inline-flex',alignItems:'center',justifyContent:'center',gap:8,
  }}>
    {loading && <Spinner size={14}/>}
    {children}
  </button>
)

const StepDot = ({step,current,onClick}) => {
  const idx=STEPS.indexOf(step),cur=STEPS.indexOf(current),done=idx<cur,active=idx===cur
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:done?'pointer':'default'}} onClick={done?onClick:undefined}>
      <div style={{width:24,height:24,borderRadius:'50%',background:done?'#00e5a0':active?'#fff':'transparent',border:`2px solid ${done?'#00e5a0':active?'#fff':'#252525'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:done||active?'#000':'#3a3a3a',transition:'all .4s'}}>
        {done?'✓':idx+1}
      </div>
      <span style={{fontSize:7,letterSpacing:1,textTransform:'uppercase',color:active?'#fff':done?'#00e5a0':'#2a2a2a',whiteSpace:'nowrap'}}>{LBL[step]}</span>
    </div>
  )
}

const LoadingPanel = ({msg,progress}) => (
  <div style={{padding:20,background:'#090909',borderRadius:10,border:'1px solid #0f0f0f'}}>
    <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:progress!=null?12:0}}>
      <Spinner/><span style={{fontSize:12,color:'#888'}}>{msg}</span>
    </div>
    {progress!=null && (
      <>
        <div style={{height:3,background:'#141414',borderRadius:99}}>
          <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#00e5a0,#00b8ff)',borderRadius:99,transition:'width 1s ease'}}/>
        </div>
        <div style={{fontSize:10,color:'#2a2a2a',marginTop:6,textAlign:'right'}}>{progress}%</div>
      </>
    )}
  </div>
)

export default function Home() {
  const [step,setStep] = useState('upload')
  const [videoFile,setVideoFile] = useState(null)
  const [videoUrl,setVideoUrl] = useState(null)
  const [rawText,setRawText] = useState('')
  const [cleanScript,setCleanScript] = useState('')
  const [targetLang,setTargetLang] = useState('en')
  const [voices,setVoices] = useState(FALLBACK_VOICES)
  const [selectedVoice,setSelectedVoice] = useState(FALLBACK_VOICES[0].voice_id)
  const [audioBlob,setAudioBlob] = useState(null)
  const [audioUrl,setAudioUrl] = useState(null)
  const [finalVideoUrl,setFinalVideoUrl] = useState(null)
  const [loading,setLoading] = useState(false)
  const [loadingMsg,setLoadingMsg] = useState('')
  const [progress,setProgress] = useState(null)
  const [error,setError] = useState('')
  const [keyStatus,setKeyStatus] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    fetch('/api/voices').then(r=>r.json()).then(d=>{
      if(d.keyOk && d.voices?.length){ setVoices(d.voices); setSelectedVoice(d.voices[0].voice_id); setKeyStatus('ok') }
      else if(d.keyMissing||d.keyError) setKeyStatus('missing')
    }).catch(()=>{})
  },[])

  const handleFile = useCallback((file) => {
    if(!file||!file.type.startsWith('video/')){ setError('Please upload a video file'); return }
    setError(''); setVideoFile(file); setVideoUrl(URL.createObjectURL(file)); setStep('transcribe')
  },[])

  const onDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }

  const runTranscribe = async () => {
    setError(''); setLoading(true); setLoadingMsg('Extracting audio from video...'); setProgress(10)
    try {
      const fd = new FormData()
      fd.append('video', videoFile, videoFile.name)
      const progInt = setInterval(()=>setProgress(p=>Math.min((p||0)+3,85)),2000)
      setTimeout(()=>setLoadingMsg('Whisper is transcribing your speech...'),3000)
      const res = await fetch('/api/transcribe',{method:'POST',body:fd})
      clearInterval(progInt); setProgress(95)
      if(!res.ok){ const j=await res.json(); throw new Error(j.error||'Transcription failed') }
      const data = await res.json()
      setRawText(data.transcript||''); setProgress(100); setStep('enhance')
    } catch(e){ setError(e.message) }
    setLoading(false); setProgress(null)
  }

  const runEnhance = async () => {
    setError(''); setLoading(true); setLoadingMsg('Claude is polishing your script...')
    try {
      const res = await fetch('/api/enhance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rawText,targetLang})})
      const data = await res.json()
      if(!res.ok) throw new Error(data.error||'Enhance failed')
      setCleanScript(data.cleanScript); setStep('voice')
    } catch(e){ setError(e.message) }
    setLoading(false)
  }

  const runVoice = async () => {
    setError(''); setLoading(true); setLoadingMsg('ElevenLabs generating AI voice...')
    try {
      const res = await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({script:cleanScript,voiceId:selectedVoice})})
      if(!res.ok){ const j=await res.json(); throw new Error(j.error||'TTS failed') }
      const blob = await res.blob()
      setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); setStep('merge')
    } catch(e){ setError(e.message) }
    setLoading(false)
  }

  const runMerge = async () => {
    setError(''); setLoading(true); setLoadingMsg('Merging AI voice into your video...'); setProgress(5)
    try {
      const fd = new FormData()
      fd.append('video',videoFile,videoFile.name)
      fd.append('audio',audioBlob,'voice.mp3')
      const progInt = setInterval(()=>setProgress(p=>Math.min((p||0)+8,88)),1500)
      const res = await fetch('/api/merge',{method:'POST',body:fd})
      clearInterval(progInt); setProgress(95)
      if(!res.ok){ const j=await res.json(); throw new Error(j.error||'Merge failed') }
      const blob = await res.blob()
      setProgress(100); setFinalVideoUrl(URL.createObjectURL(blob)); setStep('done')
    } catch(e){ setError(e.message) }
    setLoading(false); setProgress(null)
  }

  const reset = () => {
    setStep('upload'); setVideoFile(null); setVideoUrl(null); setRawText('')
    setCleanScript(''); setAudioBlob(null); setAudioUrl(null); setFinalVideoUrl(null); setError('')
  }

  const goBack = (s) => { setError(''); setStep(s) }

  return (
    <>
      <Head>
        <title>VOICECRAFT — AI Video Voice Enhancer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px)'}}/>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',position:'relative'}}>

        <header style={{padding:'18px 24px',borderBottom:'1px solid #0f0f0f',display:'flex',justifyContent:'space-between',alignItems:'center',zIndex:10,position:'relative'}}>
          <div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:5,color:'#fff'}}>VOICECRAFT</div>
            <div style={{fontSize:8,color:'#2a2a2a',letterSpacing:2}}>AUTOMATED AI VIDEO VOICE PIPELINE</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            {keyStatus==='ok'&&<Tag>ElevenLabs ✓</Tag>}
            {keyStatus==='missing'&&<Tag color='#ff9944'>EL Missing</Tag>}
          </div>
        </header>

        <div style={{padding:'14px 24px 0',position:'relative',zIndex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            {STEPS.map(s=><StepDot key={s} step={s} current={step} onClick={()=>goBack(s)}/>)}
          </div>
          <div style={{height:2,background:'#0f0f0f',borderRadius:99}}>
            <div style={{height:'100%',width:`${PROG[step]}%`,background:'linear-gradient(90deg,#00e5a0,#00b8ff)',borderRadius:99,transition:'width .5s ease'}}/>
          </div>
          {step!=='upload'&&step!=='done'&&(
            <div style={{textAlign:'right',marginTop:6}}>
              <button onClick={()=>goBack(STEPS[STEPS.indexOf(step)-1])} style={{background:'none',border:'none',color:'#333',fontSize:10,cursor:'pointer',fontFamily:'inherit',letterSpacing:1}}>
                ← GO BACK
              </button>
            </div>
          )}
        </div>

        <main style={{flex:1,padding:'24px',maxWidth:680,margin:'0 auto',width:'100%',position:'relative',zIndex:1}}>
          {error&&step!=='upload'&&(
            <div style={{background:'rgba(255,60,60,.07)',border:'1px solid rgba(255,60,60,.2)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:11,color:'#ff7070'}}>⚠ {error}</div>
          )}

          {/* UPLOAD */}
          {step==='upload'&&(
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>DROP YOUR VIDEO</h2>
              <p style={{color:'#444',fontSize:11,marginBottom:18}}>Fully automated — Whisper transcribes, Claude cleans, ElevenLabs voices, FFmpeg merges</p>
              <div className="drop-zone" onDrop={onDrop} onDragOver={e=>e.preventDefault()} onClick={()=>fileRef.current.click()}
                style={{border:'2px dashed #1a1a1a',borderRadius:14,padding:'50px 24px',textAlign:'center',cursor:'pointer',background:'rgba(255,255,255,.003)'}}>
                <div style={{fontSize:40,marginBottom:12}}>🎬</div>
                <div style={{fontSize:14,color:'#555',marginBottom:4}}>Drag & drop your video</div>
                <div style={{fontSize:10,color:'#2a2a2a'}}>MP4, MOV, WEBM · up to 500MB · up to 30 minutes</div>
                <input ref={fileRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>
              {error&&<div style={{marginTop:10,fontSize:11,color:'#ff7070'}}>⚠ {error}</div>}
              <div style={{marginTop:18,padding:14,background:'#090909',borderRadius:10,border:'1px solid #0f0f0f'}}>
                <Lbl>FULLY AUTOMATIC PIPELINE</Lbl>
                {[['1','Whisper auto-transcribes your speech'],['2','Claude cleans grammar & removes fillers'],['3','You can manually edit the script'],['4','ElevenLabs generates clean AI voice'],['5','FFmpeg merges new audio into video 🎉']].map(([n,t])=>(
                  <div key={n} style={{display:'flex',gap:10,alignItems:'center',marginBottom:7}}>
                    <span style={{color:'#00e5a0',fontSize:10,width:12}}>{n}.</span>
                    <span style={{fontSize:11,color:'#444'}}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TRANSCRIBE */}
          {step==='transcribe'&&(
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>AUTO-TRANSCRIBE</h2>
              <p style={{color:'#444',fontSize:11,marginBottom:18}}>Whisper extracts your speech automatically</p>
              <Card>
                <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:12}}>
                  <span style={{fontSize:18}}>🎬</span>
                  <div>
                    <div style={{color:'#bbb',fontSize:12}}>{videoFile?.name}</div>
                    <div style={{color:'#2a2a2a',fontSize:10}}>{videoFile?(videoFile.size/1024/1024).toFixed(1)+' MB':''}</div>
                  </div>
                </div>
                {videoUrl&&<video src={videoUrl} controls style={{width:'100%',maxHeight:200,background:'#000'}}/>}
              </Card>
              <div style={{marginBottom:14}}>
                <Lbl>TARGET LANGUAGE</Lbl>
                <select value={targetLang} onChange={e=>setTargetLang(e.target.value)}
                  style={{width:'100%',background:'#0a0a0a',border:'1px solid #141414',color:'#ccc',borderRadius:8,padding:'10px 14px',fontSize:12,fontFamily:'inherit',outline:'none',cursor:'pointer'}}>
                  {LANGS.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
              {loading?<LoadingPanel msg={loadingMsg} progress={progress}/>:<Btn onClick={runTranscribe}>▶ AUTO-EXTRACT TRANSCRIPT</Btn>}
            </div>
          )}

          {/* ENHANCE — with manual edit */}
          {step==='enhance'&&(
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>EDIT SCRIPT</h2>
              <p style={{color:'#444',fontSize:11,marginBottom:18}}>Claude cleans your script — then you can manually edit before generating voice</p>

              {!cleanScript ? (
                <>
                  <Card>
                    <Lbl>WHISPER TRANSCRIPT</Lbl>
                    <div style={{fontSize:12,color:'#888',lineHeight:1.8,fontStyle:'italic',maxHeight:140,overflowY:'auto'}}>"{rawText}"</div>
                  </Card>
                  {loading?<LoadingPanel msg={loadingMsg}/>:<Btn onClick={runEnhance}>✨ CLEAN WITH CLAUDE →</Btn>}
                </>
              ) : (
                <>
                  <Card accent>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <Tag>✓ CLAUDE ENHANCED</Tag>
                      <button onClick={()=>setCleanScript('')} style={{background:'none',border:'none',color:'#444',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>↺ RE-ENHANCE</button>
                    </div>
                    <Lbl>EDIT YOUR SCRIPT (click to edit)</Lbl>
                    <textarea
                      value={cleanScript}
                      onChange={e=>setCleanScript(e.target.value)}
                      rows={8}
                      style={{width:'100%',background:'#060606',border:'1px solid #1a1a1a',color:'#ccc',borderRadius:8,padding:'10px 12px',fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',lineHeight:1.8}}
                    />
                    <div style={{fontSize:9,color:'#2a2a2a',marginTop:4}}>{cleanScript.split(' ').length} words · ~{Math.ceil(cleanScript.split(' ').length/145)} min read aloud</div>
                  </Card>
                  <Btn onClick={()=>setStep('voice')}>USE THIS SCRIPT → CHOOSE VOICE</Btn>
                </>
              )}
            </div>
          )}

          {/* VOICE */}
          {step==='voice'&&(
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>CHOOSE VOICE</h2>
              <p style={{color:'#444',fontSize:11,marginBottom:18}}>Pick the voice — you can come back and change it anytime</p>
              <Card accent style={{maxHeight:180,overflowY:'auto'}}>
                <Lbl>YOUR SCRIPT</Lbl>
                <div style={{fontSize:11,color:'#888',lineHeight:1.8}}>{cleanScript}</div>
              </Card>
              <Lbl>SELECT VOICE</Lbl>
              <div style={{border:'1px solid #111',borderRadius:10,overflow:'hidden',marginBottom:14,maxHeight:280,overflowY:'auto'}}>
                {voices.map((v,i)=>(
                  <div key={v.voice_id} className="voice-row" onClick={()=>setSelectedVoice(v.voice_id)}
                    style={{display:'flex',gap:12,alignItems:'center',padding:'11px 14px',background:selectedVoice===v.voice_id?'rgba(0,229,160,.06)':'transparent',borderBottom:i<voices.length-1?'1px solid #0d0d0d':'none',cursor:'pointer'}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:selectedVoice===v.voice_id?'#00e5a0':'#111',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:selectedVoice===v.voice_id?'#000':'#444',flexShrink:0,fontWeight:700}}>
                      {v.name[0]}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:selectedVoice===v.voice_id?'#fff':'#777'}}>{v.name}</div>
                      <div style={{fontSize:10,color:'#2a2a2a'}}>{v.desc}</div>
                    </div>
                    {selectedVoice===v.voice_id&&<span style={{color:'#00e5a0'}}>✓</span>}
                  </div>
                ))}
              </div>
              {loading?<LoadingPanel msg={loadingMsg}/>:<Btn onClick={runVoice} disabled={!selectedVoice}>GENERATE VOICE →</Btn>}
            </div>
          )}

          {/* MERGE — with ability to go back and change voice */}
          {step==='merge'&&(
            <div className="fadeUp">
              <h2 style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:'#fff',margin:'0 0 4px'}}>PREVIEW & MERGE</h2>
              <p style={{color:'#444',fontSize:11,marginBottom:18}}>Listen to the AI voice — go back if you want changes</p>
              <Card accent>
                <Lbl>AI VOICE PREVIEW — LISTEN BEFORE MERGING</Lbl>
                {audioUrl&&<audio src={audioUrl} controls/>}
              </Card>

              {/* Action options */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
                <button onClick={()=>goBack('voice')} style={{background:'#090909',border:'1px solid #1a1a1a',borderRadius:8,padding:'12px 8px',cursor:'pointer',color:'#777',fontFamily:'inherit',fontSize:10,letterSpacing:1}}>
                  🎙 CHANGE<br/>VOICE
                </button>
                <button onClick={()=>goBack('enhance')} style={{background:'#090909',border:'1px solid #1a1a1a',borderRadius:8,padding:'12px 8px',cursor:'pointer',color:'#777',fontFamily:'inherit',fontSize:10,letterSpacing:1}}>
                  ✏️ EDIT<br/>SCRIPT
                </button>
                <button onClick={()=>{setAudioBlob(null);setAudioUrl(null);goBack('voice')}} style={{background:'#090909',border:'1px solid #1a1a1a',borderRadius:8,padding:'12px 8px',cursor:'pointer',color:'#777',fontFamily:'inherit',fontSize:10,letterSpacing:1}}>
                  🔄 REGENERATE<br/>VOICE
                </button>
              </div>

              <Card>
                <div style={{display:'flex',gap:10,alignItems:'center',fontSize:11}}>
                  <span style={{fontSize:18}}>🎬</span>
                  <div style={{color:'#888',flex:1}}>{videoFile?.name}</div>
                  <span style={{color:'#333'}}>+</span>
                  <span style={{fontSize:18}}>🔊</span>
                  <span style={{color:'#00e5a0',fontSize:11}}>AI voice</span>
                  <span style={{color:'#333'}}>=</span>
                  <span style={{fontSize:16}}>🎉</span>
                </div>
              </Card>
              {loading?<LoadingPanel msg={loadingMsg} progress={progress}/>:<Btn onClick={runMerge}>🎬 MERGE INTO FINAL VIDEO →</Btn>}
            </div>
          )}

          {/* DONE */}
          {step==='done'&&(
            <div className="fadeUp">
              <div style={{textAlign:'center',marginBottom:24}}>
                <div style={{fontSize:38,marginBottom:8,animation:'glow 2s infinite'}}>✦</div>
                <h2 style={{fontFamily:"'Bebas Neue'",fontSize:38,letterSpacing:4,color:'#00e5a0',margin:0}}>YOUR VIDEO IS READY</h2>
                <p style={{color:'#333',fontSize:11}}>AI voice merged into your original video</p>
              </div>
              {finalVideoUrl&&(
                <Card accent>
                  <Lbl>FINAL VIDEO WITH AI VOICE</Lbl>
                  <video src={finalVideoUrl} controls style={{width:'100%',background:'#000',maxHeight:300}}/>
                </Card>
              )}
              <button onClick={()=>{if(finalVideoUrl){const a=document.createElement('a');a.href=finalVideoUrl;a.download='voicecraft_output.mp4';a.click()}}}
                style={{width:'100%',padding:'14px',background:'#00e5a0',color:'#000',border:'none',borderRadius:8,fontSize:12,fontFamily:'inherit',fontWeight:700,cursor:'pointer',letterSpacing:2,marginBottom:10}}>
                ↓ DOWNLOAD FINAL VIDEO (.MP4)
              </button>
              <Btn onClick={reset} secondary>← PROCESS ANOTHER VIDEO</Btn>
            </div>
          )}
        </main>

        <footer style={{padding:'12px 24px',borderTop:'1px solid #0a0a0a',display:'flex',justifyContent:'space-between',zIndex:1,position:'relative'}}>
          <div style={{fontSize:8,color:'#181818'}}>VOICECRAFT v3.1 · WHISPER + CLAUDE + ELEVENLABS + FFMPEG</div>
          <div style={{fontSize:8,color:'#181818'}}>FULLY AUTOMATIC</div>
        </footer>
      </div>
    </>
  )
}
