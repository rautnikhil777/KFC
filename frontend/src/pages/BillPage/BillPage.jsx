import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { apiOrderStatus } from '../../services/api.js'
import styles from './billPage.module.css'

const COPY = {
  en: {
    title: 'Bill',
    subtitle: 'Dummy QR payment successful',
    back: 'Start new order',
  },
  hi: {
    title: 'बिल',
    subtitle: 'Dummy QR भुगतान सफल',
    back: 'नया ऑर्डर शुरू करें',
  },
  mr: {
    title: 'बिल',
    subtitle: 'Dummy QR payment यशस्वी',
    back: 'नवीन ऑर्डर सुरू करा',
  },
}

export default function BillPage() {
  const { orderId } = useParams()
  const nav = useNavigate()
  const { state, resetSession } = useContext(OrderSessionContext)

  const [order, setOrder] = useState(null)

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  useEffect(() => {
    async function load() {
      try {
        const res = await apiOrderStatus(orderId)
        setOrder(res)
      } catch (e) {
        alert(e?.message || 'Failed to load bill')
      }
    }
    load()
  }, [orderId])

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
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="h1">{copy.title}</div>
            <div className="muted" style={{ fontWeight: 800 }}>{copy.subtitle}</div>
          </div>
          <button type="button" className="btn" onClick={() => { resetSession(); nav('/') }}>
            {copy.back}
          </button>
        </div>

        {!order ? (
          <div className="muted" style={{ fontWeight: 800, marginTop: 14 }}>Loading...</div>
        ) : (
          <div className={styles.grid}>
            <div className={styles.panel}>
              <div className={styles.sectionTitle}>TABLE</div>
              <div className={styles.tableVal}>{order.table?.label || 'T-1'}</div>

              <div className={styles.sectionTitle} style={{ marginTop: 14 }}>Items</div>
              <div className={styles.items}>
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className={styles.itemRow}>
                    <div style={{ fontWeight: 950 }}>{it.name}</div>
                    <div className="muted" style={{ fontWeight: 800 }}>Qty: {it.quantity}</div>
                    <div style={{ marginTop: 6, fontWeight: 950 }}>₹ {(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.sectionTitle}>Total</div>
              <div className={styles.total}>₹ {order.billing?.total?.toFixed?.(0) || order.billing?.total || 0}</div>

              <div className={styles.line}>Subtotal: ₹ {order.billing?.subtotal?.toFixed?.(0) || order.billing?.subtotal || 0}</div>
              <div className={styles.line}>Tax: ₹ {order.billing?.tax?.toFixed?.(0) || order.billing?.tax || 0}</div>

              <div className={styles.qr}>
                <div className={styles.qrText}>Dummy QR</div>
                <div className={styles.qrBox}>
                  <div className={styles.qrGrid} />
                </div>
                <div className="muted" style={{ fontWeight: 800, marginTop: 10 }}>
                  Phase 1: QR payment is dummy and confirmed server-side.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

