import { createContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'kfc_order_session_v1'

export const OrderSessionContext = createContext(null)

function safeParse(json) {
  try { return JSON.parse(json) } catch { return null }
}

export function OrderSessionProvider({ children }) {
  const [state, setState] = useState(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const parsed = raw ? safeParse(raw) : null
    return (
      parsed || {
        sessionId: null,
        language: 'en',
        mode: null, // 'voice' | 'touch'
        table: { label: null, source: null },
        cart: { items: [] },
      }
    )
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(() => ({
    state,
    setState,
    resetSession: () => {
      const next = {
        sessionId: null,
        language: 'en',
        mode: null,
        table: { label: null, source: null },
        cart: { items: [] },
      }
      setState(next)
      window.localStorage.removeItem(STORAGE_KEY)
    },
    setLanguage: (language) => setState((s) => ({ ...s, language })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setSessionIdAndTable: (payload) => setState((s) => ({ ...s, sessionId: payload.sessionId, table: payload.table })),
    setCart: (cart) => setState((s) => ({ ...s, cart })),
    addCartItemLocal: (item) => {
      setState((s) => {
        const existing = s.cart.items.find((x) => x.menuItemId === item.menuItemId && x.name === item.name)
        if (existing) {
          const items = s.cart.items.map((x) =>
            x.menuItemId === item.menuItemId && x.name === item.name ? { ...x, quantity: x.quantity + item.quantity } : x
          )
          return { ...s, cart: { items } }
        }
        return { ...s, cart: { items: [...s.cart.items, item] } }
      })
    },
    removeCartItemLocal: (menuItemId, name) => {
      setState((s) => ({
        ...s,
        cart: { items: s.cart.items.filter((x) => !(x.menuItemId === menuItemId && x.name === name)) },
      }))
    },
    changeQuantityLocal: (menuItemId, name, quantity) => {
      setState((s) => {
        const items = s.cart.items
          .map((x) => (x.menuItemId === menuItemId && x.name === name ? { ...x, quantity } : x))
          .filter((x) => x.quantity > 0)
        return { ...s, cart: { items } }
      })
    },
  }), [state])

  return <OrderSessionContext.Provider value={value}>{children}</OrderSessionContext.Provider>
}

