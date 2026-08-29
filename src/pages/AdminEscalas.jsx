import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
]

const ESCALA_VAZIA = { nome: '', dias_semana: [1,2,3,4,5], horario_entrada: '09:00', horario_saida: '18:00', horas_diarias_esperadas: '9' }

function horasParaTexto(decimal) {
  const n = Number(decimal)
  if (!n && n !== 0) return ''
  const h = Math.floor(n)
  const m = Math.round((n - h) * 60)
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

export default function AdminEscalas({ usuario }) {
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'novo' | {id, ...}
  const [form, setForm] = useState(ESCALA_VAZIA)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [modalExcluir, setModalExcluir] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('escalas').select('*').eq('empresa_id', usuario.empresa_id).order('nome')
    setEscalas(data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(ESCALA_VAZIA); setErro(''); setModal('novo') }
  function abrirEditar(e) { setForm({ nome: e.nome, dias_semana: e.dias_semana || [], horario_entrada: e.horario_entrada || '09:00', horario_saida: e.horario_saida || '18:00', horas_diarias_esperadas: String(e.horas_diarias_esperadas ?? 9) }); setErro(''); setModal(e) }

  function toggleDia(dia) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(dia) ? f.dias_semana.filter(d => d !== dia) : [...f.dias_semana, dia].sort()
    }))
  }

  function calcularHorasAutomatico() {
    if (!form.horario_entrada || !form.horario_saida) return
    const [hE, mE] = form.horario_entrada.split(':').map(Number)
    const [hS, mS] = form.horario_saida.split(':').map(Number)
    let diffMin = (hS * 60 + mS) - (hE * 60 + mE)
    if (diffMin < 0) diffMin += 24 * 60
    setForm(f => ({ ...f, horas_diarias_esperadas: (diffMin / 60).toFixed(2) }))
  }

  async function salvar() {
    if (!form.nome.trim() || form.dias_semana.length === 0) return
    setSalvando(true); setErro('')
    const payload = { nome: form.nome.trim().toUpperCase(), dias_semana: form.dias_semana, horario_entrada: form.horario_entrada || null, horario_saida: form.horario_saida || null, horas_diarias_esperadas: Number(form.horas_diarias_esperadas) || 9, empresa_id: usuario.empresa_id }
    const { error } = modal === 'novo'
      ? await supabase.from('escalas').insert(payload)
      : await supabase.from('escalas').update(payload).eq('id', modal.id)
    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }
    setSalvando(false); setModal(null); carregar()
  }

  async function excluir() {
    await supabase.from('escalas').delete().eq('id', modalExcluir.id)
    setModalExcluir(null); carregar()
  }

  function descricaoDias(dias) {
    if (!dias?.length) return '—'
    return dias.map(d => DIAS_SEMANA.find(s => s.value === d)?.label).filter(Boolean).join(', ')
  }

  const inputCls = 'w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none text-sm'

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-xl font-bold">Escalas de Trabalho</h2>
        <button onClick={abrirNovo} className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl hover:bg-green-600 cursor-pointer transition-colors text-sm w-auto">+ Nova escala</button>
      </div>

      {loading ? <p className="text-gray-500">Carregando...</p> : escalas.length === 0 ? (
        <div className="text-center py-10"><p className="text-4xl mb-3">📅</p><p className="text-gray-400">Nenhuma escala cadastrada.</p><p className="text-gray-600 text-sm mt-1">Crie escalas para atribuir aos colaboradores.</p></div>
      ) : (
        <div className="space-y-2">
          {escalas.map(e => (
            <div key={e.id} className="flex justify-between items-center bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
              <div>
                <p className="text-white font-semibold text-sm">{e.nome}</p>
                <p className="text-gray-400 text-xs mt-0.5">{descricaoDias(e.dias_semana)}{e.horario_entrada ? ` · ${e.horario_entrada.slice(0,5)} às ${e.horario_saida?.slice(0,5) || '—'}` : ''} · {e.horas_diarias_esperadas || 9}h/dia</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => abrirEditar(e)} className="text-blue-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-blue-300 transition-colors">Editar</button>
                <button onClick={() => setModalExcluir(e)} className="text-red-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-red-300 transition-colors">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-lg font-bold">{modal === 'novo' ? 'Nova escala' : 'Editar escala'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-2xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nome da escala *</label>
                <input className={inputCls} value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} placeholder="Ex: 5x2 Seg-Sex, 6x1 Sáb..." />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Dias de trabalho *</label>
                <div className="flex gap-2 flex-wrap">
                  {DIAS_SEMANA.map(d => (
                    <button key={d.value} type="button" onClick={() => toggleDia(d.value)}
                      className={`w-10 h-10 rounded-xl text-xs font-bold cursor-pointer transition-colors border w-auto px-3 ${form.dias_semana.includes(d.value) ? 'bg-green-500 text-white border-green-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Entrada padrão</label>
                  <input type="time" className={inputCls} value={form.horario_entrada} onChange={e => setForm(f => ({...f, horario_entrada: e.target.value}))} />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Saída padrão</label>
                  <input type="time" className={inputCls} value={form.horario_saida} onChange={e => setForm(f => ({...f, horario_saida: e.target.value}))} />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Horas esperadas por dia trabalhado *
                  <button type="button" onClick={calcularHorasAutomatico} className="ml-2 text-green-400 text-xs font-normal w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">↻ calcular a partir do horário</button>
                </label>
                <input type="number" step="0.01" className={inputCls} value={form.horas_diarias_esperadas} onChange={e => setForm(f => ({...f, horas_diarias_esperadas: e.target.value}))} placeholder="Ex: 9 ou 8.33" />
                {form.horas_diarias_esperadas && <p className="text-green-400 text-xs mt-1 font-semibold">= {horasParaTexto(form.horas_diarias_esperadas)}</p>}
                <p className="text-gray-600 text-xs mt-1">Usado pro banco de horas — 9 pro 5x2, ~8.33 (8h20) pro 6x1. Quem trabalhar mais soma hora extra, quem trabalhar menos entra como falta de horário (sem descontar automaticamente).</p>
              </div>
            </div>
            {erro && <p className="text-red-400 text-sm mt-3">{erro}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.nome.trim() || form.dias_semana.length === 0} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors">{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir */}
      {modalExcluir && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6">
            <h3 className="text-white text-lg font-bold mb-2">Excluir Escala</h3>
            <p className="text-gray-400 mb-6">Tem certeza que deseja excluir <strong className="text-white">{modalExcluir.nome}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={excluir} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 cursor-pointer transition-colors">Excluir</button>
              <button onClick={() => setModalExcluir(null)} className="flex-1 bg-gray-700 text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-600 cursor-pointer transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}