import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

function mascaraMoeda(valor) {
  const num = String(valor).replace(/\D/g, '')
  if (!num) return ''
  return (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function desmascaraMoeda(valor) {
  return Number(String(valor).replace(/\D/g, '')) / 100
}

const ESCALAS = [
  { value: '5x2', label: '5x2 — Seg a Sex' },
  { value: '6x1_sabados', label: '6x1 — Seg a Sex + 2 sábados fixos/mês' },
  { value: '5x2_sabados_variaveis', label: '5x2 + sábados variáveis' },
  { value: 'livre', label: 'Livre — Escala variável' },
]

export default function PerfilColaborador({ usuario, colaboradorId, onVoltar }) {
  const isAdmin = usuario.perfil === 'admin'
  const idAlvo = colaboradorId || usuario.id

  const [colab, setColab] = useState(null)
  const [cargos, setCargos] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvandoProfissional, setSalvandoProfissional] = useState(false)
  const [salvandoBancario, setSalvandoBancario] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgTipo, setMsgTipo] = useState('erro')
  const [msgProfissional, setMsgProfissional] = useState('')
  const [msgBancario, setMsgBancario] = useState('')

  // Foto
  const [trocandoFoto, setTrocandoFoto] = useState(false)
  const fileInputRef = useRef(null)

  // Câmera para trocar foto
  const [modalCamera, setModalCamera] = useState(false)
  const [faceMsg, setFaceMsg] = useState('')
  const [faceMsgCor, setFaceMsgCor] = useState('#aaa')
  const [faceStatus, setFaceStatus] = useState('idle')
  const [facePreview, setFacePreview] = useState(null)
  const [salvandoFoto, setSalvandoFoto] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', data_nascimento: '',
    cargo: '', escala: '5x2', data_admissao: '',
    salario_fixo: '', ajuda_custo: '', hora_extra_valor: '', cache_evento: '',
    pix: '', banco: '', agencia: '', conta: '',
  })

  useEffect(() => {
    carregar()
    if (isAdmin) carregarCargos()
  }, [idAlvo])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('colaboradores').select('*').eq('id', idAlvo).single()
    if (data) {
      setColab(data)
      setForm({
        nome: data.nome || '',
        email: data.email || '',
        telefone: data.telefone || '',
        data_nascimento: data.data_nascimento || '',
        cargo: data.cargo || '',
        escala: data.escala || '5x2',
        data_admissao: data.data_admissao || '',
        salario_fixo: data.salario_fixo ? mascaraMoeda(String(Math.round(data.salario_fixo * 100))) : '',
        ajuda_custo: data.ajuda_custo_diaria ? mascaraMoeda(String(Math.round(data.ajuda_custo_diaria * 100))) : '',
        hora_extra_valor: data.hora_extra_valor ? mascaraMoeda(String(Math.round(data.hora_extra_valor * 100))) : '',
        cache_evento: data.cache_evento ? mascaraMoeda(String(Math.round(data.cache_evento * 100))) : '',
        pix: data.pix || '',
        banco: data.banco || '',
        agencia: data.agencia || '',
        conta: data.conta || '',
      })
    }
    setLoading(false)
  }

  async function carregarCargos() {
    const { data } = await supabase.from('cargos').select('*').eq('empresa_id', usuario.empresa_id).order('nome')
    setCargos(data || [])
  }

  function calcularHoraExtra() {
    const sal = desmascaraMoeda(form.salario_fixo)
    if (!sal) return
    const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    setForm(f => ({ ...f, hora_extra_valor: mascaraMoeda(String(Math.round((sal / diasMes / 9) * 100))) }))
  }

  // Salvar dados pessoais com validação de duplicados
  async function salvarPessoais(e) {
    e.preventDefault()
    setSalvando(true)
    setMsg('')

    // Validar email duplicado
    if (form.email.trim()) {
      const { data: emailExiste } = await supabase
        .from('colaboradores').select('id').eq('email', form.email.trim()).neq('id', idAlvo).maybeSingle()
      if (emailExiste) {
        setMsg('⚠️ Este email já está cadastrado para outro colaborador.')
        setMsgTipo('erro')
        setSalvando(false)
        return
      }
    }

    // Validar telefone duplicado
    if (form.telefone.trim()) {
      const { data: telExiste } = await supabase
        .from('colaboradores').select('id').eq('telefone', form.telefone.trim()).neq('id', idAlvo).maybeSingle()
      if (telExiste) {
        setMsg('⚠️ Este telefone já está cadastrado para outro colaborador.')
        setMsgTipo('erro')
        setSalvando(false)
        return
      }
    }

    const { error } = await supabase.from('colaboradores').update({
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      data_nascimento: form.data_nascimento || null,
    }).eq('id', idAlvo)

    if (error) {
      setMsg('Erro ao salvar: ' + error.message)
      setMsgTipo('erro')
    } else {
      setMsg('Dados pessoais salvos!')
      setMsgTipo('ok')
      carregar()
    }
    setSalvando(false)
  }

  // Salvar dados profissionais (só admin)
  async function salvarProfissional(e) {
    e.preventDefault()
    setSalvandoProfissional(true)
    setMsgProfissional('')

    const { error } = await supabase.from('colaboradores').update({
      cargo: form.cargo,
      escala: form.escala,
      data_admissao: form.data_admissao || null,
      salario_fixo: desmascaraMoeda(form.salario_fixo),
      ajuda_custo_diaria: desmascaraMoeda(form.ajuda_custo),
      hora_extra_valor: desmascaraMoeda(form.hora_extra_valor),
      cache_evento: desmascaraMoeda(form.cache_evento),
    }).eq('id', idAlvo)

    setMsgProfissional(error ? 'Erro ao salvar.' : 'Dados profissionais salvos!')
    setSalvandoProfissional(false)
    if (!error) carregar()
  }

  // Salvar dados bancários
  async function salvarBancario(e) {
    e.preventDefault()
    setSalvandoBancario(true)
    setMsgBancario('')

    const { error } = await supabase.from('colaboradores').update({
      pix: form.pix.trim() || null,
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
    }).eq('id', idAlvo)

    setMsgBancario(error ? 'Erro ao salvar.' : 'Dados bancários salvos!')
    setSalvandoBancario(false)
    if (!error) carregar()
  }

  // Trocar foto via upload
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      await supabase.from('colaboradores').update({ foto_perfil: ev.target.result }).eq('id', idAlvo)
      carregar()
      setTrocandoFoto(false)
    }
    reader.readAsDataURL(file)
  }

  // Trocar foto via câmera
  async function abrirCamera() {
    setModalCamera(true)
    setFaceStatus('idle')
    setFacePreview(null)
    setFaceMsg('Carregando câmera...')
    setFaceMsgCor('#aaa')

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
        })
        streamRef.current = stream
        await new Promise(r => setTimeout(r, 200))
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await new Promise(r => { videoRef.current.onloadedmetadata = r })
        }
        setFaceMsg('Clique em "Capturar" quando estiver pronto')
        setFaceMsgCor('white')
      } catch (e) {
        setFaceMsg('Erro: ' + e.message)
        setFaceMsgCor('#ef4444')
      }
    }, 300)
  }

  function fecharCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setModalCamera(false)
    setTrocandoFoto(false)
  }

  function capturarFoto() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    setFacePreview(canvas.toDataURL('image/jpeg', 0.95))
    setFaceStatus('capturado')
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }

  async function salvarFotoCamera() {
    if (!facePreview) return
    setSalvandoFoto(true)
    await supabase.from('colaboradores').update({ foto_perfil: facePreview }).eq('id', idAlvo)
    carregar()
    fecharCamera()
    setSalvandoFoto(false)
  }

  const inputCls = 'w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none text-sm'
  const inputReadOnly = 'w-full bg-gray-900 text-gray-400 border border-gray-800 rounded-xl p-3 text-sm cursor-default'

  if (loading) return <div className="text-gray-500 p-6">Carregando...</div>
  if (!colab) return <div className="text-gray-500 p-6">Colaborador não encontrado.</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {onVoltar && (
        <button onClick={onVoltar}
          className="text-gray-400 flex items-center gap-2 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-sm">
          ← Voltar
        </button>
      )}

      {/* Cabeçalho */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
            {colab.foto_perfil ? (
              <img src={colab.foto_perfil} className="w-full h-full object-cover" alt="Foto" />
            ) : (
              <span className="text-gray-400 text-3xl font-bold">{colab.nome?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <button onClick={() => setTrocandoFoto(!trocandoFoto)}
            className="absolute -bottom-2 -right-2 bg-green-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center cursor-pointer border-0 shadow-none p-0 hover:bg-green-600 transition-colors">
            ✏️
          </button>
        </div>

        {trocandoFoto ? (
          <div className="flex flex-col gap-2">
            <p className="text-gray-400 text-xs">Trocar foto:</p>
            <div className="flex gap-2">
              <button onClick={abrirCamera}
                className="bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-600 cursor-pointer border-0 shadow-none w-auto transition-colors">
                📷 Câmera
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-600 cursor-pointer border-0 shadow-none w-auto transition-colors">
                🖼️ Galeria
              </button>
              <button onClick={() => setTrocandoFoto(false)}
                className="text-gray-500 text-xs cursor-pointer border-0 shadow-none bg-transparent p-0 w-auto hover:text-gray-300">
                Cancelar
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          <div>
            <h2 className="text-white text-2xl font-bold">{colab.nome}</h2>
            <p className="text-gray-400 text-sm">{colab.cargo || 'Sem cargo'}</p>
            <p className="text-gray-500 text-xs mt-1">
              {ESCALAS.find(e => e.value === colab.escala)?.label || colab.escala || 'Escala não definida'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {colab.face_descriptor
                ? <span className="text-green-400 text-xs">✅ Facial cadastrada</span>
                : <span className="text-red-400 text-xs">❌ Sem facial</span>}
              <span className="text-gray-600 text-xs">•</span>
              <span className={`text-xs font-semibold ${colab.perfil === 'admin' ? 'text-green-400' : 'text-gray-400'}`}>
                {colab.perfil === 'admin' ? 'Admin' : 'Colaborador'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Dados pessoais — form separado com próprio botão salvar */}
      <form onSubmit={salvarPessoais} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-white font-bold">Dados Pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Nome completo</label>
            <input className={inputCls} value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">CPF</label>
            <input className={inputReadOnly} value={colab.cpf} readOnly />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Telefone / WhatsApp</label>
            <input className={inputCls} value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Data de Nascimento</label>
            <input type="date" className={inputCls + ' cursor-pointer'} value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Data de Admissão</label>
            {isAdmin
              ? <input type="date" className={inputCls + ' cursor-pointer'} value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} />
              : <input className={inputReadOnly} value={colab.data_admissao ? new Date(colab.data_admissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'} readOnly />}
          </div>
        </div>
        {msg && <p className={`text-sm font-semibold ${msgTipo === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}
        <button type="submit" disabled={salvando}
          className="w-full bg-green-500 text-white font-bold py-3 rounded-2xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
          {salvando ? 'Salvando...' : 'Salvar dados pessoais'}
        </button>
      </form>

      {/* Dados profissionais — só admin edita */}
      <form onSubmit={isAdmin ? salvarProfissional : e => e.preventDefault()} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-white font-bold">Dados Profissionais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Cargo</label>
            {isAdmin
              ? <select className={inputCls + ' cursor-pointer'} value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})}>
                  <option value="">-- Selecione --</option>
                  {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              : <input className={inputReadOnly} value={form.cargo || '—'} readOnly />}
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Escala</label>
            {isAdmin
              ? <select className={inputCls + ' cursor-pointer'} value={form.escala} onChange={e => setForm({...form, escala: e.target.value})}>
                  {ESCALAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              : <input className={inputReadOnly} value={ESCALAS.find(e => e.value === form.escala)?.label || form.escala} readOnly />}
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Salário Fixo</label>
            {isAdmin
              ? <input type="text" className={inputCls} value={form.salario_fixo} onChange={e => setForm({...form, salario_fixo: mascaraMoeda(e.target.value)})} />
              : <input className={inputReadOnly} value={form.salario_fixo || 'R$ 0,00'} readOnly />}
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Ajuda de Custo Mensal</label>
            {isAdmin
              ? <input type="text" className={inputCls} value={form.ajuda_custo} onChange={e => setForm({...form, ajuda_custo: mascaraMoeda(e.target.value)})} />
              : <input className={inputReadOnly} value={form.ajuda_custo || 'R$ 0,00'} readOnly />}
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">
              Valor Hora Extra
              {isAdmin && (
                <button type="button" onClick={calcularHoraExtra}
                  className="ml-2 text-green-400 text-xs w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">
                  ↻ calcular automático
                </button>
              )}
            </label>
            {isAdmin
              ? <input type="text" className={inputCls} value={form.hora_extra_valor} onChange={e => setForm({...form, hora_extra_valor: mascaraMoeda(e.target.value)})} />
              : <input className={inputReadOnly} value={form.hora_extra_valor || 'R$ 0,00'} readOnly />}
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Cachê de Evento</label>
            {isAdmin
              ? <input type="text" className={inputCls} value={form.cache_evento} onChange={e => setForm({...form, cache_evento: mascaraMoeda(e.target.value)})} />
              : <input className={inputReadOnly} value={form.cache_evento || 'R$ 0,00'} readOnly />}
          </div>
        </div>
        {isAdmin && (
          <>
            {msgProfissional && <p className={`text-sm font-semibold ${msgProfissional.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>{msgProfissional}</p>}
            <button type="submit" disabled={salvandoProfissional}
              className="w-full bg-green-500 text-white font-bold py-3 rounded-2xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
              {salvandoProfissional ? 'Salvando...' : 'Salvar dados profissionais'}
            </button>
          </>
        )}
      </form>

      {/* Dados bancários */}
      <form onSubmit={salvarBancario} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <h3 className="text-white font-bold">Dados Bancários</h3>
        <p className="text-gray-500 text-sm">Informações para recebimento de pagamentos</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-gray-400 text-sm mb-1">Banco</label>
            <input className={inputCls} placeholder="Ex: Nubank, Itaú, Bradesco..." value={form.banco} onChange={e => setForm({...form, banco: e.target.value})} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Agência</label>
            <input className={inputCls} placeholder="0000" value={form.agencia} onChange={e => setForm({...form, agencia: e.target.value})} />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Conta Corrente</label>
            <input className={inputCls} placeholder="00000-0" value={form.conta} onChange={e => setForm({...form, conta: e.target.value})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-gray-400 text-sm mb-1">Chave PIX</label>
            <input className={inputCls} placeholder="CPF, email, telefone ou chave aleatória" value={form.pix} onChange={e => setForm({...form, pix: e.target.value})} />
          </div>
        </div>
        {msgBancario && <p className={`text-sm font-semibold ${msgBancario.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>{msgBancario}</p>}
        <button type="submit" disabled={salvandoBancario}
          className="w-full bg-green-500 text-white font-bold py-3 rounded-2xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
          {salvandoBancario ? 'Salvando...' : 'Salvar dados bancários'}
        </button>
      </form>

      {/* Modal câmera */}
      {modalCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold">Tirar foto</h3>
              <button onClick={fecharCamera}
                className="text-gray-400 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-2xl">✕</button>
            </div>
            <div className="relative rounded-3xl overflow-hidden bg-black mb-4" style={{ height: '320px' }}>
              {facePreview ? (
                <img src={facePreview} className="w-full h-full object-cover" alt="Prévia" />
              ) : (
                <video ref={videoRef} autoPlay muted playsInline
                  className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              )}
              <div className="absolute bottom-3 left-0 right-0 text-center px-4">
                <p className="text-sm font-semibold" style={{ color: faceMsgCor, textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                  {faceMsg}
                </p>
              </div>
            </div>
            {faceStatus === 'capturado' ? (
              <div className="space-y-3">
                <button onClick={salvarFotoCamera} disabled={salvandoFoto}
                  className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
                  {salvandoFoto ? 'Salvando...' : '✅ Usar esta foto'}
                </button>
                <button onClick={() => { setFacePreview(null); setFaceStatus('idle'); abrirCamera() }}
                  className="w-full bg-gray-700 text-white font-bold py-3 rounded-2xl hover:bg-gray-600 cursor-pointer transition-colors">
                  🔄 Refazer
                </button>
              </div>
            ) : (
              <button onClick={capturarFoto}
                className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl hover:bg-green-600 cursor-pointer transition-colors">
                📷 Capturar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}