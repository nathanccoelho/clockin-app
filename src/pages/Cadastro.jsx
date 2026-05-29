import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'

function mascaraCPF(v) {
  return v.replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .slice(0, 14)
}

function mascaraTelefone(v) {
  return v.replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15)
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(cpf[10])
}

const OlhoIcon = ({ aberto }) => aberto ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export default function Cadastro({ onVoltar }) {
  const [etapa, setEtapa] = useState('dados') // dados | senha | verificacao | facial | sucesso
  const [form, setForm] = useState({
    nome: '', cpf: '', email: '', telefone: '', data_nascimento: ''
  })
  const [senhaForm, setSenhaForm] = useState({ senha: '', confirmar: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [erro, setErro] = useState('')
  const [errosCampo, setErrosCampo] = useState({})
  const [verificandoCPF, setVerificandoCPF] = useState(false)

  // Verificação de email
  const [codigoEnviado, setCodigoEnviado] = useState('')
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [enviandoCodigo, setEnviandoCodigo] = useState(false)
  const [verificandoCodigo, setVerificandoCodigo] = useState(false)
  const [reenvioTimer, setReenvioTimer] = useState(0)

  // Facial
  const [faceDescriptor, setFaceDescriptor] = useState(null)
  const [facePreview, setFacePreview] = useState(null)
  const [faceStatus, setFaceStatus] = useState('idle')
  const [faceMsg, setFaceMsg] = useState('')
  const [faceMsgCor, setFaceMsgCor] = useState('#aaa')
  const [ovalCor, setOvalCor] = useState('#ffffff40')
  const [salvando, setSalvando] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const loopRef = useRef(false)
  const capturedRef = useRef(false)
  const nomeRef = useRef(null)
  const senhaRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (etapa === 'dados' && nomeRef.current) nomeRef.current.focus()
    if (etapa === 'senha' && senhaRef.current) senhaRef.current.focus()
    if (etapa === 'facial') iniciarFacial()
    return () => {
      if (etapa === 'facial') pararFacial()
      clearInterval(timerRef.current)
    }
  }, [etapa])

  function triggerShake(campos) {
    setErrosCampo(campos)
    setTimeout(() => setErrosCampo({}), 500)
  }

  async function avancarDados(e) {
    e.preventDefault()
    setErro('')
    const novosErros = {}
    if (!form.nome.trim()) novosErros.nome = true
    if (!validarCPF(form.cpf)) novosErros.cpf = true
    if (!form.email.trim()) novosErros.email = true
    if (!form.telefone.trim()) novosErros.telefone = true
    if (!form.data_nascimento) novosErros.data_nascimento = true

    if (Object.keys(novosErros).length > 0) {
      triggerShake(novosErros)
      setErro('Preencha todos os campos corretamente.')
      return
    }

    setVerificandoCPF(true)
    const cpfLimpo = form.cpf.replace(/\D/g, '')
    const { data: existing } = await supabase
      .from('colaboradores').select('id').eq('cpf', cpfLimpo).maybeSingle()
    if (existing) {
      setVerificandoCPF(false)
      triggerShake({ cpf: true })
      setErro('⚠️ CPF já cadastrado no sistema.')
      return
    }
    setVerificandoCPF(false)
    setEtapa('senha')
  }

  function avancarSenha(e) {
    e.preventDefault()
    setErro('')
    const novosErros = {}
    if (senhaForm.senha.length < 6) novosErros.senha = true
    if (senhaForm.confirmar !== senhaForm.senha) novosErros.confirmar = true
    if (Object.keys(novosErros).length > 0) {
      triggerShake(novosErros)
      setErro(novosErros.senha ? 'Mínimo 6 caracteres.' : 'As senhas não coincidem.')
      return
    }
    setEtapa('verificacao')
    enviarCodigo()
  }

  async function enviarCodigo() {
    setEnviandoCodigo(true)
    setErro('')
    const codigo = gerarCodigo()
    setCodigoEnviado(codigo)
    setCodigoDigitado('')

    try {
      const { error } = await supabase.functions.invoke('enviar-codigo-email', {
        body: { email: form.email, nome: form.nome, codigo }
      })
      if (error) throw error
    } catch {
      setErro(`DEV: código ${codigo} (configure Edge Function para envio real)`)
    }

    setEnviandoCodigo(false)

    setReenvioTimer(60)
    timerRef.current = setInterval(() => {
      setReenvioTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0 }
        return t - 1
      })
    }, 1000)
  }

  async function verificarCodigo() {
    setVerificandoCodigo(true)
    setErro('')
    if (codigoDigitado.trim() === codigoEnviado) {
      setVerificandoCodigo(false)
      setEtapa('facial')
    } else {
      setVerificandoCodigo(false)
      setErro('Código incorreto. Verifique seu email.')
    }
  }

  async function iniciarFacial() {
    capturedRef.current = false
    setFaceStatus('idle')
    setFaceDescriptor(null)
    setFacePreview(null)
    setFaceMsg('Carregando reconhecimento facial...')
    setFaceMsgCor('#aaa')
    setOvalCor('#ffffff40')

    try {
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
      })
      streamRef.current = stream
      await new Promise(r => setTimeout(r, 150))
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await new Promise(r => { videoRef.current.onloadedmetadata = r })
      }
      setFaceMsg('Posicione seu rosto dentro do oval')
      setFaceMsgCor('white')
      loopRef.current = true
      loopFacial()
    } catch (e) {
      setFaceMsg('Erro ao abrir câmera: ' + e.message)
      setFaceMsgCor('#ff6b6b')
    }
  }

  function pararFacial() {
    loopRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function loopFacial() {
    if (!loopRef.current) return
    await analisarFrame()
    setTimeout(loopFacial, 600)
  }

  function calcularBrilho(video) {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, 64, 64)
    const data = ctx.getImageData(0, 0, 64, 64).data
    let soma = 0
    for (let i = 0; i < data.length; i += 4) soma += (data[i] + data[i+1] + data[i+2]) / 3
    return soma / (data.length / 4)
  }

  function calcularAbertura(pontos) {
    const v1 = Math.abs(pontos[1].y - pontos[5].y)
    const v2 = Math.abs(pontos[2].y - pontos[4].y)
    const h = Math.abs(pontos[0].x - pontos[3].x)
    return (v1 + v2) / (2 * h)
  }

  async function analisarFrame() {
    if (capturedRef.current) return
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.75 }))
      .withFaceLandmarks().withFaceDescriptor()

    if (!det) {
      setOvalCor('#ffffff40'); setFaceMsg('Posicione seu rosto dentro do oval'); setFaceMsgCor('#aaa'); return
    }

    const todos = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
    if (todos.length > 1) {
      setOvalCor('#ef4444'); setFaceMsg('⚠️ Mais de um rosto — fique sozinho'); setFaceMsgCor('#ef4444'); return
    }

    const { box } = det.detection
    const vw = video.videoWidth, vh = video.videoHeight
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2

    if (box.width < vw * 0.32) { setOvalCor('#facc15'); setFaceMsg('Aproxime mais o rosto'); setFaceMsgCor('#facc15'); return }
    if (cx < vw * 0.28 || cx > vw * 0.72 || cy < vh * 0.18 || cy > vh * 0.82) { setOvalCor('#facc15'); setFaceMsg('Centralize o rosto no oval'); setFaceMsgCor('#facc15'); return }

    const brilho = calcularBrilho(video)
    if (brilho < 90) { setOvalCor('#facc15'); setFaceMsg(`Muito escuro (${Math.round(brilho)}/90)`); setFaceMsgCor('#facc15'); return }
    if (brilho > 200) { setOvalCor('#facc15'); setFaceMsg('Luz excessiva'); setFaceMsgCor('#facc15'); return }

    const olhoE = det.landmarks.getLeftEye(), olhoD = det.landmarks.getRightEye()
    if (calcularAbertura(olhoE) < 0.24 || calcularAbertura(olhoD) < 0.24) { setOvalCor('#facc15'); setFaceMsg('Abra bem os olhos'); setFaceMsgCor('#facc15'); return }

    const nariz = det.landmarks.getNose()
    const nxRelativo = (nariz[3].x - box.x) / box.width
    if (nxRelativo < 0.33 || nxRelativo > 0.67) { setOvalCor('#facc15'); setFaceMsg('Olhe diretamente para a câmera'); setFaceMsgCor('#facc15'); return }

    if (det.detection.score < 0.85) { setOvalCor('#facc15'); setFaceMsg('Melhore posição e iluminação'); setFaceMsgCor('#facc15'); return }

    setOvalCor('#22c55e')
    setFaceMsg('✅ Perfeito! Mantendo posição por 3 segundos...')
    setFaceMsgCor('#22c55e')

    await new Promise(r => setTimeout(r, 3000))
    if (capturedRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)

    capturedRef.current = true
    loopRef.current = false
    pararFacial()

    setFacePreview(canvas.toDataURL('image/jpeg', 0.95))
    setFaceDescriptor(Array.from(det.descriptor))
    setFaceStatus('capturado')
    setFaceMsg('✅ Facial capturada com sucesso!')
    setFaceMsgCor('#22c55e')
  }

  async function handleCadastro() {
    if (!faceDescriptor) { setErro('Capture sua facial antes de finalizar.'); return }
    setSalvando(true)
    const cpfLimpo = form.cpf.replace(/\D/g, '')
    const senhaHash = await sha256(senhaForm.senha)

    const { error } = await supabase.from('colaboradores').insert({
      nome: form.nome.trim(),
      cpf: cpfLimpo,
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      senha_hash: senhaHash,
      data_nascimento: form.data_nascimento || null,
      face_descriptor: JSON.stringify(faceDescriptor),
      face_cadastrada_em: new Date().toISOString(),
      status: 'pendente',
      perfil: 'colaborador',
      empresa_id: null,
      ativo: true
    })

    if (error) { setErro('Erro ao cadastrar: ' + error.message); setSalvando(false); return }
    setEtapa('sucesso')
    setSalvando(false)
  }

  function refazerFoto() {
    setFaceStatus('idle')
    setFaceDescriptor(null)
    setFacePreview(null)
    capturedRef.current = false
    setOvalCor('#ffffff40')
    setFaceMsg('Posicione seu rosto dentro do oval')
    setFaceMsgCor('#aaa')
    iniciarFacial()
  }

  const inputClass = (campo) => `w-full bg-gray-800 text-white border rounded-2xl p-4 text-lg placeholder-gray-500 focus:outline-none cursor-text transition-all ${
    errosCampo[campo] ? 'border-red-500 focus:border-red-500 shake' : 'border-gray-700 focus:border-green-500'
  }`

  // ── TELA SUCESSO ─────────────────────────────────────────────
  if (etapa === 'sucesso') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-7xl mb-6">✅</div>
        <h2 className="text-white text-3xl font-bold mb-3">Cadastro enviado!</h2>
        <p className="text-gray-400 mb-8 max-w-sm">Seu cadastro está pendente de aprovação pelo administrador.</p>
        <button onClick={onVoltar} className="bg-green-500 text-white font-bold py-4 px-10 rounded-2xl text-lg hover:bg-green-600 cursor-pointer transition-colors">
          Voltar ao login
        </button>
      </div>
    </div>
  )

  // ── TELA FACIAL ──────────────────────────────────────────────
  if (etapa === 'facial') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs">
        <h2 className="text-white text-2xl font-bold text-center mb-1">Cadastro Facial</h2>
        <p className="text-gray-400 text-center text-sm mb-4">
          {faceStatus === 'capturado' ? 'Confirme sua foto abaixo' : 'Posicione seu rosto no oval e aguarde'}
        </p>
        <div className="relative rounded-3xl overflow-hidden bg-black mb-4" style={{ height: '320px' }}>
          {facePreview ? (
            <img src={facePreview} className="w-full h-full object-cover" alt="Foto capturada" />
          ) : (
            <>
              <video ref={videoRef} autoPlay muted playsInline
                className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse 58% 72% at 50% 42%, transparent 55%, rgba(0,0,0,0.82) 100%)'
              }} />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 320" preserveAspectRatio="none">
                <ellipse cx="150" cy="148" rx="95" ry="118"
                  fill="none" stroke={ovalCor} strokeWidth="2.5"
                  style={{ transition: 'stroke 0.4s', filter: ovalCor === '#22c55e' ? 'drop-shadow(0 0 10px #22c55e)' : 'none' }} />
              </svg>
            </>
          )}
          <div className="absolute bottom-3 left-0 right-0 text-center px-4">
            <p className="text-sm font-semibold" style={{ color: faceMsgCor, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
              {faceMsg}
            </p>
          </div>
        </div>
        {faceStatus === 'capturado' ? (
          <div className="space-y-3">
            <button onClick={handleCadastro} disabled={salvando}
              className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
              {salvando ? 'Finalizando...' : '✅ Confirmar e Cadastrar'}
            </button>
            <button onClick={refazerFoto}
              className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl hover:bg-gray-600 cursor-pointer transition-colors">
              🔄 Refazer foto
            </button>
          </div>
        ) : (
          <button onClick={() => { pararFacial(); setEtapa('verificacao') }}
            className="w-full bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl hover:bg-gray-700 cursor-pointer transition-colors">
            Voltar
          </button>
        )}
        {erro && <p className="text-red-400 text-center mt-3 text-sm">{erro}</p>}
      </div>
    </div>
  )

  // ── TELA VERIFICAÇÃO EMAIL ────────────────────────────────────
  if (etapa === 'verificacao') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={() => setEtapa('senha')} className="text-gray-400 mb-6 w-auto bg-transparent border-0 shadow-none p-0 flex items-center gap-2 hover:text-white cursor-pointer">
          ← Voltar
        </button>
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-white text-2xl font-bold mb-2">Verifique seu email</h2>
          <p className="text-gray-400 text-sm">
            Enviamos um código de 6 dígitos para<br />
            <span className="text-green-400 font-semibold">{form.email}</span>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Código de verificação</label>
            <input
              type="text"
              maxLength={6}
              placeholder="000000"
              value={codigoDigitado}
              onChange={e => setCodigoDigitado(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 text-2xl text-center tracking-widest placeholder-gray-600 focus:border-green-500 focus:outline-none"
            />
          </div>

          {erro && (
            <p className={`text-sm text-center ${erro.startsWith('DEV:') ? 'text-yellow-400 bg-yellow-500 bg-opacity-10 rounded-xl p-3' : 'text-red-400'}`}>
              {erro}
            </p>
          )}

          <button
            onClick={verificarCodigo}
            disabled={verificandoCodigo || codigoDigitado.length !== 6}
            className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
            {verificandoCodigo ? 'Verificando...' : 'Verificar código'}
          </button>

          <div className="text-center">
            {reenvioTimer > 0 ? (
              <p className="text-gray-500 text-sm">Reenviar em {reenvioTimer}s</p>
            ) : (
              <button onClick={enviarCodigo} disabled={enviandoCodigo}
                className="text-green-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300 disabled:opacity-50">
                {enviandoCodigo ? 'Enviando...' : 'Reenviar código'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // ── TELA SENHA ───────────────────────────────────────────────
  if (etapa === 'senha') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={() => setEtapa('dados')} className="text-gray-400 mb-6 w-auto bg-transparent border-0 shadow-none p-0 flex items-center gap-2 hover:text-white cursor-pointer">
          ← Voltar
        </button>
        <h2 className="text-white text-2xl font-bold mb-1">Crie sua senha</h2>
        <p className="text-gray-400 text-sm mb-8">Mínimo 6 caracteres</p>
        <form onSubmit={avancarSenha} className="space-y-4">
          <div className="relative">
            <input ref={senhaRef} type={mostrarSenha ? 'text' : 'password'} placeholder="Senha"
              value={senhaForm.senha}
              onChange={e => setSenhaForm({ ...senhaForm, senha: e.target.value })}
              className={`w-full bg-gray-800 text-white border rounded-2xl p-4 pr-12 text-lg placeholder-gray-500 focus:outline-none transition-all ${errosCampo.senha ? 'border-red-500 shake' : 'border-gray-700 focus:border-green-500'}`}
              required />
            <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-gray-300">
              <OlhoIcon aberto={mostrarSenha} />
            </button>
          </div>
          <div className="relative">
            <input type={mostrarConfirmar ? 'text' : 'password'} placeholder="Confirmar senha"
              value={senhaForm.confirmar}
              onChange={e => setSenhaForm({ ...senhaForm, confirmar: e.target.value })}
              className={`w-full bg-gray-800 text-white border rounded-2xl p-4 pr-12 text-lg placeholder-gray-500 focus:outline-none transition-all ${
                errosCampo.confirmar ? 'border-red-500 shake' :
                senhaForm.confirmar && senhaForm.confirmar !== senhaForm.senha ? 'border-red-500' :
                senhaForm.confirmar && senhaForm.confirmar === senhaForm.senha ? 'border-green-500' :
                'border-gray-700 focus:border-green-500'
              }`}
              required />
            <button type="button" onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-gray-300">
              <OlhoIcon aberto={mostrarConfirmar} />
            </button>
            {senhaForm.confirmar && senhaForm.confirmar !== senhaForm.senha && (
              <p className="text-red-400 text-xs mt-1">⚠️ As senhas não coincidem</p>
            )}
            {senhaForm.confirmar && senhaForm.confirmar === senhaForm.senha && (
              <p className="text-green-400 text-xs mt-1">✓ Senhas coincidem</p>
            )}
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 cursor-pointer transition-colors mt-4">
            Continuar
          </button>
        </form>
      </div>
    </div>
  )

  // ── TELA DADOS ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={onVoltar} className="text-gray-400 mb-6 w-auto bg-transparent border-0 shadow-none p-0 flex items-center gap-2 hover:text-white cursor-pointer">
          ← Voltar ao login
        </button>
        <h2 className="text-white text-2xl font-bold mb-1">Criar conta</h2>
        <p className="text-gray-400 text-sm mb-8">Preencha seus dados para solicitar acesso</p>

        <form onSubmit={avancarDados} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Nome completo</label>
            <input ref={nomeRef} type="text" placeholder="Seu nome completo" value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              className={inputClass('nome')} required />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">CPF</label>
            <input type="text" placeholder="000.000.000-00" value={form.cpf}
              onChange={e => setForm({ ...form, cpf: mascaraCPF(e.target.value) })}
              className={inputClass('cpf')} required />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">E-mail</label>
            <input type="email" placeholder="seu@email.com" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className={inputClass('email')} required />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Telefone / WhatsApp</label>
            <input type="tel" placeholder="(11) 99999-9999" value={form.telefone}
              onChange={e => setForm({ ...form, telefone: mascaraTelefone(e.target.value) })}
              className={inputClass('telefone')} required />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Data de Nascimento</label>
            <input type="date" value={form.data_nascimento}
              onChange={e => setForm({ ...form, data_nascimento: e.target.value })}
              className={inputClass('data_nascimento')} required />
          </div>

          {erro && <p className="text-red-400 text-sm font-semibold">{erro}</p>}

          <button type="submit" disabled={verificandoCPF}
            className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 cursor-pointer transition-colors mt-4 disabled:opacity-50">
            {verificandoCPF ? 'Verificando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}