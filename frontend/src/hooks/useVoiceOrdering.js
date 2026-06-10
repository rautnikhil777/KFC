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
 *  IDLE            – hook inactive
 *  CATEGORY        – listening for a category (starters / main / drinks / dessert)
 *  ITEM            – listening for an item name + optional quantity
 *  WAITING_FOR_QTY – item known; waiting for a quantity
 *  ITEM_SELECTION  – quantity known; waiting for item name
 *  ANYTHING_ELSE   – item added; asking if user wants more
 *  CART_CONFIRM    – on cart page; listening for confirm/yes/no
 *  KITCHEN         – order sent; no listening needed
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
  extractQuantity,
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
    whichItem: 'Which item would you like sir?',
    // howMany: 'How many would you like sir?',
    emptCart: 'Your cart is empty. Please add some items first.',
    noRepeat: 'I do not have a previous item to repeat. What would you like to order?',
    cartGreeting: 'Here is your order. Say confirm or yes to place it, or no to go back to the menu.',
    confirmOptions: 'Say yes or confirm to place your order, or no to go back.',
    recovery: 'I did not understand. You may choose Starters, Main Course, Drinks or Dessert.',
    confidenceLow: 'Sorry, I did not catch that. Please try again.',
    itemUnclear: 'I could not find that item. Please say the item name again.',
    categoryUnclear: 'Would you like Starters, Main Course, Drinks or Dessert?',
  },
  hi: {
    anythingElse: 'कुछ और चाहिए सर?',
    added: 'कार्ट में जोड़ दिया।',
    sendingKitchen: 'आपका ऑर्डर किचन को भेज दिया गया।',
    categoryPrompt: 'सर, आज आप क्या लेना चाहेंगे? स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट।',
    whichItem: 'कौन सा आइटम सर?',
    howMany: 'कितने सर?',
    emptCart: 'कार्ट खाली है।',
    noRepeat: 'कोई पिछला आइटम नहीं मिला।',
    cartGreeting: 'सर, ये आपके चुने हुए आइटम हैं। ऑर्डर देने के लिए हाँ कहें।',
    confirmOptions: 'हाँ या कन्फर्म कहें, या ना कहें।',
    recovery: 'समझ नहीं आया। स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट चुनें।',
    confidenceLow: 'माफ़ कीजिये, मुझे समझ नहीं आया।',
    itemUnclear: 'कृपया आइटम का नाम फिर से बताएं।',
    categoryUnclear: 'आप स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट लेना चाहेंगे?',
  },
  mr: {
    anythingElse: 'काही अजून सर?',
    added: 'कार्टमध्ये जोडले.',
    sendingKitchen: 'आपला ऑर्डर किचनला पाठवला.',
    categoryPrompt: 'सर, आज आपण काय घेणार? स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट.',
    whichItem: 'कोणता आयटम सर?',
    howMany: 'किती सर?',
    emptCart: 'कार्ट रिकामे आहे.',
    noRepeat: 'मागील आयटम सापडला नाही.',
    cartGreeting: 'सर, हे आपले आयटम आहेत. ऑर्डर द्यायला हो म्हणा.',
    confirmOptions: 'हो किंवा कन्फर्म म्हणा, किंवा नाही म्हणा.',
    recovery: 'समजलं नाही. स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट निवडा.',
    confidenceLow: 'माफ करा, मला समजले नाही.',
    itemUnclear: 'कृपया आयटमचे नाव पुन्हा सांगा.',
    categoryUnclear: 'स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट?',
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

  // Keep menuItems accessible inside callbacks without stale closures
  const menuItemsRef = useRef(menuItems || [])
  useEffect(() => { menuItemsRef.current = menuItems || [] }, [menuItems])

  const lang = safeLang(state.language)
  const copy = useMemo(() => COPY[lang] || COPY.en, [lang])

  // UI badge state ('IDLE' | 'LISTENING' | 'SPEAKING' | 'PROCESSING')
  const [voiceStatus, setVoiceStatus] = useState('IDLE')

  // ── Core state refs (avoid React re-render churn) ─────────────────────────

  /** Current step in the voice state machine */
  const stepRef = useRef('IDLE')

  /** Category currently displayed / selected by voice */
  const currentCategoryRef = useRef(null)

  /** Last item added — used for "same again" / repeat intent */
  const lastAddedItemRef = useRef(null)
  const lastQtyRef = useRef(null)

  /** Pending item waiting for quantity confirmation */
  const pendingItemRef = useRef(null)

  /** Pending quantity waiting for item name */
  const pendingQtyRef = useRef(null)

  /** Callback into MenuPage to switch the active category tab */
  const onSelectCategoryRef = useRef(null)

  /** Mounted guard — prevents state updates after component unmounts */
  const mountedRef = useRef(true)

  /** Prevents same transcript from being processed twice in a row */
  const lastProcessedRef = useRef('')

  /** Prevents concurrent transcript processing */
  const processingRef = useRef(false)

  /** Simple execution lock to prevent concurrent transcript processing and duplication */
  const voiceLockRef = useRef(false)

  /** Timestamp index of processed items to avoid SpeechRecognition duplication within 6s */
  const lastProcessedItemTimesRef = useRef({})

  // ── Timer refs ────────────────────────────────────────────────────────────

  /** "Anything else?" first silence timer (fires at T1 ms) */
  const aeTimer1Ref = useRef(null)

  /** "Anything else?" second silence timer (fires at T1+T2 ms → navigate) */
  const aeTimer2Ref = useRef(null)

  /** Restart-after-unexpected-end timer */
  const restartTimerRef = useRef(null)

  // ── Util: clear timers ────────────────────────────────────────────────────

  function clearAETimers() {
    if (aeTimer1Ref.current) { clearTimeout(aeTimer1Ref.current); aeTimer1Ref.current = null }
    if (aeTimer2Ref.current) { clearTimeout(aeTimer2Ref.current); aeTimer2Ref.current = null }
  }

  function clearAllTimers() {
    clearAETimers()
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
  }

  // ─── speakThen ─────────────────────────────────────────────────────────────
  //
  // THE ONLY way to speak. Enforces the mutex by stopping listening first.
  // Calls afterFn (if provided) after a safe delay post-TTS.
  //
  function speakThen(text, afterFn) {
    if (!mountedRef.current) {
      voiceLockRef.current = false
      processingRef.current = false
      return
    }

    // Mutex rule: stop mic before speaking
    stopListening()

    // Ensure voice lock is active during speaking
    voiceLockRef.current = true

    // Reset dedup so the next utterance from the user is treated fresh
    lastProcessedRef.current = ''

    if (mountedRef.current) setVoiceStatus('SPEAKING')

    speak(text, lang, () => {
      // TTS finished (or errored)
      if (!mountedRef.current) {
        voiceLockRef.current = false
        processingRef.current = false
        return
      }
      if (mountedRef.current) setVoiceStatus('IDLE')
      if (typeof afterFn === 'function') {
        // Small delay: prevents mic from picking up speaker echo
        setTimeout(() => {
          if (!mountedRef.current) return
          voiceLockRef.current = false
          processingRef.current = false
          afterFn()
        }, POST_SPEAK_DELAY_MS)
      } else {
        voiceLockRef.current = false
        processingRef.current = false
      }
    })
  }

  // ─── startListeningControlled ───────────────────────────────────────────────
  //
  // THE ONLY way to start listening. Guards the mutex.
  //
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

  // ─── Barge-in handler ──────────────────────────────────────────────────────
  //
  // Fires from listen.js onspeechstart — the instant user speech is detected.
  // If TTS is playing, cancel it immediately so the user's speech is captured.
  //
  function handleBargeIn() {
    if (!mountedRef.current) return
    clearAETimers()
    if (isSpeaking()) {
      stopSpeak()
      if (mountedRef.current) setVoiceStatus('LISTENING')
      // Cancel locks since TTS was stopped and the callback won't fire
      voiceLockRef.current = false
      processingRef.current = false
    }
  }

  // ─── Recognition end handler ────────────────────────────────────────────────
  //
  // Called when the recognition session ends. The hook decides whether/when to restart.
  //
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

  // ─── Recognition error handler ──────────────────────────────────────────────

  function handleListenError(e) {
    console.warn('[Voice] Recognition error:', e?.error || e)
  }

  // ─── Result handler ─────────────────────────────────────────────────────────
  //
  // Receives { transcript, isFinal } from listen.js.
  //
  function handleResult({ transcript, isFinal }) {
    if (!mountedRef.current || !enabled) return

    // If speaking, handle barge-in first to cancel TTS and release lock
    if (isSpeaking()) {
      stopSpeak()
      if (mountedRef.current) setVoiceStatus('LISTENING')
      voiceLockRef.current = false
      processingRef.current = false
    }

    // Ensure ONLY final speech results are processed (ignore interim)
    if (!isFinal) {
      if (stepRef.current === 'ANYTHING_ELSE') clearAETimers()
      if (mountedRef.current) setVoiceStatus('PROCESSING')
      return
    }

    // Ensure one lock mechanism prevents concurrent execution
    if (voiceLockRef.current || processingRef.current) {
      console.log('[Voice] Lock active, ignoring transcript:', transcript)
      return
    }

    const norm = transcript.trim().toLowerCase()
    if (!norm) return

    if (norm === lastProcessedRef.current) return

    voiceLockRef.current = true
    processingRef.current = true
    lastProcessedRef.current = norm

    if (mountedRef.current) setVoiceStatus('PROCESSING')

    try {
      processTranscript(transcript)
    } catch (e) {
      console.error('[Voice] processTranscript error:', e)
      voiceLockRef.current = false
      processingRef.current = false
      if (mountedRef.current) setVoiceStatus('IDLE')
    }
  }

  // ─── Core transcript processor ──────────────────────────────────────────────
  //
  // Routes transcript to the correct handler based on stepRef.current.
  //
  function processTranscript(rawTranscript) {
    const step = stepRef.current

    console.log(`[Voice] step=${step} | transcript="${rawTranscript}"`)

    let processed = false

    if (step === 'CATEGORY') {
      processed = true
      const catKey = detectCategoryIntent(rawTranscript)
      if (catKey) {
        applyCategory(catKey)
        return
      }
      speakThen(copy.recovery, startListeningControlled)
      return
    }

    if (step === 'WAITING_FOR_QTY') {
      processed = true
      const rawQty = extractQuantity(rawTranscript)
      const qty = Math.min(Math.max(rawQty ?? 1, 1), 5)
      if (pendingItemRef.current) {
        const item = pendingItemRef.current
        pendingItemRef.current = null
        addItemAndSchedule(item, qty)
        return
      } else {
        voiceLockRef.current = false
        processingRef.current = false
        startListeningControlled()
        return
      }
    }

    if (step === 'ITEM_SELECTION') {
      processed = true
      const parsed = parseVoice(rawTranscript, menuItemsRef.current)
      if (parsed.intent === 'ADD_ITEM' && parsed.menuItem) {
        const qty = Math.min(Math.max(pendingQtyRef.current || 1, 1), 5)
        addItemAndSchedule(parsed.menuItem, qty)
        pendingQtyRef.current = null
        return
      }
      speakThen(copy.whichItem, startListeningControlled)
      return
    }

    if (step === 'ANYTHING_ELSE') {
      processed = true
      clearAETimers()
      const parsed = parseVoice(rawTranscript, menuItemsRef.current)

      if (parsed.intent === 'YES') {
        stepRef.current = 'CATEGORY'
        speakThen(copy.categoryPrompt, startListeningControlled)
        return
      }
      if (parsed.intent === 'NO') {
        voiceLockRef.current = false
        processingRef.current = false
        nav('/cart')
        return
      }
      const catKey = detectCategoryIntent(rawTranscript)
      if (catKey) {
        applyCategory(catKey)
        return
      }
      if (parsed.intent === 'ADD_ITEM' && parsed.menuItem) {
        const qty = Math.min(Math.max(parsed.qty || 1, 1), 5)
        addItemAndSchedule(parsed.menuItem, qty)
        return
      }
      if (parsed.intent === 'ADD_ITEM_MISSING_QTY' && parsed.menuItem) {
        pendingItemRef.current = parsed.menuItem
        pendingQtyRef.current = null // Clean reset of pending quantity
        stepRef.current = 'WAITING_FOR_QTY'
        speakThen(copy.howMany, startListeningControlled)
        return
      }
      stepRef.current = 'CATEGORY'
      speakThen(copy.categoryPrompt, startListeningControlled)
      return
    }

    if (step === 'ITEM') {
      processed = true
      const catKey = detectCategoryIntent(rawTranscript)
      const parsed = parseVoice(rawTranscript, menuItemsRef.current)

      if (catKey && (!parsed.menuItem)) {
        applyCategory(catKey)
        return
      }

      if (parsed.intent === 'SWITCH_CATEGORY' && parsed.category) {
        applyCategory(parsed.category)
        return
      }

      if (parsed.intent === 'ADD_ITEM' && parsed.menuItem) {
        const qty = Math.min(Math.max(parsed.qty || 1, 1), 5)
        addItemAndSchedule(parsed.menuItem, qty)
        return
      }

      if (parsed.intent === 'ADD_ITEM_MISSING_QTY' && parsed.menuItem) {
        pendingItemRef.current = parsed.menuItem
        pendingQtyRef.current = null // Clean reset of pending quantity
        stepRef.current = 'WAITING_FOR_QTY'
        speakThen(copy.howMany, startListeningControlled)
        return
      }

      if (parsed.intent === 'AMBIGUOUS_QTY') {
        const qty = Math.min(Math.max(parsed.qty || 1, 1), 5)
        pendingQtyRef.current = qty
        pendingItemRef.current = null // Clean reset of pending item
        stepRef.current = 'ITEM_SELECTION'
        speakThen(copy.whichItem, startListeningControlled)
        return
      }

      if (parsed.intent === 'REPEAT_LAST') {
        const last = lastAddedItemRef.current
        if (!last?.menuItemId) {
          speakThen(copy.noRepeat, startListeningControlled)
          return
        }
        const qty = Math.min(Math.max(parsed.qty || 1, 1), 5)
        addItemAndSchedule(last, qty)
        return
      }

      speakThen(copy.itemUnclear, startListeningControlled)
      return
    }

    if (step === 'CART_CONFIRM' || page === 'CART') {
      processed = true
      const parsed = parseVoice(rawTranscript, [])

      if (parsed.intent === 'CONFIRM_ORDER' || parsed.intent === 'YES') {
        if (!state.cart.items.length) {
          speakThen(copy.emptCart, startListeningControlled)
          return
        }
        speakThen(copy.sendingKitchen, () => {
          confirmOrderFromVoice().catch(err => {
            console.error('[Voice] Confirm failed:', err)
            voiceLockRef.current = false
            processingRef.current = false
          })
        })
        return
      }

      if (
        parsed.intent === 'NO' ||
        parsed.intent === 'BACK' ||
        parsed.intent === 'REMOVE_ITEM'
      ) {
        voiceLockRef.current = false
        processingRef.current = false
        nav('/menu')
        return
      }

      speakThen(copy.confirmOptions, startListeningControlled)
      return
    }

    // Fallback if no step matched
    if (!processed) {
      voiceLockRef.current = false
      processingRef.current = false
      startListeningControlled()
    }
  }

  // ─── applyCategory ──────────────────────────────────────────────────────────

  function applyCategory(catKey) {
    clearAETimers()
    pendingItemRef.current = null
    pendingQtyRef.current = null
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

  // ─── addItemAndSchedule ──────────────────────────────────────────────────────

  function addItemAndSchedule(menuItem, qty) {
    clearAETimers()

    // Clean reset of pending refs to prevent leaking
    pendingItemRef.current = null
    pendingQtyRef.current = null

    const itemId = menuItem.menuItemId || menuItem.name
    const now = Date.now()
    const lastTime = lastProcessedItemTimesRef.current[itemId]

    // Prevent repeated addition of same item within 5–7 seconds (6s window)
    if (lastTime && now - lastTime < 6000) {
      console.log(`[Voice] Deduplicated repeated speech result for item: ${menuItem.name}`)
      voiceLockRef.current = false
      processingRef.current = false
      startListeningControlled()
      return
    }

    lastProcessedItemTimesRef.current[itemId] = now

    // quantity must NEVER exceed 5; default to 1 if not explicitly spoken
    const rawQty = parseInt(qty, 10)
    const targetQty = Math.min(Math.max(isNaN(rawQty) ? 1 : rawQty, 1), 5)

    const existing = state.cart.items.find(
      (x) => x.menuItemId === menuItem.menuItemId && x.name === menuItem.name
    )

    if (existing) {
      changeQuantityLocal(menuItem.menuItemId, menuItem.name, targetQty)
    } else {
      addCartItemLocal({ ...menuItem, quantity: targetQty, notes: '' })
    }

    lastAddedItemRef.current = menuItem
    lastQtyRef.current = targetQty
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

  // ─── confirmOrderFromVoice ───────────────────────────────────────────────────

  async function confirmOrderFromVoice() {
    if (!state.sessionId || !state.cart.items.length) {
      voiceLockRef.current = false
      processingRef.current = false
      return
    }
    try {
      const orderRes = await apiConfirmOrder({
        sessionId: state.sessionId,
        cartItems: state.cart.items,
      })
      setCart({ items: [] })
      voiceLockRef.current = false
      processingRef.current = false
      nav(`/kitchen?orderId=${encodeURIComponent(orderRes.orderId)}`)
    } catch (err) {
      console.error('[Voice] Confirm failed:', err)
      voiceLockRef.current = false
      processingRef.current = false
    }
  }

  // ─── getItemsForCategory ─────────────────────────────────────────────────────

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

  // ─── stopAll ─────────────────────────────────────────────────────────────────

  function stopAll() {
    clearAllTimers()
    stopSpeak()
    stopListening()
    stepRef.current = 'IDLE'
    voiceLockRef.current = false
    processingRef.current = false
    if (mountedRef.current) setVoiceStatus('IDLE')
  }

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      processingRef.current = false
      voiceLockRef.current = false
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
    voiceLockRef.current = false
    lastProcessedItemTimesRef.current = {}
    clearAllTimers()
    pendingItemRef.current = null
    pendingQtyRef.current = null

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

  // ─── Public API ───────────────────────────────────────────────────────────────

  return {
    stop: stopAll,
    listening: enabled && isListening(),
    voiceStatus,
    setOnSelectCategory: (cb) => { onSelectCategoryRef.current = cb },
  }
}