import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Totem({ onLogout }) {
  const [status, setStatus] = useState('Carregando...')
  const [resultado, setResultado] = useState('')
  const [corResultado, setCorResultado] = useState('#aaa')
  const [ovalCor, setOvalCor] = useState('#ffffff30')
  const [base, setBase] = useState([])
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const loopRef = useRef(false)
  const processandoRef = useRef(false)
  const ultimoIdRef = useRef(null)
  const ultimoTempoRef = useRef(0)

  useEffect(() => {
    iniciar()
    return () => pararCamera()
  }, [])

  async function iniciar() {
    setStatus('Carregando modelos faciais...')
    try {
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      }

      setStatus('Carregando base de colaboradores...')
      const { data: cols } = await supabase
        .from('colaboradores').select('id, nome, face_descriptor, empresa_id')
        .eq('status', 'aprovado').not('face_descriptor', 'is', null)

      const base = (cols || []).map(p => {
        try {
          const raw = typeof p.face_descriptor === 'string' ? JSON.parse(p.face_descriptor) : p.face_descriptor
          if (!Array.isArray(raw) || raw.length !== 128) return null
          return { ...p, descriptorArray: new Float32Array(raw) }
        } catch { return null }
      }).filter(Boolean)

      setBase(base)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
      })
      streamRef.current = stream
      await new Promise(r => setTimeout(r, 150))
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise(r => { videoRef.current.onloadedmetadata = r })
      }

      setStatus('Aproxime o rosto')
      setOvalCor('#ffffff30')
      loopRef.current = true
      loop()
    } catch (e) {
      setStatus('Erro: ' + e.message)
    }
  }

  function pararCamera() {
    loopRef.current = false
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  async function loop() {
    if (!loopRef.current) return
    if (!processandoRef.current) {
      processandoRef.current = true
      await processarFrame()
      processandoRef.current = false
    }
    setTimeout(loop, 700)
  }

  function calcularBrilho(video) {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 64, 64)
    const data = ctx.getImageData(0, 0, 64, 64).data
    let soma = 0
    for (let i = 0; i < data.length; i += 4) soma += (data[i] + data[i + 1] + data[i + 2]) / 3
    return soma / (data.length / 4)
  }

  function calcularAbertura(pontos) {
    const v1 = Math.abs(pontos[1].y - pontos[5].y)
    const v2 = Math.abs(pontos[2].y - pontos[4].y)
    const h = Math.abs(pontos[0].x - pontos[3].x)
    return (v1 + v2) / (2 * h)
  }

  async function processarFrame() {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
      .withFaceLandmarks().withFaceDescriptor()

    if (!det) {
      if (Date.now() - ultimoTempoRef.current > 2000) {
        setOvalCor('#ffffff30')
        setStatus('Aproxime o rosto')
        setResultado('')
        setCorResultado('#aaa')
      }
      return
    }

    const { box } = det.detection
    const vw = video.videoWidth
    const vh = video.videoHeight
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    if (box.width < vw * 0.22) {
      setOvalCor('#facc15')
      setStatus('Aproxime mais o rosto')
      return
    }

    if (cx < vw * 0.25 || cx > vw * 0.75 || cy < vh * 0.15 || cy > vh * 0.85) {
      setOvalCor('#facc15')
      setStatus('Centralize o rosto')
      return
    }

    const brilho = calcularBrilho(video)
    if (brilho < 60) {
      setOvalCor('#facc15')
      setStatus('Melhore a iluminação')
      return
    }

    const olhoE = det.landmarks.getLeftEye()
    const olhoD = det.landmarks.getRightEye()
    if (calcularAbertura(olhoE) < 0.18 || calcularAbertura(olhoD) < 0.18) {
      setOvalCor('#facc15')
      setStatus('Abra bem os olhos')
      return
    }

    if (!base.length) {
      setOvalCor('#facc15')
      setStatus('Nenhuma facial cadastrada')
      return
    }

    const pessoa = encontrarMelhor(det.descriptor)

    if (!pessoa) {
      setOvalCor('#ef4444')
      setStatus('Rosto não reconhecido')
      setResultado('')
      return
    }

    const agora = Date.now()
    if (pessoa.id === ultimoIdRef.current && agora - ultimoTempoRef.current < 8000) return

    ultimoIdRef.current = pessoa.id
    ultimoTempoRef.current = agora

    setOvalCor('#22c55e')
    setStatus(`Reconhecido: ${pessoa.nome}`)
    await registrarPonto(pessoa)
  }

  function encontrarMelhor(descriptor) {
    let melhor = null, menorDist = 999, segundaDist = 999
    base.forEach(p => {
      const dist = faceapi.euclideanDistance(descriptor, p.descriptorArray)
      if (dist < menorDist) { segundaDist = menorDist; menorDist = dist; melhor = p }
      else if (dist < segundaDist) { segundaDist = dist }
    })
    if (!melhor || menorDist > 0.42) return null
    if (segundaDist - menorDist < 0.12) return null
    return melhor
  }

  async function registrarPonto(pessoa) {
    const hoje = new Date().toISOString().split('T')[0]
    const agora = new Date()

    const { data: existente } = await supabase
      .from('registros_ponto').select('*')
      .eq('colaborador_id', pessoa.id).eq('data', hoje)
      .is('saida', null).order('criado_em', { ascending: false })
      .limit(1).maybeSingle()

    if (existente) {
      await supabase.from('registros_ponto').update({
        saida: agora.toISOString(),
        horas_trabalhadas: (new Date(agora) - new Date(existente.entrada)) / (1000 * 60 * 60)
      }).eq('id', existente.id)

      tocarSom()
      setResultado(`✅ ${pessoa.nome} — Saída: ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
      setCorResultado('#22c55e')
    } else {
      await supabase.from('registros_ponto').insert({
        colaborador_id: pessoa.id,
        empresa_id: pessoa.empresa_id,
        data: hoje,
        categoria: 'FIXO MENSAL',
        entrada: agora.toISOString(),
        metodo: 'Facial'
      })

      tocarSom()
      setResultado(`✅ ${pessoa.nome} — Entrada: ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
      setCorResultado('#22c55e')
    }

    setTimeout(() => {
      setResultado('')
      setStatus('Aproxime o rosto')
      setOvalCor('#ffffff30')
      ultimoIdRef.current = null
    }, 5000)
  }

  function tocarSom() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, ctx.currentTime)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.6)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">

      {/* Header */}
      <div className="w-full max-w-sm flex justify-between items-center mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Ponto Eletrônico</h1>
          <p className="text-gray-500 text-sm">Reconhecimento facial automático</p>
        </div>
        <button onClick={() => { pararCamera(); onLogout() }}
          className="bg-gray-800 text-gray-400 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-700 cursor-pointer border border-gray-700 w-auto transition-colors">
          Sair
        </button>
      </div>

      <div className="w-full max-w-sm">
        {/* Câmera */}
        <div className="relative rounded-3xl overflow-hidden bg-black mb-4" style={{ height: '420px' }}>
          <video ref={videoRef} autoPlay muted playsInline
            className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />

          {/* Overlay */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 55% 68% at 50% 46%, transparent 52%, rgba(0,0,0,0.82) 100%)'
          }} />

          {/* Oval SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" preserveAspectRatio="none">
            <ellipse cx="150" cy="185" rx="88" ry="145"
              fill="none" stroke={ovalCor} strokeWidth="2.5"
              style={{
                transition: 'stroke 0.4s',
                filter: ovalCor === '#22c55e' ? 'drop-shadow(0 0 12px #22c55e)' :
                  ovalCor === '#ef4444' ? 'drop-shadow(0 0 8px #ef4444)' : 'none'
              }} />
          </svg>

          {/* Resultado sobre a câmera */}
          {resultado && (
            <div className="absolute bottom-4 left-0 right-0 text-center px-4">
              <p className="font-bold text-base" style={{ color: corResultado, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                {resultado}
              </p>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
          <p className="text-gray-300 font-semibold">{status}</p>
        </div>
      </div>
    </div>
  )
}