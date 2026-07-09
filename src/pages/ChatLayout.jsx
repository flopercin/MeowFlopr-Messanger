import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import { Search, Settings, LogOut, Users, Plus, Bookmark } from 'lucide-react'

const TITLES = ["Meow", "MeowFlopr", "flopercin?", "67", "92", "ура робло", "Мр", "мяу", "кошка", "дыня", "melon", "MeowMeowMeow"]

export default function ChatLayout() {
  const { session, profile, setSession } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [chats, setChats] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [randomTitle, setRandomTitle] = useState(TITLES[0])
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState('group')

  const isMobileMainView = location.pathname !== '/'

  useEffect(() => {
    // Рандомный заголовок каждые 10 секунд
    const interval = setInterval(() => {
      setRandomTitle(TITLES[Math.floor(Math.random() * TITLES.length)])
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (profile) loadChats()
  }, [profile, location.pathname]) // Reload chats when navigating back to list

  const loadChats = async () => {
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('chat_id, chats(id, type, name, avatar_url, updated_at)')
      .eq('user_id', profile.id)

    if (!participants || participants.length === 0) {
      setChats([])
      return
    }

    const chatIds = participants.map(p => p.chat_id)

    // Для direct чатов нужно найти второго участника. Для групп - просто вывести группу.
    const { data: allParticipants } = await supabase
      .from('chat_participants')
      .select('chat_id, user_id, profiles(display_name, username, avatar_url)')
      .in('chat_id', chatIds)

    const formattedChats = participants.map(p => {
      const chatInfo = p.chats
      if (chatInfo.type === 'direct') {
        const otherUser = allParticipants.find(ap => ap.chat_id === chatInfo.id && ap.user_id !== profile.id)
        if (otherUser) {
          return {
            id: chatInfo.id,
            name: otherUser.profiles.display_name,
            username: otherUser.profiles.username,
            avatar: otherUser.profiles.avatar_url,
            isDirect: true
          }
        } else {
          // Если второго участника нет, это "Избранное" (чат с самим собой)
          return {
            id: chatInfo.id,
            name: 'Избранное',
            username: 'saved',
            avatar: null,
            isDirect: true,
            isSaved: true
          }
        }
      } else {
        return {
          id: chatInfo.id,
          name: chatInfo.name || (chatInfo.type === 'channel' ? 'Канал' : 'Группа'),
          username: chatInfo.type,
          avatar: chatInfo.avatar_url,
          isDirect: false
        }
      }
    }).filter(Boolean)

    setChats(formattedChats)
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
    // Проверяем существующий чат
    const { data: existingChat } = await supabase.rpc('get_direct_chat', { user1: profile.id, user2: otherUserId })
    // Для простоты здесь создадим новый, если его нет (в реальном приложении нужна RPC функция или сложный запрос)
    
    // Временное простое решение:
    const { data: newChat } = await supabase.from('chats').insert([{ type: 'direct' }]).select().single()
    if (newChat) {
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, user_id: profile.id },
        ...(profile.id !== otherUserId ? [{ chat_id: newChat.id, user_id: otherUserId }] : []) // Если ID совпадают, добавляем только один раз (Избранное)
      ])
      navigate(`/chat/${newChat.id}`)
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const createGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) return

    const { data: newChat } = await supabase
      .from('chats')
      .insert([{ type: groupType, name: groupName, admin_id: profile.id }])
      .select()
      .single()

    if (newChat) {
      await supabase.from('chat_participants').insert([{ chat_id: newChat.id, user_id: profile.id }])
      setShowGroupModal(false)
      setGroupName('')
      loadChats()
      navigate(`/chat/${newChat.id}`)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    navigate('/')
  }

  return (
    <div className={`app-container ${isMobileMainView ? 'mobile-show-main' : ''}`}>
      <div className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to={`/profile/${profile?.id}`} className="ripple" style={{ borderRadius: '50%' }}>
              <img 
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'U'}`} 
                className="avatar avatar-sm" 
                alt="My Avatar"
              />
            </Link>
            <strong style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>{randomTitle}</strong>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setShowGroupModal(true)} className="btn-icon ripple" title="Новая группа"><Plus size={20} /></button>
            <Link to="/settings" className="btn-icon ripple"><Settings size={20} /></Link>
            <button onClick={handleLogout} className="btn-icon ripple" title="Выйти"><LogOut size={20} /></button>
          </div>
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Поиск ID или username..."
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
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px', paddingLeft: '8px' }}>Поиск:</div>
              {searchResults.map(user => (
                <div key={user.id} className="chat-item ripple" style={{ padding: '8px', borderRadius: '8px' }} onClick={() => startDirectChat(user.id)}>
                  <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}`} className="avatar avatar-sm" />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{user.display_name} {user.id === profile.id ? '(Вы)' : ''}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{user.username}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-list">
          <div className="chat-item ripple" onClick={() => startDirectChat(profile.id)}>
             <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}>
               <Bookmark size={20} color="white" />
             </div>
             <div>
               <div style={{ fontWeight: '600' }}>Избранное</div>
               <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Сохраненные сообщения</div>
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
                <div style={{ fontWeight: '600' }}>{chat.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{chat.isDirect ? `@${chat.username}` : chat.username}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="main-area">
        <Outlet />
      </div>

      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>Создать новую беседу</h3>
            <form onSubmit={createGroup}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Название" 
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                required
              />
              <select className="input-field" value={groupType} onChange={e => setGroupType(e.target.value)}>
                <option value="group">Группа (Пишут все)</option>
                <option value="channel">Канал (Пишет только создатель)</option>
              </select>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn ripple" style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} onClick={() => setShowGroupModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary ripple" style={{ flex: 1 }}>Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
