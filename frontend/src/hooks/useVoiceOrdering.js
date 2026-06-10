/**
 * useVoiceOrdering.js — Single voice state machine.
 *
 * ARCHITECTURE
 * ────────────
 *  • This hook is the ONE source of truth for all voice state.
 *  • listen.js and speak.js are pure services — no state, no cross-talk.
 *  • The only way to speak is speakThen(text, afterFn).
 *  • The only way to listen is startListeningControlled().
 *  • MUTEX: isSpeaking && isListening must NEVER both be true.
 *
 * STATE MACHINE (stepRef)
 * ───────────────────────
 *  IDLE          – hook inactive
 *  CATEGORY      – listening for a category (starters / main / drinks / dessert)
 *  ITEM          – listening for an item name
 *  ANYTHING_ELSE – item added; asking if user wants more
 *  CART_CONFIRM  – on cart page; listening for confirm/yes/no
 *  KITCHEN       – order sent; no listening needed
 *
 * FLOW
 * ────
 *  MENU entry → CATEGORY → (user says category) → ITEM → (user says item) →
 *    ANYTHING_ELSE → (silence 10 s) → /cart
 *    ANYTHING_ELSE → (yes / new item) → ITEM
 *    ANYTHING_ELSE → (no) → /cart
 *  CART entry → CART_CONFIRM → (yes/confirm) → /kitchen
 *                             → (no) → /menu
 *  KITCHEN entry → KITCHEN (no listening)
 */

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { OrderSessionContext } from '../context/OrderSessionContext.jsx'
import { apiConfirmOrder } from '../services/api.js'
import {
  CATEGORY_DISPLAY_NAMES,
  detectCategoryIntent,
  parseVoice,
} from '../services/intentParser.js'
import {
  destroyListener,
  isListening,
  startListening,
  stopListening,
} from '../services/listen.js'
import { isSpeaking, speak, stopSpeak } from '../services/speak.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
)

/** Delay between TTS end and mic start — prevents echo pickup on mobile */
const POST_SPEAK_DELAY_MS = IS_MOBILE ? 600 : 350

/** After an unexpected recognition end, wait before restarting (prevents loop) */
const RESTART_DELAY_MS = IS_MOBILE ? 2000 : 1200

/** Silence-to-cart timers: repeat prompt at T1, navigate at T2 */
const ANYTHING_ELSE_T1_MS = 5000
const ANYTHING_ELSE_T2_MS = 5000

const RECOGNITION_LANG_MAP = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' }

// ─── Copy (voice prompts) ────────────────────────────────────────────────────

const COPY = {
  en: {
    anythingElse: 'Anything else sir?',
    added: 'Added to cart.',
    sendingKitchen: 'Your order has been sent to the kitchen. Thank you!',
    categoryPrompt: 'What would you like today? You may choose Starters, Main Course, Drinks, or Dessert.',
    cartGreeting: 'Here is your order. Say confirm or yes to place it, or no to go back to the menu.',
    confirmOptions: 'Say yes or confirm to place your order, or no to go back.',
    recovery: 'I did not understand. You may choose Starters, Main Course, Drinks or Dessert.',
    itemUnclear: 'I could not find that item. Please say the item name again.',
  },
  hi: {
    anythingElse: 'कुछ और चाहिए सर?',
    added: 'कार्ट में जोड़ दिया।',
    sendingKitchen: 'आपका ऑर्डर किचन को भेज दिया गया।',
    categoryPrompt: 'सर, आज आप क्या लेना चाहेंगे? स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट।',
    cartGreeting: 'सर, ये आपके चुने हुए आइटम हैं। ऑर्डर देने के लिए हाँ कहें।',
    confirmOptions: 'हाँ या कन्फर्म कहें, या ना कहें।',
    recovery: 'समझ नहीं आया। स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट चुनें।',
    itemUnclear: 'कृपया आइटम का नाम फिर से बताएं।',
  },
  mr: {
    anythingElse: 'काही अजून सर?',
    added: 'कार्टमध्ये जोडले.',
    sendingKitchen: 'आपला ऑर्डर किचनला पाठवला.',
    categoryPrompt: 'सर, आज आपण काय घेणार? स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट.',
    cartGreeting: 'सर, हे आपले आयटम आहेत. ऑर्डर द्यायला हो म्हणा.',
    confirmOptions: 'हो किंवा कन्फर्म म्हणा, किंवा नाही म्हणा.',
    recovery: 'समजलं नाही. स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट निवडा.',
    itemUnclear: 'कृपया आयटमचे नाव पुन्हा सांगा.',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeLang(l) {
  return l === 'hi' || l === 'mr' ? l : 'en'
}

function catLabel(key) {
  return CATEGORY_DISPLAY_NAMES[key] ||
    (key ? key.charAt(0).toUpperCase() + key.slice(1) : '')
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVoiceOrdering({ enabled, page, menuItems, onCartUpdated } = {}) {
  const nav = useNavigate()
  const { state, addCartItemLocal, setCart, changeQuantityLocal } = useContext(OrderSessionContext)

  const menuItemsRef = useRef(menuItems || [])
  useEffect(() => { menuItemsRef.current = menuItems || [] }, [menuItems])

  const lang = safeLang(state.language)
  const copy = useMemo(() => COPY[lang] || COPY.en, [lang])

  const [voiceStatus, setVoiceStatus] = useState('IDLE')

  const stepRef = useRef('IDLE')
  const currentCategoryRef = useRef(null)
  const lastAddedItemRef = useRef(null)
  const onSelectCategoryRef = useRef(null)
  const mountedRef = useRef(true)
  const lastProcessedRef = useRef('')
  const processingRef = useRef(false)
  const lastProcessedItemTimesRef = useRef({})

  const aeTimer1Ref = useRef(null)
  const aeTimer2Ref = useRef(null)
  const restartTimerRef = useRef(null)

  function clearAETimers() {
    if (aeTimer1Ref.current) { clearTimeout(aeTimer1Ref.current); aeTimer1Ref.current = null }
    if (aeTimer2Ref.current) { clearTimeout(aeTimer2Ref.current); aeTimer2Ref.current = null }
  }

  function clearAllTimers() {
    clearAETimers()
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
  }

  function speakThen(text, afterFn) {
    if (!mountedRef.current) return

    stopListening()
    lastProcessedRef.current = ''

    if (mountedRef.current) setVoiceStatus('SPEAKING')

    speak(text, lang, () => {
      if (!mountedRef.current) return
      if (mountedRef.current) setVoiceStatus('IDLE')
      if (typeof afterFn === 'function') {
        setTimeout(() => {
          if (mountedRef.current) afterFn()
        }, POST_SPEAK_DELAY_MS)
      }
    })
  }

  function startListeningControlled() {
    if (!mountedRef.current) return
    if (!enabled) return
    if (isSpeaking()) return
    if (isListening()) return
    if (stepRef.current === 'IDLE' || stepRef.current === 'KITCHEN') return

    const recLang = RECOGNITION_LANG_MAP[lang] || 'en-US'

    try {
      startListening({
        lang: recLang,
        onResult: handleResult,
        onError: handleListenError,
        onEnd: handleListenEnd,
        onBargeIn: handleBargeIn,
      })
      if (mountedRef.current) setVoiceStatus('LISTENING')
    } catch (e) {
      console.warn('[Voice] startListening failed:', e.message)
    }
  }

  function handleBargeIn() {
    if (!mountedRef.current) return
    if (isSpeaking()) {
      stopSpeak()
      if (mountedRef.current) setVoiceStatus('LISTENING')
    }
  }

  function handleListenEnd({ manual }) {
    if (!mountedRef.current) return
    if (manual) return
    if (isSpeaking()) return
    if (stepRef.current === 'IDLE' || stepRef.current === 'KITCHEN') return

    if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null
      if (!mountedRef.current || !enabled || isSpeaking() || isListening()) return
      startListeningControlled()
    }, RESTART_DELAY_MS)
  }

  function handleListenError(e) {
    console.warn('[Voice] Recognition error:', e?.error || e)
  }

  function handleResult({ transcript, isFinal }) {
    if (!mountedRef.current || !enabled) return

    if (isSpeaking()) {
      stopSpeak()
      if (mountedRef.current) setVoiceStatus('LISTENING')
      if (!isFinal) return
    }

    if (!isFinal) {
      if (stepRef.current === 'ANYTHING_ELSE') clearAETimers()
      if (mountedRef.current) setVoiceStatus('PROCESSING')
      return
    }

    const norm = transcript.trim().toLowerCase()
    if (!norm) return
    if (norm === lastProcessedRef.current) return

    if (processingRef.current) return
    processingRef.current = true
    lastProcessedRef.current = norm

    if (mountedRef.current) setVoiceStatus('PROCESSING')

    try {
      processTranscript(transcript)
    } finally {
      processingRef.current = false
    }
  }

  function processTranscript(rawTranscript) {
    const step = stepRef.current

    console.log(`[Voice] step=${step} | transcript="${rawTranscript}"`)

    if (step === 'CATEGORY') {
      const catKey = detectCategoryIntent(rawTranscript)
      if (catKey) {
        applyCategory(catKey)
        return
      }
      speakThen(copy.recovery, startListeningControlled)
      return
    }

    if (step === 'ANYTHING_ELSE') {
      clearAETimers()
      const parsed = parseVoice(rawTranscript, menuItemsRef.current)

      if (parsed.intent === 'YES') {
        stepRef.current = 'CATEGORY'
        speakThen(copy.categoryPrompt, startListeningControlled)
        return
      }

      if (parsed.intent === 'NO') {
        nav('/cart')
        return
      }

      const catKey = detectCategoryIntent(rawTranscript)
      if (catKey) {
        applyCategory(catKey)
        return
      }

      if (parsed.menuItem) {
        addItemAndSchedule(parsed.menuItem, 1)
        return
      }

      stepRef.current = 'CATEGORY'
      speakThen(copy.categoryPrompt, startListeningControlled)
      return
    }

    if (step === 'ITEM') {
      const catKey = detectCategoryIntent(rawTranscript)
      const parsed = parseVoice(rawTranscript, menuItemsRef.current)

      if (catKey && !parsed.menuItem) {
        applyCategory(catKey)
        return
      }

      if (parsed.intent === 'SWITCH_CATEGORY' && parsed.category) {
        applyCategory(parsed.category)
        return
      }

      if (parsed.intent === 'REPEAT_LAST') {
        const last = lastAddedItemRef.current
        if (last?.menuItemId || last?.name) {
          addItemAndSchedule(last, 1)
          return
        }
      }

      if (parsed.menuItem) {
        addItemAndSchedule(parsed.menuItem, 1)
        return
      }

      speakThen(copy.itemUnclear, startListeningControlled)
      return
    }

    if (step === 'CART_CONFIRM' || page === 'CART') {
      const parsed = parseVoice(rawTranscript, [])

      if (parsed.intent === 'CONFIRM_ORDER' || parsed.intent === 'YES') {
        if (!state.cart.items.length) {
          nav('/menu')
          return
        }
        speakThen(copy.sendingKitchen, () => {
          confirmOrderFromVoice().catch(err => console.error('[Voice] Confirm failed:', err))
        })
        return
      }

      if (
        parsed.intent === 'NO' ||
        parsed.intent === 'BACK' ||
        parsed.intent === 'REMOVE_ITEM'
      ) {
        nav('/menu')
        return
      }

      speakThen(copy.confirmOptions, startListeningControlled)
    }
  }

  function applyCategory(catKey) {
    clearAETimers()
    currentCategoryRef.current = catKey
    stepRef.current = 'ITEM'

    if (typeof onSelectCategoryRef.current === 'function') {
      onSelectCategoryRef.current(catKey)
    }

    const label = catLabel(catKey)
    const catItems = getItemsForCategory(catKey)
    const names = catItems
      .slice(0, 5)
      .map(it => it.name)
      .filter(Boolean)
      .join(', ')

    let text
    if (lang === 'hi') {
      text = `ठीक है सर, ${label} दिखा रहे हैं।${names ? ` ये उपलब्ध आइटम हैं: ${names}.` : ''} आप क्या ऑर्डर करना चाहेंगे?`
    } else if (lang === 'mr') {
      text = `ठीक आहे सर, ${label} दाखवत आहे.${names ? ` उपलब्ध आयटम: ${names}.` : ''} आपण काय ऑर्डर करणार?`
    } else {
      text = `Okay sir, showing ${label}.${names ? ` Available items: ${names}.` : ''} What would you like to order?`
    }

    speakThen(text, startListeningControlled)
  }

  function addItemAndSchedule(menuItem, qty = 1) {
    clearAETimers()

    const itemId = menuItem.menuItemId || menuItem.name
    const now = Date.now()
    const lastTime = lastProcessedItemTimesRef.current[itemId]

    if (lastTime && now - lastTime < 3000) {
      console.log(`[Voice] Deduplicated repeated speech result for item: ${menuItem.name}`)
      return
    }

    lastProcessedItemTimesRef.current[itemId] = now

    const targetQty = qty || 1

    const existing = state.cart.items.find(
      (x) => x.menuItemId === menuItem.menuItemId && x.name === menuItem.name
    )

    if (existing) {
      changeQuantityLocal(menuItem.menuItemId, menuItem.name, existing.quantity + targetQty)
    } else {
      addCartItemLocal({ ...menuItem, quantity: targetQty, notes: '' })
    }

    lastAddedItemRef.current = menuItem

    if (onCartUpdated) onCartUpdated()

    stepRef.current = 'ANYTHING_ELSE'

    const addedMsg = `${copy.added} ${copy.anythingElse}`

    speakThen(addedMsg, () => {
      startListeningControlled()

      aeTimer1Ref.current = setTimeout(() => {
        aeTimer1Ref.current = null
        if (stepRef.current !== 'ANYTHING_ELSE' || !mountedRef.current) return

        speakThen(copy.anythingElse, () => {
          startListeningControlled()

          aeTimer2Ref.current = setTimeout(() => {
            aeTimer2Ref.current = null
            if (stepRef.current !== 'ANYTHING_ELSE' || !mountedRef.current) return
            nav('/cart')
          }, ANYTHING_ELSE_T2_MS)
        })
      }, ANYTHING_ELSE_T1_MS)
    })
  }

  async function confirmOrderFromVoice() {
    if (!state.sessionId || !state.cart.items.length) return
    const orderRes = await apiConfirmOrder({
      sessionId: state.sessionId,
      cartItems: state.cart.items,
    })
    setCart({ items: [] })
    nav(`/kitchen?orderId=${encodeURIComponent(orderRes.orderId)}`)
  }

  function getItemsForCategory(catKey) {
    const all = menuItemsRef.current || []
    if (!catKey) return all
    const k = String(catKey).toLowerCase().trim()
    return all.filter(it => {
      const cat = String(it?.category || '').toLowerCase().trim()
      if (!cat) return false
      if (cat === k) return true
      if (cat.includes(k) || k.includes(cat)) return true
      if (k === 'main' && cat.includes('main')) return true
      if (k === 'starter' && (cat.includes('starter') || cat.includes('start'))) return true
      if (k === 'drinks' && (cat.includes('drink') || cat.includes('beverage'))) return true
      if (k === 'dessert' && (cat.includes('dessert') || cat.includes('sweet'))) return true
      return false
    })
  }

  function stopAll() {
    clearAllTimers()
    stopSpeak()
    stopListening()
    stepRef.current = 'IDLE'
    if (mountedRef.current) setVoiceStatus('IDLE')
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      processingRef.current = false
      lastProcessedRef.current = ''
      lastProcessedItemTimesRef.current = {}
      stepRef.current = 'IDLE'
      clearAllTimers()
      stopSpeak()
      destroyListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopAll()
      return
    }
    if (typeof window === 'undefined') return
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return

    lastProcessedRef.current = ''
    processingRef.current = false
    lastProcessedItemTimesRef.current = {}
    clearAllTimers()

    if (page === 'MENU') {
      stepRef.current = 'CATEGORY'
      currentCategoryRef.current = null
      speakThen(copy.categoryPrompt, startListeningControlled)
    } else if (page === 'CART') {
      stepRef.current = 'CART_CONFIRM'
      speakThen(copy.cartGreeting, startListeningControlled)
    } else if (page === 'KITCHEN') {
      stepRef.current = 'KITCHEN'
      speakThen(copy.sendingKitchen, () => {
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page])

  return {
    stop: stopAll,
    listening: enabled && isListening(),
    voiceStatus,
    setOnSelectCategory: (cb) => { onSelectCategoryRef.current = cb },
  }
}