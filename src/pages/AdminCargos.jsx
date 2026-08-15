import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function AdminCargos({ usuario }) {
  const [cargos, setCargos] = useState([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [modalExcluir, setModalExcluir] = useState(null)
  const [modalEditar, setModalEditar] = useState(null)
  const [nomeEditar, setNomeEditar] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('cargos').select('*').eq('empresa_id', usuario.empresa_id).order('nome')
    setCargos(data || [])
    setLoading(false)
  }

  async function adicionar(e) {
    e.preventDefault()
    if (!novo.trim()) return
    setSalvando(true)
    await supabase.from('cargos').insert({ nome: novo.trim().toUpperCase(), empresa_id: usuario.empresa_id })
    setNovo('')
    setMsg('Cargo adicionado!')
    carregar()
    setTimeout(() => setMsg(''), 2000)
    setSalvando(false)
  }

  async function confirmarExcluir() {
    await supabase.from('cargos').delete().eq('id', modalExcluir.id)
    setModalExcluir(null)
    carregar()
  }

  async function confirmarEditar() {
    if (!nomeEditar.trim()) return
    await supabase.from('cargos').update({ nome: nomeEditar.trim().toUpperCase() }).eq('id', modalEditar.id)
    setModalEditar(null)
    carregar()
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 max-w-lg">
      <h2 className="text-white text-xl font-bold mb-6">Gestão de Cargos</h2>

      <form onSubmit={adicionar} className="flex gap-3 mb-6">
        <input
          className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-xl p-3 placeholder-gray-500 focus:border-green-500 focus:outline-none cursor-text"
          value={novo} onChange={e => setNovo(e.target.value)} placeholder="Nome do cargo" />
        <button type="submit" disabled={salvando}
          className="bg-green-500 text-white font-bold px-6 rounded-xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors w-auto">
          {salvando ? '...' : 'Adicionar'}
        </button>
      </form>

      {msg && <p className="text-green-400 font-semibold mb-4 text-sm">{msg}</p>}

      {loading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="space-y-2">
          {cargos.map(c => (
            <div key={c.id} className="flex justify-between items-center bg-gray-800 rounded-xl px-4 py-3 border border-gray-700">
              <span className="text-white font-semibold text-sm">{c.nome}</span>
              <div className="flex gap-4">
                <button onClick={() => { setModalEditar(c); setNomeEditar(c.nome) }}
                  className="text-blue-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-blue-300 transition-colors">
                  Editar
                </button>
                <button onClick={() => setModalExcluir(c)}
                  className="text-red-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-red-300 transition-colors">
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6">
            <h3 className="text-white text-lg font-bold mb-4">Editar Cargo</h3>
            <input className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 mb-4 focus:border-green-500 focus:outline-none cursor-text"
              value={nomeEditar} onChange={e => setNomeEditar(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={confirmarEditar}
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

      {/* Modal Excluir */}
      {modalExcluir && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm p-6">
            <h3 className="text-white text-lg font-bold mb-2">Excluir Cargo</h3>
            <p className="text-gray-400 mb-6">Tem certeza que deseja excluir <strong className="text-white">{modalExcluir.nome}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={confirmarExcluir}
                className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 cursor-pointer transition-colors">
                Excluir
              </button>
              <button onClick={() => setModalExcluir(null)}
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