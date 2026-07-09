import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import useStore from './store'
import Auth from './pages/Auth'
import ChatLayout from './pages/ChatLayout'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

export default function App() {
  const { session, setSession, profile, setProfile } = useStore()
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Получение сессии
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error)
      } else if (data) {
        setProfile(data)
        document.documentElement.setAttribute('data-theme', data.theme || 'dark')
        import('./i18n').then(module => {
           module.default.changeLanguage(data.language || 'ru')
        })
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Загрузка...</div>
  }

  return (
    <div className="app-container">
      <Routes>
        {!session ? (
          <Route path="*" element={<Auth />} />
        ) : (
          <Route path="/" element={<ChatLayout />}>
            <Route index element={
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)' }}>
                Выберите чат или начните новый диалог
              </div>
            } />
            <Route path="chat/:chatId" element={<ChatRoom />} />
            <Route path="profile/:userId" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        )}
      </Routes>
    </div>
  )
}
