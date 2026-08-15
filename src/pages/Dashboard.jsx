import { useState, useEffect } from 'react'
import Colaboradores from './Colaboradores'
import AdminAprovacoes from './AdminAprovacoes'
import AdminCargos from './AdminCargos'
import AdminEscalas from './AdminEscalas'
import AdminCorrecoes from './AdminCorrecoes'
import BaterPonto from './BaterPonto'
import RelatorioMensal from './RelatorioMensal'
import PerfilColaborador from './PerfilColaborador'
import Solicitacoes from './Solicitacoes'

export default function Dashboard({ usuario, onLogout }) {
  const isAdmin = usuario.perfil === 'admin' || usuario.super_admin
  const [aba, setAba] = useState(isAdmin ? 'relatorio' : 'ponto')
  const [relatorioKey, setRelatorioKey] = useState(0)

  const abas = [
    ...(isAdmin ? [{ id: 'aprovacoes', label: 'Aprovações' }] : []),
    ...(isAdmin ? [{ id: 'colaboradores', label: 'Colaboradores' }] : []),
    ...(isAdmin ? [{ id: 'inativos', label: 'Inativos' }] : []),
    ...(isAdmin ? [{ id: 'cargos', label: 'Cargos' }] : []),
    ...(isAdmin ? [{ id: 'escalas', label: 'Escalas' }] : []),
    ...(isAdmin ? [{ id: 'correcoes', label: 'Correções' }] : []),
    { id: 'ponto', label: 'Meu Clockin' },
    ...(isAdmin || usuario.pode_ver_aba_relatorio !== false ? [{ id: 'relatorio', label: 'Relatório Mensal' }] : []),
    ...(!isAdmin && usuario.pode_ver_aba_solicitacoes !== false ? [{ id: 'solicitacoes', label: 'Solicitações' }] : []),
    ...(isAdmin || usuario.pode_ver_aba_perfil !== false ? [{ id: 'perfil', label: 'Meu Perfil' }] : []),
  ]

  // Segurança: se a aba atual foi restringida (ou não existe mais na lista), volta pro Meu Clockin.
  useEffect(() => {
    if (!abas.find(a => a.id === aba)) setAba('ponto')
  }, [])

  function trocarAba(id) {
    if (id === 'relatorio') setRelatorioKey(k => k + 1)
    setAba(id)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-white font-bold text-lg">Clockin App</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => trocarAba('perfil')} className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-0 shadow-none p-0 cursor-pointer hover:opacity-80 transition-opacity">
              {usuario.foto_perfil ? <img src={usuario.foto_perfil} className="w-full h-full object-cover" alt="Foto" /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white text-sm font-bold">{usuario.nome?.charAt(0).toUpperCase()}</div>}
            </button>
            <span className="text-gray-300 text-sm">{usuario.nome}</span>
            {isAdmin && <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{usuario.super_admin ? '👑 Super' : 'Admin'}</span>}
          </div>
          <button onClick={onLogout} className="bg-gray-800 text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-700 cursor-pointer border border-gray-700 w-auto transition-colors">Sair</button>
        </div>
      </div>
      <div className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 overflow-x-auto">
        {abas.map(tab => (
          <button key={tab.id} onClick={() => trocarAba(tab.id)} className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer w-auto ${aba === tab.id ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{tab.label}</button>
        ))}
      </div>
      <div className="p-6">
        {aba === 'aprovacoes' && <AdminAprovacoes usuario={usuario} />}
        {aba === 'colaboradores' && <Colaboradores usuario={usuario} onVerPerfil={(id) => setAba('perfil_colab_' + id)} modo="ativos" />}
        {aba === 'inativos' && <Colaboradores usuario={usuario} onVerPerfil={(id) => setAba('perfil_colab_' + id)} modo="inativos" />}
        {aba === 'cargos' && <AdminCargos usuario={usuario} />}
        {aba === 'escalas' && <AdminEscalas usuario={usuario} />}
        {aba === 'correcoes' && <AdminCorrecoes usuario={usuario} />}
        {aba === 'ponto' && <BaterPonto usuario={usuario} />}
        {aba === 'relatorio' && <RelatorioMensal key={relatorioKey} usuario={usuario} />}
        {aba === 'solicitacoes' && <Solicitacoes usuario={usuario} />}
        {aba === 'perfil' && <PerfilColaborador usuario={usuario} />}
        {aba.startsWith('perfil_colab_') && <PerfilColaborador usuario={usuario} colaboradorId={aba.replace('perfil_colab_', '')} onVoltar={() => setAba('colaboradores')} />}
      </div>
    </div>
  )
}