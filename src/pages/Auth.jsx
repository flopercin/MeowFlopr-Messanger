import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { AlertCircle } from 'lucide-react'

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        if (!username || username.trim().length < 3) {
          throw new Error('Имя пользователя должно быть не короче 3 символов')
        }
        
        // Регистрация
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim().toLowerCase() }
          }
        })
        if (signUpError) throw signUpError
        alert('Успешно! Вы можете войти.')
        setIsSignUp(false)
      } else {
        // Вход
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err.message || 'Произошла ошибка при авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center-card">
      <img src="/Icon.png" alt="MeowFlopr" style={{ width: '80px', height: '80px', margin: '0 auto 16px', borderRadius: '20px' }} />
      <h1 style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent)' }}>MeowFlopr</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        {isSignUp ? 'Создать новый аккаунт' : 'С возвращением!'}
      </p>

      <form onSubmit={handleAuth}>
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {isSignUp && (
          <input
            type="text"
            className="input-field"
            placeholder="Уникальный username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}

        <input
          type="email"
          className="input-field"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="input-field"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={loading}>
          {loading ? 'Загрузка...' : isSignUp ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>

      <div style={{ marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {isSignUp ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isSignUp ? 'Войти' : 'Создать'}
        </button>
      </div>
    </div>
  )
}
