import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATEGORIAS = ['FIXO MENSAL', 'CACHÊ ESPECIAL', 'CORPORATIVO', 'FOLGA', 'FALTA']

export default function RegistrosPonto({ usuario }) {
  const [colaboradores, setColaboradores] = useState([])
  const [registros, setRegistros] = useState([])
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState('')
  const [mesAno, setMesAno] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ data: '', categoria: 'FIXO MENSAL', justificativa: '', entrada: '', saida: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [modalEditar, setModalEditar] = useState(null)
  const [formEditar, setFormEditar] = useState({ entrada: '', saida: '', categoria: '', justificativa: '' })

  useEffect(() => { carregarColaboradores() }, [])
  useEffect(() => { if (colaboradorSelecionado) carregarRegistros() }, [colaboradorSelecionado, mesAno])

  async function carregarColaboradores() {
    const isAdmin = usuario.perfil === 'admin'
    if (isAdmin) {
      const { data } = await supabase
        .from('colaboradores').select('id, nome')
        .eq('empresa_id', usuario.empresa_id)
        .eq('status', 'aprovado')
        .order('nome')
      setColaboradores(data || [])
    } else {
      setColaboradorSelecionado(usuario.id)
    }
  }

  async function carregarRegistros() {
    setLoading(true)
    const [ano, mes] = mesAno.split('-')
    const { data } = await supabase
      .from('registros_ponto').select('*')
      .eq('colaborador_id', colaboradorSelecionado)
      .gte('data', `${ano}-${mes}-01`)
      .lte('data', `${ano}-${mes}-31`)
      .order('data')
    setRegistros(data || [])
    setLoading(false)
  }

  function calcularHoras(entrada, saida) {
    if (!entrada || !saida) return 0
    const diff = (new Date(saida) - new Date(entrada)) / (1000 * 60 * 60)
    return Math.max(0, diff)
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    const horas = calcularHoras(
      form.entrada ? `${form.data}T${form.entrada}:00` : null,
      form.saida ? `${form.data}T${form.saida}:00` : null
    )
    const { error } = await supabase.from('registros_ponto').insert({
      colaborador_id: colaboradorSelecionado,
      empresa_id: usuario.empresa_id,
      data: form.data,
      categoria: form.categoria,
      justificativa: form.justificativa,
      entrada: form.entrada ? `${form.data}T${form.entrada}:00` : null,
      saida: form.saida ? `${form.data}T${form.saida}:00` : null,
      horas_trabalhadas: horas,
      metodo: 'Manual RH'
    })
    if (error) { setMsg('Erro: ' + error.message) }
    else {
      setMsg('Registro salvo!')
      setForm({ data: '', categoria: 'FIXO MENSAL', justificativa: '', entrada: '', saida: '' })
      carregarRegistros()
      setTimeout(() => setMsg(''), 3000)
    }
    setSalvando(false)
  }

  async function salvarEdicao() {
    const horas = calcularHoras(
      formEditar.entrada ? `${modalEditar.data}T${formEditar.entrada}:00` : null,
      formEditar.saida ? `${modalEditar.data}T${formEditar.saida}:00` : null
    )
    await supabase.from('registros_ponto').update({
      entrada: formEditar.entrada ? `${modalEditar.data}T${formEditar.entrada}:00` : null,
      saida: formEditar.saida ? `${modalEditar.data}T${formEditar.saida}:00` : null,
      categoria: formEditar.categoria,
      justificativa: formEditar.justificativa,
      horas_trabalhadas: horas
    }).eq('id', modalEditar.id)
    setModalEditar(null)
    carregarRegistros()
  }

  async function excluirRegistro(id) {
    await supabase.from('registros_ponto').delete().eq('id', id)
    carregarRegistros()
  }

  function abrirEditar(r) {
    setModalEditar(r)
    setFormEditar({
      entrada: r.entrada ? new Date(r.entrada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      saida: r.saida ? new Date(r.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      categoria: r.categoria || 'FIXO MENSAL',
      justificativa: r.justificativa || ''
    })
  }

  const totalHoras = registros.reduce((acc, r) => acc + Number(r.horas_trabalhadas || 0), 0)
  const isAdmin = usuario.perfil === 'admin'

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-wrap gap-4 items-end">
        {isAdmin && (
          <div>
            <label className="block text-gray-400 text-sm mb-1">Colaborador</label>
            <select className="bg-gray-800 text-white border border-gray-700 rounded-xl p-3 min-w-48 focus:border-green-500 focus:outline-none cursor-pointer"
              value={colaboradorSelecionado} onChange={e => setColaboradorSelecionado(e.target.value)}>
              <option value="">-- Selecione --</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-gray-400 text-sm mb-1">Mês</label>
          <input type="month" className="bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
            value={mesAno} onChange={e => setMesAno(e.target.value)} />
        </div>
      </div>

      {/* Formulário novo registro — só admin */}
      {isAdmin && colaboradorSelecionado && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-white text-xl font-bold mb-4">Lançar Registro</h2>
          <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Data</label>
              <input type="date" className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                value={form.data} onChange={e => setForm({...form, data: e.target.value})} required />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Categoria</label>
              <select className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Justificativa</label>
              <input className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-text"
                value={form.justificativa} onChange={e => setForm({...form, justificativa: e.target.value})} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Entrada</label>
              <input type="time" className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                value={form.entrada} onChange={e => setForm({...form, entrada: e.target.value})} />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Saída</label>
              <input type="time" className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                value={form.saida} onChange={e => setForm({...form, saida: e.target.value})} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={salvando}
                className="w-full bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
                {salvando ? 'Salvando...' : 'Lançar'}
              </button>
            </div>
          </form>
          {msg && <p className="mt-2 text-green-400 font-semibold text-sm">{msg}</p>}
        </div>
      )}

      {/* Tabela */}
      {colaboradorSelecionado && (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white text-xl font-bold">Registros do Mês</h2>
            <span className="bg-green-500 bg-opacity-20 text-green-400 font-bold px-4 py-2 rounded-xl border border-green-500 border-opacity-30">
              Total: {totalHoras.toFixed(1)}h
            </span>
          </div>

          {loading ? <p className="text-gray-500">Carregando...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-gray-400 font-semibold p-3 text-left">Data</th>
                    <th className="text-gray-400 font-semibold p-3 text-left">Categoria</th>
                    <th className="text-gray-400 font-semibold p-3 text-left">Justificativa</th>
                    <th className="text-gray-400 font-semibold p-3 text-center">Entrada</th>
                    <th className="text-gray-400 font-semibold p-3 text-center">Saída</th>
                    <th className="text-gray-400 font-semibold p-3 text-center">Horas</th>
                    {isAdmin && <th className="text-gray-400 font-semibold p-3 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => (
                    <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <td className="p-3 text-white">{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-gray-300">{r.categoria}</td>
                      <td className="p-3 text-gray-400">{r.justificativa}</td>
                      <td className="p-3 text-center text-gray-300">
                        {r.entrada ? new Date(r.entrada).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="p-3 text-center text-gray-300">
                        {r.saida ? new Date(r.saida).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="p-3 text-center text-white font-semibold">{Number(r.horas_trabalhadas).toFixed(1)}h</td>
                      {isAdmin && (
                        <td className="p-3 text-center">
                          <div className="flex gap-3 justify-center">
                            <button onClick={() => abrirEditar(r)}
                              className="text-blue-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-blue-300 transition-colors">
                              Editar
                            </button>
                            <button onClick={() => excluirRegistro(r.id)}
                              className="text-red-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-red-300 transition-colors">
                              Excluir
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {registros.length === 0 && (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-gray-500">Nenhum registro neste mês.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md p-6">
            <h3 className="text-white text-xl font-bold mb-1">Editar Registro</h3>
            <p className="text-gray-400 text-sm mb-6">
              {new Date(modalEditar.data + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Categoria</label>
                <select className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                  value={formEditar.categoria} onChange={e => setFormEditar({...formEditar, categoria: e.target.value})}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Justificativa</label>
                <input className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-text"
                  value={formEditar.justificativa} onChange={e => setFormEditar({...formEditar, justificativa: e.target.value})} />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Entrada</label>
                <input type="time" className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                  value={formEditar.entrada} onChange={e => setFormEditar({...formEditar, entrada: e.target.value})} />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Saída</label>
                <input type="time" className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                  value={formEditar.saida} onChange={e => setFormEditar({...formEditar, saida: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={salvarEdicao}
                className="flex-1 bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 cursor-pointer transition-colors">
                Salvar
              </button>
              <button onClick={() => setModalEditar(null)}
                className="flex-1 bg-gray-700 text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-600 cursor-pointer transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}