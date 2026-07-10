import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import imageCompression from 'browser-image-compression'
import { Send, User, ChevronLeft, Paperclip, X, File, Bookmark, Check, CheckCheck, Edit2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function ChatRoom() {
  const { t } = useTranslation()
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { profile } = useStore()
  const { onlineUsers } = useOutletContext() || { onlineUsers: new Set() }
  
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [chatInfo, setChatInfo] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  
  const [editingMsg, setEditingMsg] = useState(null)
  const [typingUsers, setTypingUsers] = useState(new Set())
  const typingTimeoutRef = useRef(null)
  
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!chatId || !profile) return
    
    // Offline Cache
    const cached = localStorage.getItem(`chat_${chatId}`)
    if (cached) setMessages(JSON.parse(cached))
    else setMessages([])
    
    setAttachment(null)
    setEditingMsg(null)
    loadChatInfo()
    loadMessages()

    const channel = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, async (payload) => {
        const { data: authorData } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', payload.new.user_id).single()
        setMessages(prev => {
          if (prev.some(msg => msg.id === payload.new.id)) return prev
          const newMsgs = [...prev, { ...payload.new, profiles: authorData }]
          localStorage.setItem(`chat_${chatId}`, JSON.stringify(newMsgs.slice(-50)))
          return newMsgs
        })
        if (payload.new.user_id !== profile.id) markAsRead(payload.new.id, payload.new.read_by || [])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages(prev => {
          const newMsgs = prev.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg)
          localStorage.setItem(`chat_${chatId}`, JSON.stringify(newMsgs.slice(-50)))
          return newMsgs
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages(prev => {
          const newMsgs = prev.filter(msg => msg.id !== payload.old.id)
          localStorage.setItem(`chat_${chatId}`, JSON.stringify(newMsgs.slice(-50)))
          return newMsgs
        })
      })
      .subscribe()

    // Typing Presence
    const typingChannel = supabase.channel(`typing_${chatId}`)
    typingChannel.on('presence', { event: 'sync' }, () => {
      const state = typingChannel.presenceState()
      const typists = new Set()
      for (const id in state) {
        state[id].forEach(p => { if (p.user !== profile.id) typists.add(p.name || t('someone', 'Кто-то')) })
      }
      setTypingUsers(typists)
    }).subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(typingChannel)
    }
  }, [chatId, profile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadChatInfo = async () => {
    const { data: chatData } = await supabase.from('chats').select('*').eq('id', chatId).single()
    if (!chatData) return

    if (chatData.type === 'direct') {
      const { data: participants } = await supabase.from('chat_participants').select('user_id, profiles(id, display_name, avatar_url, last_seen, hide_last_seen)').eq('chat_id', chatId)
      const otherUser = participants?.find(p => p.user_id !== profile.id)
      
      if (otherUser && otherUser.profiles) {
        setChatInfo({ isDirect: true, other_user_id: otherUser.user_id, ...otherUser.profiles })
      } else {
        setChatInfo({ isDirect: true, isSaved: true, display_name: t('saved_messages', 'Избранное'), id: profile.id })
      }
    } else {
      setChatInfo({ isDirect: false, ...chatData })
    }
  }

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(display_name, avatar_url)')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(100)
    
    if (data) {
      setMessages(data)
      localStorage.setItem(`chat_${chatId}`, JSON.stringify(data.slice(-50)))
      
      const unreadIds = data.filter(m => m.user_id !== profile.id && !(m.read_by || []).includes(profile.id)).map(m => m.id)
      if (unreadIds.length > 0) {
        unreadIds.forEach(id => {
          const msg = data.find(m => m.id === id)
          markAsRead(id, msg.read_by || [])
        })
      }
    }
  }

  const markAsRead = async (msgId, currentReadBy) => {
    if (currentReadBy.includes(profile.id)) return
    const newReadBy = [...currentReadBy, profile.id]
    await supabase.from('messages').update({ read_by: newReadBy }).eq('id', msgId)
  }

  const toggleReaction = async (msg, emoji) => {
    const newReactions = { ...(msg.reactions || {}) }
    if (newReactions[profile.id] === emoji) delete newReactions[profile.id]
    else newReactions[profile.id] = emoji
    
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: newReactions } : m))
    setHoveredMsgId(null)
    await supabase.from('messages').update({ reactions: newReactions }).eq('id', msg.id)
  }
  
  const deleteMessage = async (msgId) => {
    if (!window.confirm(t('confirm_delete', 'Точно удалить сообщение?'))) return
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await supabase.from('messages').delete().eq('id', msgId)
  }
  
  const startEditing = (msg) => {
    setEditingMsg(msg)
    setNewMessage(msg.text)
    inputRef.current?.focus()
  }

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    
    // Broadcast typing
    const typingChannel = supabase.channel(`typing_${chatId}`)
    typingChannel.track({ user: profile.id, name: profile.display_name })
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      typingChannel.untrack()
    }, 2000)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return alert(t('file_too_large', 'Файл слишком большой! Лимит 5 МБ.'))
    
    let processedFile = file
    let fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'

    if (fileType === 'image') {
      try {
        setUploading(true)
        processedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 })
      } catch (err) { console.error(err) } finally { setUploading(false) }
    }
    setAttachment({ file: processedFile, type: fileType, name: file.name, preview: fileType === 'image' ? URL.createObjectURL(processedFile) : null })
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !attachment) || uploading) return

    setUploading(true)
    
    if (editingMsg) {
       setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, text: newMessage, is_edited: true } : m))
       await supabase.from('messages').update({ text: newMessage, is_edited: true }).eq('id', editingMsg.id)
       setEditingMsg(null)
       setNewMessage('')
       setUploading(false)
       return
    }
    
    let uploadedUrl = null
    if (attachment) {
      const fileExt = attachment.file.name.split('.').pop()
      const fileName = `${chatId}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('attachments').upload(fileName, attachment.file)
      if (!uploadError) {
        const { data } = supabase.storage.from('attachments').getPublicUrl(fileName)
        uploadedUrl = data.publicUrl
      }
    }

    const msgData = {
      chat_id: chatId, user_id: profile.id, text: newMessage || (attachment ? '' : ' '),
      attachment_url: uploadedUrl, attachment_type: attachment ? attachment.type : null, attachment_name: attachment ? attachment.name : null,
      read_by: [], reactions: {}
    }

    const tempId = Date.now()
    const tempMsg = { ...msgData, id: tempId, created_at: new Date().toISOString(), profiles: profile }
    
    setMessages(prev => {
      const newMsgs = [...prev, tempMsg]
      localStorage.setItem(`chat_${chatId}`, JSON.stringify(newMsgs.slice(-50)))
      return newMsgs
    })
    
    setNewMessage('')
    setAttachment(null)
    setUploading(false)

    const { error, data } = await supabase.from('messages').insert([msgData]).select().single()
    if (error) {
      alert(error.message)
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m))
    }
  }

  if (!chatInfo) return <div style={{ padding: '24px' }}>{t('loading', 'Загрузка...')}</div>

  const canWrite = chatInfo.type !== 'channel' || chatInfo.admin_id === profile.id
  
  // Онлайн статус логика
  const isOnline = chatInfo.isDirect && !chatInfo.isSaved && onlineUsers.has(chatInfo.other_user_id)
  const isTyping = typingUsers.size > 0
  
  let statusText = ''
  if (!chatInfo.isDirect) {
    statusText = chatInfo.type === 'channel' ? t('channel', 'Канал') : t('group', 'Группа')
  } else if (chatInfo.isSaved) {
    statusText = t('saved_messages', 'Избранное')
  } else if (isTyping) {
    statusText = `${Array.from(typingUsers).join(', ')} ${t('typing', 'печатает...')}`
  } else if (isOnline) {
    statusText = t('online', 'в сети')
  } else {
    if (chatInfo.hide_last_seen) {
      statusText = t('last_seen_recently', 'был(а) недавно')
    } else if (chatInfo.last_seen) {
      const date = new Date(chatInfo.last_seen)
      statusText = `${t('last_seen', 'был(а)')} ${date.toLocaleDateString() === new Date().toLocaleDateString() ? t('today', 'сегодня') : date.toLocaleDateString()} ${t('at', 'в')} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      statusText = t('last_seen_recently', 'был(а) недавно')
    }
  }

  const renderReactions = (reactions) => {
    if (!reactions || Object.keys(reactions).length === 0) return null
    const counts = {}
    Object.values(reactions).forEach(emoji => { counts[emoji] = (counts[emoji] || 0) + 1 })
    
    return (
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([emoji, count]) => (
          <div key={emoji} style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <span>{emoji}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{count}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-icon ripple d-md-none" onClick={() => navigate('/')} style={{ marginLeft: '-10px' }}>
            <ChevronLeft size={24} />
          </button>
          
          <div style={{ position: 'relative' }}>
            {chatInfo.isSaved ? (
               <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}><Bookmark size={20} color="white" /></div>
            ) : chatInfo.isDirect ? (
              <img src={chatInfo.avatar_url || `https://ui-avatars.com/api/?name=${chatInfo.display_name}`} className="avatar avatar-sm" />
            ) : (
              <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-secondary)' }}><User size={20} color="var(--accent)" /></div>
            )}
            {isOnline && <div style={{ position: 'absolute', bottom: 0, right: 0, width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', border: '2px solid var(--bg-glass)' }}/>}
          </div>
          
          <div>
            <strong style={{ fontSize: '1.1rem', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatInfo.display_name || chatInfo.name}</strong>
            <span style={{ fontSize: '0.75rem', color: isOnline || isTyping ? '#10b981' : 'var(--text-secondary)', transition: 'color 0.3s' }}>
              {statusText}
            </span>
          </div>
        </div>
        
        {chatInfo.isDirect && !chatInfo.isSaved && (
          <Link to={`/profile/${chatInfo.id}`} className="btn-icon ripple" title={t('profile', 'Профиль')}>
            <User size={20} />
          </Link>
        )}
      </div>

      <div className="messages-wrapper">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
            {chatInfo.isSaved ? t('saved_messages_empty', 'Здесь вы можете сохранять ссылки, файлы и заметки.') : t('no_messages', 'Здесь пока нет сообщений.')}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.user_id === profile.id
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const showAuthor = !isMine && !chatInfo.isDirect && (index === 0 || messages[index - 1].user_id !== msg.user_id)
            const isRead = (msg.read_by || []).length > 0
            
            return (
              <div 
                key={msg.id} 
                className={`bubble ${isMine ? 'mine' : 'other'}`}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                style={{ position: 'relative' }}
              >
                {showAuthor && <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '4px', fontWeight: 'bold' }}>{msg.profiles?.display_name}</div>}
                
                {msg.attachment_url && (
                  <div style={{ marginBottom: msg.text ? '8px' : '0' }}>
                    {msg.attachment_type === 'image' && <img src={msg.attachment_url} className="attachment-img" alt="attachment" onClick={() => window.open(msg.attachment_url)} />}
                    {msg.attachment_type === 'video' && <video src={msg.attachment_url} className="attachment-video" controls />}
                    {msg.attachment_type === 'file' && (
                      <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '8px' }}>
                        <File size={20} /> <span style={{ wordBreak: 'break-all' }}>{msg.attachment_name || 'Скачать файл'}</span>
                      </a>
                    )}
                  </div>
                )}
                
                {msg.text && <div>{msg.text}</div>}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  {msg.is_edited && <span style={{ fontSize: '0.65rem', opacity: 0.6, fontStyle: 'italic', marginRight: '4px' }}>{t('edited', 'изменено')}</span>}
                  <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>{time}</div>
                  {isMine && !chatInfo.isSaved && (
                    <div style={{ color: isRead ? '#3b82f6' : 'inherit', opacity: isRead ? 1 : 0.6, display: 'flex' }}>
                      {isRead ? <CheckCheck size={14} /> : <Check size={14} />}
                    </div>
                  )}
                </div>

                {renderReactions(msg.reactions)}

                {/* Reaction & Action Menu */}
                {hoveredMsgId === msg.id && (
                  <div style={{ position: 'absolute', top: '-40px', [isMine ? 'right' : 'left']: '0', background: 'var(--bg-glass)', backdropFilter: 'blur(10px)', padding: '4px 8px', borderRadius: '20px', display: 'flex', gap: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)', zIndex: 10 }}>
                    {['👍', '❤️', '😂', '😢', '🔥'].map(emoji => (
                      <button key={emoji} className="btn-icon ripple" style={{ padding: '4px', fontSize: '1.2rem', width: 'auto', height: 'auto' }} onClick={() => toggleReaction(msg, emoji)}>
                        {emoji}
                      </button>
                    ))}
                    {isMine && (
                      <div style={{ display: 'flex', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px', gap: '4px' }}>
                        {msg.text && <button className="btn-icon ripple" style={{ padding: '4px', width: 'auto', height: 'auto', color: 'var(--accent)' }} onClick={() => startEditing(msg)} title={t('edit', 'Редактировать')}><Edit2 size={18} /></button>}
                        <button className="btn-icon ripple" style={{ padding: '4px', width: 'auto', height: 'auto', color: '#ef4444' }} onClick={() => deleteMessage(msg.id)} title={t('delete', 'Удалить')}><Trash2 size={18} /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {canWrite ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {editingMsg && (
            <div style={{ background: 'var(--bg-secondary)', padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Edit2 size={16} color="var(--accent)" />
                <div>
                  <div style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{t('edit_message', 'Редактирование')}</div>
                  <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{editingMsg.text}</div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => { setEditingMsg(null); setNewMessage('') }}><X size={18} /></button>
            </div>
          )}
          
          <form onSubmit={handleSend} className="input-area" style={{ position: 'relative' }}>
            {attachment && !editingMsg && (
              <div style={{ position: 'absolute', bottom: '100%', left: '20px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {attachment.type === 'image' ? <img src={attachment.preview} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} /> : <File size={24} />}
                <div style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
                <button type="button" onClick={() => setAttachment(null)} className="btn-icon" style={{ padding: '4px' }}><X size={16} /></button>
              </div>
            )}
            
            <button type="button" className="btn-icon ripple" onClick={() => fileInputRef.current?.click()} disabled={editingMsg}>
              <Paperclip size={22} style={{ opacity: editingMsg ? 0.3 : 1 }}/>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            
            <textarea
              ref={inputRef}
              className="message-input"
              placeholder={uploading ? t('uploading', 'Загрузка файла...') : t('type_message', 'Напишите сообщение...')}
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
              rows={1}
              disabled={uploading}
            />
            
            <button type="submit" className="btn-icon ripple" style={{ background: 'var(--accent)', color: 'white', padding: '12px' }} disabled={uploading || (!newMessage.trim() && !attachment)}>
              {editingMsg ? <Check size={20} /> : <Send size={20} />}
            </button>
          </form>
        </div>
      ) : (
        <div className="input-area" style={{ justifyContent: 'center', color: 'var(--text-secondary)' }}>
          {t('channel_readonly', 'Только администраторы могут писать в этот канал.')}
        </div>
      )}
    </>
  )
}
