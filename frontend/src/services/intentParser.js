function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[,\.!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractQuantity(text) {
  const t = normalize(text)

  // digits: 2, 2x, 2 x ...
  const digit = t.match(/(\d+)\s*(x|times)?\b/)
  if (digit) return Number(digit[1])

  // common spoken forms
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }
  for (const [w, n] of Object.entries(words)) {
    if (t.split(' ').includes(w)) return n
  }

  return null
}

function stripNumbers(text) {
  return String(text || '')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function bestMatchMenuItem(spoken, menuItems) {
  const s = normalize(spoken)
  if (!s || !Array.isArray(menuItems) || menuItems.length === 0) return null

  // Exact/substring matches based on item.name and some aliases.
  let best = null
  let bestScore = -Infinity

  for (const it of menuItems) {
    const name = normalize(it?.name)
    const cat = normalize(it?.category)

    // Basic scoring
    let score = 0

    if (!name) continue

    if (s === name) score += 100
    if (s.includes(name)) score += 70
    if (name.includes(s)) score += 40

    // token overlap
    const sTokens = new Set(s.split(' ').filter(Boolean))
    const nTokens = new Set(name.split(' ').filter(Boolean))
    let overlap = 0
    for (const tok of sTokens) if (nTokens.has(tok)) overlap += 1
    score += overlap * 10

    if (cat && s.includes(cat)) score += 5

    if (score > bestScore) {
      bestScore = score
      best = it
    }
  }

  // Guardrail: require some similarity
  if (bestScore < 10) return null
  return best
}

function detectBaseIntent(t) {
  // normalize once
  if (!t) return null

  // remove
  if (t.includes('remove') || t.includes('delete') || t.includes('minus') || t.startsWith('no ') || t.includes('take away')) {
    return 'REMOVE_ITEM'
  }

  // confirm
  if (t === 'confirm' || t.includes('confirm order') || t.includes('send to kitchen') || t.includes('confirm &') || t.includes('confirm and') || t.includes('checkout') || t.includes('order confirm')) {
    return 'CONFIRM_ORDER'
  }
  if (t.includes('checkout') || t.includes('place order') || t.includes('place an order')) return 'CONFIRM_ORDER'

  // pay
  if (t.includes('pay') || t.includes('pay now') || t.includes('make payment') || t.includes('complete payment')) return 'PAY'

  // bill
  if (t.includes('bill') || t.includes('generate bill') || t.includes('receipt')) return 'GENERATE_BILL'

  // track
  if (t.includes('ready') || t.includes('track') || t.includes('where is') || t.includes('status') || t.includes('order ready') || t.includes('is it ready')) {
    return 'TRACK_ORDER'
  }

  // change language
  if (t.includes('language') || t.includes('switch language') || t.includes('change language') || t.includes('hindi') || t.includes('marathi') || t.includes('english')) {
    return 'CHANGE_LANGUAGE'
  }

  // add
  if (t.includes('add') || t.includes('another') || t.includes('more')) return 'ADD_ITEM'

  // fallback categories: if it contains likely item name -> ADD_ITEM
  return null
}

function detectLanguageFromText(text) {
  const t = normalize(text)
  if (t.includes('hindi') || t.includes('hi ')) return 'hi'
  if (t.includes('marathi') || t.includes('mr ')) return 'mr'
  if (t.includes('english') || t.includes('en ')) return 'en'

  // If user says just "hindi" / "मराठी" etc, best-effort.
  if (t === 'hindi') return 'hi'
  if (t === 'marathi') return 'mr'

  return null
}

/**
 * @param {string} text transcript
 * @param {Array<{menuItemId?:string,name:string,category?:string,price?:number}>} [menuItems]
 */
export function parseVoice(text, menuItems) {
  const t = normalize(text)
  if (!t) return { intent: null }

  // Quantity default
  const qty = extractQuantity(text) || 1

  // Language intent
  if (detectBaseIntent(t) === 'CHANGE_LANGUAGE') {
    const language = detectLanguageFromText(text)
    return { intent: 'CHANGE_LANGUAGE', language: language || null }
  }

  // Remove/Confirm/Pay/Track/Bill intents
  const base = detectBaseIntent(t)
  if (base && base !== 'ADD_ITEM') {
    return { intent: base }
  }

  // Add intent (either explicit add/another/more, or implicit item name)
  if (base === 'ADD_ITEM' || base === null) {
    // Remove some common leading verbs
    let cleaned = stripNumbers(text)
    cleaned = cleaned.replace(/\b(add|another|more|please|want|i want|i would like|order|buy)\b/gi, ' ').trim()
    cleaned = cleaned || stripNumbers(text)

    // Try to match against menu
    const matched = bestMatchMenuItem(cleaned, menuItems || [])
    if (matched) {
      const itemName = matched.name
      return {
        intent: 'ADD_ITEM',
        item: itemName,
        menuItem: matched,
        qty: qty,
      }
    }

    // If we can't match menu, return ADD_ITEM with raw item text for the controller to decide
    return { intent: 'ADD_ITEM', item: cleaned, qty }
  }

  return { intent: null }
}

