import { jsPDF } from 'jspdf'
import { useContext, useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { useVoiceOrdering } from '../../hooks/useVoiceOrdering.js'
import { apiOrderStatus } from '../../services/api.js'
import styles from './trackPage.module.css'

const COPY = {
  en: {
    title: 'Order Tracking',
    subtitle: 'Status updates from kitchen',
    pay: 'Dummy QR Payment',
    backKitchen: 'Back to kitchen',
    qrTitle: 'Scan QR to Pay',
    confirmPay: 'Confirm Payment',
    close: 'Close',
    success: 'Payment Successful',
    downloadPdf: 'Download Receipt PDF',
    paymentPending: 'Waiting for customer payment confirmation.',
    paymentDoneMsg: 'Customer payment has been marked as successful for demo.',
    billBtn: 'Go to Bill Page',
    loading: 'Loading order...',
  },
  hi: {
    title: 'ऑर्डर ट्रैकिंग',
    subtitle: 'किचन से अपडेट',
    pay: 'Dummy QR Payment',
    backKitchen: 'किचन पर वापस',
    qrTitle: 'पेमेंट के लिए QR स्कैन करें',
    confirmPay: 'पेमेंट कन्फर्म करें',
    close: 'बंद करें',
    success: 'पेमेंट सफल हुआ',
    downloadPdf: 'रसीद PDF डाउनलोड करें',
    paymentPending: 'कस्टमर पेमेंट कन्फर्मेशन का इंतजार है।',
    paymentDoneMsg: 'डेमो के लिए पेमेंट सफल मार्क कर दिया गया है।',
    billBtn: 'बिल पेज पर जाएँ',
    loading: 'ऑर्डर लोड हो रहा है...',
  },
  mr: {
    title: 'ऑर्डर ट्रॅकिंग',
    subtitle: 'किचनकडून अपडेट्स',
    pay: 'Dummy QR Payment',
    backKitchen: 'किचनला परत',
    qrTitle: 'पेमेंटसाठी QR स्कॅन करा',
    confirmPay: 'पेमेंट कन्फर्म करा',
    close: 'बंद करा',
    success: 'पेमेंट यशस्वी झाले',
    downloadPdf: 'रिसीट PDF डाउनलोड करा',
    paymentPending: 'कस्टमर पेमेंट कन्फर्मेशनची वाट पाहत आहे.',
    paymentDoneMsg: 'डेमोसाठी पेमेंट यशस्वी म्हणून मार्क केले आहे.',
    billBtn: 'बिल पेजवर जा',
    loading: 'ऑर्डर लोड होत आहे...',
  },
}

export default function TrackPage() {
  const { orderId } = useParams()
  const nav = useNavigate()
  const { state, resetSession } = useContext(OrderSessionContext)

  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

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

  function openQrModal() {
    setShowQr(true)
  }

  function closeQrModal() {
    if (busy) return
    setShowQr(false)
  }

  async function confirmPayment() {
    try {
      setBusy(true)
      await new Promise((resolve) => setTimeout(resolve, 900))
      setPaymentSuccess(true)
      setShowQr(false)

      setOrder((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          paymentStatus: 'paid',
        }
      })
    } catch (e) {
      alert('Payment failed')
    } finally {
      setBusy(false)
    }
  }

  function downloadReceiptPdf() {
    if (!order) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    const subtotal = Number(order.billing?.subtotal || 0)
    const tax = Number(order.billing?.tax || 0)
    const total = Number(order.billing?.total || 0)

    const left = 14
    const right = pageWidth - 14
    let y = 16

    const money = (value) => `Rs. ${Number(value || 0).toFixed(0)}`

    doc.setFillColor(198, 40, 40)
    doc.rect(0, 0, pageWidth, 32, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('KFC', left, 14)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Restaurant Payment Receipt', left, 21)
    doc.text('Demo Billing Copy', left, 27)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('PAYMENT RECEIPT', right, 16, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(new Date().toLocaleString(), right, 23, { align: 'right' })

    y = 42

    doc.setDrawColor(220, 220, 220)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(left, y, pageWidth - 28, 30, 3, 3, 'FD')

    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Order Details', left + 4, y + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Order ID: ${orderId}`, left + 4, y + 15)
    doc.text(`Table: ${order.table?.label || 'T-1'}`, left + 4, y + 22)

    doc.text(`Order Status: ${order.status || 'N/A'}`, right - 4, y + 15, { align: 'right' })
    doc.text('Payment Status: Successful', right - 4, y + 22, { align: 'right' })

    y += 40

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(198, 40, 40)
    doc.text('Items Ordered', left, y)

    y += 6

    doc.setFillColor(198, 40, 40)
    doc.rect(left, y, pageWidth - 28, 9, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.text('Item', left + 4, y + 6)
    doc.text('Qty', pageWidth - 42, y + 6, { align: 'right' })

    y += 12

    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'normal')
    doc.setDrawColor(230, 230, 230)

    ;(order.items || []).forEach((it, idx) => {
      if (y > pageHeight - 45) {
        doc.addPage()
        y = 20
      }

      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250)
        doc.rect(left, y - 4, pageWidth - 28, 10, 'F')
      }

      doc.text(String(it.name || ''), left + 4, y + 2)
      doc.text(String(it.quantity || 0), pageWidth - 42, y + 2, { align: 'right' })
      doc.line(left, y + 5, right, y + 5)

      y += 10
    })

    y += 8

    const summaryBoxWidth = 78
    const summaryX = pageWidth - summaryBoxWidth - 14

    doc.setFillColor(255, 245, 245)
    doc.setDrawColor(240, 200, 200)
    doc.roundedRect(summaryX, y, summaryBoxWidth, 28, 3, 3, 'FD')

    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Subtotal', summaryX + 4, y + 7)
    doc.text(money(subtotal), summaryX + summaryBoxWidth - 4, y + 7, { align: 'right' })

    doc.text('Tax', summaryX + 4, y + 14)
    doc.text(money(tax), summaryX + summaryBoxWidth - 4, y + 14, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(198, 40, 40)
    doc.text('Total', summaryX + 4, y + 23)
    doc.text(money(total), summaryX + summaryBoxWidth - 4, y + 23, { align: 'right' })

    y += 40

    doc.setDrawColor(220, 220, 220)
    doc.line(left, y, right, y)

    y += 10

    doc.setTextColor(17, 24, 39)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Thank you for ordering with KFC', pageWidth / 2, y, { align: 'center' })

    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text('This is a demo-generated payment receipt for presentation purpose.', pageWidth / 2, y, {
      align: 'center',
    })

    doc.setTextColor(140, 140, 140)
    doc.setFontSize(8)
    doc.text(`Generated from Track Page • Order ${orderId}`, pageWidth / 2, pageHeight - 10, {
      align: 'center',
    })

    doc.save(`kfc-receipt-${orderId}.pdf`)
  }

  const qrValue = `demo-payment://order/${encodeURIComponent(orderId || 'unknown')}/amount/${encodeURIComponent(order?.billing?.total || 0)}`

  const isPayDisabled =
    busy ||
    (order?.status !== 'ready' &&
      order?.status !== 'sent_to_kitchen' &&
      order?.status !== 'preparing')

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

          <button type="button" className="btn" onClick={() => nav('/kitchen')}>
            {copy.backKitchen}
          </button>
        </div>

        {!order ? (
          <div className="muted" style={{ fontWeight: 800, marginTop: 14 }}>
            {copy.loading}
          </div>
        ) : (
          <>
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
                        <div className="muted" style={{ fontWeight: 800 }}>
                          Qty: {it.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.title}>Billing</div>

                <div className={styles.billLine}>
                  Subtotal: ₹ {order.billing?.subtotal?.toFixed?.(0) || order.billing?.subtotal || 0}
                </div>

                <div className={styles.billLine}>
                  Tax: ₹ {order.billing?.tax?.toFixed?.(0) || order.billing?.tax || 0}
                </div>

                <div className={styles.billTotal}>
                  Total: ₹ {order.billing?.total?.toFixed?.(0) || order.billing?.total || 0}
                </div>

                <div style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btnPrimary"
                    style={{ width: '100%' }}
                    onClick={openQrModal}
                    disabled={isPayDisabled}
                  >
                    {busy ? 'Processing...' : copy.pay}
                  </button>

                  <div className="muted" style={{ fontWeight: 800, marginTop: 10 }}>
                    Phase 1: payment can be triggered anytime for demo.
                  </div>
                </div>

                {paymentSuccess && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 12,
                      background: '#ecfdf3',
                      border: '1px solid #16a34a',
                      color: '#111827',
                    }}
                  >
                    <div style={{ fontWeight: 900, color: '#166534' }}>
                      {copy.success}
                    </div>

                    <div style={{ fontWeight: 800, marginTop: 6, color: '#1f2937' }}>
                      {copy.paymentDoneMsg}
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btnPrimary"
                        onClick={downloadReceiptPdf}
                      >
                        {copy.downloadPdf}
                      </button>

                      <button
                        type="button"
                        className="btn"
                        onClick={() => nav(`/bill/${encodeURIComponent(orderId)}`)}
                      >
                        {copy.billBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showQr && (
              <div
                onClick={closeQrModal}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  zIndex: 999,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    maxWidth: 420,
                    background: '#ffffff',
                    color: '#111827',
                    borderRadius: 18,
                    padding: 20,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#111827' }}>
                    {copy.qrTitle}
                  </div>

                  <div style={{ fontWeight: 800, marginTop: 6, color: '#4b5563' }}>
                    {copy.paymentPending}
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                      display: 'flex',
                      justifyContent: 'center',
                      background: '#ffffff',
                      padding: 16,
                      borderRadius: 16,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <QRCode
                      value={qrValue}
                      size={220}
                      bgColor="#FFFFFF"
                      fgColor="#111111"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 12,
                      background: '#f8fafc',
                      color: '#111827',
                      fontWeight: 800,
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ color: '#111827' }}>Order ID: {orderId}</div>
                    <div style={{ color: '#111827', marginTop: 4 }}>
                      Amount: ₹ {order.billing?.total?.toFixed?.(0) || order.billing?.total || 0}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ flex: 1 }}
                      onClick={closeQrModal}
                      disabled={busy}
                    >
                      {copy.close}
                    </button>

                    <button
                      type="button"
                      className="btn btnPrimary"
                      style={{ flex: 1 }}
                      onClick={confirmPayment}
                      disabled={busy}
                    >
                      {busy ? 'Processing...' : copy.confirmPay}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}