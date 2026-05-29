import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

const TIPOS_LANCAMENTO = [
    // Faturamentos (somam)
    { value: 'cache_especial', label: 'Cachê Especial', grupo: 'fatura' },
    { value: 'cache_corporativo', label: 'Cachê Corporativo', grupo: 'fatura' },
    { value: 'dia_nao_folga', label: 'Dia Não Folga', grupo: 'fatura' },
    { value: 'ferias', label: 'Férias', grupo: 'fatura' },
    // Descontos (debitam)
    { value: 'adiantamento', label: 'Adiantamento', grupo: 'debito' },
    { value: 'desconto', label: 'Desconto', grupo: 'debito' },
]

function ehDebito(tipo) {
    return tipo === 'adiantamento' || tipo === 'desconto'
}

export default function RelatorioMensal({ usuario }) {
    const hoje = new Date()
    const isAdmin = usuario.perfil === 'admin'

    const [mes, setMes] = useState(hoje.getMonth())
    const [ano, setAno] = useState(hoje.getFullYear())
    const [colaboradores, setColaboradores] = useState([])
    const [colaboradorSel, setColaboradorSel] = useState(null)
    const [registros, setRegistros] = useState([])
    const [lancamentos, setLancamentos] = useState([])
    const [solicitacoes, setSolicitacoes] = useState([])
    const [loading, setLoading] = useState(true)

    // Fechamento
    const [todosRegs, setTodosRegs] = useState([])
    const [todosLancs, setTodosLancs] = useState([])
    const [fechamentos, setFechamentos] = useState([])
    const [expandido, setExpandido] = useState(null)
    const [loadingFechamento, setLoadingFechamento] = useState(false)
    const [aprovando, setAprovando] = useState(null)
    const [exportandoFech, setExportandoFech] = useState(false)

    // Modal solicitação (colaborador)
    const [modalDia, setModalDia] = useState(null)
    const [formSol, setFormSol] = useState({ entrada: '', saida: '', justificativa: '' })
    const [enviandoSol, setEnviandoSol] = useState(false)
    const [sucessoSol, setSucessoSol] = useState(false)

    // Modal lançamento (admin)
    const [modalLanc, setModalLanc] = useState(false)
    const [formLanc, setFormLanc] = useState({ colaboradorId: '', tipo: 'adiantamento', descricao: '', valor: '', quantidade: '1', parcelas: '1', data: '' })
    const [salvandoLanc, setSalvandoLanc] = useState(false)

    const colaboradorId = isAdmin ? colaboradorSel?.id : usuario.id

    useEffect(() => {
        if (isAdmin) carregarColaboradores()
        else carregar(usuario.id)
    }, [])

    useEffect(() => {
        if (colaboradorId) carregar(colaboradorId)
    }, [mes, ano, colaboradorId])

    useEffect(() => {
        if (isAdmin && colaboradores.length > 0) carregarFechamento()
    }, [mes, ano, colaboradores])

    async function carregarColaboradores() {
        const { data } = await supabase
            .from('colaboradores')
            .select('id, nome, cargo, salario_fixo, ajuda_custo_diaria, hora_extra_valor, pix')
            .eq('empresa_id', usuario.empresa_id)
            .eq('status', 'aprovado')
            .order('nome')
        setColaboradores(data || [])
        if (data?.length > 0) setColaboradorSel(data[0])
    }

    async function carregar(colabId) {
        if (!colabId) return
        setLoading(true)
        const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
        const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${new Date(ano, mes + 1, 0).getDate()}`
        const [{ data: regs }, { data: lancs }, { data: sols }] = await Promise.all([
            supabase.from('registros_ponto').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim).order('data'),
            supabase.from('lancamentos').select('*').eq('colaborador_id', colabId).eq('mes', mes + 1).eq('ano', ano).order('criado_em'),
            supabase.from('solicitacoes_correcao').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim)
        ])
        setRegistros(regs || [])
        setLancamentos(lancs || [])
        setSolicitacoes(sols || [])
        setLoading(false)
    }

    async function carregarFechamento() {
        setLoadingFechamento(true)
        const ids = colaboradores.map(c => c.id)
        const diasMes = new Date(ano, mes + 1, 0).getDate()
        const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
        const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${diasMes}`

        const [{ data: regs }, { data: lancs }, { data: fechs }] = await Promise.all([
            supabase.from('registros_ponto').select('*').in('colaborador_id', ids).gte('data', inicio).lte('data', fim),
            supabase.from('lancamentos').select('*').in('colaborador_id', ids).eq('mes', mes + 1).eq('ano', ano),
            supabase.from('fechamentos').select('*').in('colaborador_id', ids).eq('mes', mes + 1).eq('ano', ano)
        ])

        setTodosRegs(regs || [])
        setTodosLancs(lancs || [])
        setFechamentos(fechs || [])
        setLoadingFechamento(false)
    }

    function mudarMes(delta) {
        const d = new Date(ano, mes + delta)
        setMes(d.getMonth()); setAno(d.getFullYear())
    }

    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
    const nomeMes = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    function getRegistro(dia) {
        const s = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        return registros.find(r => r.data === s) || null
    }
    function getSolicitacao(dia) {
        const s = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        return solicitacoes.find(r => r.data === s) || null
    }
    function ehUtil(dia) { const d = new Date(ano, mes, dia).getDay(); return d !== 0 && d !== 6 }
    function ehPassado(dia) {
        const d = new Date(ano, mes, dia)
        const ontem = new Date(); ontem.setDate(ontem.getDate() - 1); ontem.setHours(23, 59, 59)
        return d <= ontem
    }
    function horaFmt(iso) {
        if (!iso) return '--:--'
        if (iso.length <= 8) return iso.slice(0, 5)
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    function brl(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

    const totalHoras = registros.reduce((a, r) => a + (r.horas_trabalhadas || 0), 0)
    const diasTrabalhados = registros.filter(r => r.entrada).length

    function somaLanc(tipo, lancs) {
        return (lancs || lancamentos).filter(l => l.tipo === tipo)
            .reduce((a, l) => a + Number(l.valor || 0) * Number(l.quantidade || 1), 0)
    }

    function calcularTotal(colab, regsC, lancsC) {
        const dias = regsC.filter(r => r.entrada).length
        const horas = regsC.reduce((a, r) => a + (r.horas_trabalhadas || 0), 0)
        const st = (tipo) => somaLanc(tipo, lancsC)
        const salario = Number(colab.salario_fixo || 0)
        const ajuda = Number(colab.ajuda_custo_diaria || 0) * dias
        const cE = st('cache_especial'), cC = st('cache_corporativo')
        const hExtra = Number((Math.max(0, horas - dias * 8) * Number(colab.hora_extra_valor || 0)).toFixed(2))
        const adiant = st('adiantamento'), desc = st('desconto')
        return { dias, horas, salario, ajuda, cE, cC, hExtra, adiant, desc, total: salario + ajuda + cE + cC + hExtra - adiant - desc }
    }

    async function aprovarColaborador(colabId, total) {
        setAprovando(colabId)
        await supabase.from('fechamentos').upsert({
            empresa_id: usuario.empresa_id,
            colaborador_id: colabId,
            mes: mes + 1, ano,
            aprovado: true,
            aprovado_em: new Date().toISOString(),
            aprovado_por: usuario.id,
            total_liquido: total
        }, { onConflict: 'colaborador_id,mes,ano' })
        setAprovando(null)
        carregarFechamento()
    }

    async function desaprovarColaborador(colabId) {
        setAprovando(colabId)
        await supabase.from('fechamentos').upsert({
            empresa_id: usuario.empresa_id,
            colaborador_id: colabId,
            mes: mes + 1, ano,
            aprovado: false,
            aprovado_em: null,
            aprovado_por: null,
            total_liquido: 0
        }, { onConflict: 'colaborador_id,mes,ano' })
        setAprovando(null)
        carregarFechamento()
    }

    const todoAprovado = colaboradores.length > 0 &&
        colaboradores.every(c => fechamentos.find(f => f.colaborador_id === c.id && f.aprovado))

    function abrirModalLanc() {
        setFormLanc({
            colaboradorId: colaboradorSel?.id || colaboradores[0]?.id || '',
            tipo: 'adiantamento', descricao: '', valor: '', quantidade: '1', parcelas: '1', data: ''
        })
        setModalLanc(true)
    }

    async function salvarLancamento() {
        if (!formLanc.colaboradorId || !formLanc.descricao.trim() || !formLanc.valor) return
        setSalvandoLanc(true)
        const valor = parseFloat(String(formLanc.valor).replace(',', '.'))
        const parcelas = parseInt(formLanc.parcelas) || 1
        for (let p = 0; p < parcelas; p++) {
            const d = new Date(ano, mes + p)
            await supabase.from('lancamentos').insert({
                colaborador_id: formLanc.colaboradorId, empresa_id: usuario.empresa_id,
                mes: d.getMonth() + 1, ano: d.getFullYear(),
                tipo: formLanc.tipo, descricao: formLanc.descricao + (formLanc.data ? ` (${formLanc.data})` : ''),
                valor, quantidade: parseFloat(formLanc.quantidade) || 1,
                parcelas, parcela_atual: p + 1
            })
        }
        setSalvandoLanc(false)
        setModalLanc(false)
        setFormLanc({ colaboradorId: '', tipo: 'adiantamento', descricao: '', valor: '', quantidade: '1', parcelas: '1', data: '' })
        carregar(colaboradorId)
        carregarFechamento()
    }

    async function excluirLancamento(id) {
        await supabase.from('lancamentos').delete().eq('id', id)
        carregar(colaboradorId)
        carregarFechamento()
    }

    async function exportarFechamento() {
        setExportandoFech(true)
        const wb = XLSX.utils.book_new()
        const mesNome = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long' })
        const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
        const diasMes = new Date(ano, mes + 1, 0).getDate()

        // Aba por colaborador
        for (const colab of colaboradores) {
            const regsC = todosRegs.filter(r => r.colaborador_id === colab.id)
            const lancsC = todosLancs.filter(l => l.colaborador_id === colab.id)
            const calc = calcularTotal(colab, regsC, lancsC)

            const rows = [['DATA', 'DIA DE SEMANA', 'TRABALHOU?', 'CATEGORIA', 'JUSTIFICATIVA', '', 'ENTRADA', 'SAÍDA', 'HORA TRABALHADA']]
            for (let d = 1; d <= diasMes; d++) {
                const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const dow = new Date(ano, mes, d).getDay()
                const reg = regsC.find(r => r.data === dataStr)
                let horas = '00:00'
                if (reg?.horas_trabalhadas) {
                    const h = Math.floor(reg.horas_trabalhadas)
                    const m = Math.round((reg.horas_trabalhadas % 1) * 60)
                    horas = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                }
                rows.push([dataStr, diasSemana[dow], reg?.entrada ? 'sim' : '', reg?.categoria || '', '', '',
                    reg?.entrada ? horaFmt(reg.entrada) : '', reg?.saida ? horaFmt(reg.saida) : '', horas])
            }

            const ws = XLSX.utils.aoa_to_sheet(rows)
            const salRows = [
                ['SALÁRIO', 'VALOR', 'DIÁRIA', 'TOTAL'],
                ['SALÁRIO FIXO', calc.salario, 1, calc.salario],
                ['AJUDA CUSTO MENSAL', Number(colab.ajuda_custo_diaria || 0), calc.dias, calc.ajuda],
                ['DIA NÃO FOLGA', somaLanc('dia_nao_folga', lancsC), '', somaLanc('dia_nao_folga', lancsC)],
                ['CACHÊ ESPECIAL', calc.cE, '', calc.cE],
                ['CACHÊ CORPORATIVO', calc.cC, '', calc.cC],
                ['FÉRIAS', somaLanc('ferias', lancsC), '', somaLanc('ferias', lancsC)],
                ['DÉCIMO TERCEIRO', calc.salario, 0, 0],
                ['HORAS EXTRA', Number(colab.hora_extra_valor || 0), Number(calc.hExtra.toFixed ? calc.hExtra : 0), calc.hExtra],
                [],
                ['TOTAL SALÁRIO', '', '', null],
                [],
                ['DESCONTOS', 'VALOR', 'DIÁRIA', 'TOTAL'],
                ['FALTA', somaLanc('dia_nao_folga', lancsC), 0, 0],
                ['ADIANTAMENTO', calc.adiant, -1, -calc.adiant],
                ['DESCONTO', calc.desc, -1, -calc.desc],
                [], [], [],
                ['TOTAL DESCONTOS', '', '', null],
                ['TOTAL LÍQUIDO', '', '', null],
                ['CHAVE PIX', colab.pix || '', '', ''],
            ]
            salRows.forEach((row, i) => {
                row.forEach((val, j) => {
                    const cell = XLSX.utils.encode_cell({ r: i, c: 10 + j })
                    if (val === undefined) return
                    ws[cell] = { v: val === null ? 0 : val, t: typeof val === 'number' ? 'n' : 's' }
                })
            })
            ws['N11'] = { f: 'N2+N3+N4+N5+N6+N7+N8+N9', t: 'n' }
            ws['N20'] = { f: 'N14+N15+N16', t: 'n' }
            ws['N21'] = { f: 'N11-N20', t: 'n' }
            const ref = XLSX.utils.decode_range(ws['!ref'] || `A1:I${diasMes + 1}`)
            ref.e.c = Math.max(ref.e.c, 13); ref.e.r = Math.max(ref.e.r, 22)
            ws['!ref'] = XLSX.utils.encode_range(ref)
            ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 2 }, { wch: 9 }, { wch: 9 }, { wch: 16 }, { wch: 2 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]
            XLSX.utils.book_append_sheet(wb, ws, colab.nome.substring(0, 31))
        }

        // Aba Geral
        const rowsGeral = [['COLABORADOR', 'CARGO', 'DIAS TRAB.', 'HORAS', 'SALÁRIO FIXO', 'AJUDA CUSTO', 'CACHÊ ESP.', 'CACHÊ CORP.', 'H. EXTRA', 'ADIANT.', 'DESCONTOS', 'TOTAL LÍQUIDO', 'PIX', 'STATUS']]
        colaboradores.forEach(c => {
            const regsC = todosRegs.filter(r => r.colaborador_id === c.id)
            const lancsC = todosLancs.filter(l => l.colaborador_id === c.id)
            const calc = calcularTotal(c, regsC, lancsC)
            const fech = fechamentos.find(f => f.colaborador_id === c.id)
            rowsGeral.push([c.nome, c.cargo || '', calc.dias, Number(calc.horas.toFixed(1)), calc.salario, calc.ajuda, calc.cE, calc.cC, calc.hExtra, calc.adiant, calc.desc, calc.total, c.pix || '', fech?.aprovado ? 'APROVADO' : 'PENDENTE'])
        })
        const nr = rowsGeral.length
        rowsGeral.push(['TOTAL', '', '', '', { f: `SUM(E2:E${nr})` }, { f: `SUM(F2:F${nr})` }, { f: `SUM(G2:G${nr})` }, { f: `SUM(H2:H${nr})` }, { f: `SUM(I2:I${nr})` }, { f: `SUM(J2:J${nr})` }, { f: `SUM(K2:K${nr})` }, { f: `SUM(L2:L${nr})` }, '', ''])
        const wsGeral = XLSX.utils.aoa_to_sheet(rowsGeral)
        wsGeral['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 }]
        XLSX.utils.book_append_sheet(wb, wsGeral, 'Geral')

        XLSX.writeFile(wb, `fechamento_${mesNome}_${ano}.xlsx`)
        setExportandoFech(false)
    }

    function abrirModalDia(dia) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        setModalDia({ dia, data: dataStr })
        setFormSol({ entrada: '', saida: '', justificativa: '' })
        setSucessoSol(false)
    }

    async function enviarSolicitacao() {
        if (!formSol.justificativa.trim()) return
        setEnviandoSol(true)

        const { data, error } = await supabase.from('solicitacoes_correcao').insert({
            colaborador_id: usuario.id,
            empresa_id: usuario.empresa_id,
            data: modalDia.data,
            entrada_solicitada: formSol.entrada || null,
            saida_solicitada: formSol.saida || null,
            justificativa: formSol.justificativa,
            status: 'pendente'
        })

        

        setSucessoSol(true)
        setEnviandoSol(false)
        carregar(usuario.id)
    }

    return (
        <div className="space-y-4">

            {/* Seletor colaborador (admin) */}
            {isAdmin && (
                <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-wrap gap-3 items-center">
                    <label className="text-gray-400 text-sm">Visualizando:</label>
                    <select className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-green-500 cursor-pointer"
                        value={colaboradorSel?.id || ''}
                        onChange={e => setColaboradorSel(colaboradores.find(c => c.id === e.target.value))}>
                        {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                </div>
            )}

            {/* Calendário */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => mudarMes(-1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors text-lg">‹</button>
                    <h2 className="text-white font-bold text-lg capitalize">{nomeMes}</h2>
                    <button onClick={() => mudarMes(1)} disabled={mes === hoje.getMonth() && ano === hoje.getFullYear()}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 cursor-pointer transition-colors text-lg">›</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-gray-400 text-xs mb-1">Dias trabalhados</p>
                        <p className="text-white text-2xl font-bold">{diasTrabalhados}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 text-center">
                        <p className="text-gray-400 text-xs mb-1">Total de horas</p>
                        <p className="text-white text-2xl font-bold">{totalHoras.toFixed(1)}h</p>
                    </div>
                </div>
                {loading ? <p className="text-gray-500 text-center py-8">Carregando...</p> : (
                    <>
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                <div key={d} className="text-center text-gray-500 text-xs py-1">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`v${i}`} />)}
                            {Array.from({ length: diasNoMes }).map((_, i) => {
                                const dia = i + 1
                                const reg = getRegistro(dia)
                                const sol = getSolicitacao(dia)
                                const util = ehUtil(dia)
                                const passado = ehPassado(dia)
                                const isHoje = dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()
                                let bg = 'bg-gray-800', textColor = 'text-gray-500', cursor = ''
                                if (!passado) { textColor = 'text-gray-600' }
                                else if (reg?.entrada && reg?.saida) { bg = 'bg-green-500 bg-opacity-15'; textColor = 'text-green-400'; cursor = !isAdmin ? 'cursor-pointer hover:bg-opacity-25' : '' }
                                else if (reg?.entrada && !reg?.saida) { bg = 'bg-yellow-500 bg-opacity-15'; textColor = 'text-yellow-400'; cursor = !isAdmin ? 'cursor-pointer hover:bg-opacity-25' : '' }
                                else if (util && passado) { bg = 'bg-red-500 bg-opacity-10'; textColor = 'text-red-400'; cursor = !isAdmin ? 'cursor-pointer hover:bg-opacity-20' : '' }
                                return (
                                    <div key={dia} onClick={() => !isAdmin && passado && abrirModalDia(dia)}
                                        className={`relative rounded-xl p-1.5 text-center transition-all ${bg} ${cursor} ${isHoje ? 'ring-2 ring-green-500 ring-opacity-60' : ''}`}>
                                        <p className={`text-xs font-bold ${textColor}`}>{dia}</p>
                                        {reg?.entrada && <p className="text-green-400 text-[9px] leading-tight">{horaFmt(reg.entrada)}</p>}
                                        {reg?.saida && <p className="text-red-400 text-[9px] leading-tight">{horaFmt(reg.saida)}</p>}
                                        {sol && <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${sol.status === 'aprovado' ? 'bg-green-400' : sol.status === 'recusado' ? 'bg-red-400' : 'bg-yellow-400'}`} />}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Completo</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Sem saída</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Ausente</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Correção pendente</span>
                        </div>
                    </>
                )}
            </div>

            {/* Lançamentos do colaborador selecionado (admin) */}
            {isAdmin && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-bold">Lançamentos — {colaboradorSel?.nome || ''}</h3>
                        <button onClick={abrirModalLanc}
                            className="bg-green-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-green-600 cursor-pointer transition-colors text-sm w-auto">
                            + Lançamento
                        </button>
                    </div>
                    {lancamentos.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">Nenhum lançamento neste mês</p>
                    ) : (
                        <div className="space-y-2">
                            {lancamentos.map(l => (
                                <div key={l.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-white text-sm font-semibold">
                                            {TIPOS_LANCAMENTO.find(t => t.value === l.tipo)?.label || l.tipo}
                                            {l.parcelas > 1 && <span className="text-gray-500 text-xs ml-2">({l.parcela_atual}/{l.parcelas})</span>}
                                        </p>
                                        {l.descricao && <p className="text-gray-400 text-xs">{l.descricao}</p>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className={`font-bold text-sm ${l.tipo === 'adiantamento' || l.tipo === 'desconto' ? 'text-red-400' : 'text-green-400'}`}>
                                            {l.tipo === 'adiantamento' || l.tipo === 'desconto' ? '-' : '+'}{brl(Number(l.valor) * Number(l.quantidade || 1))}
                                        </p>
                                        <button onClick={() => excluirLancamento(l.id)}
                                            className="text-gray-600 hover:text-red-400 cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none transition-colors text-xl leading-none">×</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Registros (colaborador) */}
            {!isAdmin && registros.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-white font-bold mb-4">Registros do mês</h3>
                    <div className="space-y-2">
                        {registros.map(r => (
                            <div key={r.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                                <div>
                                    <p className="text-white text-sm font-semibold">
                                        {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </p>
                                    <p className="text-gray-400 text-xs mt-0.5">
                                        <span className="text-green-400">{horaFmt(r.entrada)}</span>{' → '}
                                        <span className={r.saida ? 'text-red-400' : 'text-gray-500'}>{horaFmt(r.saida)}</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    {r.horas_trabalhadas
                                        ? <p className="text-white font-bold text-sm">{Number(r.horas_trabalhadas).toFixed(1)}h</p>
                                        : <p className="text-gray-500 text-xs">Em aberto</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── FECHAMENTO DO MÊS (admin) ─────────────────────────────── */}
            {isAdmin && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-white font-bold text-lg">Fechamento do Mês</h3>
                            <p className="text-gray-500 text-xs mt-0.5 capitalize">{nomeMes} — aprove cada colaborador para liberar o export</p>
                        </div>
                        {todoAprovado && (
                            <button onClick={exportarFechamento} disabled={exportandoFech}
                                className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl hover:bg-green-600 cursor-pointer transition-colors text-sm w-auto disabled:opacity-50">
                                {exportandoFech ? 'Gerando...' : '⬇ Exportar Fechamento'}
                            </button>
                        )}
                    </div>

                    {!todoAprovado && (
                        <p className="text-yellow-400 text-xs mb-4">
                            {fechamentos.filter(f => f.aprovado).length}/{colaboradores.length} aprovados — aprove todos para exportar
                        </p>
                    )}

                    {loadingFechamento ? (
                        <p className="text-gray-500 text-center py-6">Carregando...</p>
                    ) : (
                        <div className="space-y-3 mt-4">
                            {colaboradores.map(colab => {
                                const regsC = todosRegs.filter(r => r.colaborador_id === colab.id)
                                const lancsC = todosLancs.filter(l => l.colaborador_id === colab.id)
                                const calc = calcularTotal(colab, regsC, lancsC)
                                const fech = fechamentos.find(f => f.colaborador_id === colab.id)
                                const aprovado = fech?.aprovado || false
                                const aberto = expandido === colab.id

                                return (
                                    <div key={colab.id} className={`rounded-2xl border transition-all ${aprovado ? 'border-green-500 border-opacity-40 bg-green-500 bg-opacity-5' : 'border-gray-700 bg-gray-800'}`}>
                                        {/* Header do colaborador */}
                                        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandido(aberto ? null : colab.id)}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-white font-bold text-sm">{colab.nome}</p>
                                                    {aprovado && <span className="text-xs font-bold text-green-400 bg-green-500 bg-opacity-20 px-2 py-0.5 rounded-full">✓ Aprovado</span>}
                                                </div>
                                                <p className="text-gray-400 text-xs">{colab.cargo || '—'} · {calc.dias} dias · {calc.horas.toFixed(1)}h</p>
                                            </div>
                                            <div className="text-right mr-2">
                                                <p className="text-white font-bold">{brl(calc.total)}</p>
                                                <p className="text-gray-500 text-xs">total líquido</p>
                                            </div>
                                            <span className={`text-gray-400 text-lg transition-transform ${aberto ? 'rotate-90' : ''}`}>›</span>
                                        </div>

                                        {/* Expandido */}
                                        {aberto && (
                                            <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-3">
                                                {/* Resumo financeiro */}
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {[
                                                        ['Salário fixo', calc.salario],
                                                        ['Ajuda de custo', calc.ajuda],
                                                        ['Cachê especial', calc.cE],
                                                        ['Cachê corporativo', calc.cC],
                                                        ['Horas extra', calc.hExtra],
                                                        ['Adiantamentos', -calc.adiant],
                                                        ['Descontos', -calc.desc],
                                                    ].filter(([, v]) => v !== 0).map(([label, valor]) => (
                                                        <div key={label} className="flex justify-between bg-gray-900 rounded-lg px-3 py-2">
                                                            <span className="text-gray-400">{label}</span>
                                                            <span className={`font-semibold ${valor < 0 ? 'text-red-400' : 'text-white'}`}>{brl(Math.abs(valor))}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Lançamentos */}
                                                {lancsC.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-500 text-xs mb-2">Lançamentos</p>
                                                        <div className="space-y-1">
                                                            {lancsC.map(l => (
                                                                <div key={l.id} className="flex justify-between text-xs bg-gray-900 rounded-lg px-3 py-2">
                                                                    <span className="text-gray-300">{TIPOS_LANCAMENTO.find(t => t.value === l.tipo)?.label} {l.descricao ? `— ${l.descricao}` : ''}</span>
                                                                    <span className={l.tipo === 'adiantamento' || l.tipo === 'desconto' ? 'text-red-400' : 'text-green-400'}>
                                                                        {l.tipo === 'adiantamento' || l.tipo === 'desconto' ? '-' : '+'}{brl(Number(l.valor) * Number(l.quantidade || 1))}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Total e botão */}
                                                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                                                    <div>
                                                        <p className="text-gray-400 text-xs">Total líquido</p>
                                                        <p className="text-white font-bold text-lg">{brl(calc.total)}</p>
                                                    </div>
                                                    {aprovado ? (
                                                        <button onClick={() => desaprovarColaborador(colab.id)} disabled={aprovando === colab.id}
                                                            className="bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded-xl cursor-pointer hover:bg-gray-600 transition-colors text-sm w-auto disabled:opacity-50">
                                                            Desfazer aprovação
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => aprovarColaborador(colab.id, calc.total)} disabled={aprovando === colab.id}
                                                            className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl cursor-pointer hover:bg-green-600 transition-colors text-sm w-auto disabled:opacity-50">
                                                            {aprovando === colab.id ? 'Aprovando...' : '✓ Aprovar'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal lançamento */}
            {modalLanc && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-md border border-gray-700 max-h-screen overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-white text-lg font-bold">Novo lançamento</h3>
                                <p className="text-gray-500 text-xs mt-0.5 capitalize">{nomeMes}</p>
                            </div>
                            <button onClick={() => setModalLanc(false)} className="text-gray-400 hover:text-white cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none text-2xl leading-none">✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Colaborador */}
                            <div>
                                <label className="text-gray-400 text-xs mb-1 block">Colaborador *</label>
                                <select value={formLanc.colaboradorId} onChange={e => setFormLanc(f => ({ ...f, colaboradorId: e.target.value }))}
                                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500 cursor-pointer">
                                    <option value="">-- Selecione --</option>
                                    {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                            </div>

                            {/* Separador Faturamento / Débito */}
                            <div>
                                <label className="text-gray-400 text-xs mb-2 block">Tipo *</label>

                                <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">💰 Faturamento (soma no salário)</p>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {TIPOS_LANCAMENTO.filter(t => t.grupo === 'fatura').map(t => (
                                        <button key={t.value} type="button"
                                            onClick={() => setFormLanc(f => ({ ...f, tipo: t.value }))}
                                            className={`py-2 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors border w-auto ${formLanc.tipo === t.value
                                                    ? 'bg-green-500 text-white border-green-500'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-green-500'
                                                }`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                <p className="text-gray-500 text-xs mb-1 uppercase tracking-wide">🔻 Débito (desconta do salário)</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {TIPOS_LANCAMENTO.filter(t => t.grupo === 'debito').map(t => (
                                        <button key={t.value} type="button"
                                            onClick={() => setFormLanc(f => ({ ...f, tipo: t.value }))}
                                            className={`py-2 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors border w-auto ${formLanc.tipo === t.value
                                                    ? 'bg-red-500 text-white border-red-500'
                                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-red-400'
                                                }`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Justificativa */}
                            <div>
                                <label className="text-gray-400 text-xs mb-1 block">Justificativa / Descrição *</label>
                                <input value={formLanc.descricao} onChange={e => setFormLanc(f => ({ ...f, descricao: e.target.value }))}
                                    placeholder={
                                        formLanc.tipo === 'adiantamento' ? 'Ex: Emergência, pedido pessoal...' :
                                            formLanc.tipo === 'desconto' ? 'Ex: Falta injustificada, quebra...' :
                                                formLanc.tipo === 'cache_especial' ? 'Ex: Good Times, Timbalada, Seu Jorge...' :
                                                    formLanc.tipo === 'cache_corporativo' ? 'Ex: Evento corporativo XYZ...' :
                                                        formLanc.tipo === 'ferias' ? 'Ex: Férias 2025 — 1/2...' :
                                                            'Descreva o lançamento...'
                                    }
                                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500 placeholder-gray-600" />
                            </div>

                            {/* Data (para adiantamento/desconto) */}
                            {ehDebito(formLanc.tipo) && (
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Data do lançamento</label>
                                    <input type="date" value={formLanc.data} onChange={e => setFormLanc(f => ({ ...f, data: e.target.value }))}
                                        className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
                                </div>
                            )}

                            {/* Valor + Qtd + Parcelas */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Valor (R$) *</label>
                                    <input type="number" value={formLanc.valor} onChange={e => setFormLanc(f => ({ ...f, valor: e.target.value }))} placeholder="0.00"
                                        className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs mb-1 block">Qtd / Dias</label>
                                    <input type="number" value={formLanc.quantidade} onChange={e => setFormLanc(f => ({ ...f, quantidade: e.target.value }))}
                                        className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
                                </div>
                                {ehDebito(formLanc.tipo) && (
                                    <div>
                                        <label className="text-gray-400 text-xs mb-1 block">Parcelas</label>
                                        <input type="number" min="1" value={formLanc.parcelas} onChange={e => setFormLanc(f => ({ ...f, parcelas: e.target.value }))}
                                            className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
                                    </div>
                                )}
                            </div>

                            {/* Preview */}
                            {formLanc.valor && (
                                <div className={`rounded-xl px-4 py-3 flex justify-between items-center ${ehDebito(formLanc.tipo) ? 'bg-red-500 bg-opacity-10 border border-red-500 border-opacity-20' : 'bg-green-500 bg-opacity-10 border border-green-500 border-opacity-20'}`}>
                                    <span className="text-gray-300 text-sm">{ehDebito(formLanc.tipo) ? 'Será debitado' : 'Será faturado'}</span>
                                    <span className={`font-bold text-lg ${ehDebito(formLanc.tipo) ? 'text-red-400' : 'text-green-400'}`}>
                                        {ehDebito(formLanc.tipo) ? '-' : '+'}
                                        {Number(parseFloat(formLanc.valor || 0) * parseFloat(formLanc.quantidade || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                </div>
                            )}

                            {parseInt(formLanc.parcelas) > 1 && ehDebito(formLanc.tipo) && (
                                <p className="text-yellow-400 text-xs">⚠ Debitado em {formLanc.parcelas} meses consecutivos — {Number(parseFloat(formLanc.valor || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por mês.</p>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setModalLanc(false)}
                                className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                            <button onClick={salvarLancamento}
                                disabled={salvandoLanc || !formLanc.colaboradorId || !formLanc.descricao.trim() || !formLanc.valor}
                                className={`flex-1 text-white font-bold py-3 rounded-2xl cursor-pointer disabled:opacity-40 transition-colors ${ehDebito(formLanc.tipo) ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                                {salvandoLanc ? 'Salvando...' : `Salvar ${ehDebito(formLanc.tipo) ? 'débito' : 'faturamento'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal solicitação (colaborador) */}
            {modalDia && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
                        {sucessoSol ? (
                            <div className="text-center py-4">
                                <div className="text-5xl mb-4">✅</div>
                                <h3 className="text-white text-xl font-bold mb-2">Solicitação enviada!</h3>
                                <p className="text-gray-400 text-sm mb-6">O admin será notificado para revisar.</p>
                                <button onClick={() => setModalDia(null)}
                                    className="w-full bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 transition-colors">Fechar</button>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-white text-lg font-bold mb-1">Solicitar correção</h3>
                                <p className="text-gray-400 text-sm mb-5">
                                    {new Date(modalDia.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                                {getSolicitacao(modalDia.dia) ? (
                                    <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-xl p-4 mb-4">
                                        <p className="text-yellow-400 text-sm font-semibold">Você já tem uma solicitação para este dia.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-gray-400 text-xs mb-1 block">Entrada</label>
                                                <input type="time" value={formSol.entrada} onChange={e => setFormSol(f => ({ ...f, entrada: e.target.value }))}
                                                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
                                            </div>
                                            <div>
                                                <label className="text-gray-400 text-xs mb-1 block">Saída</label>
                                                <input type="time" value={formSol.saida} onChange={e => setFormSol(f => ({ ...f, saida: e.target.value }))}
                                                    className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-gray-400 text-xs mb-1 block">Justificativa *</label>
                                            <textarea value={formSol.justificativa} onChange={e => setFormSol(f => ({ ...f, justificativa: e.target.value }))}
                                                placeholder="Ex: Esqueci de bater a saída..." rows={3}
                                                className="w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500 resize-none placeholder-gray-600" />
                                        </div>
                                    </div>
                                )}
                                <div className="flex gap-3 mt-5">
                                    <button onClick={() => setModalDia(null)}
                                        className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                                    {!getSolicitacao(modalDia.dia) && (
                                        <button onClick={enviarSolicitacao} disabled={enviandoSol || !formSol.justificativa.trim()}
                                            className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors">
                                            {enviandoSol ? 'Enviando...' : 'Enviar'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}