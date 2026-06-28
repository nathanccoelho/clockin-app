import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { FACE_CONFIG as FC } from './faceConfig'

function mascaraMoeda(valor) { const num = String(valor).replace(/\D/g, ''); if (!num) return ''; return (Number(num)/100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function desmascaraMoeda(valor) { return Number(String(valor).replace(/\D/g, ''))/100 }
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

const ESCALAS = [
    { value: '5x2', label: '5x2 — Seg a Sex' },
    { value: '6x1_sabados', label: '6x1 — Seg a Sex + 2 sábados fixos/mês' },
    { value: '5x2_sabados_variaveis', label: '5x2 + sábados variáveis' },
    { value: 'livre', label: 'Livre — Escala variável' },
]

export default function Colaboradores({ usuario, onVerPerfil, modo = 'ativos' }) {
    const [colaboradores, setColaboradores] = useState([])
    const [cargos, setCargos] = useState([])
    const [loading, setLoading] = useState(true)
    const [modalCadastro, setModalCadastro] = useState(false)
    const [form, setForm] = useState({ nome: '', cpf: '', email: '', telefone: '', cargo: '', escala: '5x2', salario_fixo: '', ajuda_custo: '', hora_extra_valor: '', cache_evento: '' })
    const [salvando, setSalvando] = useState(false)
    const [msg, setMsg] = useState('')
    const [modalFacial, setModalFacial] = useState(null)
    const [faceMsg, setFaceMsg] = useState('')
    const [faceMsgCor, setFaceMsgCor] = useState('#aaa')
    const [ovalCor, setOvalCor] = useState('#ffffff40')
    const [faceStatus, setFaceStatus] = useState('idle')
    const [faceDescriptor, setFaceDescriptor] = useState(null)
    const [facePreview, setFacePreview] = useState(null)
    const [salvandoFacial, setSalvandoFacial] = useState(false)
    const [modalAcao, setModalAcao] = useState(null) // { colab, tipo: 'excluir'|'promover'|'reativar' }
    const [processandoAcao, setProcessandoAcao] = useState(false)
    const videoRef = useRef(null), streamRef = useRef(null), loopRef = useRef(false), capturedRef = useRef(false)

    useEffect(() => { carregar(); carregarCargos() }, [modo])

    async function carregar() {
        setLoading(true)
        const { data } = await supabase.from('colaboradores').select('*').eq('empresa_id', usuario.empresa_id).eq('status', modo === 'inativos' ? 'inativo' : 'aprovado').order('nome')
        setColaboradores(data || []); setLoading(false)
    }

    async function carregarCargos() {
        const { data } = await supabase.from('cargos').select('*').eq('empresa_id', usuario.empresa_id).order('nome')
        setCargos(data || [])
    }

    function calcularHoraExtra(salarioStr) {
        const sal = desmascaraMoeda(salarioStr); if (!sal) return ''
        const diasMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
        return mascaraMoeda(String(Math.round((sal/diasMes/9)*100)))
    }

    function abrirModalCadastro() { setForm({ nome: '', cpf: '', email: '', telefone: '', cargo: '', escala: '5x2', salario_fixo: '', ajuda_custo: '', hora_extra_valor: '', cache_evento: '' }); setMsg(''); setModalCadastro(true) }

    async function salvar(e) {
        e.preventDefault(); setSalvando(true); setMsg('')
        const cpfLimpo = form.cpf.replace(/\D/g, '')
        // Verifica CPF duplicado
        const { data: cpfExiste } = await supabase.from('colaboradores').select('id').eq('cpf', cpfLimpo).eq('empresa_id', usuario.empresa_id).maybeSingle()
        if (cpfExiste) { setMsg('CPF já cadastrado.'); setSalvando(false); return }
        const { error } = await supabase.from('colaboradores').insert({
            nome: form.nome.trim(), cpf: cpfLimpo, email: form.email.trim() || null, telefone: form.telefone.trim() || null,
            cargo: form.cargo, escala: form.escala, salario_fixo: desmascaraMoeda(form.salario_fixo),
            ajuda_custo_diaria: desmascaraMoeda(form.ajuda_custo), hora_extra_valor: desmascaraMoeda(form.hora_extra_valor),
            cache_evento: desmascaraMoeda(form.cache_evento), empresa_id: usuario.empresa_id, status: 'aprovado', perfil: 'colaborador', ativo: true
        })
        if (error) setMsg('Erro: ' + error.message)
        else { setModalCadastro(false); carregar() }
        setSalvando(false)
    }

    async function executarAcao() {
        if (!modalAcao) return
        setProcessandoAcao(true)
        const { colab, tipo } = modalAcao
        if (tipo === 'excluir') {
            // Inativa sem apagar histórico
            await supabase.from('colaboradores').update({ status: 'inativo', ativo: false, inativado_em: new Date().toISOString(), inativado_por: usuario.id }).eq('id', colab.id)
        } else if (tipo === 'promover') {
            await supabase.from('colaboradores').update({ perfil: 'admin' }).eq('id', colab.id)
        } else if (tipo === 'rebaixar') {
            await supabase.from('colaboradores').update({ perfil: 'colaborador' }).eq('id', colab.id)
        } else if (tipo === 'reativar') {
            await supabase.from('colaboradores').update({ status: 'aprovado', ativo: true, inativado_em: null, inativado_por: null }).eq('id', colab.id)
        }
        setModalAcao(null); setProcessandoAcao(false); carregar()
    }

    // FACIAL
    async function abrirModalFacial(colab) {
        setModalFacial(colab); setFaceStatus('idle'); setFaceDescriptor(null); setFacePreview(null)
        setFaceMsg('Carregando câmera...'); setFaceMsgCor('#aaa'); setOvalCor('#ffffff40'); capturedRef.current = false
        setTimeout(async () => {
            try {
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models'
                if (!faceapi.nets.tinyFaceDetector.isLoaded) { await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL); await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL); await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) }
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
                streamRef.current = stream; await new Promise(r => setTimeout(r, 200))
                if (videoRef.current) { videoRef.current.srcObject = stream; await new Promise(r => { videoRef.current.onloadedmetadata = r }) }
                setFaceMsg('Posicione o rosto no oval'); setFaceMsgCor('white'); loopRef.current = true; loopFacial()
            } catch (e) { setFaceMsg('Erro: ' + e.message); setFaceMsgCor('#ef4444') }
        }, 300)
    }

    function fecharModalFacial() { loopRef.current = false; if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null } setModalFacial(null) }

    async function loopFacial() { if (!loopRef.current) return; await analisarFrame(); setTimeout(loopFacial, 600) }

    async function analisarFrame() {
        if (capturedRef.current) return
        const video = videoRef.current; if (!video || video.readyState < 2) return
        const det = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: FC.inputSize, scoreThreshold: FC.scoreThreshold })).withFaceLandmarks().withFaceDescriptor()
        if (!det) { setOvalCor('#ffffff40'); setFaceMsg('Posicione o rosto no oval'); setFaceMsgCor('#aaa'); return }
        const todos = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 }))
        if (todos.length > 1) { setOvalCor('#ef4444'); setFaceMsg('⚠️ Mais de um rosto — fique sozinho'); setFaceMsgCor('#ef4444'); return }
        const { box } = det.detection, vw = video.videoWidth, vh = video.videoHeight, cx = box.x+box.width/2, cy = box.y+box.height/2
        if (box.width < vw*FC.minFaceWidthCadastro) { setOvalCor('#facc15'); setFaceMsg('Aproxime mais'); setFaceMsgCor('#facc15'); return }
        if (cx < vw*FC.minCX || cx > vw*FC.maxCX || cy < vh*FC.minCY || cy > vh*FC.maxCY) { setOvalCor('#facc15'); setFaceMsg('Centralize o rosto'); setFaceMsgCor('#facc15'); return }
        const brilho = calcularBrilho(video)
        if (brilho < FC.minBrilhoCadastro) { setOvalCor('#facc15'); setFaceMsg(`Muito escuro (${Math.round(brilho)}/90)`); setFaceMsgCor('#facc15'); return }
        if (brilho > FC.maxBrilho) { setOvalCor('#facc15'); setFaceMsg('Luz excessiva'); setFaceMsgCor('#facc15'); return }
        const olhoE = det.landmarks.getLeftEye(), olhoD = det.landmarks.getRightEye()
        if (calcularAbertura(olhoE) < FC.minAberturaCadastro || calcularAbertura(olhoD) < FC.minAberturaCadastro) { setOvalCor('#facc15'); setFaceMsg('Abra bem os olhos'); setFaceMsgCor('#facc15'); return }
        const nariz = det.landmarks.getNose(), nxRelativo = (nariz[3].x-box.x)/box.width
        if (nxRelativo < 0.33 || nxRelativo > 0.67) { setOvalCor('#facc15'); setFaceMsg('Olhe para a câmera'); setFaceMsgCor('#facc15'); return }
        if (det.detection.score < 0.85) { setOvalCor('#facc15'); setFaceMsg('Melhore posição/iluminação'); setFaceMsgCor('#facc15'); return }
        setOvalCor('#22c55e'); setFaceMsg('✅ Perfeito! Aguardando 3 segundos...'); setFaceMsgCor('#22c55e')
        await new Promise(r => setTimeout(r, 3000)); if (capturedRef.current) return
        const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d'); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0)
        capturedRef.current = true; loopRef.current = false
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
        setFacePreview(canvas.toDataURL('image/jpeg', 0.95)); setFaceDescriptor(Array.from(det.descriptor)); setFaceStatus('capturado'); setFaceMsg('✅ Facial capturada!'); setFaceMsgCor('#22c55e')
    }

    async function salvarFacial() {
        if (!faceDescriptor || !modalFacial) return; setSalvandoFacial(true)
        const { error } = await supabase.from('colaboradores').update({ face_descriptor: JSON.stringify(faceDescriptor), face_cadastrada_em: new Date().toISOString(), foto_perfil: facePreview }).eq('id', modalFacial.id)
        if (error) { setFaceMsg('Erro ao salvar: ' + error.message); setFaceMsgCor('#ef4444') } else { fecharModalFacial(); carregar() }
        setSalvandoFacial(false)
    }

    function refazerFacial() { setFaceStatus('idle'); setFaceDescriptor(null); setFacePreview(null); capturedRef.current = false; abrirModalFacial(modalFacial) }

    const inputCls = 'w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none text-sm'

    const acaoInfo = {
        excluir: { titulo: 'Inativar colaborador', msg: 'O histórico será preservado. O colaborador perderá acesso ao sistema.', btn: 'Inativar', cor: 'bg-red-500 hover:bg-red-600' },
        promover: { titulo: 'Promover a Admin', msg: 'Este colaborador passará a ter acesso total de administrador.', btn: 'Promover', cor: 'bg-green-500 hover:bg-green-600' },
        rebaixar: { titulo: 'Remover Admin', msg: 'Este colaborador voltará a ser colaborador comum.', btn: 'Confirmar', cor: 'bg-yellow-500 hover:bg-yellow-600' },
        reativar: { titulo: 'Reativar colaborador', msg: 'O colaborador voltará a ter acesso ao sistema.', btn: 'Reativar', cor: 'bg-green-500 hover:bg-green-600' },
    }

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-white text-xl font-bold">{modo === 'inativos' ? 'Colaboradores Inativos' : 'Colaboradores Ativos'}</h2>
                    {modo === 'ativos' && <button onClick={abrirModalCadastro} className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl hover:bg-green-600 cursor-pointer transition-colors text-sm w-auto">+ Novo colaborador</button>}
                </div>
                {loading ? <p className="text-gray-500">Carregando...</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="text-gray-400 font-semibold p-3 text-left">Nome</th>
                                    <th className="text-gray-400 font-semibold p-3 text-left">Cargo</th>
                                    <th className="text-gray-400 font-semibold p-3 text-left">Escala</th>
                                    <th className="text-gray-400 font-semibold p-3 text-right">Salário</th>
                                    <th className="text-gray-400 font-semibold p-3 text-center">Facial</th>
                                    <th className="text-gray-400 font-semibold p-3 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {colaboradores.map(c => (
                                    <tr key={c.id} onClick={() => onVerPerfil(c.id)} className="border-b border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer">
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-semibold">{c.nome}</span>
                                                {c.perfil === 'admin' && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">Admin</span>}
                                            </div>
                                            <p className="text-gray-500 text-xs">{c.cpf}</p>
                                        </td>
                                        <td className="p-3 text-gray-400">{c.cargo || '—'}</td>
                                        <td className="p-3 text-gray-400 text-xs">{ESCALAS.find(e => e.value === c.escala)?.label?.split(' — ')[0] || c.escala || '—'}</td>
                                        <td className="p-3 text-gray-300 text-right">{Number(c.salario_fixo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="p-3 text-center">{c.face_descriptor ? <span className="text-green-400 text-xs font-semibold">✅ Cadastrada</span> : <span className="text-red-400 text-xs font-semibold">❌ Sem facial</span>}</td>
                                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                            <div className="flex gap-2 justify-center flex-wrap">
                                                <button onClick={() => onVerPerfil(c.id)} className="text-green-400 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">✏️ Editar</button>
                                                {modo === 'ativos' && <button onClick={() => abrirModalFacial(c)} className="text-blue-400 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-blue-300">{c.face_descriptor ? '🔄 Facial' : '📷 Facial'}</button>}
                                                {modo === 'ativos' && c.perfil !== 'admin' && <button onClick={() => setModalAcao({ colab: c, tipo: 'promover' })} className="text-yellow-400 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-yellow-300">⬆ Admin</button>}
                                                {modo === 'ativos' && c.perfil === 'admin' && c.id !== usuario.id && <button onClick={() => setModalAcao({ colab: c, tipo: 'rebaixar' })} className="text-orange-400 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-orange-300">⬇ Colab</button>}
                                                {modo === 'ativos' && c.id !== usuario.id && <button onClick={() => setModalAcao({ colab: c, tipo: 'excluir' })} className="text-red-400 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-red-300">🚫 Inativar</button>}
                                                {modo === 'inativos' && <button onClick={() => setModalAcao({ colab: c, tipo: 'reativar' })} className="text-green-400 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">✅ Reativar</button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {colaboradores.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum colaborador {modo === 'inativos' ? 'inativo' : 'cadastrado'}.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal confirmação de ação */}
            {modalAcao && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
                        <h3 className="text-white text-lg font-bold mb-2">{acaoInfo[modalAcao.tipo]?.titulo}</h3>
                        <p className="text-gray-400 text-sm mb-1"><span className="text-white font-semibold">{modalAcao.colab.nome}</span></p>
                        <p className="text-gray-400 text-sm mb-5">{acaoInfo[modalAcao.tipo]?.msg}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setModalAcao(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                            <button onClick={executarAcao} disabled={processandoAcao} className={`flex-1 text-white font-bold py-3 rounded-2xl cursor-pointer disabled:opacity-50 transition-colors ${acaoInfo[modalAcao.tipo]?.cor}`}>{processandoAcao ? 'Aguarde...' : acaoInfo[modalAcao.tipo]?.btn}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cadastro */}
            {modalCadastro && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white text-lg font-bold">Cadastrar Colaborador</h3>
                            <button onClick={() => setModalCadastro(false)} className="text-gray-400 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-2xl leading-none">✕</button>
                        </div>
                        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-gray-400 text-sm mb-1">Nome completo *</label><input className={inputCls} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} required /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">CPF *</label><input className={inputCls} value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} required /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Email</label><input type="email" className={inputCls} value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Telefone</label><input className={inputCls} value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Cargo</label><select className={inputCls+' cursor-pointer'} value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})}><option value="">-- Selecione --</option>{cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Escala</label><select className={inputCls+' cursor-pointer'} value={form.escala} onChange={e => setForm({...form, escala: e.target.value})}>{ESCALAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Salário Fixo</label><input type="text" placeholder="R$ 0,00" className={inputCls} value={form.salario_fixo} onChange={e => setForm({...form, salario_fixo: mascaraMoeda(e.target.value)})} /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Ajuda de Custo Mensal</label><input type="text" placeholder="R$ 0,00" className={inputCls} value={form.ajuda_custo} onChange={e => setForm({...form, ajuda_custo: mascaraMoeda(e.target.value)})} /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Valor Hora Extra <button type="button" onClick={() => setForm({...form, hora_extra_valor: calcularHoraExtra(form.salario_fixo)})} className="ml-2 text-green-400 text-xs font-normal w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">↻ calcular automático</button></label><input type="text" placeholder="R$ 0,00" className={inputCls} value={form.hora_extra_valor} onChange={e => setForm({...form, hora_extra_valor: mascaraMoeda(e.target.value)})} /></div>
                            <div><label className="block text-gray-400 text-sm mb-1">Cachê de Evento</label><input type="text" placeholder="R$ 0,00" className={inputCls} value={form.cache_evento} onChange={e => setForm({...form, cache_evento: mascaraMoeda(e.target.value)})} /></div>
                            {msg && <p className="md:col-span-2 text-red-400 text-sm">{msg}</p>}
                            <div className="md:col-span-2 flex gap-3 mt-2">
                                <button type="button" onClick={() => setModalCadastro(false)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl hover:bg-gray-700 cursor-pointer transition-colors">Cancelar</button>
                                <button type="submit" disabled={salvando} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">{salvando ? 'Salvando...' : 'Cadastrar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Facial */}
            {modalFacial && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-xs">
                        <div className="flex justify-between items-center mb-4">
                            <div><h3 className="text-white text-lg font-bold">Cadastrar Facial</h3><p className="text-gray-400 text-sm">{modalFacial.nome}</p></div>
                            <button onClick={fecharModalFacial} className="text-gray-400 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-2xl">✕</button>
                        </div>
                        <div className="relative rounded-3xl overflow-hidden bg-black mb-4" style={{ height: '320px' }}>
                            {facePreview ? <img src={facePreview} className="w-full h-full object-cover" alt="Foto" /> : (
                                <>
                                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                                    <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 58% 72% at 50% 42%, transparent 55%, rgba(0,0,0,0.82) 100%)' }} />
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 320" preserveAspectRatio="none">
                                        <ellipse cx="150" cy="148" rx="95" ry="118" fill="none" stroke={ovalCor} strokeWidth="2.5" style={{ transition: 'stroke 0.4s', filter: ovalCor === '#22c55e' ? 'drop-shadow(0 0 10px #22c55e)' : 'none' }} />
                                    </svg>
                                </>
                            )}
                            <div className="absolute bottom-3 left-0 right-0 text-center px-4"><p className="text-sm font-semibold" style={{ color: faceMsgCor, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{faceMsg}</p></div>
                        </div>
                        {faceStatus === 'capturado' ? (
                            <div className="space-y-3">
                                <button onClick={salvarFacial} disabled={salvandoFacial} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">{salvandoFacial ? 'Salvando...' : '✅ Salvar Facial'}</button>
                                <button onClick={refazerFacial} className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl hover:bg-gray-600 cursor-pointer transition-colors">🔄 Refazer</button>
                            </div>
                        ) : <button onClick={fecharModalFacial} className="w-full bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl hover:bg-gray-700 cursor-pointer transition-colors">Cancelar</button>}
                    </div>
                </div>
            )}
        </div>
    )
}