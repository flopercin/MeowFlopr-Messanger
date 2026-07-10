import React, { useEffect, useState, useRef } from 'react'
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import { Search, Settings, Users, Plus, Bookmark, X, Pin } from 'lucide-react'
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
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [contextMenu, setContextMenu] = useState(null)
  
  const [groupName, setGroupName] = useState('')
  const [groupUsername, setGroupUsername] = useState('')
  const [groupType, setGroupType] = useState('group')
  const [creationError, setCreationError] = useState('')

  const isMobileMainView = location.pathname !== '/'

  useEffect(() => {
    if (!profile) return
    loadChats()

    const chatSub = supabase
      .channel('chat_list_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants', filter: `user_id=eq.${profile.id}` }, () => loadChats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats())
      .subscribe()

    // Presence (Online Status)
    const presenceChannel = supabase.channel('online_users')
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      const onlineSet = new Set()
      for (const id in state) {
        state[id].forEach(presence => {
          if (presence.user) onlineSet.add(presence.user)
        })
      }
      setOnlineUsers(onlineSet)
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user: profile.id })
      }
    })

    // Обновляем last_seen при загрузке
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', profile.id).then()

    return () => {
      supabase.removeChannel(chatSub)
      supabase.removeChannel(presenceChannel)
    }
  }, [profile])

  const loadChats = async () => {
    try {
      const { data: participants, error: pError } = await supabase
        .from('chat_participants')
        .select('chat_id, is_pinned, chats(id, type, name, avatar_url, created_at, username)')
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
          
          if (otherUser && otherUser.profiles) {
            return {
              id: chatInfo.id,
              other_user_id: otherUser.user_id,
              name: otherUser.profiles.display_name || 'User',
              username: otherUser.profiles.username,
              avatar: otherUser.profiles.avatar_url,
              isDirect: true,
              is_pinned: p.is_pinned,
              created_at: chatInfo.created_at
            }
          } else {
            return {
              id: chatInfo.id,
              name: t('saved_messages', 'Избранное'),
              username: 'saved',
              avatar: null,
              isDirect: true,
              isSaved: true,
              is_pinned: p.is_pinned,
              created_at: chatInfo.created_at
            }
          }
        } else {
          return {
            id: chatInfo.id,
            name: chatInfo.name || (chatInfo.type === 'channel' ? t('channel', 'Канал') : t('group', 'Группа')),
            username: chatInfo.username ? `@${chatInfo.username}` : chatInfo.type,
            avatar: chatInfo.avatar_url,
            isDirect: false,
            is_pinned: p.is_pinned,
            created_at: chatInfo.created_at
          }
        }
      }).filter(Boolean).sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1
        if (!a.is_pinned && b.is_pinned) return 1
        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      })

      setChats(formattedChats)
    } catch (err) {
      console.error(err)
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

      const newId = crypto.randomUUID()
      await supabase.from('chats').insert([{ id: newId, type: 'direct' }])

      const participants = [{ chat_id: newId, user_id: profile.id }]
      if (profile.id !== otherUserId) {
        participants.push({ chat_id: newId, user_id: otherUserId })
      }
      
      await supabase.from('chat_participants').insert(participants)

      navigate(`/chat/${newId}`)
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      alert(error.message)
    }
  }

  const createGroup = async (e) => {
    e.preventDefault()
    setCreationError('')
    if (!groupName.trim()) return

    try {
      const { count } = await supabase.from('chats').select('*', { count: 'exact', head: true }).eq('admin_id', profile.id).eq('type', groupType)
      if (count >= 2) return setCreationError(t('limit_reached', 'Лимит: максимум 2 группы и 2 канала.'))

      const newId = crypto.randomUUID()
      const chatData = { id: newId, type: groupType, name: groupName, admin_id: profile.id }
      if (groupUsername.trim()) chatData.username = groupUsername.trim().toLowerCase()

      const { error: chatError } = await supabase.from('chats').insert([chatData])
      if (chatError && chatError.code === '23505') throw new Error(t('username_taken', 'Этот username уже занят'))

      await supabase.from('chat_participants').insert([{ chat_id: newId, user_id: profile.id }])
      
      setShowGroupModal(false)
      setGroupName('')
      setGroupUsername('')
      navigate(`/chat/${newId}`)
    } catch (error) {
      setCreationError(error.message)
    }
  }

  const handleContextMenu = (e, chat) => {
    e.preventDefault()
    setContextMenu({ x: e.pageX, y: e.pageY, chat })
  }

  const togglePin = async () => {
    if (!contextMenu) return
    const { chat } = contextMenu
    const newPinned = !chat.is_pinned
    
    // Оптимистично
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, is_pinned: newPinned } : c).sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    }))
    setContextMenu(null)

    await supabase.from('chat_participants').update({ is_pinned: newPinned }).eq('chat_id', chat.id).eq('user_id', profile.id)
  }

  const hasSavedMessages = chats.some(c => c.isSaved)

  return (
    <div className={`app-container ${isMobileMainView ? 'mobile-show-main' : ''}`} onClick={() => setContextMenu(null)}>
      <div className="sidebar" style={{ position: 'relative' }}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to={`/profile/${profile?.id}`} className="ripple" style={{ borderRadius: '50%' }}>
              <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'U'}`} className="avatar avatar-sm" />
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
            <button type="submit" className="btn-icon ripple" style={{ background: 'var(--bg-secondary)' }}><Search size={18} /></button>
          </form>
          
          {searchResults.length > 0 && (
            <div style={{ marginTop: '10px', background: 'var(--bg-glass)', borderRadius: '12px', padding: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', paddingLeft: '8px' }}>{t('search', 'Поиск')}:</div>
              {searchResults.map(user => (
                <div key={user.id} className="chat-item ripple" style={{ padding: '8px', borderRadius: '8px' }} onClick={() => startDirectChat(user.id)}>
                  <div style={{ position: 'relative' }}>
                    <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}`} className="avatar avatar-sm" />
                    {onlineUsers.has(user.id) && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-glass)' }}/>}
                  </div>
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
          {!hasSavedMessages && (
            <div className="chat-item ripple" onClick={() => startDirectChat(profile.id)}>
               <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}>
                 <Bookmark size={20} color="white" />
               </div>
               <div>
                 <div style={{ fontWeight: '600' }}>{t('saved_messages', 'Избранное')}</div>
               </div>
            </div>
          )}
          
          {chats.map(chat => (
            <div 
              key={chat.id} 
              className={`chat-item ripple ${location.pathname === `/chat/${chat.id}` ? 'active' : ''}`} 
              onClick={() => navigate(`/chat/${chat.id}`)}
              onContextMenu={(e) => handleContextMenu(e, chat)}
            >
              {chat.isSaved ? (
                <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}>
                  <Bookmark size={20} color="white" />
                </div>
              ) : chat.isDirect ? (
                <div style={{ position: 'relative' }}>
                  <img src={chat.avatar || `https://ui-avatars.com/api/?name=${chat.name}`} className="avatar avatar-sm" />
                  {onlineUsers.has(chat.other_user_id) && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-primary)' }}/>}
                </div>
              ) : (
                <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
                  <Users size={20} color="var(--accent)" />
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{chat.isDirect ? `@${chat.username}` : chat.username}</div>
              </div>

              {chat.is_pinned && <Pin size={16} color="var(--text-secondary)" style={{ transform: 'rotate(45deg)' }} />}
            </div>
          ))}
        </div>

        <button className="ripple" onClick={() => setShowGroupModal(true)} style={{ position: 'absolute', bottom: '20px', right: '20px', width: '50px', height: '50px', borderRadius: '25px', background: 'var(--accent)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 100 }}>
          <Plus size={24} />
        </button>
      </div>

      <div className="main-area">
        <Outlet context={{ onlineUsers }} />
      </div>

      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'var(--bg-glass)', backdropFilter: 'blur(10px)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '8px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          <button className="btn-icon ripple" style={{ width: '100%', display: 'flex', gap: '8px', padding: '8px 16px', justifyContent: 'flex-start' }} onClick={togglePin}>
            <Pin size={18} style={{ transform: contextMenu.chat.is_pinned ? 'none' : 'rotate(45deg)' }}/>
            {contextMenu.chat.is_pinned ? t('unpin', 'Открепить') : t('pin', 'Закрепить')}
          </button>
        </div>
      )}

      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>{t('create_new_chat', 'Создать новый чат')}</h3>
            <form onSubmit={createGroup}>
              <input type="text" className="input-field" placeholder={t('name', 'Название')} value={groupName} onChange={e => setGroupName(e.target.value)} required />
              <input type="text" className="input-field" placeholder={t('username_optional', 'Юзернейм (необязательно)')} value={groupUsername} onChange={e => setGroupUsername(e.target.value)} />
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
