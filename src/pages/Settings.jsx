import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import { Mail, CheckCircle, AlertTriangle, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { t } = useTranslation()
  const { session, profile, setProfile, setSession } = useStore()
  const navigate = useNavigate()

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
    
    import('../i18n').then(module => {
       module.default.changeLanguage(newLang)
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    navigate('/')
  }

  const isEmailConfirmed = session?.user?.email_confirmed_at != null

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '1.8rem' }}>{t('settings', 'Настройки')}</h2>

      <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>{t('account', 'Аккаунт')}</h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Mail color="var(--text-secondary)" />
          <div>
            <div style={{ fontWeight: '500' }}>{session?.user?.email}</div>
            {isEmailConfirmed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem' }}>
                <CheckCircle size={14} /> {t('email_confirmed', 'Подтверждена')}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.85rem' }}>
                <AlertTriangle size={14} /> {t('email_unconfirmed', 'Почта не подтверждена')}
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            {t('change_email', 'Сменить почту (Скоро)')}
          </button>
          
          <button onClick={handleLogout} className="btn ripple" style={{ background: '#ef4444', color: 'white', border: 'none', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <LogOut size={18} />
            {t('logout', 'Выйти')}
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-glass)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginBottom: '16px' }}>{t('appearance_language', 'Внешний вид и Язык')}</h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>{t('theme', 'Тема оформления')}</label>
          <select 
            className="input-field" 
            value={profile?.theme || 'dark'} 
            onChange={handleThemeChange}
            style={{ cursor: 'pointer' }}
          >
            <option value="dark">{t('theme_dark', 'Темная (Стекло)')}</option>
            <option value="light">{t('theme_light', 'Светлая')}</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>{t('language', 'Язык')}</label>
          <select 
            className="input-field" 
            value={profile?.language || 'ru'} 
            onChange={handleLanguageChange}
            style={{ cursor: 'pointer' }}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    </div>
  )
}
