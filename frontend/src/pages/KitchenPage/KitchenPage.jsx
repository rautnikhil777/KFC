import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { useVoiceOrdering } from '../../hooks/useVoiceOrdering.js'
import { apiKitchenGetOrders, apiKitchenSend } from '../../services/api.js'
import styles from './kitchenPage.module.css'





const COPY = {
  en: {
    title: 'Kitchen Dashboard',
    subtitle: 'Orders with TABLE clearly shown',
    ready: 'Mark Ready',
    refresh: 'Refresh',
    sent: 'Sent',
  },
  hi: {
    title: 'किचन डैशबोर्ड',
    subtitle: 'TABLE साफ दिखता है',
    ready: 'Ready करें',
    refresh: 'Refresh',
    sent: 'Sent',
  },
  mr: {
    title: 'किचन डॅशबोर्ड',
    subtitle: 'टेबल स्पष्ट दिसतो',
    ready: 'Ready करा',
    refresh: 'Refresh',
    sent: 'Sent',
  },
}

export default function KitchenPage() {
  const nav = useNavigate()
  const { state, resetSession } = useContext(OrderSessionContext)
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(true)

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  useVoiceOrdering({
    enabled: state.mode === 'voice',
    page: 'KITCHEN',
    menuItems: [],
  })


  async function load() {
    try {
      setBusy(true)
      const res = await apiKitchenGetOrders()
      setOrders(res.orders || [])
    } catch (e) {
      alert(e?.message || 'Failed to load kitchen orders')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
    if (!polling) return
    const t = setInterval(() => {
      load()
    }, 2500)
    return () => clearInterval(t)
  }, [polling])

  async function sendToKitchen(orderId) {
    try {
      await apiKitchenSend({ orderId })
      await load()
    } catch (e) {
      alert(e?.message || 'Failed to send to kitchen')
    }
  }

  function statusBadge(status) {
    const map = {
      sent_to_kitchen: { label: 'SENT', c: 'rgba(255,204,77,0.18)', b: 'rgba(255,204,77,0.45)' },
      preparing: { label: 'PREP', c: 'rgba(255,179,0,0.12)', b: 'rgba(255,204,77,0.35)' },
      ready: { label: 'READY', c: 'rgba(46,229,157,0.14)', b: 'rgba(46,229,157,0.45)' },
      paid: { label: 'PAID', c: 'rgba(46,229,157,0.14)', b: 'rgba(46,229,157,0.45)' },
      closed: { label: 'CLOSED', c: 'rgba(255,255,255,0.08)', b: 'rgba(255,255,255,0.18)' },
      confirmed: { label: 'CONF', c: 'rgba(255,255,255,0.06)', b: 'rgba(255,255,255,0.14)' },
    }
    const x = map[status] || map.confirmed
    return <div className={styles.badge} style={{ background: x.c, borderColor: x.b }}>{x.label}</div>
  }

  useEffect(() => {
    // Auto-send the orderId provided from confirm/cart flow.
    const orderId = searchParams.get('orderId')
    if (orderId) sendToKitchen(orderId)
  }, [searchParams])

  return (
    <div className="container">
      <TopBar mode={state.mode} onReset={() => { resetSession(); nav('/') }} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="h1">{copy.title}</div>
            <div className="muted" style={{ fontWeight: 800 }}>{copy.subtitle}</div>
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn" onClick={() => { setPolling(false); load(); }} disabled={busy}>
              {copy.refresh}
            </button>
            <button type="button" className="btn btnPrimary" onClick={() => setPolling((p) => !p)}>
              {polling ? 'Auto: ON' : 'Auto: OFF'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }} className={styles.list}>
          {orders.length === 0 ? (
            <div className="muted" style={{ fontWeight: 800 }}>{busy ? 'Loading...' : 'No active kitchen orders yet.'}</div>
          ) : (
            orders.map((o) => (
              <div key={o.orderId} className={styles.orderCard}>
                <div className={styles.orderTop}>
                  <div>
                    <div className={styles.orderId}>Order: {o.orderId.slice(-6)}</div>
                    <div className={styles.tableLine}>
                      <span className={styles.tableLabel}>TABLE</span>
                      <span className={styles.tableValue}>{o.table?.label || 'T-1'}</span>
                    </div>
                    <div className="muted" style={{ fontWeight: 800, marginTop: 6 }}>Mode: {o.mode}</div>
                  </div>
                  {statusBadge(o.status)}
                </div>

                <div className={styles.items}>
                  {(o.items || []).map((it, idx) => (
                    <div key={idx} className={styles.itemRow}>
                      <div style={{ fontWeight: 950 }}>{it.name}</div>
                      <div className="muted" style={{ fontWeight: 800 }}>Qty: {it.quantity}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.bottom}>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={() => nav(`/track/${encodeURIComponent(o.orderId)}`)}
                  >
                    Track
                  </button>
                  {o.status === 'sent_to_kitchen' && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        // Phase 1: no extra endpoints to mark preparing/ready.
                        alert('Phase 1: Kitchen sending is implemented; further status transitions come in Phase 2.')
                      }}
                    >
                      {copy.ready}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

