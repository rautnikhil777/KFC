import { useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LanguageSelector from '../../components/LanguageSelector/LanguageSelector.jsx'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { apiCreateOrResumeSession } from '../../services/api.js'
import styles from './orderModePage.module.css'

const COPY = {
  en: {
    title: 'Choose Voice or Touch',
    subtitle: 'You can switch anytime.',
    pick: 'Pick',
    continue: 'Continue',
  },
  hi: {
    title: 'Voice या Touch चुनें',
    subtitle: 'कभी भी बदल सकते हैं।',
    pick: 'चुनें',
    continue: 'आगे बढ़ें',
  },
  mr: {
    title: 'Voice किंवा Touch निवडा',
    subtitle: 'कधीही बदलू शकता.',
    pick: 'निवडा',
    continue: 'पुढे जा',
  },
}

export default function OrderModePage() {
  const nav = useNavigate()
  const { state, setMode, setLanguage, resetSession, setSessionIdAndTable } = useContext(OrderSessionContext)
  const [busy, setBusy] = useState(false)

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  async function start(mode) {
    try {
      setBusy(true)
      setMode(mode)
      const payload = await apiCreateOrResumeSession({ language: state.language, mode })
      setSessionIdAndTable({ sessionId: payload.sessionId, table: payload.table })
      nav('/menu')
    } catch (e) {
      alert(e?.message || 'Failed to start')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <TopBar
        mode={state.mode}
        onReset={() => {
          resetSession()
          nav('/')
        }}
      />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="h1">{copy.title}</div>
            <div className="muted" style={{ fontWeight: 800 }}>{copy.subtitle}</div>
          </div>
          <div style={{ minWidth: 280 }}>
            <LanguageSelector language={state.language} onChange={(l) => setLanguage(l)} />
          </div>
        </div>

        <div className={styles.grid}>
          <div
            className={styles.card}
            onClick={() => start('voice')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') start('voice') }}
          >
            <div className={styles.title}>Voice</div>
            <div className={styles.sub}>Speak your order</div>
            <div className={styles.btnWrap}>
              <button type="button" className="btn btnPrimary" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Starting...' : copy.continue}
              </button>
            </div>
          </div>

          <div
            className={styles.card}
            onClick={() => start('touch')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') start('touch') }}
          >
            <div className={styles.title}>Touch</div>
            <div className={styles.sub}>Tap to order</div>
            <div className={styles.btnWrap}>
              <button type="button" className="btn btnPrimary" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Starting...' : copy.continue}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

