import { useTranslation } from 'react-i18next'

const langs = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'kk', label: 'ҚЗ' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const change = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
  }

  return (
    <div className="flex items-center gap-1 bg-panel border border-border rounded-lg p-1">
      {langs.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => change(code)}
          className={`px-3 py-1.5 rounded-md text-xs font-display font-bold transition-all duration-200 ${
            i18n.language === code
              ? 'bg-accent text-white shadow-lg shadow-accent/30'
              : 'text-subtle hover:text-text hover:bg-surface'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
