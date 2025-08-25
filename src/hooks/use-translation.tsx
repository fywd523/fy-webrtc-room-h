'use client'
import { createContext, useContext, useState, useMemo } from 'react'
import { translations, type Translations } from '@/lib/translations'

type Language = 'en' | 'zh'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('zh')
  
  const t = useMemo(() => {
    // Fallback to English if a translation is missing in the current language
    return new Proxy(translations[language], {
      get(target, prop) {
        return target[prop as keyof Translations] || translations.en[prop as keyof Translations];
      }
    });
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return context
}
