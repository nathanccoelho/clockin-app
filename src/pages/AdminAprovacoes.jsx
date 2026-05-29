import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function mascaraMoeda(valor) {
  const num = String(valor).replace(/\D/g, '')
  if (!num) return ''
  return (Number(num) / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  })
}

function desmascaraMoeda(valor) {
  return Number(String(valor).replace(/\D/g, '')) / 100
}

export default function AdminAprovacoes({ usuario }) {
  const [pendentes, setPendentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState(null)
  const [modalAprovar, setModalAprovar] = useState(null)
  const [cargos, setCargos] = useState([])
  const [formAprovar, setFormAprovar] = useState({
    data_admissao: new Date().toISOString().split('T')[0],
    cargo: '', salario_fixo: '', ajuda_custo_diaria: '', hora_extra_valor: ''
  })

  useEffect(() => { carregar(); carregarCargos() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('colaboradores').select('*').eq('status', 'pendente').order('criado_em')
    setPendentes(data || [])
    setLoading(false)
  }

  async function carregarCargos() {
    const { data } = await supabase
      .from('cargos').select('*').eq('empresa_id', usuario.empresa_id).order('nome')
    setCargos(data || [])
  }

  async function confirmarAprovacao() {
    if (!modalAprovar) return
    setProcessando(modalAprovar.id)

    const { error } = await supabase.from('colaboradores').update({
      status: 'aprovado',
      empresa_id: usuario.empresa_id,
      data_admissao: formAprovar.data_admissao || null,
      cargo: formAprovar.cargo,
      salario_fixo: desmascaraMoeda(formAprovar.salario_fixo),
      ajuda_custo_diaria: desmascaraMoeda(formAprovar.ajuda_custo_diaria),
      hora_extra_valor: desmascaraMoeda(formAprovar.hora_extra_valor),
      aprovado_por: usuario.nome,
      aprovado_em: new Date().toISOString()
    }).eq('id', modalAprovar.id)

    if (!error) {
      setModalAprovar(null)
      setFormAprovar({
        data_admissao: new Date().toISOString().split('T')[0],
        cargo: '', salario_fixo: '', ajuda_custo_diaria: '', hora_extra_valor: ''
      })
      carregar()
    }
    setProcessando(null)
  }

  async function recusar(colab) {
    setProcessando(colab.id)
    await supabase.from('colaboradores').update({ status: 'recusado' }).eq('id', colab.id)
    carregar()
    setProcessando(null)
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white text-xl font-bold">Aprovações Pendentes</h2>
        {pendentes.length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : pendentes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-400">Nenhum cadastro pendente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendentes.map(c => (
            <div key={c.id} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-white font-bold text-lg">{c.nome}</p>
                <p className="text-gray-400 text-sm">CPF: {c.cpf}</p>
                <p className="text-gray-400 text-sm">Email: {c.email}</p>
                <p className="text-gray-400 text-sm">Telefone: {c.telefone}</p>
                <p className="text-gray-600 text-xs mt-1">
                  Cadastrado em: {new Date(c.criado_em).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalAprovar(c)} disabled={processando === c.id}
                  className="bg-green-500 text-white font-bold px-6 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors w-auto">
                  Aprovar
                </button>
                <button onClick={() => recusar(c)} disabled={processando === c.id}
                  className="bg-red-500 text-white font-bold px-6 py-2 rounded-xl hover:bg-red-600 disabled:opacity-50 cursor-pointer transition-colors w-auto">
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Aprovação */}
      {modalAprovar && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md p-6">
            <h3 className="text-white text-xl font-bold mb-1">Aprovar Colaborador</h3>
            <p className="text-gray-400 mb-6">{modalAprovar.nome}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Data de Admissão</label>
                <input type="date"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                  value={formAprovar.data_admissao}
                  onChange={e => setFormAprovar({...formAprovar, data_admissao: e.target.value})} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Cargo</label>
                <select
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-pointer"
                  value={formAprovar.cargo}
                  onChange={e => setFormAprovar({...formAprovar, cargo: e.target.value})}>
                  <option value="">-- Selecione --</option>
                  {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Salário Fixo</label>
                <input type="text" placeholder="R$ 0,00"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-text"
                  value={formAprovar.salario_fixo}
                  onChange={e => setFormAprovar({...formAprovar, salario_fixo: mascaraMoeda(e.target.value)})} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Ajuda de Custo Diária</label>
                <input type="text" placeholder="R$ 0,00"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-text"
                  value={formAprovar.ajuda_custo_diaria}
                  onChange={e => setFormAprovar({...formAprovar, ajuda_custo_diaria: mascaraMoeda(e.target.value)})} />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Valor Hora Extra</label>
                <input type="text" placeholder="R$ 0,00"
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl p-3 focus:border-green-500 focus:outline-none cursor-text"
                  value={formAprovar.hora_extra_valor}
                  onChange={e => setFormAprovar({...formAprovar, hora_extra_valor: mascaraMoeda(e.target.value)})} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={confirmarAprovacao} disabled={processando === modalAprovar.id}
                className="flex-1 bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">
                {processando === modalAprovar.id ? 'Aprovando...' : 'Confirmar'}
              </button>
              <button onClick={() => setModalAprovar(null)}
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