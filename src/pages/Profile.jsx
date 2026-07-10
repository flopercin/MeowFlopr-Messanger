import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import imageCompression from 'browser-image-compression'
import { Edit2, Save, ChevronLeft, Camera } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Profile() {
  const { t } = useTranslation()
  const { userId } = useParams()
  const navigate = useNavigate()
  const { profile: currentUserProfile, setProfile: setCurrentUserProfile } = useStore()
  
  const [profileData, setProfileData] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  
  const [editForm, setEditForm] = useState({
    display_name: '',
    username: '',
    description: '',
    hide_last_seen: false
  })
  
  const [uploading, setUploading] = useState(false)

  const isMe = currentUserProfile?.id === userId

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfileData(data)
      setEditForm({
        display_name: data.display_name || '',
        username: data.username || '',
        description: data.description || '',
        hide_last_seen: data.hide_last_seen || false
      })
    }
  }

  const handleSave = async () => {
    if (!editForm.username.trim() || !editForm.display_name.trim()) {
      alert(t('fill_required', 'Имя и Юзернейм обязательны!'))
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editForm.display_name.trim(),
          username: editForm.username.trim().toLowerCase(),
          description: editForm.description.trim(),
          hide_last_seen: editForm.hide_last_seen
        })
        .eq('id', userId)

      if (error) {
        if (error.code === '23505') throw new Error(t('username_taken', 'Этот username уже занят!'))
        throw error
      }

      setProfileData({ ...profileData, ...editForm })
      if (isMe) setCurrentUserProfile({ ...currentUserProfile, ...editForm })
      setIsEditing(false)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleAvatarChange = async (e) => {
    if (!isMe) return
    const file = e.target.files[0]
    if (!file) return

    try {
      setUploading(true)
      const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 800 })
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedFile)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
      
      setProfileData({ ...profileData, avatar_url: data.publicUrl })
      setCurrentUserProfile({ ...currentUserProfile, avatar_url: data.publicUrl })

    } catch (err) {
      alert(t('avatar_error', 'Ошибка загрузки аватара: ') + err.message)
    } finally {
      setUploading(false)
    }
  }

  if (!profileData) return <div style={{ padding: '24px' }}>{t('loading', 'Загрузка...')}</div>

  let statusText = ''
  if (profileData.hide_last_seen && !isMe) {
    statusText = t('last_seen_recently', 'был(а) недавно')
  } else if (profileData.last_seen) {
    const date = new Date(profileData.last_seen)
    statusText = `${t('last_seen', 'был(а)')} ${date.toLocaleDateString() === new Date().toLocaleDateString() ? t('today', 'сегодня') : date.toLocaleDateString()} ${t('at', 'в')} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } else {
    statusText = t('last_seen_recently', 'был(а) недавно')
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%', height: '100dvh', overflowY: 'auto' }}>
      <div className="topbar" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-glass)', backdropFilter: 'blur(20px)' }}>
        <button className="btn-icon ripple" onClick={() => navigate(-1)} style={{ marginLeft: '-10px' }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{t('profile', 'Профиль')}</div>
        {isMe && (
          <button className="btn-icon ripple" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
            {isEditing ? <Save size={20} color="#10b981" /> : <Edit2 size={20} />}
          </button>
        )}
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <img 
            src={profileData.avatar_url || `https://ui-avatars.com/api/?name=${profileData.display_name}&size=150`} 
            style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
            alt="Avatar"
          />
          {isMe && isEditing && (
            <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--accent)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              {uploading ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}/> : <Camera size={20} />}
              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleAvatarChange} disabled={uploading} />
            </label>
          )}
        </div>
        
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          {statusText}
        </div>

        <div style={{ width: '100%', background: 'var(--bg-secondary)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('name', 'Имя')}</div>
            {isEditing ? (
              <input type="text" className="input-field" value={editForm.display_name} onChange={e => setEditForm({...editForm, display_name: e.target.value})} />
            ) : (
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{profileData.display_name}</div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('username_id', 'Юзернейм и ID')}</div>
            {isEditing ? (
              <input type="text" className="input-field" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} />
            ) : (
              <div style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>@{profileData.username} <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>#{profileData.numeric_id}</span></div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{t('about', 'О себе')}</div>
            {isEditing ? (
              <textarea className="input-field" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={3} placeholder={t('about_placeholder', 'Напишите что-нибудь о себе...')} />
            ) : (
              <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{profileData.description || <span style={{ opacity: 0.5 }}>{t('no_description', 'Ничего не указано')}</span>}</div>
            )}
          </div>
          
          {isMe && isEditing && (
             <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <input 
                 type="checkbox" 
                 id="hideLastSeen" 
                 checked={editForm.hide_last_seen}
                 onChange={e => setEditForm({...editForm, hide_last_seen: e.target.checked})}
                 style={{ width: '18px', height: '18px', cursor: 'pointer' }}
               />
               <label htmlFor="hideLastSeen" style={{ cursor: 'pointer' }}>{t('hide_last_seen', 'Скрывать время в сети ("был(а) недавно")')}</label>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
