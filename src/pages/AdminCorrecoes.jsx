import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function AdminCorrecoes({ usuario }) {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('pendente')
  const [modalSol, setModalSol] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [formEdicao, setFormEdicao] = useState({ entrada: '', saida: '' })

  useEffect(() => { carregar() }, [filtro])

  async function carregar() {
    setLoading(true)

    // Busca colaboradores da empresa primeiro
    const { data: colabs } = await supabase
      .from('colaboradores')
      .select('id, nome')
      .eq('empresa_id', usuario.empresa_id)
      .eq('status', 'aprovado')

    if (!colabs?.length) { setSolicitacoes([]); setLoading(false); return }

    const ids = colabs.map(c => c.id)

    let query = supabase
      .from('solicitacoes_correcao')
      .select('*')
      .in('colaborador_id', ids)
      .order('criado_em', { ascending: false })

    if (filtro !== 'todos') query = query.eq('status', filtro)

    const { data } = await query

    // Enriquece com nome do colaborador
    const enriquecidas = (data || []).map(s => ({
      ...s,
      colaborador_nome: colabs.find(c => c.id === s.colaborador_id)?.nome || 'Desconhecido'
    }))

    setSolicitacoes(enriquecidas)
    setLoading(false)
  }

  function abrirModal(sol) {
    setModalSol(sol)
    setFormEdicao({
      entrada: sol.entrada_solicitada?.slice(0, 5) || '',
      saida: sol.saida_solicitada?.slice(0, 5) || ''
    })
    setProcessando(false)
  }

  async function aprovar() {
    setProcessando(true)
    const agora = new Date()

    const { data: regExistente } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('colaborador_id', modalSol.colaborador_id)
      .eq('data', modalSol.data)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    const entradaISO = formEdicao.entrada ? `${modalSol.data}T${formEdicao.entrada}:00` : null
    const saidaISO = formEdicao.saida ? `${modalSol.data}T${formEdicao.saida}:00` : null

    if (regExistente) {
      const updates = {}
      if (entradaISO) updates.entrada = entradaISO
      if (saidaISO) updates.saida = saidaISO
      if (entradaISO && saidaISO) {
        updates.horas_trabalhadas = (new Date(saidaISO) - new Date(entradaISO)) / (1000 * 60 * 60)
      } else if (saidaISO && regExistente.entrada) {
        updates.horas_trabalhadas = (new Date(saidaISO) - new Date(regExistente.entrada)) / (1000 * 60 * 60)
      } else if (entradaISO && regExistente.saida) {
        updates.horas_trabalhadas = (new Date(regExistente.saida) - new Date(entradaISO)) / (1000 * 60 * 60)
      }
      await supabase.from('registros_ponto').update(updates).eq('id', regExistente.id)
    } else {
      const novoReg = {
        colaborador_id: modalSol.colaborador_id,
        empresa_id: usuario.empresa_id,
        data: modalSol.data,
        categoria: 'FIXO MENSAL',
        metodo: 'Correção Admin',
      }
      if (entradaISO) novoReg.entrada = entradaISO
      if (saidaISO) novoReg.saida = saidaISO
      if (entradaISO && saidaISO) {
        novoReg.horas_trabalhadas = (new Date(saidaISO) - new Date(entradaISO)) / (1000 * 60 * 60)
      }
      await supabase.from('registros_ponto').insert(novoReg)
    }

    await supabase.from('solicitacoes_correcao').update({
      status: 'aprovado',
      resolvido_em: agora.toISOString()
    }).eq('id', modalSol.id)

    setModalSol(null)
    setProcessando(false)
    carregar()
  }

  async function recusar() {
    setProcessando(true)
    await supabase.from('solicitacoes_correcao').update({
      status: 'recusado',
      resolvido_em: new Date().toISOString()
    }).eq('id', modalSol.id)
    setModalSol(null)
    setProcessando(false)
    carregar()
  }

  const pendentes = solicitacoes.filter(s => s.status === 'pendente').length

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-xl font-bold">Correções de Ponto</h2>
            {pendentes > 0 && (
              <p className="text-yellow-400 text-sm mt-0.5">{pendentes} pendente{pendentes > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5">
          {[
            { key: 'pendente', label: 'Pendentes' },
            { key: 'aprovado', label: 'Aprovados' },
            { key: 'recusado', label: 'Recusados' },
            { key: 'todos', label: 'Todos' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors w-auto ${
                filtro === f.key ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Carregando...</p>
        ) : solicitacoes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-400">Nenhuma solicitação {filtro !== 'todos' ? filtro : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitacoes.map(sol => (
              <div key={sol.id}
                onClick={() => sol.status === 'pendente' && abrirModal(sol)}
                className={`bg-gray-800 rounded-xl p-4 transition-all ${
                  sol.status === 'pendente' ? 'cursor-pointer hover:bg-gray-750 border border-yellow-500 border-opacity-20' : ''
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold text-sm">{sol.colaborador_nome}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        sol.status === 'aprovado' ? 'bg-green-500 bg-opacity-20 text-green-400' :
                        sol.status === 'recusado' ? 'bg-red-500 bg-opacity-20 text-red-400' :
                        'bg-yellow-500 bg-opacity-20 text-yellow-400'
                      }`}>
                        {sol.status === 'aprovado' ? 'Aprovado' : sol.status === 'recusado' ? 'Recusado' : 'Pendente'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mb-1">
                      {new Date(sol.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                    {(sol.entrada_solicitada || sol.saida_solicitada) && (
                      <p className="text-gray-500 text-xs mb-1">
                        {sol.entrada_solicitada && <span>Entrada: <span className="text-green-400">{sol.entrada_solicitada.slice(0,5)}</span> </span>}
                        {sol.saida_solicitada && <span>Saída: <span className="text-red-400">{sol.saida_solicitada.slice(0,5)}</span></span>}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs italic">"{sol.justificativa}"</p>
                  </div>
                  {sol.status === 'pendente' && <span className="text-gray-500 text-lg ml-3">›</span>}
                </div>
                <p className="text-gray-600 text-xs mt-2">
                  {new Date(sol.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal aprovação */}
      {modalSol && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-white text-lg font-bold mb-1">Revisar solicitação</h3>
            <p className="text-gray-400 text-sm mb-1">{modalSol.colaborador_nome}</p>
            <p className="text-gray-500 text-xs mb-4">
              {new Date(modalSol.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            <div className="bg-gray-800 rounded-xl p-3 mb-4">
              <p className="text-gray-400 text-xs mb-1">Justificativa</p>
              <p className="text-white text-sm">"{modalSol.justificativa}"</p>
            </div>

            <p className="text-gray-400 text-xs mb-2">Confirme ou ajuste os horários:</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Entrada</label>
                <input type="time" value={formEdicao.entrada}
                  onChange={e => setFormEdicao(f => ({ ...f, entrada: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Saída</label>
                <input type="time" value={formEdicao.saida}
                  onChange={e => setFormEdicao(f => ({ ...f, saida: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalSol(null)}
                className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={recusar} disabled={processando}
                className="flex-1 bg-red-500 bg-opacity-20 text-red-400 font-bold py-3 rounded-2xl cursor-pointer hover:bg-opacity-30 disabled:opacity-40 transition-colors text-sm border border-red-500 border-opacity-30">
                Recusar
              </button>
              <button onClick={aprovar} disabled={processando}
                className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors text-sm">
                {processando ? '...' : 'Aprovar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}