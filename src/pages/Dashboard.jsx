import { useState } from 'react'
import Colaboradores from './Colaboradores'
import AdminAprovacoes from './AdminAprovacoes'
import AdminCargos from './AdminCargos'
import AdminCorrecoes from './AdminCorrecoes'
import BaterPonto from './BaterPonto'
import RelatorioMensal from './RelatorioMensal'

export default function Dashboard({ usuario, onLogout }) {
  const isAdmin = usuario.perfil === 'admin'

  // Tela inicial: relatório mensal para todos
  const [aba, setAba] = useState('relatorio')

  const abas = [
    ...(isAdmin ? [{ id: 'aprovacoes', label: 'Aprovações' }] : []),
    ...(isAdmin ? [{ id: 'colaboradores', label: 'Colaboradores' }] : []),
    ...(isAdmin ? [{ id: 'cargos', label: 'Cargos' }] : []),
    ...(isAdmin ? [{ id: 'correcoes', label: 'Correções' }] : []),
    { id: 'ponto', label: 'Meu Ponto' },
    { id: 'relatorio', label: 'Relatório Mensal' },
  ]

  return (
    <div className="min-h-screen bg-gray-950">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-white font-bold text-lg">Ponto Eletrônico</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {usuario.nome?.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-300 text-sm">{usuario.nome}</span>
            {isAdmin && <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Admin</span>}
          </div>
          <button onClick={onLogout}
            className="bg-gray-800 text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-700 cursor-pointer border border-gray-700 w-auto transition-colors">
            Sair
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 overflow-x-auto">
        {abas.map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer w-auto ${
              aba === tab.id
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        {aba === 'aprovacoes' && <AdminAprovacoes usuario={usuario} />}
        {aba === 'colaboradores' && <Colaboradores usuario={usuario} />}
        {aba === 'cargos' && <AdminCargos usuario={usuario} />}
        {aba === 'correcoes' && <AdminCorrecoes usuario={usuario} />}
        {aba === 'ponto' && <BaterPonto usuario={usuario} />}
        {aba === 'relatorio' && <RelatorioMensal usuario={usuario} />}
      </div>
    </div>
  )
}