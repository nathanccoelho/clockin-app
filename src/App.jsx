import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

const SESSION_KEY = 'ponto_usuario'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) { setCarregando(false); return }
      const sessao = JSON.parse(raw)
      if (Date.now() > sessao.expiraEm) {
        localStorage.removeItem(SESSION_KEY)
        setCarregando(false)
        return
      }
      setUsuario(sessao.usuario)
    } catch (e) {
      localStorage.removeItem(SESSION_KEY)
    }
    setCarregando(false)
  }, [])

  function handleLogin(usuario) {
    const sessao = {
      usuario,
      expiraEm: Date.now() + SESSION_DURATION_MS
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao))
    setUsuario(usuario)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setUsuario(null)
  }

  if (carregando) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500 text-lg">Carregando...</p>
    </div>
  )

  if (usuario) return <Dashboard usuario={usuario} onLogout={handleLogout} />
  return <Login onLogin={handleLogin} />
}