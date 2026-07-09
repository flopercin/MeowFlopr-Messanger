import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import imageCompression from 'browser-image-compression'
import { Camera, Save, X } from 'lucide-react'

export default function Profile() {
  const { userId } = useParams()
  const { profile: currentUserProfile, setProfile: setCurrentUserProfile } = useStore()
  const [viewedProfile, setViewedProfile] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  // Форма редактирования
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const isMyProfile = currentUserProfile?.id === userId

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setViewedProfile(data)
      setDisplayName(data.display_name || '')
      setUsername(data.username || '')
      setAvatarUrl(data.avatar_url || '')
    }
    setLoading(false)
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setSaving(true)
      
      // Сжатие картинки
      const options = {
        maxSizeMB: 0.2, // Максимум 200KB
        maxWidthOrHeight: 500,
        useWebWorker: true
      }
      const compressedFile = await imageCompression(file, options)
      
      // Загрузка в Supabase Storage
      const fileExt = compressedFile.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      
      // Сразу сохраняем в базу
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      if (isMyProfile) {
        setCurrentUserProfile({ ...currentUserProfile, avatar_url: publicUrl })
      }
    } catch (err) {
      alert('Ошибка при загрузке аватарки: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (username.length < 3) {
      alert('Username должен быть не короче 3 символов')
      return
    }

    setSaving(true)
    const updates = {
      display_name: displayName,
      username: username.toLowerCase()
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      alert('Ошибка сохранения: возможно такой username уже занят')
    } else {
      setViewedProfile({ ...viewedProfile, ...updates })
      if (isMyProfile) {
        setCurrentUserProfile({ ...currentUserProfile, ...updates })
      }
      setIsEditing(false)
    }
    setSaving(false)
  }

  const handleMessageUser = async () => {
    // Начинаем чат
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', currentUserProfile.id)

    const chatIds = participants?.map(p => p.chat_id) || []
    
    // Ищем, есть ли уже чат с этим пользователем
    const { data: sharedChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .in('chat_id', chatIds)
      .eq('user_id', userId)

    if (sharedChats && sharedChats.length > 0) {
      navigate(`/chat/${sharedChats[0].chat_id}`)
    } else {
      // Создаем новый
      const { data: newChat } = await supabase.from('chats').insert([{}]).select().single()
      if (newChat) {
        await supabase.from('chat_participants').insert([
          { chat_id: newChat.id, user_id: currentUserProfile.id },
          { chat_id: newChat.id, user_id: userId }
        ])
        navigate(`/chat/${newChat.id}`)
      }
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Загрузка профиля...</div>
  if (!viewedProfile) return <div style={{ padding: '40px', textAlign: 'center' }}>Пользователь не найден</div>

  const currentAvatar = isEditing ? avatarUrl : viewedProfile.avatar_url
  const defaultAvatar = `https://ui-avatars.com/api/?name=${viewedProfile.display_name || viewedProfile.username}&size=200`

  return (
    <div className="center-card" style={{ marginTop: '40px' }}>
      <div style={{ position: 'relative', width: '120px', margin: '0 auto 24px' }}>
        <img 
          src={currentAvatar || defaultAvatar} 
          alt="Avatar" 
          className="avatar avatar-lg"
          style={{ width: '120px', height: '120px' }}
        />
        {isEditing && (
          <>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="btn-icon"
              style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--accent)', color: 'white' }}
            >
              <Camera size={18} />
            </button>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleAvatarChange}
            />
          </>
        )}
      </div>

      {!isEditing ? (
        <>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{viewedProfile.display_name}</h2>
          <div style={{ color: 'var(--accent)', fontWeight: '600', marginBottom: '8px' }}>@{viewedProfile.username}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '32px' }}>
            ID Пользователя: {viewedProfile.numeric_id}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {isMyProfile ? (
              <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                Редактировать профиль
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleMessageUser}>
                Написать сообщение
              </button>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Отображаемое имя</label>
            <input 
              type="text" 
              className="input-field" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
            />
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Username (уникальный)</label>
            <input 
              type="text" 
              className="input-field" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={() => setIsEditing(false)} disabled={saving}>
              <X size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Отмена
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
              <Save size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
