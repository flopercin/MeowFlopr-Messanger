import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import useStore from '../store'
import imageCompression from 'browser-image-compression'
import { Send, User, ChevronLeft, Paperclip, X, File, Image as ImageIcon } from 'lucide-react'

export default function ChatRoom() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { profile } = useStore()
  
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [chatInfo, setChatInfo] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!chatId || !profile) return
    
    setMessages([])
    setAttachment(null)
    loadChatInfo()
    loadMessages()

    const channel = supabase
      .channel(`chat_${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          // Загружаем инфу об авторе для нового сообщения
          const { data: authorData } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', payload.new.user_id).single()
          
          setMessages((prev) => {
            if (prev.some(msg => msg.id === payload.new.id)) return prev
            return [...prev, { ...payload.new, profiles: authorData }]
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [chatId, profile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadChatInfo = async () => {
    const { data: chatData } = await supabase.from('chats').select('*').eq('id', chatId).single()
    
    if (chatData.type === 'direct') {
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id, profiles(id, display_name, avatar_url)')
        .eq('chat_id', chatId)
      
      const otherUser = participants.find(p => p.user_id !== profile.id)
      if (otherUser) {
        setChatInfo({ isDirect: true, ...otherUser.profiles })
      } else {
        setChatInfo({ isDirect: true, isSaved: true, display_name: 'Избранное', id: profile.id })
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
    
    if (data) setMessages(data)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой! Лимит 5 МБ.')
      return
    }
    
    let processedFile = file
    let fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'

    if (fileType === 'image') {
      try {
        setUploading(true)
        processedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 })
      } catch (err) {
        console.error('Ошибка сжатия', err)
      } finally {
        setUploading(false)
      }
    }
    
    setAttachment({ file: processedFile, type: fileType, name: file.name, preview: fileType === 'image' ? URL.createObjectURL(processedFile) : null })
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!newMessage.trim() && !attachment) || uploading) return

    setUploading(true)
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
      chat_id: chatId,
      user_id: profile.id,
      text: newMessage || (attachment ? '' : ' '),
      attachment_url: uploadedUrl,
      attachment_type: attachment ? attachment.type : null,
      attachment_name: attachment ? attachment.name : null
    }

    const { error } = await supabase.from('messages').insert([msgData])
    if (error) {
      alert('Ошибка отправки: ' + error.message)
    } else {
      setNewMessage('')
      setAttachment(null)
    }
    setUploading(false)
  }

  if (!chatInfo) return <div style={{ padding: '24px' }}>Загрузка чата...</div>

  const canWrite = chatInfo.type !== 'channel' || chatInfo.admin_id === profile.id

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-icon ripple d-md-none" onClick={() => navigate('/')} style={{ marginLeft: '-10px' }}>
            <ChevronLeft size={24} />
          </button>
          
          {chatInfo.isSaved ? (
             <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--accent)' }}><Bookmark size={20} color="white" /></div>
          ) : chatInfo.isDirect ? (
            <img src={chatInfo.avatar_url || `https://ui-avatars.com/api/?name=${chatInfo.display_name}`} className="avatar avatar-sm" />
          ) : (
            <div className="avatar avatar-sm" style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-secondary)' }}><User size={20} color="var(--accent)" /></div>
          )}
          
          <div>
            <strong style={{ fontSize: '1.1rem', display: 'block' }}>{chatInfo.display_name || chatInfo.name}</strong>
            {!chatInfo.isDirect && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{chatInfo.type === 'channel' ? 'Канал' : 'Группа'}</span>}
          </div>
        </div>
        
        {chatInfo.isDirect && !chatInfo.isSaved && (
          <Link to={`/profile/${chatInfo.id}`} className="btn-icon ripple" title="Профиль">
            <User size={20} />
          </Link>
        )}
      </div>

      <div className="messages-wrapper">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>
            {chatInfo.isSaved ? 'Здесь вы можете сохранять ссылки, файлы и заметки.' : 'Здесь пока нет сообщений.'}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.user_id === profile.id
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const showAuthor = !isMine && !chatInfo.isDirect && (index === 0 || messages[index - 1].user_id !== msg.user_id)
            
            return (
              <div key={msg.id} className={`bubble ${isMine ? 'mine' : 'other'}`}>
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
                
                <div style={{ fontSize: '0.65rem', marginTop: '4px', textAlign: 'right', opacity: 0.7 }}>
                  {time}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {canWrite ? (
        <form onSubmit={handleSend} className="input-area" style={{ position: 'relative' }}>
          {attachment && (
            <div style={{ position: 'absolute', bottom: '100%', left: '20px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {attachment.type === 'image' ? <img src={attachment.preview} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} /> : <File size={24} />}
              <div style={{ fontSize: '0.8rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
              <button type="button" onClick={() => setAttachment(null)} className="btn-icon" style={{ padding: '4px' }}><X size={16} /></button>
            </div>
          )}
          
          <button type="button" className="btn-icon ripple" onClick={() => fileInputRef.current?.click()}>
            <Paperclip size={22} />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          
          <textarea
            className="message-input"
            placeholder={uploading ? "Загрузка файла..." : "Напишите сообщение..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            rows={1}
            disabled={uploading}
          />
          
          <button type="submit" className="btn-icon ripple" style={{ background: 'var(--accent)', color: 'white', padding: '12px' }} disabled={uploading || (!newMessage.trim() && !attachment)}>
            <Send size={20} />
          </button>
        </form>
      ) : (
        <div className="input-area" style={{ justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Только администраторы могут писать в этот канал.
        </div>
      )}
    </>
  )
}
