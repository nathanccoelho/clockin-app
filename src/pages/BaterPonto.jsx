import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { FACE_CONFIG as FC } from './faceConfig'

const VARANDA_LAT = -23.61496
const VARANDA_LNG = -46.69607
const RAIO_METROS = 100

// Validação de localização (100m) — ATIVA. Só volte pra "true" se precisar testar de novo.
const DESATIVAR_VALIDACAO_LOCALIZACAO_TESTE = false

function distanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
    return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
function calcularBrilho(video) {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0, 64, 64)
    const data = ctx.getImageData(0, 0, 64, 64).data; let soma = 0
    for (let i = 0; i < data.length; i += 4) soma += (data[i]+data[i+1]+data[i+2])/3
    return soma/(data.length/4)
}
function calcularAbertura(pontos) {
    const v1 = Math.abs(pontos[1].y-pontos[5].y), v2 = Math.abs(pontos[2].y-pontos[4].y), h = Math.abs(pontos[0].x-pontos[3].x)
    return (v1+v2)/(2*h)
}
function tocarSom() {
    const ctx = new (window.AudioContext||window.webkitAudioContext)()
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(900, ctx.currentTime)
    gain.gain.setValueAtTime(0.4, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.6)
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+0.6)
}

export default function BaterPonto({ usuario }) {
    const [registroHoje, setRegistroHoje] = useState(null)
    const [loading, setLoading] = useState(true)
    const [distancia, setDistancia] = useState(null)
    const [erroLoc, setErroLoc] = useState('')
    const [etapa, setEtapa] = useState('inicio')
    const [acao, setAcao] = useState(null)
    const [faceMsg, setFaceMsg] = useState('')
    const [faceMsgCor, setFaceMsgCor] = useState('#aaa')
    const [ovalCor, setOvalCor] = useState('#ffffff40')
    const [processando, setProcessando] = useState(false)
    const videoRef = useRef(null), streamRef = useRef(null), loopRef = useRef(false)
    const capturedRef = useRef(false), acaoRef = useRef(null)

    useEffect(() => { carregarRegistroHoje(); verificarLocalizacao() }, [])

    async function carregarRegistroHoje() {
        setLoading(true)
        const hoje = new Date().toISOString().split('T')[0]
        const { data } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', usuario.id).eq('data', hoje).order('criado_em', { ascending: false }).limit(1).maybeSingle()
        setRegistroHoje(data || null); setLoading(false)
    }

    function verificarLocalizacao() {
        setErroLoc(''); setDistancia(null)
        if (!navigator.geolocation) { setErroLoc('Geolocalização não suportada nesse navegador.'); return }
        navigator.geolocation.getCurrentPosition(
            pos => { const dist = distanciaMetros(pos.coords.latitude, pos.coords.longitude, VARANDA_LAT, VARANDA_LNG); setDistancia(Math.round(dist)) },
            (err) => {
                if (err.code === 1) setErroLoc('PERMISSAO_NEGADA')
                else if (err.code === 3) setErroLoc('Tempo esgotado tentando obter sua localização. Tente novamente.')
                else setErroLoc('Não foi possível obter sua localização. Tente novamente.')
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const dentroDoRaio = DESATIVAR_VALIDACAO_LOCALIZACAO_TESTE || (distancia !== null && distancia <= RAIO_METROS)
    const temEntrada = registroHoje?.entrada, temSaida = registroHoje?.saida

    async function registrarPonto(tipo) {
        setProcessando(true)
        const agora = new Date(), hoje = agora.toISOString().split('T')[0]
        try {
            if (tipo === 'entrada') {
                await supabase.from('registros_ponto').insert({ colaborador_id: usuario.id, empresa_id: usuario.empresa_id, data: hoje, categoria: 'FIXO MENSAL', entrada: agora.toISOString(), metodo: 'App Facial' })
                // Se existia uma falta marcada pra hoje (gerada antes de bater o ponto), remove — já que o colaborador apareceu.
                await supabase.from('faltas').delete().eq('colaborador_id', usuario.id).eq('data', hoje).eq('status', 'falta')
            } else {
                const { data: reg } = await supabase.from('registros_ponto').select('*').eq('colaborador_id', usuario.id).eq('data', hoje).is('saida', null).order('criado_em', { ascending: false }).limit(1).maybeSingle()
                if (reg) { const horas = (agora - new Date(reg.entrada))/(1000*60*60); await supabase.from('registros_ponto').update({ saida: agora.toISOString(), horas_trabalhadas: horas }).eq('id', reg.id) }
            }
            await carregarRegistroHoje(); setEtapa('sucesso')
        } catch (e) { setFaceMsg('Erro ao registrar. Tente novamente.'); setFaceMsgCor('#ef4444') }
        setProcessando(false)
    }

    function iniciarAcao(tipo) {
        setAcao(tipo); acaoRef.current = tipo; setEtapa('facial')
        setFaceMsg('Carregando câmera...'); setFaceMsgCor('#aaa'); setOvalCor('#ffffff40'); capturedRef.current = false
        setTimeout(async () => {
            try {
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'
                if (!faceapi.nets.tinyFaceDetector.isLoaded) { await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL); await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL); await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) }
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
                streamRef.current = stream; await new Promise(r => setTimeout(r, 200))
                if (videoRef.current) { videoRef.current.srcObject = stream; await new Promise(r => { videoRef.current.onloadedmetadata = r }) }
                setFaceMsg('Posicione seu rosto no oval'); setFaceMsgCor('white'); loopRef.current = true; loopFacial()
            } catch (e) { setFaceMsg('Erro: ' + e.message); setFaceMsgCor('#ef4444') }
        }, 300)
    }

    function pararCamera() { loopRef.current = false; if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null } }
    function cancelarFacial() { pararCamera(); setEtapa('inicio') }
    async function loopFacial() { if (!loopRef.current) return; await analisarFrame(); if (loopRef.current) setTimeout(loopFacial, 700) }

    async function verificarFrameContraCadastro(raw) {
        const video = videoRef.current
        const det = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: FC.inputSize, scoreThreshold: FC.scoreThreshold })).withFaceLandmarks().withFaceDescriptor()
        if (!det) return { ok: false, msg: 'Posicione seu rosto no oval' }
        const { box } = det.detection, vw = video.videoWidth, vh = video.videoHeight
        const cx = box.x+box.width/2, cy = box.y+box.height/2
        if (box.width < vw*FC.minFaceWidthReconhecimento) return { ok: false, msg: 'Aproxime mais o rosto' }
        if (cx < vw*FC.minCX || cx > vw*FC.maxCX || cy < vh*FC.minCY || cy > vh*FC.maxCY) return { ok: false, msg: 'Centralize o rosto' }
        if (calcularBrilho(video) < FC.minBrilhoReconhecimento) return { ok: false, msg: 'Melhore a iluminação' }
        const olhoE = det.landmarks.getLeftEye(), olhoD = det.landmarks.getRightEye()
        if (calcularAbertura(olhoE) < FC.minAberturaReconhecimento || calcularAbertura(olhoD) < FC.minAberturaReconhecimento) return { ok: false, msg: 'Abra bem os olhos — nada cobrindo o rosto' }
        const distFacial = faceapi.euclideanDistance(det.descriptor, new Float32Array(raw))
        if (distFacial > FC.maxDistancia) return { ok: false, msg: 'Rosto não reconhecido' }
        return { ok: true }
    }

    async function analisarFrame() {
        if (capturedRef.current) return
        const video = videoRef.current; if (!video || video.readyState < 2) return
        const { data: colabData } = await supabase.from('colaboradores').select('face_descriptor').eq('id', usuario.id).single()
        if (!colabData?.face_descriptor) { setFaceMsg('Facial não cadastrada. Contate o admin.'); setFaceMsgCor('#ef4444'); loopRef.current = false; return }
        const raw = typeof colabData.face_descriptor === 'string' ? JSON.parse(colabData.face_descriptor) : colabData.face_descriptor
        if (!Array.isArray(raw) || raw.length !== 128) { setFaceMsg('Facial inválida. Recadastre com o admin.'); setFaceMsgCor('#ef4444'); loopRef.current = false; return }

        const primeiraChecagem = await verificarFrameContraCadastro(raw)
        if (!primeiraChecagem.ok) {
            setOvalCor(primeiraChecagem.msg.includes('reconhecido') ? '#ef4444' : '#facc15')
            setFaceMsg(primeiraChecagem.msg); setFaceMsgCor(primeiraChecagem.msg.includes('reconhecido') ? '#ef4444' : '#facc15')
            return
        }

        // Reconhecido no primeiro frame — agora CONTINUA verificando por mais 3 segundos.
        // Se em qualquer momento a checagem falhar (rosto tampado, virou o rosto, etc.),
        // cancela e volta a escanear, em vez de confiar cegamente num único instante.
        setOvalCor('#22c55e'); setFaceMsg('✅ Reconhecido! Confirmando...'); setFaceMsgCor('#22c55e')
        for (let i = 3; i >= 1; i--) {
            await new Promise(r => setTimeout(r, 1000))
            if (capturedRef.current || !loopRef.current) return
            const checagem = await verificarFrameContraCadastro(raw)
            if (!checagem.ok) {
                setOvalCor('#facc15'); setFaceMsg(checagem.msg); setFaceMsgCor('#facc15')
                return
            }
            if (i > 1) setFaceMsg(`✅ Reconhecido! Mantenha a posição — ${i - 1}s...`)
        }

        capturedRef.current = true; loopRef.current = false; pararCamera(); tocarSom()
        await registrarPonto(acaoRef.current)
    }

    const horaFormatada = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'

    if (etapa === 'facial') return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-xs">
                <h2 className="text-white text-2xl font-bold text-center mb-1">{acao === 'entrada' ? 'Confirmar Entrada' : 'Confirmar Saída'}</h2>
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 flex items-center justify-center">
                        {usuario.foto_perfil ? <img src={usuario.foto_perfil} className="w-full h-full object-cover" alt="" /> : <span className="text-white text-xs font-bold">{usuario.nome?.charAt(0).toUpperCase()}</span>}
                    </div>
                    <p className="text-gray-300 text-sm font-semibold">Comparando com: {usuario.nome}</p>
                </div>
                <p className="text-gray-400 text-center text-sm mb-4">Posicione seu rosto para confirmar</p>
                <div className="relative rounded-3xl overflow-hidden bg-black mb-4" style={{ height: '380px' }}>
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 62% 75% at 50% 44%, transparent 58%, rgba(0,0,0,0.82) 100%)' }} />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" preserveAspectRatio="none">
                        <ellipse cx="150" cy="175" rx="105" ry="138" fill="none" stroke={ovalCor} strokeWidth="2.5" style={{ transition: 'stroke 0.4s', filter: ovalCor === '#22c55e' ? 'drop-shadow(0 0 10px #22c55e)' : 'none' }} />
                    </svg>
                    <div className="absolute bottom-3 left-0 right-0 text-center px-4"><p className="text-sm font-semibold" style={{ color: faceMsgCor, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{faceMsg}</p></div>
                </div>
                {!capturedRef.current && <button onClick={cancelarFacial} className="w-full bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl hover:bg-gray-700 cursor-pointer transition-colors">Cancelar</button>}
            </div>
        </div>
    )

    if (etapa === 'sucesso') return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="text-center">
                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4 border-4" style={{ borderColor: acao === 'entrada' ? '#22c55e' : '#ef4444' }}>
                    {usuario.foto_perfil ? <img src={usuario.foto_perfil} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-3xl font-bold">{usuario.nome?.charAt(0).toUpperCase()}</div>}
                </div>
                <p className="text-white text-xl font-bold mb-1">{usuario.nome}</p>
                <div className="text-4xl mb-4">{acao === 'entrada' ? '🟢' : '🔴'}</div>
                <h2 className="text-white text-3xl font-bold mb-2">{acao === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!'}</h2>
                <p className="text-gray-400 mb-2">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-gray-500 text-sm mb-8">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <button onClick={() => { carregarRegistroHoje(); setEtapa('inicio') }} className="bg-green-500 text-white font-bold py-4 px-10 rounded-2xl text-lg hover:bg-green-600 cursor-pointer transition-colors">Voltar</button>
            </div>
        </div>
    )

    return (
        <div className="space-y-4">
            {DESATIVAR_VALIDACAO_LOCALIZACAO_TESTE && (
                <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-3 text-center">
                    <p className="text-yellow-400 text-xs font-bold">⚠️ MODO TESTE: validação de localização (100m) está DESATIVADA. Não use assim em produção.</p>
                </div>
            )}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <div className="flex justify-between items-start mb-6">
                    <div><h2 className="text-white text-xl font-bold">Meu Clockin</h2><p className="text-gray-400 text-sm">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${temSaida ? 'bg-gray-700 text-gray-300' : temEntrada ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500'}`}>{temSaida ? 'Finalizado' : temEntrada ? 'Em operação' : 'Pendente'}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-800 rounded-xl p-4 text-center"><p className="text-gray-400 text-xs mb-1">Entrada</p><p className={`text-2xl font-bold ${temEntrada ? 'text-green-400' : 'text-gray-600'}`}>{horaFormatada(registroHoje?.entrada)}</p></div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center"><p className="text-gray-400 text-xs mb-1">Saída</p><p className={`text-2xl font-bold ${temSaida ? 'text-red-400' : 'text-gray-600'}`}>{horaFormatada(registroHoje?.saida)}</p></div>
                </div>
                <div className={`rounded-xl p-3 mb-4 ${erroLoc ? 'bg-red-500/10 border border-red-500/30' : distancia === null ? 'bg-gray-800' : dentroDoRaio ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📍</span>
                        <div className="flex-1">
                            {erroLoc === 'PERMISSAO_NEGADA' ? (
                                <>
                                    <p className="text-red-400 text-sm font-semibold">❌ Permissão de localização bloqueada</p>
                                    <p className="text-gray-400 text-xs mt-1">Clica no ícone de cadeado/informações ao lado do endereço no navegador, permite "Localização" pra esse site, e depois clica em "Pedir localização de novo".</p>
                                </>
                            ) : erroLoc ? (
                                <p className="text-red-400 text-sm">{erroLoc}</p>
                            ) : distancia === null ? (
                                <p className="text-gray-400 text-sm">Verificando localização...</p>
                            ) : DESATIVAR_VALIDACAO_LOCALIZACAO_TESTE ? (
                                <p className="text-yellow-400 text-sm font-semibold">⚠️ Localização real: {distancia}m (ignorada — modo teste)</p>
                            ) : dentroDoRaio ? (
                                <p className="text-white text-sm font-semibold">✅ Você está no local ({distancia}m)</p>
                            ) : (
                                <p className="text-red-400 text-sm font-semibold">❌ Fora do raio permitido ({distancia}m de {RAIO_METROS}m)</p>
                            )}
                        </div>
                    </div>
                    <button onClick={verificarLocalizacao} className="mt-2 w-full bg-gray-800 text-gray-300 font-semibold py-2 rounded-lg text-sm hover:bg-gray-700 cursor-pointer transition-colors">🔄 Pedir localização de novo</button>
                </div>
                {loading ? <p className="text-gray-500 text-center">Carregando...</p> : temSaida ? (
                    <div className="bg-gray-800 rounded-xl p-4 text-center"><p className="text-gray-400">Clockin do dia finalizado</p><p className="text-white font-bold mt-1">{Number(registroHoje?.horas_trabalhadas || 0).toFixed(1)}h trabalhadas</p></div>
                ) : !temEntrada ? (
                    <button onClick={() => iniciarAcao('entrada')} disabled={!dentroDoRaio} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">🟢 Registrar Entrada</button>
                ) : (
                    <button onClick={() => iniciarAcao('saida')} disabled={!dentroDoRaio} className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">🔴 Registrar Saída</button>
                )}
                {!dentroDoRaio && !temSaida && distancia !== null && <p className="text-gray-500 text-xs text-center mt-2">Você precisa estar a menos de {RAIO_METROS}m do local para registrar</p>}
            </div>
        </div>
    )
}