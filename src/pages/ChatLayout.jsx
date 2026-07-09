import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import { Search, Settings, Users, Plus, Bookmark, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ChatLayout() {
  const { t } = useTranslation()
  const { session, profile } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [chats, setChats] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showGroupModal, setShowGroupModal] = useState(false)
  
  // Group creation state
  const [groupName, setGroupName] = useState('')
  const [groupUsername, setGroupUsername] = useState('')
  const [groupType, setGroupType] = useState('group')
  const [creationError, setCreationError] = useState('')

  const isMobileMainView = location.pathname !== '/'

  useEffect(() => {
    if (profile) loadChats()
  }, [profile, location.pathname])

  const loadChats = async () => {
    try {
      const { data: participants, error: pError } = await supabase
        .from('chat_participants')
        .select('chat_id, chats(id, type, name, avatar_url, updated_at, username)')
        .eq('user_id', profile.id)

      if (pError) throw pError
      if (!participants || participants.length === 0) {
        setChats([])
        return
      }

      const chatIds = participants.map(p => p.chat_id)
      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('chat_id, user_id, profiles(display_name, username, avatar_url)')
        .in('chat_id', chatIds)

      const formattedChats = participants.map(p => {
        const chatInfo = p.chats
        if (!chatInfo) return null
        
        if (chatInfo.type === 'direct') {
          const otherUser = allParticipants?.find(ap => ap.chat_id === chatInfo.id && ap.user_id !== profile.id)
          if (otherUser) {
            return {
              id: chatInfo.id,
              name: otherUser.profiles?.display_name || 'User',
              username: otherUser.profiles?.username,
              avatar: otherUser.profiles?.avatar_url,
              isDirect: true,
              updated_at: chatInfo.updated_at
            }
          } else {
            return {
              id: chatInfo.id,
              name: t('saved_messages', 'Избранное'),
              username: 'saved',
              avatar: null,
              isDirect: true,
              isSaved: true,
              updated_at: chatInfo.updated_at
            }
          }
        } else {
          return {
            id: chatInfo.id,
            name: chatInfo.name || (chatInfo.type === 'channel' ? t('channel', 'Канал') : t('group', 'Группа')),
            username: chatInfo.username ? `@${chatInfo.username}` : chatInfo.type,
            avatar: chatInfo.avatar_url,
            isDirect: false,
            updated_at: chatInfo.updated_at
          }
        }
      }).filter(Boolean).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

      setChats(formattedChats)
    } catch (err) {
      console.error("Error loading chats:", err)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, numeric_id')
      .or(`username.ilike.%${searchQuery}%,numeric_id.eq.${isNaN(searchQuery) ? 0 : searchQuery}`)
      .limit(5)

    setSearchResults(data || [])
  }

  const startDirectChat = async (otherUserId) => {
    try {
      const { data: myChats } = await supabase.from('chat_participants').select('chat_id').eq('user_id', profile.id)
      const myChatIds = myChats?.map(c => c.chat_id) || []
      
      let existingChatId = null
      
      if (myChatIds.length > 0) {
        const { data: shared } = await supabase.from('chat_participants')
          .select('chat_id')
          .in('chat_id', myChatIds)
          .eq('user_id', otherUserId)
          
        if (shared && shared.length > 0) {
          const { data: chatDetails } = await supabase.from('chats')
            .select('id')
            .in('id', shared.map(s => s.chat_id))
            .eq('type', 'direct')
            
          if (chatDetails && chatDetails.length > 0) {
            existingChatId = chatDetails[0].id
          }
        }
      }

      if (existingChatId) {
        navigate(`/chat/${existingChatId}`)
        setSearchQuery('')
        setSearchResults([])
        return
      }

      // Генерация ID на клиенте обходит ошибку RLS
      const newId = crypto.randomUUID()
      
      const { error: chatError } = await supabase.from('chats').insert([{ id: newId, type: 'direct' }])
      if (chatError) throw chatError

      const participants = [{ chat_id: newId, user_id: profile.id }]
      if (profile.id !== otherUserId) {
        participants.push({ chat_id: newId, user_id: otherUserId })
      }
      
      const { error: partError } = await supabase.from('chat_participants').insert(participants)
      if (partError) throw partError

      navigate(`/chat/${newId}`)
      setSearchQuery('')
      setSearchResults([])
      loadChats()
    } catch (error) {
      console.error(error)
      alert(t('error', 'Ошибка: ') + error.message)
    }
  }

  const checkLimits = async () => {
    const { count } = await supabase
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', profile.id)
      .eq('type', groupType)
      
    return count >= 2
  }

  const createGroup = async (e) => {
    e.preventDefault()
    setCreationError('')
    if (!groupName.trim()) return

    try {
      const limitReached = await checkLimits()
      if (limitReached) {
        setCreationError(t('limit_reached', 'Лимит: максимум 2 группы и 2 канала на аккаунт.'))
        return
      }

      const newId = crypto.randomUUID()
      const chatData = { id: newId, type: groupType, name: groupName, admin_id: profile.id }
      if (groupUsername.trim()) {
        chatData.username = groupUsername.trim().toLowerCase()
      }

      const { error: chatError } = await supabase.from('chats').insert([chatData])
      if (chatError) {
        if (chatError.code === '23505') throw new Error(t('username_taken', 'Этот username уже занят'))
        throw chatError
      }

      await supabase.from('chat_participants').insert([{ chat_id: newId, user_id: profile.id }])
      
      setShowGroupModal(false)
      setGroupName('')
      setGroupUsername('')
      loadChats()
      navigate(`/chat/${newId}`)
    } catch (error) {
      setCreationError(error.message)
    }
  }

  return (
    <div className={`app-container ${isMobileMainView ? 'mobile-show-main' : ''}`}>
      <div className="sidebar" style={{ position: 'relative' }}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to={`/profile/${profile?.id}`} className="ripple" style={{ borderRadius: '50%' }}>
              <img 
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'U'}`} 
                className="avatar avatar-sm" 
                alt="My Avatar"
              />
            </Link>
            <Link to={`/profile/${profile?.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <strong style={{ fontSize: '1.1rem' }}>{profile?.display_name}</strong>
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <Link to={location.pathname === '/settings' ? '/' : '/settings'} className="btn-icon ripple"><Settings size={20} /></Link>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder={t('search_placeholder', 'Поиск ID или username...')}
              className="message-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '10px 14px', minHeight: 'auto' }}
            />
            <button type="submit" className="btn-icon ripple" style={{ background: 'var(--bg-secondary)' }}>
              <Search size={18} />
            </button>
          </form>
          
          {searchResults.length > 0 && (
            <div style={{ marginTop: '10px', background: 'var(--bg-glass)', borderRadius: '12px', padding: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', paddingLeft: '8px' }}>{t('search', 'Поиск')}:</div>
              {searchResults.map(user => (
                <div key={user.id} className="chat-item ripple" style={{ padding: '8px', borderRadius: '8px' }} onClick={() => startDirectChat(user.id)}>
                  <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}`} className="avatar avatar-sm" />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{user.display_name} {user.id === profile.id ? t('you', '(Вы)') : ''}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{user.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-list" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="chat-item ripple" onClick={() => startDirectChat(profile.id)}>
             <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}>
               <Bookmark size={20} color="white" />
             </div>
             <div>
               <div style={{ fontWeight: '600' }}>{t('saved_messages', 'Избранное')}</div>
             </div>
          </div>
          {chats.map(chat => (
            <div key={chat.id} className="chat-item ripple" onClick={() => navigate(`/chat/${chat.id}`)}>
              {chat.isSaved ? (
                <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}>
                  <Bookmark size={20} color="white" />
                </div>
              ) : chat.isDirect ? (
                <img src={chat.avatar || `https://ui-avatars.com/api/?name=${chat.name}`} className="avatar avatar-sm" />
              ) : (
                <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
                  <Users size={20} color="var(--accent)" />
                </div>
              )}
              <div>
                <div style={{ fontWeight: '600', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{chat.isDirect ? `@${chat.username}` : chat.username}</div>
              </div>
            </div>
          ))}
        </div>

        <button 
          className="ripple" 
          onClick={() => setShowGroupModal(true)} 
          style={{ position: 'absolute', bottom: '20px', right: '20px', width: '50px', height: '50px', borderRadius: '25px', background: 'var(--accent)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 100 }}
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="main-area">
        <Outlet />
      </div>

      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>{t('create_new_chat', 'Создать новый чат')}</h3>
            <form onSubmit={createGroup}>
              <input 
                type="text" 
                className="input-field" 
                placeholder={t('name', 'Название')} 
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                required
              />
              <input 
                type="text" 
                className="input-field" 
                placeholder={t('username_optional', 'Юзернейм (необязательно)')} 
                value={groupUsername}
                onChange={e => setGroupUsername(e.target.value)}
              />
              <select className="input-field" value={groupType} onChange={e => setGroupType(e.target.value)}>
                <option value="group">{t('group', 'Группа')}</option>
                <option value="channel">{t('channel', 'Канал')}</option>
              </select>
              
              {creationError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '10px' }}>{creationError}</div>}
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn ripple" style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} onClick={() => setShowGroupModal(false)}>{t('cancel', 'Отмена')}</button>
                <button type="submit" className="btn btn-primary ripple" style={{ flex: 1 }}>{t('create', 'Создать')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
