// ─── Normalisation helpers ─────────────────────────────────────────────────

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[,\.!?;:'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractQuantity(text) {
  const t = normalize(text)

  // digits: 2, 2x, 2 x …
  const digit = t.match(/(\d+)\s*(x|times)?\b/)
  if (digit) return Number(digit[1])

  // spoken number words
  const words = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
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

// ─── Category synonym table ────────────────────────────────────────────────

const CATEGORY_SYNONYMS = {
  starter:          'starter',
  starters:         'starter',
  snacks:           'starter',
  snack:            'starter',
  'beginning items':'starter',
  appetizer:        'starter',
  appetizers:       'starter',
  'starting items': 'starter',
  'start with':     'starter',

  'main course':    'mains',
  'main courses':   'mains',
  maincourse:       'mains',
  mains:            'mains',
  'main dish':      'mains',
  'main dishes':    'mains',
  main:             'mains',
  meal:             'mains',
  meals:            'mains',
  food:             'mains',
  lunch:            'mains',
  dinner:           'mains',

  drink:            'drinks',
  drinks:           'drinks',
  beverages:        'drinks',
  beverage:         'drinks',
  juice:            'drinks',
  juices:           'drinks',
  'cold drink':     'drinks',
  'cold drinks':    'drinks',
  soda:             'drinks',
  water:            'drinks',
  shakes:           'drinks',
  shake:            'drinks',

  dessert:          'dessert',
  desserts:         'dessert',
  sweet:            'dessert',
  sweets:           'dessert',
  'ice cream':      'dessert',
  'ice creams':     'dessert',
  icecream:         'dessert',
  pudding:          'dessert',
  'sweet dish':     'dessert',
  'sweet dishes':   'dessert',
  'something sweet':'dessert',
}

export function detectCategoryIntent(raw) {
  if (!raw) return null
  const t = normalize(raw)

  if (/^no\s/.test(t) || /^not\s/.test(t) || /\bdon't\b/.test(t) || /\bcancel\b/.test(t)) {
    return null
  }

  const stripped = t
    .replace(/\b(show|open|give|display|let me see|i want|i'd like|can i have|bring|switch to|go to|actually|okay|now|please|some|the|me|see|have|get|want)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const candidate of [stripped, t]) {
    if (CATEGORY_SYNONYMS[candidate]) return CATEGORY_SYNONYMS[candidate]
  }

  const sortedKeys = Object.keys(CATEGORY_SYNONYMS).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    const re = new RegExp(`\\b${key.replace(/\s+/g, '\\s+')}\\b`)
    if (re.test(stripped) || re.test(t)) {
      return CATEGORY_SYNONYMS[key]
    }
  }

  return null
}

export const CATEGORY_DISPLAY_NAMES = {
  starter:  'Starters',
  mains:    'Main Course',
  drinks:   'Drinks',
  dessert:  'Dessert',
}

function bestMatchMenuItem(spoken, menuItems) {
  const s = normalize(spoken)
  if (!s || !Array.isArray(menuItems) || menuItems.length === 0) return null

  let best = null
  let bestScore = -Infinity

  for (const it of menuItems) {
    const name = normalize(it?.name)
    const cat  = normalize(it?.category)

    if (!name) continue

    let score = 0
    if (s === name)          score += 100
    if (s.includes(name))    score += 70
    if (name.includes(s))    score += 40

    const sTokens = new Set(s.split(' ').filter(Boolean))
    const nTokens = new Set(name.split(' ').filter(Boolean))
    for (const tok of sTokens) if (nTokens.has(tok)) score += 10

    if (cat && s.includes(cat)) score += 5

    if (score > bestScore) {
      bestScore = score
      best = it
    }
  }

  if (bestScore < 10) return null
  return best
}

function detectBaseIntent(t) {
  if (!t) return null

  if (
    t === 'confirm' || t === 'place order' || t === 'go ahead' || t === 'okay' || t === 'ok' ||
    t.includes('confirm order') || t.includes('send to kitchen') ||
    t.includes('confirm and') || t.includes('checkout') ||
    t.includes('order confirm') || t.includes('place the order')
  ) return 'CONFIRM_ORDER'

  if (
    t === 'yes' || t === 'yeah' || t === 'yup' || t === 'yep' || t === 'ha' || t === 'haa' ||
    t === 'continue' || t === 'add more' || t === 'next' || t === 'more' || t === 'show menu' ||
    t.includes('show menu') || t.includes('add more') || t.includes('continue ordering')
  ) return 'YES'

  if (
    t === 'no' || t === 'done' || t === 'finish' || t === 'enough' || t === 'proceed' ||
    t.includes('no thank you') || t === 'stop'
  ) return 'NO'

  if (
    t.includes('remove') || t.includes('delete') || t.includes('minus') ||
    t.includes('take away')
  ) return 'REMOVE_ITEM'

  if (t.includes('pay') || t.includes('pay now') || t.includes('make payment') || t.includes('complete payment')) return 'PAY'

  if (t.includes('bill') || t.includes('generate bill') || t.includes('receipt')) return 'GENERATE_BILL'

  if (
    t.includes('ready') || t.includes('track') || t.includes('where is') ||
    t.includes('status') || t.includes('order ready') || t.includes('is it ready')
  ) return 'TRACK_ORDER'

  if (
    t.includes('language') || t.includes('switch language') || t.includes('change language') ||
    t.includes('hindi') || t.includes('marathi') || t.includes('english')
  ) return 'CHANGE_LANGUAGE'

  if (t.includes('add') || t.includes('another') || t.includes('more')) return 'ADD_ITEM'

  return null
}

function detectLanguageFromText(text) {
  const t = normalize(text)
  if (t.includes('hindi') || t.includes('hi ')) return 'hi'
  if (t.includes('marathi') || t.includes('mr ')) return 'mr'
  if (t.includes('english') || t.includes('en ')) return 'en'
  if (t === 'hindi') return 'hi'
  if (t === 'marathi') return 'mr'
  return null
}

export function isRepeatLastIntent(raw) {
  const t = normalize(raw)
  return (
    t === 'one more' || t === 'same again' || t === 'same' ||
    t === 'repeat' || t === 'repeat that' || t === 'again' ||
    t.includes('one more') || t.includes('same again') ||
    t.includes('same thing') || t.includes('repeat the last')
  )
}

export function isAmbiguousQuantity(raw) {
  const t = normalize(raw)
  const stripped = t
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/g, '')
    .replace(/\b(please|sir|uh|um|okay|ok|yes|yeah)\b/g, '')
    .trim()
  return stripped.length === 0 && extractQuantity(raw) !== null
}

export function parseVoice(text, menuItems) {
  const t = normalize(text)
  if (!t) return { intent: null }

  const explicitQty = extractQuantity(text)
  const qty = explicitQty || 1

  if (detectBaseIntent(t) === 'CHANGE_LANGUAGE') {
    const language = detectLanguageFromText(text)
    return { intent: 'CHANGE_LANGUAGE', language: language || null }
  }

  const base = detectBaseIntent(t)
  if (base && base !== 'ADD_ITEM') {
    return { intent: base }
  }

  const catKey = detectCategoryIntent(text)
  if (catKey) {
    return { intent: 'SWITCH_CATEGORY', category: catKey }
  }

  if (isRepeatLastIntent(text)) {
    return { intent: 'REPEAT_LAST', qty }
  }

  if (isAmbiguousQuantity(text)) {
    return { intent: 'AMBIGUOUS_QTY', qty: explicitQty }
  }

  if (base === 'ADD_ITEM' || base === null) {
    let cleaned = stripNumbers(text)
    cleaned = cleaned
      .replace(/\b(add|another|more|please|want|i want|i would like|order|buy|give me|get me|bring me)\b/gi, ' ')
      .trim()
    cleaned = cleaned || stripNumbers(text)

    const matched = bestMatchMenuItem(cleaned, menuItems || [])
    if (matched) {
      if (explicitQty !== null) {
        return { intent: 'ADD_ITEM', item: matched.name, menuItem: matched, qty }
      } else {
        return { intent: 'ADD_ITEM_MISSING_QTY', item: matched.name, menuItem: matched }
      }
    }

    return { intent: 'ADD_ITEM', item: cleaned, menuItem: null, qty }
  }

  return { intent: null }
}
