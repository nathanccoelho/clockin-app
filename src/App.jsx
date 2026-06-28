import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SuperAdmin from './pages/SuperAdmin'
import Totem from './pages/Totem'

const SESSION_KEY = 'ponto_usuario'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [empresaAtiva, setEmpresaAtiva] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) { setCarregando(false); return }
      const sessao = JSON.parse(raw)
      if (Date.now() > sessao.expiraEm) { localStorage.removeItem(SESSION_KEY); setCarregando(false); return }
      setUsuario(sessao.usuario)
      if (sessao.empresaAtiva) setEmpresaAtiva(sessao.empresaAtiva)
    } catch (e) { localStorage.removeItem(SESSION_KEY) }
    setCarregando(false)
  }, [])

  function handleLogin(usuario) {
    const sessao = { usuario, expiraEm: Date.now() + SESSION_DURATION_MS }
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao))
    setUsuario(usuario)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setUsuario(null)
    setEmpresaAtiva(null)
  }

  function entrarEmpresa(emp) {
    const sessao = { usuario, expiraEm: Date.now() + SESSION_DURATION_MS, empresaAtiva: emp }
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao))
    setEmpresaAtiva(emp)
  }

  function voltarSuperAdmin() {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const sessao = JSON.parse(raw)
      sessao.empresaAtiva = null
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessao))
    }
    setEmpresaAtiva(null)
  }

  if (carregando) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 text-lg">Carregando...</p>
    </div>
  )

  if (!usuario) return <Login onLogin={handleLogin} />

  // Perfil totem → vai direto para a tela de totem
  if (usuario.perfil === 'totem') {
    return <Totem usuario={usuario} onLogout={handleLogout} />
  }

  // Super admin sem empresa → painel de empresas
  if (usuario.super_admin && !empresaAtiva) {
    return <SuperAdmin usuario={usuario} onEntrarEmpresa={entrarEmpresa} onLogout={handleLogout} />
  }

  // Super admin dentro de uma empresa → Dashboard com banner
  const usuarioContexto = empresaAtiva
    ? { ...usuario, empresa_id: empresaAtiva.id, perfil: 'admin' }
    : usuario

  return (
    <div>
      {usuario.super_admin && empresaAtiva && (
        <div className="bg-blue-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between">
          <span>👑 Super Admin — Visualizando: <span className="text-blue-200">{empresaAtiva.nome}</span></span>
          <button onClick={voltarSuperAdmin} className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded-lg cursor-pointer border-0 shadow-none w-auto transition-colors">← Voltar ao painel</button>
        </div>
      )}
      <Dashboard usuario={usuarioContexto} onLogout={handleLogout} />
    </div>
  )
}