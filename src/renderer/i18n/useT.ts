import { create } from 'zustand'
import { translations, type Lang, type TranslationKey } from './translations'

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'de',
  setLang: (lang) => set({ lang }),
}))

export function useT() {
  const lang = useLangStore((s) => s.lang)
  return (key: TranslationKey): string => translations[lang][key] ?? translations['de'][key] ?? key
}

// Non-hook version for use outside React components
export function t(key: TranslationKey): string {
  const lang = useLangStore.getState().lang
  return translations[lang][key] ?? translations['de'][key] ?? key
}
