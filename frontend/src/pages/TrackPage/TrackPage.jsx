import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { useVoiceOrdering } from '../../hooks/useVoiceOrdering.js'
import { apiOrderStatus, apiPayDummy } from '../../services/api.js'
import styles from './trackPage.module.css'





const COPY = {
  en: {
    title: 'Order Tracking',
    subtitle: 'Status updates from kitchen',
    pay: 'Dummy QR Payment',
    backKitchen: 'Back to kitchen',
  },
  hi: {
    title: 'ऑर्डर ट्रैकिंग',
    subtitle: 'किचन से अपडेट',
    pay: 'Dummy QR Payment',
    backKitchen: 'किचन पर वापस',
  },
  mr: {
    title: 'ऑर्डर ट्रॅकिंग',
    subtitle: 'किचनकडून अपडेट्स',
    pay: 'Dummy QR Payment',
    backKitchen: 'किचनला परत',
  },
}

export default function TrackPage() {
  const { orderId } = useParams()
  const nav = useNavigate()
  const { state, resetSession } = useContext(OrderSessionContext)

  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(false)

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  useVoiceOrdering({
    enabled: state.mode === 'voice',
    page: 'TRACK',
    menuItems: [],
  })


  async function load() {
    try {
      const res = await apiOrderStatus(orderId)
      setOrder(res)
    } catch (e) {
      alert(e?.message || 'Failed to load order')
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(() => load(), 2500)
    return () => clearInterval(t)
  }, [orderId])

  async function pay() {
    try {
      setBusy(true)
      await apiPayDummy({ orderId })
      await load()
      nav(`/bill/${encodeURIComponent(orderId)}`)
    } catch (e) {
      alert(e?.message || 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <TopBar mode={state.mode} onReset={() => { resetSession(); nav('/') }} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="h1">{copy.title}</div>
            <div className="muted" style={{ fontWeight: 800 }}>{copy.subtitle}</div>
          </div>
          <button type="button" className="btn" onClick={() => nav('/kitchen')}>
            {copy.backKitchen}
          </button>
        </div>

        {!order ? (
          <div className="muted" style={{ fontWeight: 800, marginTop: 14 }}>Loading order...</div>
        ) : (
          <div className={styles.grid} style={{ marginTop: 14 }}>
            <div className={styles.panel}>
              <div className={styles.title}>TABLE</div>
              <div className={styles.value}>{order.table?.label || 'T-1'}</div>

              <div className={styles.section}>
                <div className={styles.title}>Status</div>
                <div className={styles.valueSmall}>{order.status}</div>
              </div>

              <div className={styles.section}>
                <div className={styles.title}>Items</div>
                <div className={styles.items}>
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} className={styles.itemRow}>
                      <div style={{ fontWeight: 950 }}>{it.name}</div>
                      <div className="muted" style={{ fontWeight: 800 }}>Qty: {it.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.title}>Billing</div>
              <div className={styles.billLine}>Subtotal: ₹ {order.billing?.subtotal?.toFixed?.(0) || order.billing?.subtotal || 0}</div>
              <div className={styles.billLine}>Tax: ₹ {order.billing?.tax?.toFixed?.(0) || order.billing?.tax || 0}</div>
              <div className={styles.billTotal}>Total: ₹ {order.billing?.total?.toFixed?.(0) || order.billing?.total || 0}</div>

              <div style={{ marginTop: 14 }}>
                <button type="button" className="btn btnPrimary" style={{ width: '100%' }} onClick={pay} disabled={busy || order.status !== 'ready' && order.status !== 'sent_to_kitchen' && order.status !== 'preparing'}>
                  {busy ? 'Processing...' : copy.pay}
                </button>
                <div className="muted" style={{ fontWeight: 800, marginTop: 10 }}>
                  Phase 1: payment can be triggered anytime for demo.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

