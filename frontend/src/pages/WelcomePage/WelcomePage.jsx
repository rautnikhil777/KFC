import { useContext, useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'
import LanguageSelector from '../../components/LanguageSelector/LanguageSelector.jsx'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { useVoiceOrdering } from '../../hooks/useVoiceOrdering.js'
import { apiCreateOrResumeSession } from '../../services/api.js'
import { speak } from '../../services/speak.js'


const COPY = {

  en: {
    title: 'Welcome',
    subtitle: 'Choose Voice or Touch. Switch anytime.',
    pick: 'Pick a mode',
    voice: 'Voice',
    touch: 'Touch',
    tableInfo: 'Table will be resolved automatically (Phase 1 config).',
    start: 'Start Ordering',
  },
  hi: {
    title: 'स्वागत है',
    subtitle: 'वॉइस या टच चुनें। कभी भी बदलें।',
    pick: 'मोड चुनें',
    voice: 'वॉइस',
    touch: 'टच',
    tableInfo: 'टेबल अपने-आप तय होगा (Phase 1 config)।',
    start: 'ऑर्डर शुरू करें',
  },
  mr: {
    title: 'स्वागत',
    subtitle: 'Voice किंवा Touch निवडा. कधीही बदला.',
    pick: 'मोड निवडा',
    voice: 'Voice',
    touch: 'Touch',
    tableInfo: 'टेबल आपोआप ठरवलं जाईल (Phase 1 config)।',
    start: 'ऑर्डर सुरू करा',
  },
}

export default function WelcomePage() {
  const nav = useNavigate()
  const { state, setMode, setLanguage, resetSession, setSessionIdAndTable } = useContext(OrderSessionContext)

  const voice = useVoiceOrdering({
    enabled: state.mode === 'voice',
    page: 'WELCOME',
    menuItems: [],
  })

  useEffect(() => {
    if (state.mode !== 'voice') return
    // Welcome speech once language is selected.
    const t = setTimeout(() => {
      speak('Welcome to KFC. Please select your mode voice or touch.', state.language)
    }, 50)
    return () => clearTimeout(t)
  }, [state.mode, state.language])


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
      alert(e?.message || 'Failed to start session')
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
            <div className="muted" style={{ fontWeight: 800 }}>
              {copy.subtitle}
            </div>
          </div>
          <div style={{ minWidth: 280 }}>
            <LanguageSelector language={state.language} onChange={(l) => setLanguage(l)} />
          </div>
        </div>

        <div style={{ marginTop: 18 }} className="grid2">
          <div className="card" style={{ padding: 16, background: 'rgba(255,255,255,0.04)' }}>
            <div className="h2" style={{ fontWeight: 900, marginBottom: 8 }}>
              {copy.pick}: {copy.voice}
            </div>
            <div className="muted" style={{ fontWeight: 800, marginBottom: 14 }}>
              {state.mode === 'voice' ? 'Selected' : ''}
            </div>
            <button
              type="button"
              className="btn btnPrimary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => start('voice')}
            >
              {busy ? 'Starting...' : copy.voice}
            </button>
          </div>

          <div className="card" style={{ padding: 16, background: 'rgba(255,255,255,0.04)' }}>
            <div className="h2" style={{ fontWeight: 900, marginBottom: 8 }}>
              {copy.pick}: {copy.touch}
            </div>
            <div className="muted" style={{ fontWeight: 800, marginBottom: 14 }}>
              {state.mode === 'touch' ? 'Selected' : ''}
            </div>
            <button
              type="button"
              className="btn btnPrimary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => start('touch')}
            >
              {busy ? 'Starting...' : copy.touch}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }} className="kitchenBanner">
          <div style={{ fontWeight: 900 }}>Table</div>
          <div className="muted" style={{ fontWeight: 800 }}>
            {copy.tableInfo}
          </div>
          <div className="muted" style={{ fontWeight: 800, marginTop: 6 }}>
            Current: {state.table?.label ? state.table.label : 'Resolving after start'}
          </div>
        </div>
      </div>
    </div>
  )
}

