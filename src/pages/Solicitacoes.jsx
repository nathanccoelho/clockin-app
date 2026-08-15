import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Solicitacoes({ usuario }) {
    const [solicitacoes, setSolicitacoes] = useState([])
    const [loading, setLoading] = useState(true)
    const [filtro, setFiltro] = useState('todas')

    useEffect(() => { carregar() }, [])

    async function carregar() {
        setLoading(true)
        const { data } = await supabase.from('solicitacoes_correcao').select('*').eq('colaborador_id', usuario.id).order('criado_em', { ascending: false })
        setSolicitacoes(data || []); setLoading(false)
    }

    const filtradas = filtro === 'todas' ? solicitacoes : solicitacoes.filter(s => s.status === filtro)

    return (
        <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h2 className="text-white text-xl font-bold mb-5">Minhas Solicitações</h2>
                <div className="flex flex-wrap gap-2 mb-5">
                    {[{ key: 'todas', label: 'Todas' }, { key: 'pendente', label: 'Pendentes' }, { key: 'aprovado', label: 'Aprovadas' }, { key: 'recusado', label: 'Recusadas' }].map(f => (
                        <button key={f.key} onClick={() => setFiltro(f.key)} className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors w-auto flex-shrink-0 ${filtro === f.key ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{f.label}</button>
                    ))}
                </div>
                {loading ? <p className="text-gray-500 text-center py-8">Carregando...</p> : filtradas.length === 0 ? (
                    <div className="text-center py-10"><p className="text-4xl mb-3">📋</p><p className="text-gray-400">Nenhuma solicitação encontrada.</p><p className="text-gray-600 text-sm mt-1">Clique em um dia do calendário para solicitar correção de ponto ou lançar evento.</p></div>
                ) : (
                    <div className="space-y-3">
                        {filtradas.map(sol => (
                            <div key={sol.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <p className="text-white font-semibold text-sm">{new Date(sol.data+'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                        <p className="text-gray-500 text-xs mt-0.5">{new Date(sol.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sol.status === 'aprovado' ? 'bg-green-500/20 text-green-400' : sol.status === 'recusado' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {sol.status === 'aprovado' ? '✓ Aprovado' : sol.status === 'recusado' ? '✗ Recusado' : '⏳ Pendente'}
                                    </span>
                                </div>
                                {(sol.entrada_solicitada || sol.saida_solicitada) && (
                                    <p className="text-gray-400 text-xs mb-1">
                                        {sol.entrada_solicitada && <span>Entrada: <span className="text-green-400 font-semibold">{sol.entrada_solicitada.slice(0,5)}</span> </span>}
                                        {sol.saida_solicitada && <span>Saída: <span className="text-red-400 font-semibold">{sol.saida_solicitada.slice(0,5)}</span></span>}
                                    </p>
                                )}
                                <p className="text-gray-400 text-xs italic">"{sol.justificativa}"</p>
                                {sol.status === 'aprovado' && <p className="text-green-400 text-xs mt-2">✓ Ponto corrigido pelo admin</p>}
                                {sol.status === 'recusado' && <p className="text-red-400 text-xs mt-2">✗ Solicitação recusada pelo admin</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}