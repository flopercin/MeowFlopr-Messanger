import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import { Send, LogOut, MessageSquare } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)

  // 1. Проверяем сессию пользователя при загрузке и подписываемся на изменения авторизации
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 2. Загружаем историю сообщений, когда пользователь авторизован
  useEffect(() => {
    if (!session) return

    fetchMessages()

    // 3. Подписка на сообщения в РЕАЛЬНОМ ВРЕМЕНИ (Supabase Realtime)
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          // Добавляем новое сообщение в массив, если его еще нет
          setMessages((prev) => {
            // Предотвращаем дублирование сообщений от самого себя
            if (prev.some(msg => msg.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session])

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100) // Берем последние 100 сообщений

    if (error) {
      console.error('Ошибка загрузки сообщений:', error)
    } else {
      setMessages(data || [])
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !session?.user) return

    const user = session.user
    // Имя берем из метаданных пользователя (которое ввели при регистрации) или часть email
    const username = user.user_metadata?.username || user.email.split('@')[0]

    const messageData = {
      text: newMessage,
      user_id: user.id,
      username: username
    }

    // Сразу добавляем сообщение локально для мгновенного отклика (оптимистичный UI)
    const temporaryId = Date.now()
    const tempMessage = {
      id: temporaryId,
      created_at: new Date().toISOString(),
      ...messageData
    }
    setMessages((prev) => [...prev, tempMessage])
    setNewMessage('')

    // Отправляем в Supabase
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()

    if (error) {
      console.error('Ошибка отправки сообщения:', error)
      // В случае ошибки удаляем временное сообщение
      setMessages((prev) => prev.filter(msg => msg.id !== temporaryId))
      alert('Не удалось отправить сообщение: ' + error.message)
    } else if (data && data[0]) {
      // Заменяем временное сообщение реальным из базы данных (с правильным id)
      setMessages((prev) => prev.map(msg => msg.id === temporaryId ? data[0] : msg))
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setMessages([])
  }

  // Если сессии нет, показываем экран входа/регистрации
  if (!session) {
    return <Auth onAuthSuccess={(userSession) => setSession(userSession)} />
  }

  const currentUser = session.user
  const currentUsername = currentUser.user_metadata?.username || currentUser.email.split('@')[0]

  return (
    <div className="glass-container chat-app">
      {/* Шапка чата */}
      <header className="chat-header">
        <div className="chat-info">
          <MessageSquare className="text-indigo-400" size={24} style={{ color: '#818cf8' }} />
          <span className="chat-logo">MeowFlopr</span>
          <span className="user-badge">{currentUsername}</span>
        </div>
        <button onClick={handleLogout} className="btn-logout">
          <LogOut size={16} />
          Выйти
        </button>
      </header>

      {/* Контейнер с сообщениями */}
      <main className="messages-container">
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>
            Здесь пока нет сообщений. Напишите что-нибудь первым!
          </div>
        ) : (
          messages.map((msg) => {
            const isMyMessage = msg.user_id === currentUser.id
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={msg.id}
                className={`message-bubble ${isMyMessage ? 'my-message' : 'other-message'}`}
              >
                {!isMyMessage && <span className="message-sender">{msg.username}</span>}
                <div className="message-content">
                  {msg.text}
                  <div className="message-time">{time}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Панель ввода сообщения */}
      <form onSubmit={handleSendMessage} className="chat-input-bar">
        <input
          type="text"
          className="chat-input"
          placeholder="Напишите сообщение..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          maxLength={1000}
        />
        <button type="submit" className="btn-send">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
