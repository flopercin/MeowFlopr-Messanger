import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import { Mail, CheckCircle, AlertTriangle } from 'lucide-react'

export default function Settings() {
  const { session, profile, setProfile } = useStore()
  const [loading, setLoading] = useState(false)

  const handleThemeChange = async (e) => {
    const newTheme = e.target.value
    document.documentElement.setAttribute('data-theme', newTheme)
    setProfile({ ...profile, theme: newTheme })
    
    await supabase.from('profiles').update({ theme: newTheme }).eq('id', profile.id)
  }

  const handleLanguageChange = async (e) => {
    const newLang = e.target.value
    setProfile({ ...profile, language: newLang })
    await supabase.from('profiles').update({ language: newLang }).eq('id', profile.id)
    
    import('i18next').then(i18n => {
       i18n.default.changeLanguage(newLang)
    })
  }

  const isEmailConfirmed = session?.user?.email_confirmed_at != null

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.8rem' }}>Настройки</h2>

      <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Аккаунт</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Mail color="var(--text-secondary)" />
          <div>
            <div style={{ fontWeight: '500' }}>{session?.user?.email}</div>
            {isEmailConfirmed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem' }}>
                <CheckCircle size={14} /> Подтверждена
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.85rem' }}>
                <AlertTriangle size={14} /> Почта не подтверждена
                <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>(Подтверждение временно отключено сервером)</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Placeholder for future change email feature */}
        <button className="btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
          Сменить почту (Скоро)
        </button>
      </div>

      <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '16px' }}>Внешний вид и Язык</h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Тема оформления</label>
          <select 
            className="input-field" 
            value={profile?.theme || 'dark'} 
            onChange={handleThemeChange}
            style={{ cursor: 'pointer' }}
          >
            <option value="dark">Темная (Стекло)</option>
            <option value="light">Светлая</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Язык</label>
          <select 
            className="input-field" 
            value={profile?.language || 'ru'} 
            onChange={handleLanguageChange}
            style={{ cursor: 'pointer' }}
          >
            <option value="ru">Русский</option>
            <option value="en">English (В разработке)</option>
          </select>
        </div>
      </div>
    </div>
  )
}
