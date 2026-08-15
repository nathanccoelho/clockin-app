import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

const TIPOS_EVENTO = [
    { value: 'cache', label: 'Cachê' },
    { value: 'meio_cache', label: 'Meio Cachê' },
    { value: 'dia_trabalhado', label: 'Dia Trabalhado' },
    { value: 'feriado_trabalhado', label: 'Feriado Trabalhado' },
    { value: 'ajuda_custo_extra', label: 'Ajuda de Custo (home office/avulso)' },
]
const TIPOS_DEBITO = [
    { value: 'adiantamento', label: 'Adiantamento' },
    { value: 'desconto', label: 'Desconto' },
]
const TIPOS_CREDITO = [
    { value: 'ferias', label: 'Férias' },
    { value: 'decimo_terceiro', label: 'Décimo Terceiro' },
    { value: 'bonus', label: 'Bônus' },
    { value: 'ajuda_moradia', label: 'Ajuda Moradia' },
]

function corEvento(tipo) {
    const mapa = {
        cache: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
        meio_cache: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
        dia_trabalhado: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
        feriado_trabalhado: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
        ajuda_custo_extra: { bg: 'bg-teal-500/20', text: 'text-teal-400' },
    }
    return mapa[tipo] || { bg: 'bg-gray-500/20', text: 'text-gray-400' }
}
function mascaraMoeda(v) { const num = String(v).replace(/\D/g, ''); if (!num) return ''; return (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function desmascaraMoeda(v) { return Number(String(v).replace(/[R$\s.]/g, '').replace(',', '.')) || 0 }
function numParaMoeda(v) { if (!v) return ''; return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function RelatorioMensal({ usuario }) {
    const hoje = new Date()
    const isAdmin = usuario.perfil === 'admin' || usuario.super_admin
    const [mes, setMes] = useState(hoje.getMonth())
    const [ano, setAno] = useState(hoje.getFullYear())
    const [colaboradores, setColaboradores] = useState([])
    const [escalas, setEscalas] = useState([])
    const [colaboradorSel, setColaboradorSel] = useState(null)
    const [registros, setRegistros] = useState([])
    const [lancamentos, setLancamentos] = useState([])
    const [eventos, setEventos] = useState([])
    const [solicitacoes, setSolicitacoes] = useState([])
    const [faltas, setFaltas] = useState([])
    const [loading, setLoading] = useState(true)
    const [todosRegs, setTodosRegs] = useState([])
    const [todosLancs, setTodosLancs] = useState([])
    const [todosEventos, setTodosEventos] = useState([])
    const [todasFaltas, setTodasFaltas] = useState([])
    const [fechamentos, setFechamentos] = useState([])
    const [fechamentoAtual, setFechamentoAtual] = useState(null)
    const [saldoAnteriorBanco, setSaldoAnteriorBanco] = useState(0)
    const [expandido, setExpandido] = useState(null)
    const [loadingFechamento, setLoadingFechamento] = useState(false)
    const [aprovando, setAprovando] = useState(null)
    const [modalEvento, setModalEvento] = useState(null)
    const [formEvento, setFormEvento] = useState({ tipo: 'cache', descricao: '', valor: '' })
    const [salvandoEvento, setSalvandoEvento] = useState(false)
    const [modalLanc, setModalLanc] = useState(false)
    const [tipoModalLanc, setTipoModalLanc] = useState('debito')
    const [formLanc, setFormLanc] = useState({ colaboradorId: '', tipo: 'adiantamento', descricao: '', valor: '', parcelas: '1', data: '' })
    const [salvandoLanc, setSalvandoLanc] = useState(false)
    const [modalDia, setModalDia] = useState(null)
    const [formSol, setFormSol] = useState({ entrada: '', saida: '', justificativa: '' })
    const [enviandoSol, setEnviandoSol] = useState(false)
    const [sucessoSol, setSucessoSol] = useState(false)
    const [modalExport, setModalExport] = useState(false)
    const [exportColabs, setExportColabs] = useState([])
    const [exportMes, setExportMes] = useState(hoje.getMonth())
    const [exportAno, setExportAno] = useState(hoje.getFullYear())
    const [exportando, setExportando] = useState(false)
    const [eventosParaAprovar, setEventosParaAprovar] = useState([])
    const [modalAbono, setModalAbono] = useState(null)
    const [modalExcluirRegistro, setModalExcluirRegistro] = useState(null)
    const [excluindoRegistro, setExcluindoRegistro] = useState(false)
    const [registrosAbertos, setRegistrosAbertos] = useState(false)
    const [modalHistorico, setModalHistorico] = useState(false)
    const [historicoFechamentos, setHistoricoFechamentos] = useState([])
    const [carregandoHistorico, setCarregandoHistorico] = useState(false)
    const [justAbono, setJustAbono] = useState('')
    const [salvandoAbono, setSalvandoAbono] = useState(false)
    const [abaAbono, setAbaAbono] = useState('abonar')
    const [formPontoFalta, setFormPontoFalta] = useState({ entrada: '', saida: '' })
    const [formEventoFalta, setFormEventoFalta] = useState({ tipo: 'cache', descricao: '', valor: '' })

    const colaboradorId = isAdmin ? colaboradorSel?.id : usuario.id
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
    const nomeMes = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const inputCls = 'w-full bg-gray-800 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:border-green-500'

    useEffect(() => { if (isAdmin) carregarColaboradores(); else carregar(usuario.id); carregarEscalas() }, [])
    useEffect(() => { if (colaboradorId) carregar(colaboradorId) }, [mes, ano, colaboradorId])
    useEffect(() => { if (isAdmin && colaboradores.length > 0) { carregarFechamento(); carregarEventosPendentes() } }, [mes, ano, colaboradores])

    async function carregarColaboradores() {
        const { data } = await supabase.from('colaboradores')
            .select('id, nome, cargo, salario_fixo, ajuda_custo_diaria, ajuda_custo_tipo, hora_extra_valor, cache_evento, pix, banco, agencia, conta, escala, escala_id, data_admissao')
            .eq('empresa_id', usuario.empresa_id).eq('status', 'aprovado').order('nome')
        setColaboradores(data || [])
        if (data?.length > 0) setColaboradorSel(data[0])
    }

    async function carregarEscalas() {
        const { data } = await supabase.from('escalas').select('id, horas_diarias_esperadas').eq('empresa_id', usuario.empresa_id)
        setEscalas(data || [])
    }

    function horasEsperadasPara(colab) {
        const escala = escalas.find(e => e.id === colab?.escala_id)
        return Number(escala?.horas_diarias_esperadas) || 9
    }

    async function carregar(colabId) {
        if (!colabId) return
        setLoading(true)
        const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
        const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${new Date(ano, mes + 1, 0).getDate()}`
        const [{ data: regs }, { data: lancs }, { data: evs }, { data: sols }, { data: fts }, { data: fechAtual }] = await Promise.all([
            supabase.from('registros_ponto').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim).order('data'),
            supabase.from('lancamentos').select('*').eq('colaborador_id', colabId).eq('mes', mes + 1).eq('ano', ano).order('criado_em'),
            supabase.from('eventos').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim).order('data'),
            supabase.from('solicitacoes_correcao').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim),
            supabase.from('faltas').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim),
            supabase.from('fechamentos').select('*').eq('colaborador_id', colabId).eq('mes', mes + 1).eq('ano', ano).maybeSingle(),
        ])
        setFechamentoAtual(fechAtual || null)
        setSaldoAnteriorBanco(await buscarSaldoAnterior(colabId))
        const regsLocal = regs || [], ftsLocal = fts || [], evsLocal = evs || []
        const diasMesLocal = new Date(ano, mes + 1, 0).getDate()
        const novasFaltas = []
        const faltasParaRemover = []
        for (let d = 1; d <= diasMesLocal; d++) {
            const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const dow = new Date(ano, mes, d).getDay()
            const passado = new Date(ano, mes, d) < new Date()
            if (dow !== 0 && dow !== 6 && passado) {
                const temReg = regsLocal.find(r => r.data === dataStr && r.entrada)
                const temEvento = evsLocal.find(e => e.data === dataStr && e.status === 'aprovado')
                const faltaExiste = ftsLocal.find(f => f.data === dataStr)
                if (!temReg && !temEvento && !faltaExiste) novasFaltas.push(dataStr)
                if ((temEvento || temReg) && faltaExiste?.status === 'falta') faltasParaRemover.push(faltaExiste.id)
            }
        }
        for (const dataStr of novasFaltas) {
            await supabase.from('faltas').upsert({ colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr, status: 'falta' }, { onConflict: 'colaborador_id,data' })
        }
        for (const faltaId of faltasParaRemover) {
            await supabase.from('faltas').delete().eq('id', faltaId)
        }
        const ftsFinais = (novasFaltas.length > 0 || faltasParaRemover.length > 0 || evsLocal.some(e => e.status === 'aprovado'))
            ? (await supabase.from('faltas').select('*').eq('colaborador_id', colabId).gte('data', inicio).lte('data', fim)).data || []
            : ftsLocal
        setRegistros(regsLocal); setLancamentos(lancs || []); setEventos(evsLocal)
        setSolicitacoes(sols || []); setFaltas(ftsFinais); setLoading(false)
        if ((novasFaltas.length > 0 || faltasParaRemover.length > 0) && isAdmin) setTimeout(() => carregarFechamento(), 300)
    }

    async function carregarFechamento() {
        setLoadingFechamento(true)
        const ids = colaboradores.map(c => c.id)
        const diasMes = new Date(ano, mes + 1, 0).getDate()
        const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
        const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${diasMes}`
        const [{ data: regs }, { data: lancs }, { data: evs }, { data: fechs }, { data: fts }] = await Promise.all([
            supabase.from('registros_ponto').select('*').in('colaborador_id', ids).gte('data', inicio).lte('data', fim),
            supabase.from('lancamentos').select('*').in('colaborador_id', ids).eq('mes', mes + 1).eq('ano', ano),
            supabase.from('eventos').select('*').in('colaborador_id', ids).gte('data', inicio).lte('data', fim),
            supabase.from('fechamentos').select('*').in('colaborador_id', ids).eq('mes', mes + 1).eq('ano', ano),
            supabase.from('faltas').select('*').in('colaborador_id', ids).gte('data', inicio).lte('data', fim),
        ])
        setTodosRegs(regs || []); setTodosLancs(lancs || []); setTodosEventos(evs || [])
        setFechamentos(fechs || []); setTodasFaltas(fts || []); setLoadingFechamento(false)
    }

    async function carregarEventosPendentes() {
        const ids = colaboradores.map(c => c.id)
        const inicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`
        const fim = `${ano}-${String(mes + 1).padStart(2, '0')}-${new Date(ano, mes + 1, 0).getDate()}`
        const { data } = await supabase.from('eventos').select('*, colaboradores(nome)')
            .in('colaborador_id', ids).eq('status', 'pendente').gte('data', inicio).lte('data', fim)
        setEventosParaAprovar(data || [])
    }

    function mudarMes(delta) { const d = new Date(ano, mes + delta); setMes(d.getMonth()); setAno(d.getFullYear()) }
    function getRegistro(dia) { const s = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; return registros.find(r => r.data === s) || null }
    function getEvento(dia) { const s = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; return eventos.find(e => e.data === s) || null }
    function getSolicitacao(dia) { const s = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; return solicitacoes.find(r => r.data === s) || null }
    function getFalta(dia, faltasArr) { const s = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`; return (faltasArr || faltas).find(f => f.data === s) || null }
    function ehUtil(dia) { const d = new Date(ano, mes, dia).getDay(); return d !== 0 && d !== 6 }
    function ehPassado(dia) {
        const d = new Date(ano, mes, dia)
        const o = new Date()
        o.setHours(23, 59, 59)
        return d <= o
    }
    function horaFmt(iso) { if (!iso) return '--:--'; if (iso.length <= 8) return iso.slice(0, 5); return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    function horaParaInput(iso) { if (!iso) return ''; if (iso.length <= 8) return iso.slice(0, 5); return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    function brl(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

    function valorParaTipo(tipo, colab) {
        const sal = Number(colab?.salario_fixo || 0)
        if (tipo === 'cache') return colab?.cache_evento ? numParaMoeda(colab.cache_evento) : ''
        if (tipo === 'meio_cache') return colab?.cache_evento ? numParaMoeda(Number(colab.cache_evento) / 2) : ''
        if (tipo === 'dia_trabalhado' || tipo === 'feriado_trabalhado') return sal ? numParaMoeda(sal / 30) : ''
        if (tipo === 'ajuda_custo_extra') return colab?.ajuda_custo_diaria ? numParaMoeda(colab.ajuda_custo_diaria) : ''
        return ''
    }

    const totalHoras = registros.reduce((a, r) => a + (r.horas_trabalhadas || 0), 0)
    const diasTrabalhados = registros.filter(r => r.entrada).length

    function somaEventos(tipo, evs) { return (evs || eventos).filter(e => e.tipo === tipo && e.status === 'aprovado').reduce((a, e) => a + Number(e.valor || 0), 0) }
    function countEventos(tipo, evs) { return (evs || eventos).filter(e => e.tipo === tipo && e.status === 'aprovado').length }
    function somaLanc(tipo, lancs) { return (lancs || lancamentos).filter(l => l.tipo === tipo).reduce((a, l) => a + Number(l.valor || 0) * Number(l.quantidade || 1), 0) }

    function calcularTotal(colab, regsC, lancsC, evsC, faltasC, pagarHoraExtra, descontarHoraMenos) {
        const dias = regsC.filter(r => r.entrada).length
        const horas = regsC.reduce((a, r) => a + (r.horas_trabalhadas || 0), 0)
        const salario = Number(colab.salario_fixo || 0)
        const ajudaValor = Number(colab.ajuda_custo_diaria || 0)
        const cache = somaEventos('cache', evsC); const nCache = countEventos('cache', evsC)
        const mCache = somaEventos('meio_cache', evsC); const nMCache = countEventos('meio_cache', evsC)
        const diaTrab = somaEventos('dia_trabalhado', evsC); const nDiaTrab = countEventos('dia_trabalhado', evsC)
        const ferTrab = somaEventos('feriado_trabalhado', evsC); const nFerTrab = countEventos('feriado_trabalhado', evsC)
        const ajudaExtra = somaEventos('ajuda_custo_extra', evsC); const nAjudaExtra = countEventos('ajuda_custo_extra', evsC)
        const fer = somaLanc('ferias', lancsC); const dec = somaLanc('decimo_terceiro', lancsC)
        const bonus = somaLanc('bonus', lancsC); const moradia = somaLanc('ajuda_moradia', lancsC)

        // Banco de horas: compara cada dia com registro completo (entrada + saída)
        // contra as horas esperadas da escala do colaborador. As horas a mais e a
        // menos são somadas SEPARADAS (não se cancelam automaticamente).
        // Cada uma tem seu próprio interruptor: pagar/descontar em dinheiro, ou deixar
        // no banco de horas (só informativo, some pro saldo acumulado do mês seguinte).
        const horasEsperadasDia = horasEsperadasPara(colab)
        // Dias marcados como Cachê/Meio Cachê não entram no banco de horas — são pagos à
        // parte, valor fixo, independente de quantas horas trabalhou naquele dia.
        const diasComCache = new Set(evsC.filter(e => e.status === 'aprovado' && (e.tipo === 'cache' || e.tipo === 'meio_cache')).map(e => e.data))
        let bancoHorasExtras = 0, bancoHorasFaltantes = 0
        regsC.forEach(r => {
            if (r.entrada && r.saida && r.horas_trabalhadas != null && !diasComCache.has(r.data)) {
                const diff = Number(r.horas_trabalhadas) - horasEsperadasDia
                if (diff > 0) bancoHorasExtras += diff
                else bancoHorasFaltantes += Math.abs(diff)
            }
        })
        bancoHorasExtras = Number(bancoHorasExtras.toFixed(2))
        bancoHorasFaltantes = Number(bancoHorasFaltantes.toFixed(2))
        const valorHora = Number(colab.hora_extra_valor || 0)
        const hExtra = pagarHoraExtra ? Number((bancoHorasExtras * valorHora).toFixed(2)) : 0
        const descontoHorasMenos = descontarHoraMenos ? Number((bancoHorasFaltantes * valorHora).toFixed(2)) : 0

        const adiant = somaLanc('adiantamento', lancsC); const desc = somaLanc('desconto', lancsC)
        let diasUteisMes = 0
        for (let d = 1; d <= diasNoMes; d++) { const dow = new Date(ano, mes, d).getDay(); if (dow !== 0 && dow !== 6) diasUteisMes++ }
        const faltasNaoAbonadas = (faltasC || []).filter(f => f.status === 'falta').length
        const descontoFalta = salario > 0 && diasUteisMes > 0 ? (salario / diasUteisMes) * faltasNaoAbonadas : 0
        // Ajuda de custo: se for "por dia", já nasce proporcional (só conta dias com entrada).
        // Se for "fixo", desconta proporcionalmente pelas faltas não abonadas do mês.
        // "ajudaExtra" é um crédito avulso (ex: home office) lançado manualmente via evento,
        // some da conta de dias — soma direto, não depende de ter batido ponto naquele dia.
        const ajudaBase = (colab.ajuda_custo_tipo === 'por_dia' ? ajudaValor * dias : ajudaValor) + ajudaExtra
        const descontoAjudaFalta = colab.ajuda_custo_tipo === 'fixo' && ajudaValor > 0 && diasUteisMes > 0
            ? (ajudaValor / diasUteisMes) * faltasNaoAbonadas : 0
        const ajuda = Math.max(0, ajudaBase - descontoAjudaFalta)
        const total = salario + ajuda + cache + mCache + diaTrab + ferTrab + fer + dec + bonus + moradia + hExtra - adiant - desc - descontoFalta - descontoHorasMenos
        return { dias, horas, salario, ajuda, ajudaExtra, nAjudaExtra, descontoAjudaFalta, cache, nCache, mCache, nMCache, diaTrab, nDiaTrab, ferTrab, nFerTrab, fer, dec, bonus, moradia, hExtra, descontoHorasMenos, bancoHorasExtras, bancoHorasFaltantes, pagarHoraExtra: !!pagarHoraExtra, descontarHoraMenos: !!descontarHoraMenos, adiant, desc, faltasNaoAbonadas, descontoFalta, diasUteisMes, total }
    }

    async function excluirRegistroPonto() {
        if (!modalExcluirRegistro) return
        setExcluindoRegistro(true)
        await supabase.from('registros_ponto').delete().eq('id', modalExcluirRegistro.id)
        setModalExcluirRegistro(null); setExcluindoRegistro(false)
        const colabId = isAdmin ? colaboradorSel?.id : usuario.id
        carregar(colabId); if (isAdmin) carregarFechamento()
    }

    async function sincronizarFaltas(colabId, regsC, faltasC) {
        for (let d = 1; d <= diasNoMes; d++) {
            const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const dow = new Date(ano, mes, d).getDay()
            const passado = new Date(ano, mes, d) <= new Date()
            if (dow !== 0 && dow !== 6 && passado) {
                const reg = regsC.find(r => r.data === dataStr)
                const faltaExiste = faltasC.find(f => f.data === dataStr)
                if (!reg?.entrada && !faltaExiste) {
                    await supabase.from('faltas').upsert({ colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr, status: 'falta' }, { onConflict: 'colaborador_id,data' })
                } else if (reg?.entrada && faltaExiste?.status === 'falta') {
                    // O colaborador bateu o ponto depois que a falta foi gerada — remove a falta desatualizada.
                    await supabase.from('faltas').delete().eq('id', faltaExiste.id)
                }
            }
        }
        carregar(colabId); if (isAdmin) carregarFechamento()
    }

    async function abonarFalta(faltaId, justificativa) {
        setSalvandoAbono(true)
        await supabase.from('faltas').update({ status: 'abonada', justificativa, abonado_por: usuario.id, abonado_em: new Date().toISOString() }).eq('id', faltaId)
        setSalvandoAbono(false); setModalAbono(null); setJustAbono('')
        carregar(colaboradorId); carregarFechamento()
    }

    async function salvarPontoFalta() {
        if (!formPontoFalta.entrada) return
        setSalvandoAbono(true)
        const colabId = isAdmin ? colaboradorSel?.id : usuario.id
        const dataStr = modalAbono.falta.data
        let horasTrabalhadas = 0
        if (formPontoFalta.entrada && formPontoFalta.saida) {
            const [hE, mE] = formPontoFalta.entrada.split(':').map(Number)
            const [hS, mS] = formPontoFalta.saida.split(':').map(Number)
            horasTrabalhadas = ((hS * 60 + mS) - (hE * 60 + mE)) / 60
            if (horasTrabalhadas < 0) horasTrabalhadas += 24
        }
        // A coluna é timestamp completo (data + hora), não só hora — precisa juntar com a data da falta.
        const entradaISO = new Date(`${dataStr}T${formPontoFalta.entrada}:00`).toISOString()
        const saidaISO = formPontoFalta.saida ? new Date(`${dataStr}T${formPontoFalta.saida}:00`).toISOString() : null
        // Não usa upsert com onConflict (a tabela não tem essa constraint única) —
        // busca se já existe um registro nesse dia e decide entre update ou insert.
        const { data: existente } = await supabase.from('registros_ponto').select('id').eq('colaborador_id', colabId).eq('data', dataStr).maybeSingle()
        const payload = { colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr, entrada: entradaISO, saida: saidaISO, horas_trabalhadas: horasTrabalhadas }
        const { error } = existente
            ? await supabase.from('registros_ponto').update(payload).eq('id', existente.id)
            : await supabase.from('registros_ponto').insert(payload)
        if (error) { setSalvandoAbono(false); alert('Erro ao salvar o ponto: ' + error.message); return }
        await supabase.from('faltas').delete().eq('id', modalAbono.falta.id)
        setSalvandoAbono(false); setModalAbono(null)
        carregar(colabId); if (isAdmin) carregarFechamento()
    }

    async function salvarEventoFalta() {
        if (!formEventoFalta.valor) return
        setSalvandoAbono(true)
        const colabId = isAdmin ? colaboradorSel?.id : usuario.id
        await supabase.from('eventos').insert({ colaborador_id: colabId, empresa_id: usuario.empresa_id, data: modalAbono.falta.data, tipo: formEventoFalta.tipo, descricao: formEventoFalta.descricao.trim() || null, valor: desmascaraMoeda(formEventoFalta.valor), status: 'aprovado', criado_por: 'admin' })
        await supabase.from('faltas').delete().eq('id', modalAbono.falta.id)
        setSalvandoAbono(false); setModalAbono(null)
        carregar(colabId); if (isAdmin) carregarFechamento()
    }

    async function desfazerAbono(faltaId) {
        await supabase.from('faltas').update({ status: 'falta', justificativa: null, abonado_por: null, abonado_em: null }).eq('id', faltaId)
        carregar(colaboradorId); carregarFechamento()
    }

    async function salvarEvento() {
        if (!isAdmin && formEvento.tipo !== 'dia_normal' && !formEvento.valor) return
        setSalvandoEvento(true)
        const colabId = isAdmin ? colaboradorSel?.id : usuario.id
        const dataStr = modalEvento.data

        // Admin marcando falta manualmente — grava na tabela de faltas e para por aqui
        // (não mexe em ponto nem em eventos, e ignora os campos de horário).
        if (isAdmin && formEvento.tipo === 'falta') {
            await supabase.from('faltas').upsert({ colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr, status: 'falta' }, { onConflict: 'colaborador_id,data' })
            setSalvandoEvento(false); setModalEvento(null); carregar(colabId); carregarFechamento()
            return
        }

        // Admin corrigindo o horário do dia — aplica direto no registro de ponto,
        // sem precisar de aprovação (a aprovação é só pra quando quem edita NÃO é admin).
        if (isAdmin && (formEvento.entrada || formEvento.saida)) {
            let horasTrabalhadas = null
            if (formEvento.entrada && formEvento.saida) {
                const [hE, mE] = formEvento.entrada.split(':').map(Number)
                const [hS, mS] = formEvento.saida.split(':').map(Number)
                horasTrabalhadas = ((hS * 60 + mS) - (hE * 60 + mE)) / 60
                if (horasTrabalhadas < 0) horasTrabalhadas += 24
            }
            const entradaISO = formEvento.entrada ? new Date(`${dataStr}T${formEvento.entrada}:00`).toISOString() : null
            const saidaISO = formEvento.saida ? new Date(`${dataStr}T${formEvento.saida}:00`).toISOString() : null
            const { data: existente } = await supabase.from('registros_ponto').select('id').eq('colaborador_id', colabId).eq('data', dataStr).maybeSingle()
            const payloadPonto = { colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr, entrada: entradaISO, saida: saidaISO, horas_trabalhadas: horasTrabalhadas }
            if (existente) await supabase.from('registros_ponto').update(payloadPonto).eq('id', existente.id)
            else await supabase.from('registros_ponto').insert(payloadPonto)
            // Se tinha falta marcada nesse dia, remove — já que agora tem ponto registrado.
            await supabase.from('faltas').delete().eq('colaborador_id', colabId).eq('data', dataStr).eq('status', 'falta')
        }

        // Se não é dia_normal/falta, salva o evento — exceto quando é colaborador pedindo
        // JUNTO com correção de horário (nesse caso, tudo fica dentro da solicitação abaixo,
        // e o admin cria o evento na hora de aprovar, já com as infos certas).
        const enviaComoSolicitacao = !isAdmin && (formEvento.entrada || formEvento.saida)
        let erroEvento = null
        if (formEvento.tipo !== 'dia_normal' && formEvento.tipo !== 'falta' && !enviaComoSolicitacao) {
            const payload = { colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr, tipo: formEvento.tipo, descricao: formEvento.descricao.trim() || null, valor: desmascaraMoeda(formEvento.valor), status: isAdmin ? 'aprovado' : 'pendente', criado_por: isAdmin ? 'admin' : 'colaborador' }
            const { error } = modalEvento.eventoExistente
                ? await supabase.from('eventos').update(payload).eq('id', modalEvento.eventoExistente.id)
                : await supabase.from('eventos').insert(payload)
            if (error) erroEvento = error.message
        }

        // Colaborador (não-admin) informando horário — vira solicitação, precisa de aprovação do admin.
        // Guarda o tipo/valor do evento escolhido de forma estruturada, pra tela de aprovação
        // já vir com tudo certinho, sem o admin ter que reconstruir a partir do texto.
        let erroSolicitacao = null
        if (enviaComoSolicitacao) {
            const justificativa = formEvento.tipo === 'dia_normal'
                ? 'Correção de horário solicitada pelo colaborador'
                : `Horário informado junto ao evento (${TIPOS_EVENTO.find(t => t.value === formEvento.tipo)?.label || formEvento.tipo})`
            const { error } = await supabase.from('solicitacoes_correcao').upsert({
                colaborador_id: colabId, empresa_id: usuario.empresa_id, data: dataStr,
                entrada_solicitada: formEvento.entrada || null, saida_solicitada: formEvento.saida || null,
                tipo_evento: formEvento.tipo !== 'dia_normal' ? formEvento.tipo : null,
                descricao_evento: formEvento.descricao.trim() || null,
                valor_evento: formEvento.tipo !== 'dia_normal' ? desmascaraMoeda(formEvento.valor) : null,
                justificativa, status: 'pendente'
            }, { onConflict: 'colaborador_id,data' })
            if (error) erroSolicitacao = error.message
        }

        setSalvandoEvento(false)
        if (erroEvento) { alert('Erro ao salvar o evento: ' + erroEvento); return }
        if (erroSolicitacao) { alert('Não foi possível enviar a solicitação: ' + erroSolicitacao + '\n\nAvise o admin — pode ser preciso ajustar uma configuração no banco de dados.'); return }
        setModalEvento(null); carregar(colabId); if (isAdmin) carregarFechamento()
    }

    async function excluirEvento(id) { await supabase.from('eventos').delete().eq('id', id); carregar(colaboradorId); if (isAdmin) { carregarFechamento(); carregarEventosPendentes() } }
    async function aprovarEvento(id) { await supabase.from('eventos').update({ status: 'aprovado', aprovado_por: usuario.id, aprovado_em: new Date().toISOString() }).eq('id', id); carregarEventosPendentes(); carregarFechamento(); carregar(colaboradorId) }
    async function recusarEvento(id) { await supabase.from('eventos').update({ status: 'recusado' }).eq('id', id); carregarEventosPendentes(); carregarFechamento() }

    async function salvarLancamento() {
        if (!formLanc.colaboradorId || !formLanc.descricao.trim() || !formLanc.valor) return
        setSalvandoLanc(true)
        const valor = desmascaraMoeda(formLanc.valor)
        const parcelas = parseInt(formLanc.parcelas) || 1
        for (let p = 0; p < parcelas; p++) {
            const d = new Date(ano, mes + p)
            await supabase.from('lancamentos').insert({ colaborador_id: formLanc.colaboradorId, empresa_id: usuario.empresa_id, mes: d.getMonth() + 1, ano: d.getFullYear(), tipo: formLanc.tipo, descricao: formLanc.descricao + (formLanc.data ? ` (${formLanc.data})` : ''), valor, quantidade: 1, parcelas, parcela_atual: p + 1 })
        }
        setSalvandoLanc(false); setModalLanc(false); carregar(colaboradorId); carregarFechamento()
    }

    async function excluirLancamento(id) { await supabase.from('lancamentos').delete().eq('id', id); carregar(colaboradorId); carregarFechamento() }

    async function abrirHistorico() {
        if (!colaboradorSel) return
        setModalHistorico(true); setCarregandoHistorico(true)
        const { data } = await supabase.from('fechamentos').select('*').eq('colaborador_id', colaboradorSel.id).order('ano', { ascending: false }).order('mes', { ascending: false })
        setHistoricoFechamentos(data || [])
        setCarregandoHistorico(false)
    }

    async function togglePagarHoraExtra(colabId, valorAtual) {
        const { error } = await supabase.from('fechamentos').upsert({ empresa_id: usuario.empresa_id, colaborador_id: colabId, mes: mes + 1, ano, pagar_hora_extra: !valorAtual }, { onConflict: 'colaborador_id,mes,ano' })
        if (error) { alert('Erro ao salvar: ' + error.message + '\n\nSe a mensagem falar da coluna "pagar_hora_extra", rode o script adicionar-banco-de-horas.sql no Supabase.'); return }
        carregarFechamento()
    }

    async function toggleDescontarHoraMenos(colabId, valorAtual) {
        const { error } = await supabase.from('fechamentos').upsert({ empresa_id: usuario.empresa_id, colaborador_id: colabId, mes: mes + 1, ano, descontar_hora_menos: !valorAtual }, { onConflict: 'colaborador_id,mes,ano' })
        if (error) { alert('Erro ao salvar: ' + error.message); return }
        carregarFechamento()
    }

    async function buscarSaldoAnterior(colabId) {
        let mesAnt = mes, anoAnt = ano
        mesAnt -= 1
        if (mesAnt < 0) { mesAnt = 11; anoAnt -= 1 }
        const { data } = await supabase.from('fechamentos').select('saldo_banco_horas').eq('colaborador_id', colabId).eq('mes', mesAnt + 1).eq('ano', anoAnt).maybeSingle()
        return Number(data?.saldo_banco_horas) || 0
    }

    async function aprovarColaborador(colabId, total, calc) {
        setAprovando(colabId)
        const saldoAnterior = await buscarSaldoAnterior(colabId)
        const saldoNovo = saldoAnterior + (calc?.pagarHoraExtra ? 0 : (calc?.bancoHorasExtras || 0)) - (calc?.descontarHoraMenos ? 0 : (calc?.bancoHorasFaltantes || 0))
        await supabase.from('fechamentos').upsert({ empresa_id: usuario.empresa_id, colaborador_id: colabId, mes: mes + 1, ano, aprovado: true, aprovado_em: new Date().toISOString(), aprovado_por: usuario.id, total_liquido: total, saldo_banco_horas: Number(saldoNovo.toFixed(2)) }, { onConflict: 'colaborador_id,mes,ano' })
        setAprovando(null); carregarFechamento(); setExpandido(null)
    }

    async function desaprovarColaborador(colabId) {
        setAprovando(colabId)
        await supabase.from('fechamentos').upsert({ empresa_id: usuario.empresa_id, colaborador_id: colabId, mes: mes + 1, ano, aprovado: false, aprovado_em: null, aprovado_por: null, total_liquido: 0 }, { onConflict: 'colaborador_id,mes,ano' })
        setAprovando(null); carregarFechamento()
    }

    const todoAprovado = colaboradores.length > 0 && colaboradores.every(c => fechamentos.find(f => f.colaborador_id === c.id && f.aprovado))

    async function enviarSolicitacao() {
        if (!formSol.justificativa.trim()) return
        setEnviandoSol(true)
        const { error } = await supabase.from('solicitacoes_correcao').insert({ colaborador_id: usuario.id, empresa_id: usuario.empresa_id, data: modalDia.data, entrada_solicitada: formSol.entrada || null, saida_solicitada: formSol.saida || null, justificativa: formSol.justificativa, status: 'pendente' })
        if (error) { setEnviandoSol(false); alert('Erro ao enviar solicitação: ' + error.message); return }
        setSucessoSol(true); setEnviandoSol(false); carregar(usuario.id)
    }

    function r2(v) { return Math.round((Number(v) || 0) * 100) / 100 }
    const FORMATO_MOEDA = '"R$" #,##0.00'

    async function exportarXlsx(colabsIds, mesEx, anoEx) {
        setExportando(true)
        const diasMes = new Date(anoEx, mesEx + 1, 0).getDate()
        const inicio = `${anoEx}-${String(mesEx + 1).padStart(2, '0')}-01`
        const fim = `${anoEx}-${String(mesEx + 1).padStart(2, '0')}-${diasMes}`
        const mesNome = new Date(anoEx, mesEx).toLocaleDateString('pt-BR', { month: 'long' })
        const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
        const colabsEx = colaboradores.filter(c => colabsIds.includes(c.id))
        const [{ data: regsEx }, { data: lancsEx }, { data: evsEx }, { data: ftsEx }, { data: fechsEx }] = await Promise.all([
            supabase.from('registros_ponto').select('*').in('colaborador_id', colabsIds).gte('data', inicio).lte('data', fim),
            supabase.from('lancamentos').select('*').in('colaborador_id', colabsIds).eq('mes', mesEx + 1).eq('ano', anoEx),
            supabase.from('eventos').select('*').in('colaborador_id', colabsIds).gte('data', inicio).lte('data', fim).eq('status', 'aprovado'),
            supabase.from('faltas').select('*').in('colaborador_id', colabsIds).gte('data', inicio).lte('data', fim),
            supabase.from('fechamentos').select('*').in('colaborador_id', colabsIds).eq('mes', mesEx + 1).eq('ano', anoEx),
        ])
        const wb = XLSX.utils.book_new()
        for (const colab of colabsEx) {
            const regsC = (regsEx || []).filter(r => r.colaborador_id === colab.id)
            const lancsC = (lancsEx || []).filter(l => l.colaborador_id === colab.id)
            const evsC = (evsEx || []).filter(e => e.colaborador_id === colab.id)
            const ftsC = (ftsEx || []).filter(f => f.colaborador_id === colab.id)
            const pagarHoraExtra = (fechsEx || []).find(f => f.colaborador_id === colab.id)?.pagar_hora_extra || false
            const descontarHoraMenos = (fechsEx || []).find(f => f.colaborador_id === colab.id)?.descontar_hora_menos || false
            const calc = calcularTotal(colab, regsC, lancsC, evsC, ftsC, pagarHoraExtra, descontarHoraMenos)
            const rows = [['DATA', 'DIA', 'STATUS', 'TIPO', 'DESCRIÇÃO', '', 'ENTRADA', 'SAÍDA', 'HORAS']]
            for (let d = 1; d <= diasMes; d++) {
                const dataStr = `${anoEx}-${String(mesEx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const dow = new Date(anoEx, mesEx, d).getDay()
                const reg = regsC.find(r => r.data === dataStr); const ev = evsC.find(e => e.data === dataStr); const ft = ftsC.find(f => f.data === dataStr)
                let horas = '00:00'
                if (reg?.horas_trabalhadas) { const h = Math.floor(reg.horas_trabalhadas); const m = Math.round((reg.horas_trabalhadas % 1) * 60); horas = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
                rows.push([dataStr, diasSemana[dow], reg?.entrada ? 'Sim' : (ft?.status === 'falta' ? 'FALTA' : ft?.status === 'abonada' ? 'Abonada' : ''), ev ? (TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label || ev.tipo) : '', ev?.descricao || '', '', reg?.entrada ? horaFmt(reg.entrada) : '', reg?.saida ? horaFmt(reg.saida) : '', horas])
            }
            const ws = XLSX.utils.aoa_to_sheet(rows)
            const linhaBase = diasMes + 3
            const fin = [
                ['RESUMO FINANCEIRO', '', '', 'QTD', 'VALOR UNIT.', 'TOTAL'],
                ['Salário Fixo', '', '', 1, r2(calc.salario), r2(calc.salario)],
                ['Ajuda de Custo', '', '', 1, r2(calc.ajuda), r2(calc.ajuda)],
                ['Cachê', '', '', calc.nCache, r2(calc.nCache ? calc.cache / calc.nCache : 0), r2(calc.cache)],
                ['Meio Cachê', '', '', calc.nMCache, r2(calc.nMCache ? calc.mCache / calc.nMCache : 0), r2(calc.mCache)],
                ['Dia Trabalhado', '', '', calc.nDiaTrab, r2(calc.nDiaTrab ? calc.diaTrab / calc.nDiaTrab : 0), r2(calc.diaTrab)],
                ['Feriado Trabalhado', '', '', calc.nFerTrab, r2(calc.nFerTrab ? calc.ferTrab / calc.nFerTrab : 0), r2(calc.ferTrab)],
                ['Férias', '', '', '', '', r2(calc.fer)], ['Décimo Terceiro', '', '', '', '', r2(calc.dec)],
                ['Bônus', '', '', '', '', r2(calc.bonus)], ['Ajuda Moradia', '', '', '', '', r2(calc.moradia)],
                ['Horas Extra', '', '', '', '', r2(calc.hExtra)], ['', '', '', '', '', ''],
                ['TOTAL BRUTO', '', '', '', '', r2(calc.salario + calc.ajuda + calc.cache + calc.mCache + calc.diaTrab + calc.ferTrab + calc.fer + calc.dec + calc.bonus + calc.moradia + calc.hExtra)],
                ['', '', '', '', '', ''], ['DESCONTOS', '', '', 'QTD', 'VALOR UNIT.', 'TOTAL'],
                ['Faltas', '', '', calc.faltasNaoAbonadas, r2(calc.diasUteisMes > 0 ? calc.salario / calc.diasUteisMes : 0), r2(-calc.descontoFalta)],
                ['Ajuda de custo (faltas)', '', '', '', '', r2(-calc.descontoAjudaFalta)],
                ['Horas a menos', '', '', calc.bancoHorasFaltantes, colab.hora_extra_valor || 0, r2(-calc.descontoHorasMenos)],
                ['Adiantamento', '', '', '', '', r2(-calc.adiant)], ['Desconto', '', '', '', '', r2(-calc.desc)],
                ['TOTAL DESCONTOS', '', '', '', '', r2(-(calc.descontoFalta + calc.descontoAjudaFalta + calc.descontoHorasMenos + calc.adiant + calc.desc))],
                ['', '', '', '', '', ''], ['TOTAL LÍQUIDO', '', '', '', '', r2(calc.total)],
                ['', '', '', '', '', ''], ['DADOS BANCÁRIOS', '', '', '', '', ''],
                ['Banco', '', '', '', '', colab.banco || ''], ['Agência', '', '', '', '', colab.agencia || ''],
                ['Conta', '', '', '', '', colab.conta || ''], ['PIX', '', '', '', '', colab.pix || ''],
            ]
            fin.forEach((row, i) => { row.forEach((val, j) => {
                const cell = XLSX.utils.encode_cell({ r: linhaBase + i, c: j })
                ws[cell] = { v: val, t: typeof val === 'number' ? 'n' : 's' }
                if (typeof val === 'number' && (j === 4 || j === 5)) ws[cell].z = FORMATO_MOEDA
            }) })
            const ref = XLSX.utils.decode_range(ws['!ref'] || `A1:I${diasMes + 1}`)
            ref.e.r = Math.max(ref.e.r, linhaBase + fin.length); ref.e.c = Math.max(ref.e.c, 5)
            ws['!ref'] = XLSX.utils.encode_range(ref)
            ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 2 }, { wch: 9 }, { wch: 9 }, { wch: 10 }]
            XLSX.utils.book_append_sheet(wb, ws, colab.nome.substring(0, 31))
        }
        if (colabsEx.length > 1) {
            const rowsGeral = [['COLABORADOR', 'CARGO', 'BANCO', 'PIX', 'DIAS', 'HORAS', 'SALÁRIO', 'AJUDA', 'CACHÊS/EXTRAS', 'H.EXTRA', 'FALTAS', 'DESCONTOS', 'TOTAL LÍQUIDO']]
            colabsEx.forEach(c => {
                const regsC = (regsEx || []).filter(r => r.colaborador_id === c.id); const lancsC = (lancsEx || []).filter(l => l.colaborador_id === c.id)
                const evsC = (evsEx || []).filter(e => e.colaborador_id === c.id); const ftsC = (ftsEx || []).filter(f => f.colaborador_id === c.id)
                const pagarHoraExtra = (fechsEx || []).find(f => f.colaborador_id === c.id)?.pagar_hora_extra || false
                const descontarHoraMenos = (fechsEx || []).find(f => f.colaborador_id === c.id)?.descontar_hora_menos || false
                const calc = calcularTotal(c, regsC, lancsC, evsC, ftsC, pagarHoraExtra, descontarHoraMenos)
                rowsGeral.push([c.nome, c.cargo || '', `${c.banco || ''} Ag:${c.agencia || ''} Cc:${c.conta || ''}`, c.pix || '', calc.dias, Number(calc.horas.toFixed(1)), r2(calc.salario), r2(calc.ajuda), r2(calc.cache + calc.mCache + calc.diaTrab + calc.ferTrab + calc.fer + calc.dec + calc.bonus + calc.moradia), r2(calc.hExtra), r2(-calc.descontoFalta), r2(-(calc.descontoAjudaFalta + calc.descontoHorasMenos + calc.adiant + calc.desc)), r2(calc.total)])
            })
            const wsGeral = XLSX.utils.aoa_to_sheet(rowsGeral)
            const colunasMoedaGeral = [6, 7, 8, 9, 10, 11, 12]
            for (let r = 1; r < rowsGeral.length; r++) {
                colunasMoedaGeral.forEach(c => {
                    const cell = XLSX.utils.encode_cell({ r, c })
                    if (wsGeral[cell]) wsGeral[cell].z = FORMATO_MOEDA
                })
            }
            wsGeral['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 20 }, { wch: 6 }, { wch: 7 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }]
            XLSX.utils.book_append_sheet(wb, wsGeral, 'Geral')
        }
        XLSX.writeFile(wb, `relatorio_${mesNome}_${anoEx}.xlsx`)
        setExportando(false); setModalExport(false)
    }

    function clicarDia(dia) {
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        const ev = getEvento(dia); const falta = getFalta(dia, faltas)
        const reg = registros.find(r => r.data === dataStr)
        const horaEntradaAtual = horaParaInput(reg?.entrada)
        const horaSaidaAtual = horaParaInput(reg?.saida)
        const colab = isAdmin ? colaboradorSel : (colaboradores.find(c => c.id === usuario.id) || usuario)
        if (isAdmin && falta) { setModalAbono({ falta }); setJustAbono(falta.justificativa || ''); setAbaAbono('abonar'); setFormPontoFalta({ entrada: '', saida: '' }); setFormEventoFalta({ tipo: 'cache', descricao: '', valor: valorParaTipo('cache', colaboradorSel) }); return }
        if (isAdmin) { setFormEvento({ tipo: ev?.tipo || 'dia_normal', descricao: ev?.descricao || '', valor: ev?.valor ? numParaMoeda(ev.valor) : '', entrada: horaEntradaAtual, saida: horaSaidaAtual }); setModalEvento({ dia, data: dataStr, eventoExistente: ev || null }) }
        else { if (ev) { setFormEvento({ tipo: ev.tipo, descricao: ev.descricao || '', valor: numParaMoeda(ev.valor), entrada: horaEntradaAtual, saida: horaSaidaAtual }); setModalEvento({ dia, data: dataStr, eventoExistente: ev }) } else { setFormEvento({ tipo: 'dia_normal', descricao: '', valor: '', entrada: horaEntradaAtual, saida: horaSaidaAtual }); setModalEvento({ dia, data: dataStr, eventoExistente: null }) } }
    }

    function mudarTipoEvento(tipo) { const colab = isAdmin ? colaboradorSel : usuario; setFormEvento(f => ({ ...f, tipo, valor: valorParaTipo(tipo, colab) })) }
    function abrirModalDebito() { setTipoModalLanc('debito'); setFormLanc({ colaboradorId: colaboradorSel?.id || '', tipo: 'adiantamento', descricao: '', valor: '', parcelas: '1', data: '' }); setModalLanc(true) }
    function abrirModalCredito() {
        const mesAtual = mes + 1; const sugestaoDecimo = (mesAtual === 11 || mesAtual === 12)
        setTipoModalLanc('credito'); setFormLanc({ colaboradorId: colaboradorSel?.id || '', tipo: sugestaoDecimo ? 'decimo_terceiro' : 'ferias', descricao: sugestaoDecimo ? `Décimo Terceiro ${ano}` : '', valor: '', parcelas: '1', data: '' }); setModalLanc(true)
    }
    function valorSugeridoCredito(tipo, colabId) { const colab = colaboradores.find(c => c.id === colabId); if (!colab) return ''; if (tipo === 'decimo_terceiro') return numParaMoeda(Number(colab.salario_fixo || 0) / 12); return '' }

    function LinhaResumo({ label, valor, qtd, unitario }) {
        if (!valor || valor === 0) return null
        return (
            <div className="flex justify-between items-center bg-gray-900 rounded-lg px-3 py-2">
                <div>
                    <span className="text-gray-400 text-xs">{label}</span>
                    {qtd >= 1 && <span className="text-gray-500 text-xs ml-1">— {qtd}x</span>}
                    {qtd >= 1 && unitario && <span className="text-gray-600 text-[10px] ml-1">({brl(unitario)}/un)</span>}
                </div>
                <span className={`font-semibold text-sm ${valor < 0 ? 'text-red-400' : 'text-white'}`}>{valor < 0 ? '-' : ''}{brl(Math.abs(valor))}</span>
            </div>
        )
    }

    // Banco de horas do colaborador (view própria) — segue a permissão "pode_ver_horas",
    // independente do resumo financeiro (pode_ver_resumo).
    function BancoHorasColaborador() {
        const colab = { ...usuario, salario_fixo: usuario.salario_fixo || 0, ajuda_custo_diaria: usuario.ajuda_custo_diaria || 0, ajuda_custo_tipo: usuario.ajuda_custo_tipo || 'fixo', hora_extra_valor: usuario.hora_extra_valor || 0, cache_evento: usuario.cache_evento || 0 }
        const calc = calcularTotal(colab, registros, lancamentos, eventos, faltas, fechamentoAtual?.pagar_hora_extra || false, fechamentoAtual?.descontar_hora_menos || false)
        if (saldoAnteriorBanco === 0 && calc.bancoHorasExtras === 0 && calc.bancoHorasFaltantes === 0) return null
        return (
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h3 className="text-white font-bold mb-4">Banco de horas</h3>
                {saldoAnteriorBanco !== 0 && <p className="text-gray-400 text-xs mb-3">Saldo do mês anterior: <span className={`font-semibold ${saldoAnteriorBanco > 0 ? 'text-green-400' : 'text-red-400'}`}>{saldoAnteriorBanco > 0 ? '+' : ''}{saldoAnteriorBanco.toFixed(1)}h</span></p>}
                {(calc.bancoHorasExtras > 0 || calc.bancoHorasFaltantes > 0) && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2"><p className="text-green-400 text-xs">Horas a mais</p><p className="text-white font-bold text-sm">+{calc.bancoHorasExtras.toFixed(1)}h</p></div>
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2"><p className="text-yellow-400 text-xs">Horas a menos</p><p className="text-white font-bold text-sm">-{calc.bancoHorasFaltantes.toFixed(1)}h</p></div>
                        <div className={`rounded-xl px-3 py-2 border ${(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                            <p className={`text-xs ${(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? 'text-green-400' : 'text-red-400'}`}>Saldo do mês</p>
                            <p className={`font-bold text-sm ${(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? '+' : ''}{(calc.bancoHorasExtras - calc.bancoHorasFaltantes).toFixed(1)}h</p>
                        </div>
                    </div>
                )}
                {calc.bancoHorasExtras > 0 && <p className="text-gray-500 text-xs mb-2">{calc.pagarHoraExtra ? '✅ Horas a mais deste mês estão sendo pagas.' : 'ℹ️ Horas a mais deste mês entraram como banco de horas (não pagas em dinheiro).'}</p>}
                {calc.bancoHorasFaltantes > 0 && <p className="text-gray-500 text-xs">{calc.descontarHoraMenos ? '⚠️ Horas a menos deste mês estão sendo descontadas.' : 'ℹ️ Horas a menos deste mês entraram como banco de horas (não descontadas).'}</p>}
            </div>
        )
    }

    // Resumo financeiro do colaborador (view própria)
    function ResumoColaborador() {
        const colab = { ...usuario, salario_fixo: usuario.salario_fixo || 0, ajuda_custo_diaria: usuario.ajuda_custo_diaria || 0, ajuda_custo_tipo: usuario.ajuda_custo_tipo || 'fixo', hora_extra_valor: usuario.hora_extra_valor || 0, cache_evento: usuario.cache_evento || 0 }
        const calc = calcularTotal(colab, registros, lancamentos, eventos, faltas, fechamentoAtual?.pagar_hora_extra || false, fechamentoAtual?.descontar_hora_menos || false)
        const bruto = calc.salario + calc.ajuda + calc.cache + calc.mCache + calc.diaTrab + calc.ferTrab + calc.fer + calc.dec + calc.bonus + calc.moradia + calc.hExtra
        return (
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h3 className="text-white font-bold mb-4">Resumo do mês</h3>
                <div className="space-y-1">
                    {calc.salario > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Salário fixo</span><span className="text-white text-xs font-semibold">{brl(calc.salario)}</span></div>}
                    {calc.ajuda > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Ajuda de custo</span><span className="text-white text-xs font-semibold">{brl(calc.ajuda)}</span></div>}
                    {calc.cache > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Cachê — {calc.nCache}x</span><span className="text-white text-xs font-semibold">{brl(calc.cache)}</span></div>}
                    {calc.mCache > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Meio Cachê — {calc.nMCache}x</span><span className="text-white text-xs font-semibold">{brl(calc.mCache)}</span></div>}
                    {calc.diaTrab > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Dia Trabalhado — {calc.nDiaTrab}x</span><span className="text-white text-xs font-semibold">{brl(calc.diaTrab)}</span></div>}
                    {calc.ferTrab > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Feriado Trabalhado — {calc.nFerTrab}x</span><span className="text-white text-xs font-semibold">{brl(calc.ferTrab)}</span></div>}
                    {calc.fer > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Férias</span><span className="text-white text-xs font-semibold">{brl(calc.fer)}</span></div>}
                    {calc.dec > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Décimo Terceiro</span><span className="text-white text-xs font-semibold">{brl(calc.dec)}</span></div>}
                    {calc.bonus > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Bônus</span><span className="text-white text-xs font-semibold">{brl(calc.bonus)}</span></div>}
                    {calc.moradia > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Ajuda Moradia</span><span className="text-white text-xs font-semibold">{brl(calc.moradia)}</span></div>}
                    {calc.hExtra > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Horas Extra</span><span className="text-white text-xs font-semibold">{brl(calc.hExtra)}</span></div>}
                    {calc.descontoFalta > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Faltas — {calc.faltasNaoAbonadas}x</span><span className="text-red-400 text-xs font-semibold">-{brl(calc.descontoFalta)}</span></div>}
                    {calc.ajudaExtra > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Ajuda de custo extra (home office) — {calc.nAjudaExtra}x</span><span className="text-teal-400 text-xs font-semibold">{brl(calc.ajudaExtra)}</span></div>}
                    {calc.descontoAjudaFalta > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Ajuda de custo descontada (faltas)</span><span className="text-red-400 text-xs font-semibold">-{brl(calc.descontoAjudaFalta)}</span></div>}
                    {calc.descontoHorasMenos > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Horas a menos — {calc.bancoHorasFaltantes.toFixed(1)}h</span><span className="text-red-400 text-xs font-semibold">-{brl(calc.descontoHorasMenos)}</span></div>}
                    {calc.adiant > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Adiantamentos</span><span className="text-red-400 text-xs font-semibold">-{brl(calc.adiant)}</span></div>}
                    {calc.desc > 0 && <div className="flex justify-between px-3 py-2 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">Descontos</span><span className="text-red-400 text-xs font-semibold">-{brl(calc.desc)}</span></div>}
                    <div className="border-t border-gray-700 mt-2 pt-2 space-y-1">
                        <div className="flex justify-between px-3 py-1"><span className="text-gray-400 text-xs">Total bruto</span><span className="text-green-400 text-xs font-bold">{brl(bruto)}</span></div>
                        <div className="flex justify-between px-3 py-1"><span className="text-gray-400 text-xs">Descontos</span><span className="text-red-400 text-xs font-bold">-{brl(calc.descontoFalta + calc.descontoHorasMenos + calc.adiant + calc.desc)}</span></div>
                        <div className="flex justify-between bg-gray-700 rounded-lg px-3 py-2"><span className="text-white text-sm font-bold">Total líquido</span><span className="text-white text-sm font-bold">{brl(calc.total)}</span></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {isAdmin && (
                <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex flex-wrap gap-3 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <label className="text-gray-400 text-sm">Visualizando:</label>
                        <select className="bg-gray-800 text-white rounded-xl px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-green-500 cursor-pointer" value={colaboradorSel?.id || ''} onChange={e => setColaboradorSel(colaboradores.find(c => c.id === e.target.value))}>
                            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                        <button onClick={abrirHistorico} disabled={!colaboradorSel} className="text-gray-400 hover:text-white text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer disabled:opacity-40 underline decoration-dotted">📊 Histórico</button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {eventosParaAprovar.length > 0 && <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1.5 rounded-xl">{eventosParaAprovar.length} evento{eventosParaAprovar.length > 1 ? 's' : ''} pendente{eventosParaAprovar.length > 1 ? 's' : ''}</span>}
                        <button onClick={() => { setExportColabs(colaboradores.map(c => c.id)); setExportMes(mes); setExportAno(ano); setModalExport(true) }} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-600 cursor-pointer transition-colors text-sm w-auto">⬇ Exportar</button>
                        <button onClick={abrirModalCredito} className="bg-green-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-green-700 cursor-pointer transition-colors text-sm w-auto">+ Crédito</button>
                        <button onClick={abrirModalDebito} className="bg-red-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-red-600 cursor-pointer transition-colors text-sm w-auto">+ Débito</button>
                    </div>
                </div>
            )}

            {/* Resumo rápido admin */}
            {isAdmin && colaboradorSel && (
                <div className="bg-gray-900 rounded-2xl px-4 py-3 border border-gray-800 flex flex-wrap gap-3 items-start text-xs">
                    {colaboradorSel.foto_perfil ? <img src={colaboradorSel.foto_perfil} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" /> : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{colaboradorSel.nome?.charAt(0).toUpperCase()}</div>}
                    <div className="flex flex-wrap gap-3 flex-1">
                        <span className="text-gray-400">Cargo: <span className="text-white font-semibold">{colaboradorSel.cargo || '—'}</span></span>
                        <span className="text-gray-400">Escala: <span className="text-white font-semibold">{colaboradorSel.escala || '—'}</span></span>
                        <span className="text-gray-400">Salário: <span className="text-white font-semibold">{brl(colaboradorSel.salario_fixo)}</span></span>
                        <span className="text-gray-400">Ajuda custo: <span className="text-white font-semibold">{brl(colaboradorSel.ajuda_custo_diaria)}{colaboradorSel.ajuda_custo_tipo === 'por_dia' ? '/dia presencial' : '/mês'}</span></span>
                        <span className="text-gray-400">Cachê: <span className="text-white font-semibold">{brl(colaboradorSel.cache_evento)}</span></span>
                        <span className="text-gray-400">H. extra: <span className="text-white font-semibold">{brl(colaboradorSel.hora_extra_valor)}/h</span></span>
                        <span className="text-gray-400">Admissão: <span className="text-white font-semibold">{colaboradorSel.data_admissao ? new Date(colaboradorSel.data_admissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span></span>
                        {(colaboradorSel.pix || colaboradorSel.banco) && <span className="text-gray-400">PIX: <span className="text-white font-semibold">{colaboradorSel.pix || `${colaboradorSel.banco} Ag:${colaboradorSel.agencia} Cc:${colaboradorSel.conta}`}</span></span>}
                        {(() => {
                            const regsC = todosRegs.filter(r => r.colaborador_id === colaboradorSel?.id)
                            const lancsC = todosLancs.filter(l => l.colaborador_id === colaboradorSel?.id)
                            const evsC = todosEventos.filter(e => e.colaborador_id === colaboradorSel?.id)
                            const ftsC = todasFaltas.filter(f => f.colaborador_id === colaboradorSel?.id)
                            const pagarHoraExtra = fechamentos.find(f => f.colaborador_id === colaboradorSel?.id)?.pagar_hora_extra || false
                            const descontarHoraMenos = fechamentos.find(f => f.colaborador_id === colaboradorSel?.id)?.descontar_hora_menos || false
                            const calc = calcularTotal(colaboradorSel, regsC, lancsC, evsC, ftsC, pagarHoraExtra, descontarHoraMenos)
                            return (
                                <div className="flex flex-wrap gap-3 border-t border-gray-700 pt-2 mt-1 w-full">
                                    <span className="text-gray-400">Total bruto: <span className="text-green-400 font-bold">{brl(calc.salario + calc.ajuda + calc.cache + calc.mCache + calc.diaTrab + calc.ferTrab + calc.fer + calc.dec + calc.bonus + calc.moradia + calc.hExtra)}</span></span>
                                    <span className="text-gray-400">Descontos: <span className="text-red-400 font-bold">-{brl(calc.descontoFalta + calc.descontoHorasMenos + calc.adiant + calc.desc)}</span></span>
                                    <span className="text-gray-400">Total líquido: <span className="text-white font-bold">{brl(calc.total)}</span></span>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}

            {/* Calendário */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => mudarMes(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 cursor-pointer transition-colors text-lg">‹</button>
                    <h2 className="text-white font-bold text-base capitalize">{nomeMes}</h2>
                    <button onClick={() => mudarMes(1)} disabled={mes === hoje.getMonth() && ano === hoje.getFullYear()} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-30 cursor-pointer transition-colors text-lg">›</button>
                </div>
                <div className="flex gap-3 mb-4 flex-wrap">
                    <div className="bg-gray-800 rounded-xl px-4 py-2 flex items-center gap-2"><span className="text-gray-400 text-xs">Dias trabalhados:</span><span className="text-white font-bold">{diasTrabalhados}</span></div>
                    {(isAdmin || usuario.pode_ver_horas !== false) && <div className="bg-gray-800 rounded-xl px-4 py-2 flex items-center gap-2"><span className="text-gray-400 text-xs">Total de horas:</span><span className="text-white font-bold">{totalHoras.toFixed(1)}h</span></div>}
                    {(isAdmin || usuario.pode_ver_horas !== false) && (() => {
                        const colabParaBanco = isAdmin ? colaboradorSel : usuario
                        if (!colabParaBanco) return null
                        const horasEsperadasDia = horasEsperadasPara(colabParaBanco)
                        let extras = 0, faltantes = 0
                        registros.forEach(r => {
                            if (r.entrada && r.saida && r.horas_trabalhadas != null) {
                                const diff = Number(r.horas_trabalhadas) - horasEsperadasDia
                                if (diff > 0) extras += diff; else faltantes += Math.abs(diff)
                            }
                        })
                        extras = Number(extras.toFixed(1)); faltantes = Number(faltantes.toFixed(1))
                        const saldo = Number((extras - faltantes).toFixed(1))
                        if (extras === 0 && faltantes === 0) return null
                        return (
                            <>
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-2 flex items-center gap-2"><span className="text-green-400 text-xs">Horas a mais:</span><span className="text-white font-bold">+{extras.toFixed(1)}h</span></div>
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2 flex items-center gap-2"><span className="text-yellow-400 text-xs">Horas a menos:</span><span className="text-white font-bold">-{faltantes.toFixed(1)}h</span></div>
                                <div className={`rounded-xl px-4 py-2 flex items-center gap-2 border ${saldo >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}><span className={`text-xs ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>Saldo:</span><span className={`font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>{saldo >= 0 ? '+' : ''}{saldo.toFixed(1)}h</span></div>
                            </>
                        )
                    })()}
                    {isAdmin && colaboradorSel && <button onClick={() => sincronizarFaltas(colaboradorSel.id, registros, faltas)} className="ml-auto text-xs text-gray-500 hover:text-white cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none transition-colors">🔄 Sincronizar faltas</button>}
                </div>
                {loading ? <p className="text-gray-500 text-center py-8">Carregando...</p> : (
                    <>
                        <div className="grid grid-cols-7 gap-1 mb-1">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} className="text-center text-gray-500 text-xs py-1">{d}</div>)}</div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`v${i}`} />)}
                            {Array.from({ length: diasNoMes }).map((_, i) => {
                                const dia = i + 1
                                const reg = getRegistro(dia); const ev = getEvento(dia); const sol = getSolicitacao(dia); const falta = getFalta(dia, faltas)
                                const util = ehUtil(dia); const passado = ehPassado(dia)
                                const isHoje = dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()
                                let bg = 'bg-gray-800'
                                if (!passado) { bg = 'bg-gray-800' }
                                else if (falta?.status === 'abonada') bg = 'bg-blue-500/15'
                                else if (falta?.status === 'falta') bg = 'bg-red-500/30'
                                else if (ev?.status === 'aprovado') bg = corEvento(ev.tipo).bg
                                else if (ev?.status === 'pendente') bg = 'bg-yellow-500/15'
                                else if (reg?.entrada && reg?.saida) bg = 'bg-green-500/15'
                                else if (reg?.entrada && !reg?.saida) bg = 'bg-yellow-500/15'
                                else if (util && passado) bg = 'bg-red-500/10'
                                return (
                                    <div key={dia} onClick={() => passado && clicarDia(dia)} className={`relative rounded-xl p-1.5 text-center transition-all ${bg} ${passado ? 'cursor-pointer hover:opacity-80' : ''} ${isHoje ? 'ring-2 ring-green-500 ring-opacity-60' : ''}`}>
                                        <p className="text-xs font-bold text-white">{dia}</p>
                                        {falta?.status === 'falta' && <p className="text-white text-[8px]">falta</p>}
                                        {falta?.status === 'abonada' && <p className="text-white text-[8px]">abonada</p>}
                                        {!falta && ev?.status === 'aprovado' && <p className="text-[8px] leading-tight truncate text-white">{ev.descricao || TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label}</p>}
                                        {!falta && ev?.status === 'pendente' && <p className="text-yellow-400 text-[8px]">pend.</p>}
                                        {!falta && reg?.entrada && <p className="text-white text-[9px] leading-tight">{horaFmt(reg.entrada)}</p>}
                                        {!falta && reg?.saida && <p className="text-white text-[9px] leading-tight">{horaFmt(reg.saida)}</p>}
                                        {sol && <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${sol.status === 'aprovado' ? 'bg-green-400' : sol.status === 'recusado' ? 'bg-red-400' : 'bg-yellow-400'}`} />}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Completo</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Sem saída/Pendente</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Falta</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Abonada</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Cachê</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Meio Cachê</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Dia Trabalhado</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Feriado</span>
                        </div>
                    </>
                )}
            </div>

            {/* Eventos pendentes admin */}
            {isAdmin && eventosParaAprovar.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-yellow-500/30">
                    <h3 className="text-yellow-400 font-bold mb-4">⏳ Eventos pendentes de aprovação</h3>
                    <div className="space-y-2">
                        {eventosParaAprovar.map(ev => (
                            <div key={ev.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                                <div><p className="text-white text-sm font-semibold">{ev.colaboradores?.nome} — {new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR')}</p><p className="text-gray-400 text-xs">{TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label} {ev.descricao ? `— ${ev.descricao}` : ''} · {brl(ev.valor)}</p></div>
                                <div className="flex gap-2">
                                    <button onClick={() => aprovarEvento(ev.id)} className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-green-600 transition-colors border-0 shadow-none w-auto">✓</button>
                                    <button onClick={() => recusarEvento(ev.id)} className="bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors border-0 shadow-none w-auto">✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lançamentos admin */}
            {isAdmin && lancamentos.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-white font-bold mb-4">Lançamentos — {colaboradorSel?.nome}</h3>
                    <div className="space-y-2">
                        {lancamentos.map(l => {
                            const isCredito = l.tipo === 'ferias' || l.tipo === 'decimo_terceiro' || l.tipo === 'bonus' || l.tipo === 'ajuda_moradia'
                            const label = [...TIPOS_DEBITO, ...TIPOS_CREDITO].find(t => t.value === l.tipo)?.label || l.tipo
                            return (
                                <div key={l.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                                    <div><p className="text-white text-sm font-semibold">{label}{l.parcelas > 1 && <span className="text-gray-500 text-xs ml-2">({l.parcela_atual}/{l.parcelas})</span>}</p>{l.descricao && <p className="text-gray-400 text-xs">{l.descricao}</p>}</div>
                                    <div className="flex items-center gap-3">
                                        <p className={`font-bold text-sm ${isCredito ? 'text-green-400' : 'text-red-400'}`}>{isCredito ? '+' : '-'}{brl(Number(l.valor) * Number(l.quantidade || 1))}</p>
                                        <button onClick={() => excluirLancamento(l.id)} className="text-gray-600 hover:text-red-400 cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none transition-colors text-xl">×</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Registros colaborador */}
            {registros.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <button onClick={() => setRegistrosAbertos(a => !a)} className="w-full flex items-center justify-between bg-transparent border-0 shadow-none p-0 cursor-pointer">
                        <h3 className="text-white font-bold">Registros do mês <span className="text-gray-500 font-normal text-sm">({registros.length})</span></h3>
                        <span className={`text-gray-400 text-lg transition-transform ${registrosAbertos ? 'rotate-90' : ''}`}>›</span>
                    </button>
                    {registrosAbertos && (
                        <div className="space-y-2 mt-4">
                            {registros.map(r => {
                                const colabParaBanco = isAdmin ? colaboradorSel : usuario
                                const horasEsperadasDia = colabParaBanco ? horasEsperadasPara(colabParaBanco) : 9
                                const diffDia = r.horas_trabalhadas != null && r.entrada && r.saida ? Number(r.horas_trabalhadas) - horasEsperadasDia : null
                                const corHoras = diffDia === null ? 'text-white' : diffDia > 0 ? 'text-green-400' : diffDia < 0 ? 'text-red-400' : 'text-white'
                                return (
                                    <div key={r.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                                        <div><p className="text-white text-sm font-semibold">{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</p><p className="text-gray-400 text-xs mt-0.5"><span className="text-green-400">{horaFmt(r.entrada)}</span>{' → '}<span className={r.saida ? 'text-red-400' : 'text-gray-500'}>{horaFmt(r.saida)}</span></p></div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">{r.horas_trabalhadas ? <p className={`font-bold text-sm ${corHoras}`}>{Number(r.horas_trabalhadas).toFixed(1)}h{diffDia !== null && diffDia !== 0 && <span className="text-[10px] ml-1">({diffDia > 0 ? '+' : ''}{diffDia.toFixed(1)})</span>}</p> : <p className="text-gray-500 text-xs">Em aberto</p>}</div>
                                            {isAdmin && <button onClick={() => setModalExcluirRegistro(r)} className="text-red-400 hover:text-red-300 text-xs font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer">🗑️</button>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Eventos colaborador */}
            {!isAdmin && eventos.length > 0 && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-white font-bold mb-4">Meus eventos</h3>
                    <div className="space-y-2">
                        {eventos.map(ev => {
                            const cor = corEvento(ev.tipo); return (
                                <div key={ev.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${cor.bg}`}>
                                    <div><p className={`text-sm font-semibold text-white`}>{new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} — {TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label}{ev.descricao && <span className="text-gray-300 font-normal"> — {ev.descricao}</span>}</p></div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ev.status === 'aprovado' ? 'bg-green-500/20 text-green-400' : ev.status === 'recusado' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{ev.status === 'aprovado' ? '✓' : ev.status === 'recusado' ? '✗' : '⏳'}</span>
                                        <p className="font-bold text-sm text-white">{brl(ev.valor)}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Resumo financeiro do colaborador */}
            {!isAdmin && usuario.pode_ver_horas !== false && <BancoHorasColaborador />}
            {!isAdmin && usuario.pode_ver_resumo !== false && <ResumoColaborador />}

            {/* Fechamento admin */}
            {isAdmin && (
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                        <div><h3 className="text-white font-bold text-lg">Fechamento do Mês</h3><p className="text-gray-500 text-xs mt-0.5 capitalize">{nomeMes}</p></div>
                        {todoAprovado && <button onClick={() => exportarXlsx(colaboradores.map(c => c.id), mes, ano)} disabled={exportando} className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl hover:bg-green-600 cursor-pointer transition-colors text-sm w-auto disabled:opacity-50">{exportando ? 'Gerando...' : '⬇ Exportar Fechamento'}</button>}
                    </div>
                    {!todoAprovado && <p className="text-yellow-400 text-xs mb-4">{fechamentos.filter(f => f.aprovado).length}/{colaboradores.length} aprovados</p>}
                    {loadingFechamento ? <p className="text-gray-500 text-center py-6">Carregando...</p> : (
                        <div className="space-y-3 mt-4">
                            {colaboradores.map(colab => {
                                const regsC = todosRegs.filter(r => r.colaborador_id === colab.id)
                                const lancsC = todosLancs.filter(l => l.colaborador_id === colab.id)
                                const evsC = todosEventos.filter(e => e.colaborador_id === colab.id)
                                const ftsC = todasFaltas.filter(f => f.colaborador_id === colab.id)
                                const evsAprov = evsC.filter(e => e.status === 'aprovado')
                                const evsPend = evsC.filter(e => e.status === 'pendente')
                                const faltasAtivas = ftsC.filter(f => f.status === 'falta')
                                const fech = fechamentos.find(f => f.colaborador_id === colab.id)
                                const calc = calcularTotal(colab, regsC, lancsC, evsC, ftsC, fech?.pagar_hora_extra || false, fech?.descontar_hora_menos || false)
                                const aprovado = fech?.aprovado || false
                                const aberto = expandido === colab.id
                                return (
                                    <div key={colab.id} className={`rounded-2xl border transition-all ${aprovado ? 'border-green-500/60 bg-gray-800' : 'border-gray-700 bg-gray-800'}`}>
                                        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandido(aberto ? null : colab.id)}>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-white font-bold text-sm">{colab.nome}</p>
                                                    {aprovado && <span className="text-xs font-bold text-white bg-green-500 px-2 py-0.5 rounded-full">✓ Aprovado</span>}
                                                    {evsPend.length > 0 && <span className="text-xs font-bold text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded-full">⏳ {evsPend.length}</span>}
                                                    {faltasAtivas.length > 0 && <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">⚠ {faltasAtivas.length} falta{faltasAtivas.length > 1 ? 's' : ''}</span>}
                                                </div>
                                                <p className="text-gray-400 text-xs">{colab.cargo || '—'} · {calc.dias} dias · {calc.horas.toFixed(1)}h</p>
                                            </div>
                                            <div className="text-right mr-2"><p className="text-white font-bold">{brl(calc.total)}</p><p className="text-gray-500 text-xs">total líquido</p></div>
                                            <span className={`text-gray-400 text-lg transition-transform ${aberto ? 'rotate-90' : ''}`}>›</span>
                                        </div>
                                        {aberto && (
                                            <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
                                                <div>
                                                    <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Calendário</p>
                                                    <div className="grid grid-cols-7 gap-0.5 text-center">
                                                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="text-gray-600 text-[9px] py-0.5">{d}</div>)}
                                                        {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`v${i}`} />)}
                                                        {Array.from({ length: diasNoMes }).map((_, i) => {
                                                            const dia = i + 1
                                                            const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                                                            const reg = regsC.find(r => r.data === dataStr); const ev = evsC.find(e => e.data === dataStr); const ft = ftsC.find(f => f.data === dataStr)
                                                            const util = new Date(ano, mes, dia).getDay() !== 0 && new Date(ano, mes, dia).getDay() !== 6
                                                            let bg = 'bg-gray-700'
                                                            if (ft?.status === 'abonada') bg = 'bg-blue-500/30'
                                                            else if (ft?.status === 'falta') bg = 'bg-red-500/40'
                                                            else if (ev?.status === 'aprovado') bg = corEvento(ev.tipo).bg.replace('/20', '/40')
                                                            else if (ev?.status === 'pendente') bg = 'bg-yellow-500/30'
                                                            else if (reg?.entrada && reg?.saida) bg = 'bg-green-500/30'
                                                            else if (reg?.entrada) bg = 'bg-yellow-500/30'
                                                            else if (util) bg = 'bg-red-500/20'
                                                            return <div key={dia} className={`rounded text-[9px] py-0.5 ${bg}`}><span className="text-white">{dia}</span>{ev?.descricao && <div className="text-[7px] text-white truncate px-0.5">{ev.descricao.slice(0, 6)}</div>}</div>
                                                        })}
                                                    </div>
                                                </div>

                                                {ftsC.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Faltas</p>
                                                        <div className="space-y-1">
                                                            {ftsC.map(ft => (
                                                                <div key={ft.id} className={`flex justify-between items-center rounded-lg px-3 py-2 ${ft.status === 'abonada' ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                                                                    <div><span className="text-xs font-semibold text-white">{new Date(ft.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — {ft.status === 'abonada' ? 'Abonada' : 'Falta'}</span>{ft.justificativa && <p className="text-gray-500 text-[10px]">{ft.justificativa}</p>}</div>
                                                                    {ft.status === 'falta' ? <button onClick={() => { setModalAbono({ falta: ft }); setJustAbono('') }} className="text-blue-400 text-xs font-bold cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none hover:text-blue-300">Abonar</button> : <button onClick={() => desfazerAbono(ft.id)} className="text-gray-500 text-xs cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none hover:text-gray-300">Desfazer</button>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {evsAprov.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Eventos</p>
                                                        <div className="space-y-1">
                                                            {evsAprov.map(ev => {
                                                                const cor = corEvento(ev.tipo); return (
                                                                    <div key={ev.id} className={`flex justify-between items-center rounded-lg px-3 py-2 ${cor.bg}`}>
                                                                        <span className="text-xs text-white">{new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — {TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label}{ev.descricao && ` — ${ev.descricao}`}</span>
                                                                        <div className="flex items-center gap-2"><span className="font-bold text-xs text-white">{brl(ev.valor)}</span><button onClick={() => excluirEvento(ev.id)} className="text-gray-500 hover:text-red-400 cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none text-base">×</button></div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Banco de horas</p>
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2"><p className="text-green-400 text-[10px]">Horas a mais</p><p className="text-white font-bold text-sm">+{calc.bancoHorasExtras.toFixed(1)}h</p></div>
                                                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2"><p className="text-yellow-400 text-[10px]">Horas a menos</p><p className="text-white font-bold text-sm">-{calc.bancoHorasFaltantes.toFixed(1)}h</p></div>
                                                        <div className={`rounded-lg px-3 py-2 border ${(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                                            <p className={`text-[10px] ${(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? 'text-green-400' : 'text-red-400'}`}>Saldo do mês</p>
                                                            <p className={`font-bold text-sm ${(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(calc.bancoHorasExtras - calc.bancoHorasFaltantes) >= 0 ? '+' : ''}{(calc.bancoHorasExtras - calc.bancoHorasFaltantes).toFixed(1)}h</p>
                                                        </div>
                                                    </div>
                                                    {(calc.bancoHorasExtras > 0 || calc.bancoHorasFaltantes > 0) ? (
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {calc.bancoHorasExtras > 0 ? (
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); togglePagarHoraExtra(colab.id, fech?.pagar_hora_extra || false) }}
                                                                    className={`text-left rounded-xl p-3 cursor-pointer transition-colors border ${fech?.pagar_hora_extra ? 'bg-green-500 border-green-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
                                                                    <p className={`text-xs font-bold ${fech?.pagar_hora_extra ? 'text-white' : 'text-gray-300'}`}>{fech?.pagar_hora_extra ? '✅ Pagando' : '💰 Pagar?'}</p>
                                                                    <p className={`text-[10px] mt-0.5 ${fech?.pagar_hora_extra ? 'text-green-100' : 'text-gray-500'}`}>{fech?.pagar_hora_extra ? `+${brl(calc.bancoHorasExtras * (colab.hora_extra_valor || 0))}` : 'Pagar as horas a mais'}</p>
                                                                </button>
                                                            ) : <div />}
                                                            {calc.bancoHorasFaltantes > 0 ? (
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); toggleDescontarHoraMenos(colab.id, fech?.descontar_hora_menos || false) }}
                                                                    className={`text-left rounded-xl p-3 cursor-pointer transition-colors border ${fech?.descontar_hora_menos ? 'bg-red-500 border-red-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
                                                                    <p className={`text-xs font-bold ${fech?.descontar_hora_menos ? 'text-white' : 'text-gray-300'}`}>{fech?.descontar_hora_menos ? '⚠️ Descontando' : '➖ Descontar?'}</p>
                                                                    <p className={`text-[10px] mt-0.5 ${fech?.descontar_hora_menos ? 'text-red-100' : 'text-gray-500'}`}>{fech?.descontar_hora_menos ? `-${brl(calc.bancoHorasFaltantes * (colab.hora_extra_valor || 0))}` : 'Descontar as horas a menos'}</p>
                                                                </button>
                                                            ) : <div />}
                                                            <div />
                                                        </div>
                                                    ) : <p className="text-gray-500 text-xs">Sem diferença de horas registrada este mês.</p>}
                                                    <p className="text-gray-600 text-[10px] mt-2">O que não for pago/descontado aqui vira saldo do banco de horas e aparece no fechamento do mês seguinte.</p>
                                                </div>

                                                <div>
                                                    <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Resumo financeiro</p>
                                                    <div className="space-y-1">
                                                        <LinhaResumo label="Salário fixo" valor={calc.salario} qtd={1} />
                                                        <LinhaResumo label="Ajuda de custo" valor={calc.ajuda} qtd={colab.ajuda_custo_tipo === 'por_dia' ? calc.dias : 1} unitario={colab.ajuda_custo_tipo === 'por_dia' ? colab.ajuda_custo_diaria : null} />
                                                        <LinhaResumo label="Cachê" valor={calc.cache} qtd={calc.nCache} unitario={calc.nCache ? calc.cache / calc.nCache : 0} />
                                                        <LinhaResumo label="Meio Cachê" valor={calc.mCache} qtd={calc.nMCache} unitario={calc.nMCache ? calc.mCache / calc.nMCache : 0} />
                                                        <LinhaResumo label="Dia Trabalhado" valor={calc.diaTrab} qtd={calc.nDiaTrab} unitario={calc.nDiaTrab ? calc.diaTrab / calc.nDiaTrab : 0} />
                                                        <LinhaResumo label="Feriado Trabalhado" valor={calc.ferTrab} qtd={calc.nFerTrab} unitario={calc.nFerTrab ? calc.ferTrab / calc.nFerTrab : 0} />
                                                        <LinhaResumo label="Férias" valor={calc.fer} qtd={1} />
                                                        <LinhaResumo label="Décimo Terceiro" valor={calc.dec} qtd={1} />
                                                        <LinhaResumo label="Bônus" valor={calc.bonus} qtd={1} />
                                                        <LinhaResumo label="Ajuda Moradia" valor={calc.moradia} qtd={1} />
                                                        <LinhaResumo label={`Horas extra — ${calc.bancoHorasExtras.toFixed(1)}h × ${brl(colab.hora_extra_valor || 0)}/h`} valor={calc.hExtra} qtd={1} />
                                                        {calc.descontoFalta > 0 && <div className="flex justify-between bg-gray-900 rounded-lg px-3 py-2"><span className="text-gray-400 text-xs">Faltas — {calc.faltasNaoAbonadas}x <span className="text-gray-600">({brl(calc.diasUteisMes > 0 ? calc.salario / calc.diasUteisMes : 0)}/dia)</span></span><span className="font-semibold text-xs text-red-400">-{brl(calc.descontoFalta)}</span></div>}
                                                        {calc.ajudaExtra > 0 && <div className="flex justify-between bg-gray-900 rounded-lg px-3 py-2"><span className="text-gray-400 text-xs">Ajuda de custo extra (home office) — {calc.nAjudaExtra}x</span><span className="font-semibold text-xs text-teal-400">{brl(calc.ajudaExtra)}</span></div>}
                                                        {calc.descontoAjudaFalta > 0 && <div className="flex justify-between bg-gray-900 rounded-lg px-3 py-2"><span className="text-gray-400 text-xs">Ajuda de custo descontada (faltas)</span><span className="font-semibold text-xs text-red-400">-{brl(calc.descontoAjudaFalta)}</span></div>}
                                                        {calc.descontoHorasMenos > 0 && <div className="flex justify-between bg-gray-900 rounded-lg px-3 py-2"><span className="text-gray-400 text-xs">Horas a menos — {calc.bancoHorasFaltantes.toFixed(1)}h × {brl(colab.hora_extra_valor || 0)}/h</span><span className="font-semibold text-xs text-red-400">-{brl(calc.descontoHorasMenos)}</span></div>}
                                                        {calc.adiant > 0 && <div className="flex justify-between bg-gray-900 rounded-lg px-3 py-2"><span className="text-gray-400 text-xs">Adiantamentos</span><span className="font-semibold text-xs text-red-400">-{brl(calc.adiant)}</span></div>}
                                                        {calc.desc > 0 && <div className="flex justify-between bg-gray-900 rounded-lg px-3 py-2"><span className="text-gray-400 text-xs">Descontos</span><span className="font-semibold text-xs text-red-400">-{brl(calc.desc)}</span></div>}
                                                    </div>
                                                </div>

                                                <div className="border-t border-gray-700 mt-2 pt-2 space-y-1">
                                                    <div className="flex justify-between px-3 py-1"><span className="text-gray-400 text-xs font-semibold">Total bruto</span><span className="text-green-400 text-sm font-bold">{brl(calc.salario + calc.ajuda + calc.cache + calc.mCache + calc.diaTrab + calc.ferTrab + calc.fer + calc.dec + calc.bonus + calc.moradia + calc.hExtra)}</span></div>
                                                    <div className="flex justify-between px-3 py-1"><span className="text-gray-400 text-xs font-semibold">Total descontos</span><span className="text-red-400 text-sm font-bold">-{brl(calc.descontoFalta + calc.descontoHorasMenos + calc.adiant + calc.desc)}</span></div>
                                                    <div className="flex justify-between bg-gray-700 rounded-lg px-3 py-2"><span className="text-white text-sm font-bold">Total líquido</span><span className="text-white text-sm font-bold">{brl(calc.total)}</span></div>
                                                </div>

                                                {lancsC.length > 0 && (
                                                    <div>
                                                        <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Lançamentos</p>
                                                        <div className="space-y-1">
                                                            {lancsC.map(l => {
                                                                const isCredito = l.tipo === 'ferias' || l.tipo === 'decimo_terceiro' || l.tipo === 'bonus' || l.tipo === 'ajuda_moradia'; return (
                                                                    <div key={l.id} className="flex justify-between text-xs bg-gray-900 rounded-lg px-3 py-2">
                                                                        <span className="text-gray-300">{[...TIPOS_DEBITO, ...TIPOS_CREDITO].find(t => t.value === l.tipo)?.label} {l.descricao ? `— ${l.descricao}` : ''}</span>
                                                                        <span className={isCredito ? 'text-green-400' : 'text-red-400'}>{isCredito ? '+' : '-'}{brl(Number(l.valor))}</span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {(colab.pix || colab.banco) && <div className="bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-400 space-y-0.5">{colab.banco && <p>🏦 {colab.banco} · Ag: {colab.agencia} · Cc: {colab.conta}</p>}{colab.pix && <p>PIX: {colab.pix}</p>}</div>}

                                                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                                                    <div><p className="text-gray-400 text-xs">Total líquido</p><p className="text-white font-bold text-lg">{brl(calc.total)}</p></div>
                                                    {aprovado ? <button onClick={() => desaprovarColaborador(colab.id)} disabled={aprovando === colab.id} className="bg-gray-700 text-gray-300 font-bold py-2 px-4 rounded-xl cursor-pointer hover:bg-gray-600 transition-colors text-sm w-auto disabled:opacity-50">Desfazer</button> : <button onClick={() => aprovarColaborador(colab.id, calc.total, calc)} disabled={aprovando === colab.id} className="bg-green-500 text-white font-bold py-2 px-5 rounded-xl cursor-pointer hover:bg-green-600 transition-colors text-sm w-auto disabled:opacity-50">{aprovando === colab.id ? 'Aprovando...' : '✓ Aprovar'}</button>}
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

            {/* Modal falta */}
            {modalAbono && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <div><h3 className="text-white text-lg font-bold">Resolver falta</h3><p className="text-gray-400 text-sm">{new Date(modalAbono.falta.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
                            <button onClick={() => setModalAbono(null)} className="text-gray-400 hover:text-white cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none text-2xl">✕</button>
                        </div>
                        <div className="grid grid-cols-3 gap-1 mb-4">
                            {[['abonar', '📋 Abonar'], ['ponto', '🕐 Ponto'], ['evento', '🎵 Evento']].map(([aba, label]) => (
                                <button key={aba} onClick={() => setAbaAbono(aba)} className={`py-2 px-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors border w-auto ${abaAbono === aba ? 'bg-green-500 text-white border-green-500' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>{label}</button>
                            ))}
                        </div>
                        {abaAbono === 'abonar' && (
                            <div className="space-y-3">
                                <p className="text-gray-400 text-xs">Falta justificada. Não desconta do salário.</p>
                                <div><label className="text-gray-400 text-xs mb-1 block">Justificativa</label><textarea value={justAbono} onChange={e => setJustAbono(e.target.value)} placeholder="Ex: Atestado médico..." rows={3} className={inputCls + ' resize-none placeholder-gray-600'} /></div>
                                <div className="flex gap-3">
                                    <button onClick={() => setModalAbono(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                                    <button onClick={() => abonarFalta(modalAbono.falta.id, justAbono)} disabled={salvandoAbono} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-blue-600 disabled:opacity-40 transition-colors">{salvandoAbono ? 'Salvando...' : '✓ Abonar'}</button>
                                </div>
                            </div>
                        )}
                        {abaAbono === 'ponto' && (
                            <div className="space-y-3">
                                <p className="text-gray-400 text-xs">Cria registro de ponto para este dia.</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-gray-400 text-xs mb-1 block">Entrada *</label><input type="time" value={formPontoFalta.entrada} onChange={e => setFormPontoFalta(f => ({ ...f, entrada: e.target.value }))} className={inputCls} /></div>
                                    <div><label className="text-gray-400 text-xs mb-1 block">Saída</label><input type="time" value={formPontoFalta.saida} onChange={e => setFormPontoFalta(f => ({ ...f, saida: e.target.value }))} className={inputCls} /></div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setModalAbono(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                                    <button onClick={salvarPontoFalta} disabled={salvandoAbono || !formPontoFalta.entrada} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors">{salvandoAbono ? 'Salvando...' : '✓ Salvar ponto'}</button>
                                </div>
                            </div>
                        )}
                        {abaAbono === 'evento' && (
                            <div className="space-y-3">
                                <p className="text-gray-400 text-xs">Remove a falta e lança o cachê.</p>
                                <div>
                                    <label className="text-gray-400 text-xs mb-2 block">Tipo</label>
                                    <div className="grid grid-cols-2 gap-2">{TIPOS_EVENTO.map(t => <button key={t.value} type="button" onClick={() => setFormEventoFalta(f => ({ ...f, tipo: t.value, valor: valorParaTipo(t.value, colaboradorSel) }))} className={`py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors border w-auto ${formEventoFalta.tipo === t.value ? 'bg-green-500 text-white border-green-500' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>{t.label}</button>)}</div>
                                </div>
                                <div><label className="text-gray-400 text-xs mb-1 block">Descrição</label><input value={formEventoFalta.descricao} onChange={e => setFormEventoFalta(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Léo Santana..." className={inputCls + ' placeholder-gray-600'} /></div>
                                <div><label className="text-gray-400 text-xs mb-1 block">Valor</label><input type="text" value={formEventoFalta.valor} onChange={e => { const num = e.target.value.replace(/\D/g, ''); setFormEventoFalta(f => ({ ...f, valor: num ? (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '' })) }} placeholder="R$ 0,00" className={inputCls} /></div>
                                <div className="flex gap-3">
                                    <button onClick={() => setModalAbono(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                                    <button onClick={salvarEventoFalta} disabled={salvandoAbono || !formEventoFalta.valor} className="flex-1 bg-purple-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-purple-600 disabled:opacity-40 transition-colors">{salvandoAbono ? 'Salvando...' : '✓ Lançar evento'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal evento */}
            {modalEvento && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <div><h3 className="text-white text-lg font-bold">{modalEvento.eventoExistente ? 'Editar evento' : 'Lançar evento'}</h3><p className="text-gray-400 text-sm">{new Date(modalEvento.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
                            <button onClick={() => setModalEvento(null)} className="text-gray-400 hover:text-white cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none text-2xl">✕</button>
                        </div>
                        {!isAdmin && modalEvento.eventoExistente?.status === 'aprovado' ? (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                <p className="text-green-400 text-sm font-semibold">✓ Evento aprovado pelo admin.</p>
                                <p className="text-gray-400 text-xs mt-1">{TIPOS_EVENTO.find(t => t.value === modalEvento.eventoExistente.tipo)?.label} — {brl(modalEvento.eventoExistente.valor)}</p>
                                {modalEvento.eventoExistente.descricao && <p className="text-gray-400 text-xs">{modalEvento.eventoExistente.descricao}</p>}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Horário — disponível para todos, independente de evento */}
                                <div className="bg-gray-800 rounded-xl p-3">
                                    <p className="text-white text-xs font-semibold mb-2">🕐 Corrigir horário do dia</p>
                                    <p className="text-gray-500 text-[10px] mb-2">Preencha se esqueceu de bater o ponto. Não soma valores extras.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><label className="text-gray-500 text-[10px] mb-0.5 block">Entrada</label><input type="time" value={formEvento.entrada || ''} onChange={e => setFormEvento(f => ({ ...f, entrada: e.target.value }))} className={inputCls} /></div>
                                        <div><label className="text-gray-500 text-[10px] mb-0.5 block">Saída</label><input type="time" value={formEvento.saida || ''} onChange={e => setFormEvento(f => ({ ...f, saida: e.target.value }))} className={inputCls} /></div>
                                    </div>
                                </div>

                                {/* Evento extra — opcional. Colaborador comum só vê isso se tiver cachê configurado
                                    (a maioria não tem, então só sobra "corrigir horário" pra eles). Dia Trabalhado e
                                    Feriado Trabalhado são decisão do admin, não algo que o colaborador solicita sozinho. */}
                                {(() => {
                                    const colabAlvo = isAdmin ? colaboradorSel : usuario
                                    const podeCache = isAdmin || colabAlvo?.pode_solicitar_cache
                                    const podeDiaTrabalhado = isAdmin || colabAlvo?.pode_solicitar_dia_trabalhado
                                    if (!isAdmin && !podeCache && !podeDiaTrabalhado) return null
                                    return (
                                        <div>
                                            <p className="text-white text-xs font-semibold mb-2">📋 Lançar evento extra <span className="text-gray-500 font-normal">(opcional)</span></p>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                {[
                                                    { value: 'dia_normal', label: 'Dia Normal' },
                                                    ...(podeCache ? [{ value: 'cache', label: 'Cachê' }, { value: 'meio_cache', label: 'Meio Cachê' }] : []),
                                                    ...(podeDiaTrabalhado ? [{ value: 'dia_trabalhado', label: 'Dia Trabalhado' }] : []),
                                                    ...(isAdmin ? [{ value: 'feriado_trabalhado', label: 'Feriado Trabalhado' }] : []),
                                                    ...(isAdmin ? [{ value: 'falta', label: '🚫 Falta' }] : []),
                                                ].map(t => (
                                                    <button key={t.value} type="button" onClick={() => setFormEvento(f => ({ ...f, tipo: t.value, valor: (t.value === 'dia_normal' || t.value === 'falta') ? '' : valorParaTipo(t.value, colabAlvo) }))}
                                                        className={`py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-colors border w-auto ${formEvento.tipo === t.value ? (t.value === 'falta' ? 'bg-red-500 text-white border-red-500' : 'bg-green-500 text-white border-green-500') : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-green-500'}`}>
                                                        {t.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {formEvento.tipo !== 'dia_normal' && formEvento.tipo !== 'falta' && (
                                                <>
                                                    <div className="mb-3"><label className="text-gray-400 text-xs mb-1 block">Descrição / Nome do evento</label><input value={formEvento.descricao} onChange={e => setFormEvento(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Léo Santana, Good Times..." className={inputCls + ' placeholder-gray-600'} /></div>
                                                    <div><label className="text-gray-400 text-xs mb-1 block">Valor</label><input type="text" value={formEvento.valor} onChange={e => { const num = e.target.value.replace(/\D/g, ''); setFormEvento(f => ({ ...f, valor: num ? (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '' })) }} placeholder="R$ 0,00" className={inputCls} /></div>
                                                </>
                                            )}

                                            {formEvento.tipo === 'dia_normal' && <p className="text-gray-600 text-[10px]">Dia normal — apenas corrige o ponto. Horas extras serão calculadas automaticamente se houver.</p>}
                                            {formEvento.tipo === 'falta' && <p className="text-red-400 text-[10px]">⚠ Marca esse dia como falta (desconta salário proporcional, se não for abonada depois). Ignora os campos de horário acima.</p>}
                                        </div>
                                    )
                                })()}

                                {!isAdmin && <p className="text-yellow-400 text-xs">⚠ Será enviado para aprovação do admin.</p>}
                                {isAdmin && (formEvento.entrada || formEvento.saida) && <p className="text-green-400 text-xs">✓ Como admin, isso corrige o ponto na hora — sem precisar de aprovação.</p>}
                            </div>
                        )}
                        <div className="flex gap-3 mt-5">
                            {modalEvento.eventoExistente && <button onClick={() => { excluirEvento(modalEvento.eventoExistente.id); setModalEvento(null) }} className="bg-red-500/20 text-red-400 font-bold py-3 px-4 rounded-2xl cursor-pointer hover:bg-red-500/30 transition-colors border-0 shadow-none w-auto">Excluir</button>}
                            <button onClick={() => setModalEvento(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">{(!isAdmin && modalEvento.eventoExistente?.status === 'aprovado') ? 'Fechar' : 'Cancelar'}</button>
                            {(!modalEvento.eventoExistente || modalEvento.eventoExistente?.status !== 'aprovado' || isAdmin) && <button onClick={salvarEvento} disabled={salvandoEvento || (isAdmin && formEvento.tipo !== 'dia_normal' && formEvento.tipo !== 'falta' && !formEvento.valor) || (isAdmin && formEvento.tipo === 'dia_normal' && !formEvento.entrada && !formEvento.saida && !modalEvento.eventoExistente) || (!isAdmin && formEvento.tipo !== 'dia_normal' && !formEvento.valor) || (!isAdmin && formEvento.tipo === 'dia_normal' && !formEvento.entrada && !formEvento.saida)} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors">{salvandoEvento ? 'Salvando...' : isAdmin ? 'Salvar' : 'Solicitar'}</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal lançamento */}
            {modalLanc && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-white text-lg font-bold">{tipoModalLanc === 'credito' ? 'Novo crédito' : 'Novo débito'}</h3>
                            <button onClick={() => setModalLanc(false)} className="text-gray-400 hover:text-white cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none text-2xl">✕</button>
                        </div>
                        <div className="space-y-4">
                            <div><label className="text-gray-400 text-xs mb-1 block">Colaborador *</label><select value={formLanc.colaboradorId} onChange={e => { const novoId = e.target.value; const valorSug = valorSugeridoCredito(formLanc.tipo, novoId); setFormLanc(f => ({ ...f, colaboradorId: novoId, valor: valorSug || f.valor })) }} className={inputCls + ' cursor-pointer'}><option value="">-- Selecione --</option>{colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                            <div><label className="text-gray-400 text-xs mb-2 block">Tipo *</label><div className="grid grid-cols-2 gap-2">{(tipoModalLanc === 'credito' ? TIPOS_CREDITO : TIPOS_DEBITO).map(t => <button key={t.value} type="button" onClick={() => { const valorSug = tipoModalLanc === 'credito' ? valorSugeridoCredito(t.value, formLanc.colaboradorId) : ''; setFormLanc(f => ({ ...f, tipo: t.value, valor: valorSug || f.valor })) }} className={`py-2 px-3 rounded-xl text-sm font-semibold cursor-pointer transition-colors border w-auto ${formLanc.tipo === t.value ? tipoModalLanc === 'credito' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>{t.label}</button>)}</div></div>
                            <div><label className="text-gray-400 text-xs mb-1 block">Descrição *</label><input value={formLanc.descricao} onChange={e => setFormLanc(f => ({ ...f, descricao: e.target.value }))} placeholder={tipoModalLanc === 'credito' ? 'Ex: Férias Jan/2026...' : 'Ex: Adiantamento 10/05...'} className={inputCls + ' placeholder-gray-600'} /></div>
                            {tipoModalLanc === 'debito' && <div><label className="text-gray-400 text-xs mb-1 block">Data</label><input type="date" value={formLanc.data} onChange={e => setFormLanc(f => ({ ...f, data: e.target.value }))} className={inputCls + ' cursor-pointer'} /></div>}
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-gray-400 text-xs mb-1 block">Valor *</label><input type="text" value={formLanc.valor} onChange={e => { const num = e.target.value.replace(/\D/g, ''); setFormLanc(f => ({ ...f, valor: num ? (Number(num) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '' })) }} placeholder="R$ 0,00" className={inputCls} /></div>
                                {tipoModalLanc === 'debito' && <div><label className="text-gray-400 text-xs mb-1 block">Parcelas</label><input type="number" min="1" value={formLanc.parcelas} onChange={e => setFormLanc(f => ({ ...f, parcelas: e.target.value }))} className={inputCls} /></div>}
                            </div>
                            {tipoModalLanc === 'debito' && parseInt(formLanc.parcelas) > 1 && <p className="text-yellow-400 text-xs">⚠ Debitado em {formLanc.parcelas} meses consecutivos</p>}
                            {tipoModalLanc === 'credito' && formLanc.tipo === 'decimo_terceiro' && <p className="text-blue-400 text-xs">ℹ Valor sugerido: salário ÷ 12</p>}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setModalLanc(false)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                            <button onClick={salvarLancamento} disabled={salvandoLanc || !formLanc.colaboradorId || !formLanc.descricao.trim() || !formLanc.valor} className={`flex-1 text-white font-bold py-3 rounded-2xl cursor-pointer disabled:opacity-40 transition-colors ${tipoModalLanc === 'credito' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>{salvandoLanc ? 'Salvando...' : tipoModalLanc === 'credito' ? 'Salvar crédito' : 'Salvar débito'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal export */}
            {modalExport && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between mb-5"><h3 className="text-white text-lg font-bold">Exportar Relatório</h3><button onClick={() => setModalExport(false)} className="text-gray-400 hover:text-white cursor-pointer w-auto p-0 bg-transparent border-0 shadow-none text-2xl">✕</button></div>
                        <div className="space-y-4">
                            <div><label className="text-gray-400 text-xs mb-2 block">Mês de referência</label><div className="grid grid-cols-2 gap-3"><select value={exportMes} onChange={e => setExportMes(Number(e.target.value))} className={inputCls + ' cursor-pointer'}>{Array.from({ length: 12 }).map((_, i) => <option key={i} value={i}>{new Date(2024, i).toLocaleDateString('pt-BR', { month: 'long' })}</option>)}</select><input type="number" value={exportAno} onChange={e => setExportAno(Number(e.target.value))} className={inputCls} /></div></div>
                            <div><label className="text-gray-400 text-xs mb-2 block">Colaboradores</label><div className="space-y-2 max-h-48 overflow-y-auto"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={exportColabs.length === colaboradores.length} onChange={e => setExportColabs(e.target.checked ? colaboradores.map(c => c.id) : [])} className="w-4 h-4 accent-green-500" /><span className="text-gray-300 text-sm font-semibold">Todos</span></label>{colaboradores.map(c => <label key={c.id} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={exportColabs.includes(c.id)} onChange={e => setExportColabs(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} className="w-4 h-4 accent-green-500" /><span className="text-gray-300 text-sm">{c.nome}</span></label>)}</div></div>
                        </div>
                        <div className="flex gap-3 mt-6"><button onClick={() => setModalExport(false)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button><button onClick={() => exportarXlsx(exportColabs, exportMes, exportAno)} disabled={exportando || exportColabs.length === 0} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-blue-600 disabled:opacity-40 transition-colors">{exportando ? 'Gerando...' : `⬇ Exportar (${exportColabs.length})`}</button></div>
                    </div>
                </div>
            )}

            {/* Modal correção ponto colaborador */}
            {modalDia && (
                <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
                        {sucessoSol ? (
                            <div className="text-center py-4"><div className="text-5xl mb-4">✅</div><h3 className="text-white text-xl font-bold mb-2">Solicitação enviada!</h3><p className="text-gray-400 text-sm mb-6">O admin será notificado.</p><button onClick={() => setModalDia(null)} className="w-full bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 transition-colors">Fechar</button></div>
                        ) : (
                            <>
                                <h3 className="text-white text-lg font-bold mb-1">Solicitar correção de ponto</h3>
                                <p className="text-gray-400 text-sm mb-5">{new Date(modalDia.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                {getSolicitacao(modalDia.dia) ? <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4"><p className="text-yellow-400 text-sm font-semibold">Você já tem uma solicitação para este dia.</p></div> : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div><label className="text-gray-400 text-xs mb-1 block">Entrada</label><input type="time" value={formSol.entrada} onChange={e => setFormSol(f => ({ ...f, entrada: e.target.value }))} className={inputCls} /></div>
                                            <div><label className="text-gray-400 text-xs mb-1 block">Saída</label><input type="time" value={formSol.saida} onChange={e => setFormSol(f => ({ ...f, saida: e.target.value }))} className={inputCls} /></div>
                                        </div>
                                        <div><label className="text-gray-400 text-xs mb-1 block">Justificativa *</label><textarea value={formSol.justificativa} onChange={e => setFormSol(f => ({ ...f, justificativa: e.target.value }))} placeholder="Ex: Esqueci de bater a saída..." rows={3} className={inputCls + ' resize-none placeholder-gray-600'} /></div>
                                    </div>
                                )}
                                <div className="flex gap-3 mt-5">
                                    <button onClick={() => setModalDia(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                                    {!getSolicitacao(modalDia.dia) && <button onClick={enviarSolicitacao} disabled={enviandoSol || !formSol.justificativa.trim()} className="flex-1 bg-green-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-green-600 disabled:opacity-40 transition-colors">{enviandoSol ? 'Enviando...' : 'Enviar'}</button>}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal excluir registro de ponto */}
            {modalExcluirRegistro && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-sm border border-gray-700">
                        <h3 className="text-white text-lg font-bold mb-2">Excluir registro de ponto</h3>
                        <p className="text-gray-400 text-sm mb-1">{new Date(modalExcluirRegistro.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <p className="text-gray-400 text-sm mb-5"><span className="text-green-400">{horaFmt(modalExcluirRegistro.entrada)}</span> → <span className="text-red-400">{horaFmt(modalExcluirRegistro.saida)}</span></p>
                        <p className="text-yellow-400 text-xs mb-5">⚠️ Isso apaga o registro por completo (não vira falta automaticamente — sincronize as faltas depois se for o caso).</p>
                        <div className="flex gap-3">
                            <button onClick={() => setModalExcluirRegistro(null)} className="flex-1 bg-gray-800 text-gray-300 font-bold py-3 rounded-2xl cursor-pointer hover:bg-gray-700 transition-colors">Cancelar</button>
                            <button onClick={excluirRegistroPonto} disabled={excluindoRegistro} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl cursor-pointer hover:bg-red-600 disabled:opacity-50 transition-colors">{excluindoRegistro ? 'Excluindo...' : 'Excluir'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal histórico de fechamentos do colaborador */}
            {modalHistorico && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-lg border border-gray-700 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-white text-lg font-bold">Histórico de fechamentos</h3>
                            <button onClick={() => setModalHistorico(false)} className="text-gray-400 hover:text-white w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer text-2xl">✕</button>
                        </div>
                        <p className="text-gray-400 text-sm mb-5">{colaboradorSel?.nome}</p>
                        {carregandoHistorico ? (
                            <p className="text-gray-500 text-center py-8">Carregando...</p>
                        ) : historicoFechamentos.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">Nenhum fechamento anterior encontrado. Fechamentos aparecem aqui depois que você aprova o mês (mesmo que ainda não tenha aprovado o atual).</p>
                        ) : (
                            <div className="space-y-2">
                                {historicoFechamentos.map(f => (
                                    <button key={f.id} onClick={() => { setMes(f.mes - 1); setAno(f.ano); setModalHistorico(false) }}
                                        className={`w-full text-left flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer transition-colors border ${f.mes - 1 === mes && f.ano === ano ? 'bg-gray-700 border-green-500/50' : 'bg-gray-800 border-transparent hover:border-gray-600'}`}>
                                        <div>
                                            <p className="text-white text-sm font-semibold capitalize">{new Date(f.ano, f.mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.aprovado ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{f.aprovado ? '✓ Aprovado' : '⏳ Não aprovado'}</span>
                                                {f.saldo_banco_horas != null && f.saldo_banco_horas !== 0 && <span className={`text-[10px] ${f.saldo_banco_horas > 0 ? 'text-green-400' : 'text-red-400'}`}>Saldo banco: {f.saldo_banco_horas > 0 ? '+' : ''}{Number(f.saldo_banco_horas).toFixed(1)}h</span>}
                                            </div>
                                        </div>
                                        <p className="text-white font-bold">{brl(f.total_liquido)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}