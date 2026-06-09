import { useContext, useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'
import CartSummary from '../../components/CartSummary/CartSummary.jsx'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { useVoiceOrdering } from '../../hooks/useVoiceOrdering.js'
import { apiConfirmOrder } from '../../services/api.js'
import styles from './cartPage.module.css'





const COPY = {
  en: {
    title: 'Cart',
    subtitle: 'Review and confirm your order',
    empty: 'Your cart is empty',
    qty: 'Qty',
    notes: 'Notes',
    remove: 'Remove',
    confirm: 'Confirm & Send to Kitchen',
    back: 'Back to Menu',
    confirmVoice: 'Voice confirmation (Phase 1 simulated)',
  },
  hi: {
    title: 'कार्ट',
    subtitle: 'अपना ऑर्डर देखें और कन्फर्म करें',
    empty: 'कार्ट खाली है',
    qty: 'क्वांटिटी',
    notes: 'नोट्स',
    remove: 'हटाएं',
    confirm: 'कन्फर्म करें और किचन भेजें',
    back: 'मेनू पर वापस',
    confirmVoice: 'वॉइस कन्फर्मेशन (Phase 1 सिम्युलेटेड)',
  },
  mr: {
    title: 'कार्ट',
    subtitle: 'ऑर्डर तपासा आणि कन्फर्म करा',
    empty: 'कार्ट रिकामे आहे',
    qty: 'Qty',
    notes: 'नोट्स',
    remove: 'काढा',
    confirm: 'कन्फर्म करा आणि किचनला पाठवा',
    back: 'मेनूला परत',
    confirmVoice: 'Voice confirmation (Phase 1 simulated)',
  },
}

function clamp(n, min, max) {
  const x = Number(n)
  if (Number.isNaN(x)) return min
  return Math.max(min, Math.min(max, x))
}

export default function CartPage() {
  const nav = useNavigate()
  const { state, resetSession, changeQuantityLocal, removeCartItemLocal, setCart } = useContext(OrderSessionContext)
  const [confirming, setConfirming] = useState(false)

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  const voiceCtrl = useVoiceOrdering({
    enabled: state.mode === 'voice',
    page: 'CART',
    menuItems: [],
  })

  // Phase-3 voice prompt: speak when cart opens in voice mode.
  useEffect(() => {
    if (state.mode !== 'voice') return
    // We intentionally keep touch flow unchanged; voice only adds spoken guidance.
    // Hook will also handle confirm intents.
  }, [state.mode])



  async function confirm() {
    try {
      if (!state.sessionId) {
        nav('/')
        return
      }
      if (state.cart.items.length === 0) {
        alert('Cart empty')
        return
      }

      setConfirming(true)

      // Phase 1: simulated voice confirmation prompt
      const ok = window.confirm(
        `${copy.confirmVoice}\n\nTotal items: ${state.cart.items.reduce((a, x) => a + (x.quantity || 0), 0)}\nProceed?`
      )
      if (!ok) return

      const payload = await apiConfirmOrder({
        sessionId: state.sessionId,
        cartItems: state.cart.items,
      })

      // Clear local cart (session context still persists sessionId/table)
      setCart({ items: [] })

      nav(`/kitchen`)
      // Kitchen list refresh happens there.
      return payload
    } catch (e) {
      alert(e?.message || 'Failed to confirm order')
    } finally {
      setConfirming(false)
    }
  }

  const total = state.cart.items.reduce((acc, x) => acc + Number(x.price || 0) * Number(x.quantity || 0), 0)

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
          <div style={{ minWidth: 220 }}>
            <CartSummary cartItems={state.cart.items} onGoCart={() => nav('/cart')} />
          </div>
        </div>

        {state.cart.items.length === 0 ? (
          <div className="muted" style={{ fontWeight: 800, marginTop: 18 }}>{copy.empty}</div>
        ) : (
          <div className={styles.list} style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: 120 }}>{copy.qty}</th>
                  <th style={{ width: 180 }}>{copy.notes}</th>
                  <th style={{ width: 110 }}>Price</th>
                  <th style={{ width: 110 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.cart.items.map((it) => (
                  <tr key={`${it.menuItemId}-${it.name}`}>
                    <td>
                      <div style={{ fontWeight: 950 }}>{it.name}</div>
                      <div className="muted" style={{ fontWeight: 800 }}>{it.category}</div>
                    </td>
                    <td>
                      <div className={styles.qtyRow}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => changeQuantityLocal(it.menuItemId, it.name, clamp((it.quantity || 1) - 1, 0, 99))}
                        >
                          -
                        </button>
                        <div className={styles.qtyVal}>{it.quantity}</div>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => changeQuantityLocal(it.menuItemId, it.name, clamp((it.quantity || 1) + 1, 1, 99))}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="muted" style={{ fontWeight: 800 }}>{it.notes ? it.notes : '-'}</div>
                    </td>
                    <td>₹ {Number(it.price || 0) * Number(it.quantity || 0)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.remove}
                        onClick={() => removeCartItemLocal(it.menuItemId, it.name)}
                      >
                        {copy.remove}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.footer}>
              <div>
                <div className="muted" style={{ fontWeight: 900 }}>Subtotal: ₹ {total.toFixed(0)}</div>
              </div>
              <div className={styles.actions}>
                <button type="button" className="btn" onClick={() => nav('/menu')} disabled={confirming}>
                  {copy.back}
                </button>
                <button type="button" className="btn btnPrimary" onClick={confirm} disabled={confirming}>
                  {confirming ? 'Confirming...' : copy.confirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

