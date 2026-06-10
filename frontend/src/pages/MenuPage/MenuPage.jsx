import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CartSummary from '../../components/CartSummary/CartSummary.jsx'
import TopBar from '../../components/TopBar/TopBar.jsx'
import { OrderSessionContext } from '../../context/OrderSessionContext.jsx'
import { useVoiceOrdering } from '../../hooks/useVoiceOrdering.js'
import { apiGetMenu } from '../../services/api.js'
import styles from './menuPage.module.css'


const COPY = {
  en: {
    title: 'Menu',
    subtitle: 'Add items to your cart',
    empty: 'Start by adding a starter/main/drink.',
    categories: 'Categories',
    add: 'Add',
    notes: 'Notes (optional)',
    cart: 'Cart',
    goCart: 'Go to cart',
  },
  hi: {
    title: 'मेनू',
    subtitle: 'कार्ट में आइटम जोड़ें',
    empty: 'पहले कोई Starter/Main/Drink जोड़ें।',
    categories: 'कैटेगरी',
    add: 'जोड़ें',
    notes: 'नोट्स (वैकल्पिक)',
    cart: 'कार्ट',
    goCart: 'कार्ट पर जाएँ',
  },
  mr: {
    title: 'मेनू',
    subtitle: 'कार्टमध्ये आयटम जोडा',
    empty: 'प्रथम काही Starter/Main/Drink जोडा.',
    categories: 'कॅटेगरी',
    add: 'जो़डा',
    notes: 'नोट्स (ऐच्छिक)',
    cart: 'कार्ट',
    goCart: 'कार्टला जा',
  },
}

export default function MenuPage() {
  const nav = useNavigate()
  const { state, addCartItemLocal, resetSession } = useContext(OrderSessionContext)
  const [menu, setMenu] = useState(null)
  const [activeKey, setActiveKey] = useState('starter')
  const [loading, setLoading] = useState(false)
  const [notesByKey, setNotesByKey] = useState({})

  const copy = useMemo(() => COPY[state.language] || COPY.en, [state.language])

  const voiceCtrl = useVoiceOrdering({
    enabled: state.mode === 'voice',
    page: 'MENU',
    menuItems: menu ? (menu || []).flatMap((c) => c.items || []) : [],
    onCartUpdated: null,
  })

  useEffect(() => {
    if (state.mode !== 'voice') return
    if (!voiceCtrl?.setOnSelectCategory) return

    voiceCtrl.setOnSelectCategory((categoryKey) => {
      // Map spoken category to MenuPage activeKey (menu keys are already those strings per requirement)
      setActiveKey(categoryKey)
    })
  }, [state.mode, voiceCtrl])





  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await apiGetMenu()
        setMenu(res.categories || [])
        const first = (res.categories || [])[0]
        if (first?.key) setActiveKey(first.key)
      } catch (e) {
        alert(e?.message || 'Failed to load menu')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeCategory = (menu || []).find((c) => c.key === activeKey) || (menu || [])[0]

  function ensureSession() {
    if (!state.sessionId) {
      resetSession()
      nav('/')
      return false
    }
    return true
  }

  function addItem(item) {
    if (!ensureSession()) return
    addCartItemLocal({
      ...item,
      quantity: 1,
      notes: notesByKey[item.menuItemId] || '',
    })
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

            {state.mode === 'voice' && voiceCtrl?.voiceStatus && (
              <div className="voice-status-badge" style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: '0.85rem',
                fontWeight: 'bold',
                backgroundColor:
                  voiceCtrl.voiceStatus === 'SPEAKING' ? '#0070f3' :
                    voiceCtrl.voiceStatus === 'LISTENING' ? '#10b981' :
                      voiceCtrl.voiceStatus === 'PROCESSING' ? '#f59e0b' : '#6b7280',
                color: '#fff',
              }}>
                <span className="dot" style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  display: 'inline-block',
                }} />
                {voiceCtrl.voiceStatus === 'LISTENING' ? 'Listening' :
                  voiceCtrl.voiceStatus === 'PROCESSING' ? 'Understanding' :
                    voiceCtrl.voiceStatus === 'SPEAKING' ? 'Speaking' : 'Idle'}
              </div>
            )}

            <div style={{ marginTop: 10 }} className="chipRow">
              {(menu || []).map((c) => (
                <div
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  className={`chip ${activeKey === c.key ? 'chipActive' : ''}`}
                  onClick={() => setActiveKey(c.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setActiveKey(c.key) }}
                >
                  {c.title}
                </div>
              ))}
            </div>
          </div>

          <div style={{ minWidth: 260 }}>
            <CartSummary cartItems={state.cart.items} onGoCart={() => nav('/cart')} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {!menu ? (
            <div className="muted" style={{ fontWeight: 800 }}>{loading ? 'Loading menu...' : 'Loading...'}</div>
          ) : (
            <div className="grid2">
              {(activeCategory?.items || []).map((item) => (
                <div key={item.menuItemId} className={styles.itemCard}>
                  <div className={styles.itemTop}>
                    <div>
                      <div className={styles.itemName}>{item.name}</div>
                      <div className="muted" style={{ fontWeight: 800 }}>{item.category}</div>
                    </div>
                    <div className={styles.price}>₹ {item.price}</div>
                  </div>

                  <div className={styles.noteLabel}>{copy.notes}</div>
                  <input
                    className="input"
                    value={notesByKey[item.menuItemId] || ''}
                    onChange={(e) => setNotesByKey((s) => ({ ...s, [item.menuItemId]: e.target.value }))}
                    placeholder={
                      state.language === 'hi'
                        ? 'जैसे कम मसाला'
                        : state.language === 'mr'
                          ? 'उदा. कमी मसाला'
                          : 'e.g. less spicy'
                    }
                  />

                  <button
                    type="button"
                    className="btn btnPrimary"
                    style={{ width: '100%', marginTop: 12 }}
                    onClick={() => addItem(item)}
                  >
                    {copy.add}
                  </button>
                </div>
              ))}
            </div>
          )}

          {state.cart.items.length === 0 && (
            <div className="muted" style={{ fontWeight: 800, marginTop: 16 }}>{copy.empty}</div>
          )}
        </div>
      </div>
    </div>
  )
}

