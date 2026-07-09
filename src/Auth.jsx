import React, { useState } from 'react'
import { supabase } from './supabaseClient'
import { AlertCircle } from 'lucide-react'

export default function Auth({ onAuthSuccess }) {
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
        // Регистрация
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0], // Если юзернейм пуст, берем часть email
            }
          }
        })
        if (signUpError) throw signUpError
        
        alert('Регистрация успешна! Если на почту не пришло подтверждение, вы уже можете попробовать войти (в тестовом режиме Supabase по умолчанию авто-подтверждает почту или позволяет входить сразу).')
        setIsSignUp(false)
      } else {
        // Вход
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        if (data?.user) {
          onAuthSuccess(data.user)
        }
      }
    } catch (err) {
      setError(err.message || 'Произошла ошибка при авторизации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-container auth-wrapper">
      <h1 className="auth-title">MeowFlopr</h1>
      <p className="auth-subtitle">
        {isSignUp ? 'Создай аккаунт для общения с друзьями' : 'Войди, чтобы начать общение'}
      </p>

      <form onSubmit={handleAuth}>
        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {isSignUp && (
          <div className="input-group">
            <label className="input-label">Имя (Отображается в чате)</label>
            <input
              type="text"
              className="input-field"
              placeholder="Ваш никнейм"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required={isSignUp}
            />
          </div>
        )}

        <div className="input-group">
          <label className="input-label">Электронная почта</label>
          <input
            type="email"
            className="input-field"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label className="input-label">Пароль</label>
          <input
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Загрузка...' : isSignUp ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>

      <div className="auth-toggle">
        {isSignUp ? 'Уже есть аккаунт?' : 'Впервые тут?'}
        <button
          type="button"
          className="auth-toggle-link"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError(null)
          }}
        >
          {isSignUp ? 'Войти' : 'Создать аккаунт'}
        </button>
      </div>
    </div>
  )
}
