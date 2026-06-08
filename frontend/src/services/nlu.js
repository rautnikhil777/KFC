// Phase 1: simple intent detection + quantity extraction.
// Input: transcript string

const intents = ['starter', 'main', 'drinks', 'dessert', 'help', 'checkout', 'cart']

const itemKeywords = {
  starter: ['starter', 'soup', 'samosa', 'starter'],
  main: ['main', 'biryani', 'curry', 'rice', 'chicken', 'pizza', 'burger'],
  drinks: ['drink', 'cold', 'soda', 'juice', 'water', 'coke', 'fanta'],
  dessert: ['dessert', 'ice cream', 'cake', 'sweet', 'gulab'],
}

function normalize(s){
  return String(s || '').toLowerCase().trim()
}

export function detectIntent(text) {
  const t = normalize(text)
  if (!t) return { intent: null }
  for (const i of intents) {
    if (i === 'help' && (t.includes('help') || t.includes('assistance'))) return { intent: 'help' }
    if (i === 'checkout' && (t.includes('checkout') || t.includes('confirm') || t.includes('order'))) return { intent: 'checkout' }
    if (i === 'cart' && (t.includes('cart') || t.includes('basket'))) return { intent: 'cart' }
    if (i !== 'help' && i !== 'checkout' && i !== 'cart') {
      const kws = itemKeywords[i] || []
      if (kws.some((k) => t.includes(normalize(k)))) return { intent: i }
    }
  }
  return { intent: null }
}

export function extractQuantity(text) {
  const t = normalize(text)
  const match = t.match(/(\d+)\s*(x|times)?/)
  if (match) return Number(match[1])

  // number words basic (English only in Phase 1)
  const words = [
    ['one', 1],
    ['two', 2],
    ['three', 3],
    ['four', 4],
    ['five', 5],
  ]
  for (const [w, n] of words) {
    if (t.includes(w)) return n
  }
  return null
}

export function parseOrderIntent(text) {
  const intent = detectIntent(text).intent
  const qty = extractQuantity(text)
  return { intent, qty }
}

