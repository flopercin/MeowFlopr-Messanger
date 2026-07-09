import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      "settings": "Settings",
      "account": "Account",
      "email_confirmed": "Confirmed",
      "email_unconfirmed": "Unconfirmed",
      "change_email": "Change email (Soon)",
      "logout": "Log out",
      "appearance_language": "Appearance & Language",
      "theme": "Theme",
      "theme_dark": "Dark (Glass)",
      "theme_light": "Light",
      "language": "Language",
      
      "profile": "Profile",
      "fill_required": "Name and Username are required!",
      "username_taken": "This username is already taken!",
      "avatar_error": "Avatar upload error: ",
      "loading": "Loading...",
      "name": "Name",
      "username_id": "Username and ID",
      "about": "About me",
      "about_placeholder": "Write something about yourself...",
      "no_description": "Nothing here yet",
      
      "search_placeholder": "Search ID or username...",
      "search": "Search",
      "you": "(You)",
      "saved_messages": "Saved Messages",
      "channel": "Channel",
      "group": "Group",
      "error": "Error: ",
      "limit_reached": "Limit: max 2 groups and 2 channels per account.",
      "create_new_chat": "Create new chat",
      "username_optional": "Username (optional)",
      "cancel": "Cancel",
      "create": "Create",
      
      "select_chat_or_search": "Select a chat or find someone in search",
      
      "file_too_large": "File too large! 5 MB limit.",
      "error_sending": "Sending error: ",
      "uploading": "Uploading...",
      "type_message": "Type a message...",
      "channel_readonly": "Only administrators can post in this channel.",
      "saved_messages_empty": "You can save links, files, and notes here.",
      "no_messages": "No messages here yet."
    }
  },
  ru: {
    translation: {
      "settings": "Настройки",
      "account": "Аккаунт",
      "email_confirmed": "Подтверждена",
      "email_unconfirmed": "Не подтверждена",
      "change_email": "Сменить почту (Скоро)",
      "logout": "Выйти",
      "appearance_language": "Внешний вид и Язык",
      "theme": "Тема оформления",
      "theme_dark": "Темная (Стекло)",
      "theme_light": "Светлая",
      "language": "Язык",
      
      "profile": "Профиль",
      "fill_required": "Имя и Юзернейм обязательны!",
      "username_taken": "Этот username уже занят!",
      "avatar_error": "Ошибка загрузки аватара: ",
      "loading": "Загрузка...",
      "name": "Имя",
      "username_id": "Юзернейм и ID",
      "about": "О себе",
      "about_placeholder": "Напишите что-нибудь о себе...",
      "no_description": "Ничего не указано",
      
      "search_placeholder": "Поиск ID или username...",
      "search": "Поиск",
      "you": "(Вы)",
      "saved_messages": "Избранное",
      "channel": "Канал",
      "group": "Группа",
      "error": "Ошибка: ",
      "limit_reached": "Лимит: максимум 2 группы и 2 канала на аккаунт.",
      "create_new_chat": "Создать новый чат",
      "username_optional": "Юзернейм (необязательно)",
      "cancel": "Отмена",
      "create": "Создать",
      
      "select_chat_or_search": "Выберите чат или найдите кого-нибудь в поиске",
      
      "file_too_large": "Файл слишком большой! Лимит 5 МБ.",
      "error_sending": "Ошибка отправки: ",
      "uploading": "Загрузка файла...",
      "type_message": "Напишите сообщение...",
      "channel_readonly": "Только администраторы могут писать в этот канал.",
      "saved_messages_empty": "Здесь вы можете сохранять ссылки, файлы и заметки.",
      "no_messages": "Здесь пока нет сообщений."
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ru",
    fallbackLng: "ru",
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
