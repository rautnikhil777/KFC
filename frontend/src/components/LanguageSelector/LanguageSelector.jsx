import styles from './languageSelector.module.css'

const LANGS = [
  { key: 'en', label: 'English' },
  { key: 'hi', label: 'हिन्दी' },
  { key: 'mr', label: 'मराठी' },
]

export default function LanguageSelector({ language, onChange }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Language</div>
      <div className={styles.row}>
        {LANGS.map((l) => (
          <button
            key={l.key}
            className={`${styles.chip} ${language === l.key ? styles.active : ''}`}
            onClick={() => onChange(l.key)}
            type="button"
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}

