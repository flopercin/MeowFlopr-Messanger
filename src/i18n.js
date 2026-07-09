import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      "MeowFlopr": "MeowFlopr",
      "search_placeholder": "Search ID or username...",
      "saved_messages": "Saved Messages",
      "favorites": "Favorites",
      "no_chats": "You don't have any dialogs yet. Find someone!",
      "new_group": "New Group",
      "type_message": "Type a message...",
      "settings": "Settings",
      "logout": "Logout",
      "profile": "Profile"
    }
  },
  ru: {
    translation: {
      "MeowFlopr": "MeowFlopr",
      "search_placeholder": "Поиск ID или username...",
      "saved_messages": "Сохраненные сообщения",
      "favorites": "Избранное",
      "no_chats": "У вас пока нет диалогов. Найдите кого-нибудь!",
      "new_group": "Новая группа",
      "type_message": "Напишите сообщение...",
      "settings": "Настройки",
      "logout": "Выйти",
      "profile": "Профиль"
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ru", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
