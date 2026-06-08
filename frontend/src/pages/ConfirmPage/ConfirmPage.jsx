import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { apiConfirmOrder } from '../../services/api.js'
import styles from './confirmPage.module.css'

const COPY = {
  en: {
    title: 'Confirm Order',
    subtitle: 'Voice confirmation (Phase 1 simulated) + intent/quantity parsing',
    transcriptLabel: 'Transcript',
    transcriptPlaceholder: 'e.g. 2 burgers and 1 juice',
    confirm: 'Confirm Order',
    cancel: 'Cancel',
    sendKitchen: 'Send to Kitchen',
    table: 'Table',
    mic: 'Voice input (simulated)',
  },
  hi: {
    title: 'ऑर्डर कन्फर्म करें',
    subtitle: 'वॉइस कन्फर्मेशन (Phase 1 सिम्युलेटेड) + इंटेंट/क्वांटिटी पार्सिंग',
    transcriptLabel: 'ट्रांसक्रिप्ट',
    transcriptPlaceholder: 'जैसे 2 बर्गर और 1 जूस',
    confirm: 'ऑर्डर कन्फर्म करें',
    cancel: 'रद्द करें',
    sendKitchen: 'किचन भेजें',
    table: 'टेबल',
    mic: 'वॉइस इनपुट (सिम्युलेटेड)',
  },
  mr: {
    title: 'ऑर्डर कन्फर्म करा',
    subtitle: 'Voice confirmation (Phase 1 simulated) + intent/quantity parsing',
    transcriptLabel: 'Transcript',
    transcriptPlaceholder: 'उदा. 2 burgers आणि 1 juice',
    confirm: 'कन्फर्म करा',
    cancel: 'रद्द करा',
    sendKitchen: 'किचनला पाठवा',
    table: 'टेबल',
    mic: 'Voice input (simulated)',
  },
}

export default function ConfirmPage() {
  const nav = useNavigate()
  const { state, resetSession, setCart, setSessionIdAndTable } = useContext(OrderSessionContext)
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  useEffect(() => {
    // keep page runnable even if user navigates here directly
    if (!state.sessionId) {
      nav('/')
    }
  }, [])

  async function confirm() {
    try {
      if (!state.sessionId) return
      if (!state.cart.items.length) {
        alert('Cart is empty')
        return
      }
      setBusy(true)

      // Phase 1 voice confirmation: user already selected via touch or added via menu.
      // We still display transcript as simulated voice confirmation step.
      const ok = window.confirm(`${copy.sendKitchen}\n\n${copy.transcriptLabel}: ${transcript || '(none)'}\n\nItems: ${state.cart.items.length}`)
      if (!ok) return

      const orderRes = await apiConfirmOrder({ sessionId: state.sessionId, cartItems: state.cart.items })

      setCart({ items: [] })
      nav(`/kitchen?orderId=${encodeURIComponent(orderRes.orderId)}`)
    } catch (e) {
      alert(e?.message || 'Confirm failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <TopBar mode={state.mode} onReset={() => { resetSession(); nav('/') }} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h1">{copy.title}</div>
        <div className="muted" style={{ fontWeight: 800 }}>{copy.subtitle}</div>

        <div style={{ marginTop: 14 }} className={styles.grid}>
          <div className={styles.panel}>
            <div className={styles.label}>{copy.transcriptLabel}</div>
            <input
              className="input"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={copy.transcriptPlaceholder}
            />
            <div className="muted" style={{ fontWeight: 800, marginTop: 10 }}>
              {copy.mic}: {state.mode === 'voice' ? 'Enabled' : 'Not selected (still allowed)' }
            </div>

            <div style={{ marginTop: 14 }} className={styles.actions}>
              <button type="button" className="btn" onClick={() => nav('/cart')} disabled={busy}>
                {copy.cancel}
              </button>
              <button type="button" className="btn btnPrimary" onClick={confirm} disabled={busy}>
                {busy ? 'Confirming...' : copy.confirm}
              </button>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.label}>{copy.table}</div>
            <div style={{ fontWeight: 1000, marginTop: 6 }}>
              {state.table?.label || 'T-1'}
            </div>

            <div style={{ marginTop: 14 }}>
              <div className={styles.label}>Order items</div>
              <div className={styles.items}>
                {state.cart.items.map((it) => (
                  <div key={`${it.menuItemId}-${it.name}`} className={styles.item}>
                    <div style={{ fontWeight: 950 }}>{it.name}</div>
                    <div className="muted" style={{ fontWeight: 800 }}>Qty: {it.quantity}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

