import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function SuperAdmin({ usuario, onEntrarEmpresa, onLogout }) {
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNova, setModalNova] = useState(false)
  const [form, setForm] = useState({ nome: '', cnpj: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [stats, setStats] = useState({})
  const [modalExcluir, setModalExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data: emps } = await supabase.from('empresas').select('*').order('nome')
    setEmpresas(emps || [])
    const { data: colabs } = await supabase.from('colaboradores').select('empresa_id, status')
    const statsMap = {}
    ;(colabs || []).forEach(c => {
      if (!statsMap[c.empresa_id]) statsMap[c.empresa_id] = { total: 0, ativos: 0 }
      statsMap[c.empresa_id].total++
      if (c.status === 'aprovado') statsMap[c.empresa_id].ativos++
    })
    setStats(statsMap)
    setLoading(false)
  }

  async function criarEmpresa() {
    if (!form.nome.trim()) return
    setSalvando(true); setMsg('')
    const { error } = await supabase.from('empresas').insert({ nome: form.nome.trim(), cnpj: form.cnpj.trim() || null })
    if (error) { setMsg('Erro ao criar empresa: ' + error.message); setSalvando(false); return }
    setSalvando(false); setModalNova(false); setForm({ nome: '', cnpj: '' }); carregar()
  }

  async function excluirEmpresa() {
    setExcluindo(true)
    await supabase.from('empresas').delete().eq('id', modalExcluir.id)
    setModalExcluir(null); setExcluindo(false); carregar()
  }

  const inputCls = 'w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none text-sm'

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold">👑 Super Admin</h1>
            <p className="text-gray-400 text-sm mt-1">Gerencie todas as empresas do sistema</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModalNova(true)} className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl hover:bg-green-600 cursor-pointer transition-colors text-sm w-auto">+ Nova empresa</button>
            <button onClick={onLogout} className="bg-gray-800 text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-700 cursor-pointer border border-gray-700 w-auto transition-colors">Sair</button>
          </div>
        </div>

        {loading ? <p className="text-gray-500 text-center py-8">Carregando...</p> : (
          <div className="space-y-3">
            {empresas.map(emp => (
              <div key={emp.id} className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-lg">{emp.nome}</p>
                  {emp.cnpj && <p className="text-gray-500 text-xs">CNPJ: {emp.cnpj}</p>}
                  <div className="flex gap-4 mt-2">
                    <span className="text-gray-400 text-xs">👥 <span className="text-white font-semibold">{stats[emp.id]?.ativos || 0}</span> ativos</span>
                    <span className="text-gray-400 text-xs">📊 <span className="text-white font-semibold">{stats[emp.id]?.total || 0}</span> total</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEntrarEmpresa(emp)} className="bg-blue-500 text-white font-bold py-2 px-5 rounded-xl hover:bg-blue-600 cursor-pointer transition-colors text-sm w-auto">Entrar →</button>
                  <button onClick={() => setModalExcluir(emp)} className="bg-red-500 bg-opacity-20 text-red-400 font-bold py-2 px-3 rounded-xl hover:bg-opacity-30 cursor-pointer transition-colors text-sm w-auto border border-red-500 border-opacity-30">✕</button>
                </div>
              </div>
            ))}
            {empresas.length === 0 && <p className="text-gray-500 text-center py-8">Nenhuma empresa cadastrada.</p>}
          </div>
        )}
      </div>

      {/* Modal nova empresa */}
      {modalNova && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white text-lg font-bold">Nova Empresa</h3>
              <button onClick={() => setModalNova(false)} className="text-gray-400 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-2xl">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className="text-gray-400 text-xs mb-1 block">Nome da empresa *</label><input className={inputCls} value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} placeholder="Ex: Varanda Estaiada" /></div>
              <div><label className="text-gray-400 text-xs mb-1 block">CNPJ</label><input className={inputCls} value={form.cnpj} onChange={e => setForm(f => ({...f, cnpj: e.target.value}))} placeholder="00.000.000/0001-00" /></div>
              {msg && <p className={`text-sm font-semibold ${msg.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalNova(false)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={criarEmpresa} disabled={salvando || !form.nome.trim()} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors">{salvando ? 'Criando...' : 'Criar empresa'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir empresa */}
      {modalExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-white text-lg font-bold mb-2">Excluir empresa</h3>
            <p className="text-gray-400 text-sm mb-1">Tem certeza que deseja excluir <span className="text-white font-bold">{modalExcluir.nome}</span>?</p>
            <p className="text-red-400 text-xs mb-5">⚠ Isso não apaga os colaboradores, apenas desvincula a empresa.</p>
            <div className="flex gap-3">
              <button onClick={() => setModalExcluir(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
              <button onClick={excluirEmpresa} disabled={excluindo} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-red-600 disabled:opacity-50 transition-colors">{excluindo ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}