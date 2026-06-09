// ─── Normalisation helpers ─────────────────────────────────────────────────

function normalize(s) {
  let text = String(s || '')
    .toLowerCase()
    .replace(/[,\.!?;:'"’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Replace concatenated versions
  text = text
    .replace(/\bmaincourse\b/g, 'main course')
    .replace(/\bicecream\b/g, 'ice cream')
    .replace(/\bgulabjamun\b/g, 'gulab jamun')
    .replace(/\bcolddrink\b/g, 'cold drink')
    .replace(/\s+/g, ' ')
    .trim()

  return text
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

function levenshtein(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0
  const dist = levenshtein(s1, s2)
  return 1.0 - dist / Math.max(s1.length, s2.length)
}

function stemWord(word) {
  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1)
  }
  return word
}

// ─── Category synonym table ────────────────────────────────────────────────

const CATEGORY_SYNONYMS = {
  starter:          'starter',
  starters:         'starter',
  snacks:           'starter',
  appetizer:        'starter',

  main:             'main',
  'main course':    'main',
  maincourse:       'main',
  meal:             'main',
  food:             'main',
  lunch:            'main',
  dinner:           'main',

  drink:            'drinks',
  drinks:           'drinks',
  beverage:         'drinks',
  'cold drink':     'drinks',
  juice:            'drinks',

  dessert:          'dessert',
  desserts:         'dessert',
  sweet:            'dessert',
  sweets:           'dessert',
  'ice cream':      'dessert',
}

const ITEM_ALIASES = {
  'Samosa': ['samosa'],
  'Hot Soup': ['soup', 'hot soup'],
  'Paneer Curry': ['paneer', 'paneer curry', 'curry'],
  'Veg Biryani': ['biryani', 'veg biryani'],
  'Cheese Burger': ['burger', 'cheese burger'],
  'Fresh Juice': ['juice', 'fresh juice'],
  'Cold Coke': ['coke', 'cola', 'cold coke'],
  'Mineral Water': ['water', 'mineral water'],
  'Ice Cream': ['icecream', 'ice cream'],
  'Gulab Jamun': ['gulab jamun', 'jamun', 'sweet']
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
  main:     'Main Course',
  drinks:   'Drinks',
  dessert:  'Dessert',
}

function bestMatchMenuItem(spoken, menuItems) {
  const s = normalize(spoken)
  if (!s || !Array.isArray(menuItems) || menuItems.length === 0) return null

  let best = null
  let bestScore = 0
  let bestConfidence = 0.0

  for (const it of menuItems) {
    const name = normalize(it?.name)
    const aliases = ITEM_ALIASES[it?.name] || []
    const normalizedAliases = aliases.map(normalize)

    let score = 0
    let confidence = 0.0

    if (s === name) {
      score = 1000
      confidence = 1.0
    } else if (normalizedAliases.includes(s)) {
      score = 950
      confidence = 0.95
    } else if (name.includes(s) || s.includes(name)) {
      score = 800
      confidence = 0.8
    } else if (normalizedAliases.some(a => a.includes(s) || s.includes(a))) {
      score = 750
      confidence = 0.75
    } else {
      const sTokens = s.split(' ').filter(Boolean)
      const sTokensStemmed = sTokens.map(stemWord)
      const nTokens = name.split(' ').filter(Boolean)

      let overlap = 0
      for (const tok of sTokensStemmed) {
        if (nTokens.includes(tok) || normalizedAliases.some(a => a.split(' ').map(stemWord).includes(tok))) {
          overlap++
        }
      }

      if (overlap > 0) {
        score = 500 + overlap * 10
        confidence = 0.5 + (overlap / Math.max(sTokens.length, nTokens.length)) * 0.2
      } else {
        const nameSim = stringSimilarity(s, name)
        let maxAliasSim = 0
        for (const a of normalizedAliases) {
          const sim = stringSimilarity(s, a)
          if (sim > maxAliasSim) maxAliasSim = sim
        }
        const bestSim = Math.max(nameSim, maxAliasSim)
        if (bestSim > 0.6) {
          score = 100 + bestSim * 100
          confidence = bestSim
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      best = it
      bestConfidence = confidence
    }
  }

  if (bestScore === 0) return null
  return { item: best, score: bestScore, confidence: bestConfidence }
}

function detectBaseIntent(t) {
  if (!t) return null

  if (
    t === 'change category' || t.includes('change category') ||
    t === 'something else' || t.includes('something else') ||
    t === 'another option' || t.includes('another option')
  ) return 'CATEGORY_UNCLEAR'

  if (t === 'back' || t.includes('go back') || t === 'go back') return 'BACK'

  if (t === 'show menu' || t.includes('show menu')) return 'SHOW_MENU'

  if (
    t === 'confirm' || t === 'place order' || t === 'go ahead' || t === 'okay' || t === 'ok' ||
    t.includes('confirm order') || t.includes('send to kitchen') ||
    t.includes('confirm and') || t.includes('checkout') ||
    t.includes('order confirm') || t.includes('place the order')
  ) return 'CONFIRM_ORDER'

  if (
    t === 'yes' || t === 'yeah' || t === 'yup' || t === 'yep' || t === 'ha' || t === 'haa' ||
    t === 'continue' || t === 'add more' || t === 'next' || t === 'more' ||
    t.includes('add more') || t.includes('continue ordering')
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

  const isExplicitCategorySwitch = /\b(show|open|display|let me see|switch to|go to|actually|change to)\b/i.test(t)
  if (isExplicitCategorySwitch) {
    const catKey = detectCategoryIntent(text)
    if (catKey) {
      return { intent: 'SWITCH_CATEGORY', category: catKey }
    }
  }

  if (isRepeatLastIntent(text)) {
    return { intent: 'REPEAT_LAST', qty }
  }

  if (isAmbiguousQuantity(text)) {
    return { intent: 'AMBIGUOUS_QTY', qty: explicitQty }
  }

  let cleaned = stripNumbers(text)
  const hadAddItemVerb = /\b(add|another|more|please|want|i want|i would like|order|buy|give me|get me|bring me)\b/gi.test(cleaned)

  cleaned = cleaned
    .replace(/\b(add|another|more|please|want|i want|i would like|order|buy|give me|get me|bring me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const matchResult = bestMatchMenuItem(cleaned || stripNumbers(text), menuItems || [])
  if (matchResult) {
    const { item: matched, confidence } = matchResult
    if (confidence >= 0.5) {
      if (explicitQty !== null) {
        return { intent: 'ADD_ITEM', item: matched.name, menuItem: matched, qty, confidence }
      } else {
        return { intent: 'ADD_ITEM_MISSING_QTY', item: matched.name, menuItem: matched, confidence }
      }
    } else {
      return { intent: 'ITEM_UNCLEAR' }
    }
  }

  if (hadAddItemVerb && !cleaned) {
    return { intent: 'ITEM_UNCLEAR' }
  }

  const catKey = detectCategoryIntent(text)
  if (catKey) {
    return { intent: 'SWITCH_CATEGORY', category: catKey }
  }

  if (hadAddItemVerb) {
    return { intent: 'ITEM_UNCLEAR' }
  }

  return { intent: 'LOW_CONFIDENCE' }
}

