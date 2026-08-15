import { useState } from 'react'
import { supabase } from '../supabase'
import Cadastro from './Cadastro'

function sha256Sync(str) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
}
function gerarCodigo() { return String(Math.floor(100000 + Math.random() * 900000)) }

const OlhoIcon = ({ aberto }) => aberto ? (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
  </svg>
) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

export default function Login({ onLogin }) {
  const [tela, setTela] = useState('login')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [codigoEnviado, setCodigoEnviado] = useState('')
  const [codigoDigitado, setCodigoDigitado] = useState('')
  const [colaboradorRecuperar, setColaboradorRecuperar] = useState(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('')
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [reenvioTimer, setReenvioTimer] = useState(0)

  if (tela === 'cadastro') return <Cadastro onVoltar={() => setTela('login')} />

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setErro('')
    const senhaHash = await sha256Sync(senha)
    const loginLimpo = login.replace(/\D/g, '')
    let query = supabase.from('colaboradores').select('*').eq('senha_hash', senhaHash)
    if (login.includes('@')) query = query.eq('email', login.trim().toLowerCase())
    else query = query.eq('cpf', loginLimpo)
    const { data, error } = await query.single()
    if (error || !data) { setErro('Login ou senha incorretos.'); setLoading(false); return }
    if (data.status === 'pendente') { setErro('Cadastro pendente de aprovação.'); setLoading(false); return }
    if (data.status === 'recusado') { setErro('Cadastro recusado. Entre em contato com o administrador.'); setLoading(false); return }
    onLogin(data); setLoading(false)
  }

  async function enviarCodigoRecuperacao() {
    setLoading(true); setErro('')
    const { data: colab } = await supabase.from('colaboradores').select('id, nome, email').eq('email', emailRecuperar.trim().toLowerCase()).eq('status', 'aprovado').maybeSingle()
    if (!colab) { setErro('Email não encontrado.'); setLoading(false); return }
    const codigo = gerarCodigo()
    setCodigoEnviado(codigo); setColaboradorRecuperar(colab)
    try { await supabase.functions.invoke('enviar-codigo-email', { body: { email: colab.email, nome: colab.nome, codigo, tipo: 'recuperacao' } }) } catch { setErro(`DEV: código ${codigo}`) }
    setLoading(false); setTela('codigo')
    setReenvioTimer(60)
    const interval = setInterval(() => { setReenvioTimer(t => { if (t <= 1) { clearInterval(interval); return 0 } return t - 1 }) }, 1000)
  }

  function verificarCodigoRecuperacao() {
    setErro('')
    if (codigoDigitado.trim() === codigoEnviado) setTela('nova_senha')
    else setErro('Código incorreto. Verifique seu email.')
  }

  async function salvarNovaSenha(e) {
    e.preventDefault(); setErro('')
    if (novaSenha.length < 6) { setErro('Mínimo 6 caracteres.'); return }
    if (novaSenha !== confirmarNovaSenha) { setErro('As senhas não coincidem.'); return }
    setSalvandoSenha(true)
    const hash = await sha256Sync(novaSenha)
    await supabase.from('colaboradores').update({ senha_hash: hash }).eq('id', colaboradorRecuperar.id)
    setSalvandoSenha(false); setTela('sucesso_senha')
  }

  if (tela === 'nova_senha') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8"><div className="text-5xl mb-4">🔑</div><h2 className="text-white text-2xl font-bold mb-1">Nova senha</h2><p className="text-gray-400 text-sm">Digite sua nova senha</p></div>
        <form onSubmit={salvarNovaSenha} className="space-y-4">
          <div className="relative">
            <input type={mostrarNovaSenha ? 'text' : 'password'} placeholder="Nova senha" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 pr-12 text-lg placeholder-gray-500 focus:border-green-500 focus:outline-none" required />
            <button type="button" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-gray-300"><OlhoIcon aberto={mostrarNovaSenha} /></button>
          </div>
          <input type="password" placeholder="Confirmar nova senha" value={confirmarNovaSenha} onChange={e => setConfirmarNovaSenha(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 text-lg placeholder-gray-500 focus:border-green-500 focus:outline-none" required />
          {confirmarNovaSenha && novaSenha !== confirmarNovaSenha && <p className="text-red-400 text-xs">⚠️ As senhas não coincidem</p>}
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" disabled={salvandoSenha} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">{salvandoSenha ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form>
      </div>
    </div>
  )

  if (tela === 'sucesso_senha') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-7xl mb-6">✅</div>
        <h2 className="text-white text-3xl font-bold mb-3">Senha alterada!</h2>
        <p className="text-gray-400 mb-8">Faça login com sua nova senha.</p>
        <button onClick={() => { setTela('login'); setErro('') }} className="bg-green-500 text-white font-bold py-4 px-10 rounded-2xl text-lg hover:bg-green-600 cursor-pointer transition-colors">Ir para o login</button>
      </div>
    </div>
  )

  if (tela === 'codigo') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={() => setTela('recuperar')} className="text-gray-400 mb-6 w-auto bg-transparent border-0 shadow-none p-0 flex items-center gap-2 hover:text-white cursor-pointer">← Voltar</button>
        <div className="text-center mb-8"><div className="text-5xl mb-4">📧</div><h2 className="text-white text-2xl font-bold mb-2">Verifique seu email</h2><p className="text-gray-400 text-sm">Enviamos um código para<br /><span className="text-green-400 font-semibold">{emailRecuperar}</span></p></div>
        <div className="space-y-4">
          <input type="text" maxLength={6} placeholder="000000" value={codigoDigitado} onChange={e => setCodigoDigitado(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 text-2xl text-center tracking-widest placeholder-gray-600 focus:border-green-500 focus:outline-none" />
          {erro && <p className={`text-sm text-center ${erro.startsWith('DEV:') ? 'text-yellow-400 bg-yellow-500/10 rounded-xl p-3' : 'text-red-400'}`}>{erro}</p>}
          <button onClick={verificarCodigoRecuperacao} disabled={codigoDigitado.length !== 6} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">Verificar código</button>
          <div className="text-center">{reenvioTimer > 0 ? <p className="text-gray-500 text-sm">Reenviar em {reenvioTimer}s</p> : <button onClick={enviarCodigoRecuperacao} className="text-green-400 text-sm font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">Reenviar código</button>}</div>
        </div>
      </div>
    </div>
  )

  if (tela === 'recuperar') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={() => { setTela('login'); setErro('') }} className="text-gray-400 mb-6 w-auto bg-transparent border-0 shadow-none p-0 flex items-center gap-2 hover:text-white cursor-pointer">← Voltar ao login</button>
        <div className="text-center mb-8"><div className="text-5xl mb-4">🔒</div><h2 className="text-white text-2xl font-bold mb-2">Recuperar acesso</h2><p className="text-gray-400 text-sm">Digite o email cadastrado para receber o código de verificação</p></div>
        <div className="space-y-4">
          <div><label className="block text-gray-400 text-sm mb-1">Email cadastrado</label><input type="email" placeholder="seu@email.com" value={emailRecuperar} onChange={e => setEmailRecuperar(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 text-lg placeholder-gray-500 focus:border-green-500 focus:outline-none" required /></div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button onClick={enviarCodigoRecuperacao} disabled={loading || !emailRecuperar.trim()} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors">{loading ? 'Enviando...' : 'Enviar código'}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h1 className="text-white text-3xl font-bold">Clockin App</h1>
          <p className="text-gray-400 text-sm mt-1">Faça login para continuar</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div><label className="block text-gray-400 text-sm mb-1">CPF ou E-mail</label><input type="text" placeholder="Digite seu CPF ou e-mail" value={login} onChange={e => setLogin(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 text-lg placeholder-gray-500 focus:border-green-500 focus:outline-none cursor-text" required /></div>
          <div><label className="block text-gray-400 text-sm mb-1">Senha</label>
            <div className="relative">
              <input type={mostrarSenha ? 'text' : 'password'} placeholder="Digite sua senha" value={senha} onChange={e => setSenha(e.target.value)} className="w-full bg-gray-800 text-white border border-gray-700 rounded-2xl p-4 pr-12 text-lg placeholder-gray-500 focus:border-green-500 focus:outline-none" required />
              <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-gray-300"><OlhoIcon aberto={mostrarSenha} /></button>
            </div>
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" disabled={loading} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl text-lg hover:bg-green-600 disabled:opacity-50 cursor-pointer transition-colors mt-2">{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <p className="text-center text-gray-500 mt-6 text-sm">Não tem conta?{' '}<button onClick={() => setTela('cadastro')} className="text-green-400 font-semibold w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-green-300">Cadastre-se</button></p>
        <p className="text-center text-gray-600 mt-3 text-xs">Esqueceu a senha?{' '}<button onClick={() => { setTela('recuperar'); setErro(''); setEmailRecuperar('') }} className="text-gray-400 w-auto p-0 bg-transparent border-0 shadow-none cursor-pointer hover:text-gray-300">Recuperar acesso</button></p>
      </div>
    </div>
  )
}