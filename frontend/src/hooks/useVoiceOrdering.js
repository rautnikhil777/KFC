import { useContext, useEffect, useMemo, useRef } from 'react'

import { useNavigate } from 'react-router-dom'
import { OrderSessionContext } from '../context/OrderSessionContext.jsx'
import { apiConfirmOrder, apiPayDummy } from '../services/api.js'
import { parseVoice } from '../services/intentParser.js'
import { isListening, startListening, stopListening } from '../services/listen.js'
import { speak, stopSpeak } from '../services/speak.js'

function safeLang(stateLang) {
  if (stateLang === 'hi' || stateLang === 'mr' || stateLang === 'en') return stateLang
  return 'en'
}

const COPY = {
  en: {
    welcome: 'Welcome to KFC. Please select language.',
    startListening: 'Start listening',
    stopListening: 'Stop listening',
    anythingElse: 'Anything else?',
    didntCatch: "I didn't catch that.",
    added: 'Added.',
    sendingKitchen: 'Sending to kitchen',
    confirmOrder: 'Confirm order',
    orderConfirmed: 'Order confirmed',
    payNow: 'Pay now',
    paymentCompleted: 'Payment completed',
    orderReady: 'Ready',
    orderPreparing: 'Preparing',
  },
  hi: {
    welcome: 'KFC में आपका स्वागत है। कृपया भाषा चुनें।',
    startListening: 'सुनना शुरू करें',
    stopListening: 'सुनना बंद करें',
    anythingElse: 'कुछ और?',
    didntCatch: "मुझे समझ नहीं आया।",
    added: 'जोड़ दिया।',
    sendingKitchen: 'किचन को भेज रहे हैं',
    confirmOrder: 'ऑर्डर कन्फर्म करें',
    orderConfirmed: 'ऑर्डर कन्फर्म हो गया',
    payNow: 'अभी भुगतान करें',
    paymentCompleted: 'भुगतान पूरा हो गया',
    orderReady: 'तैयार',
    orderPreparing: 'तैयार हो रहा है',
  },
  mr: {
    welcome: 'KFC मध्ये आपले स्वागत आहे. कृपया भाषा निवडा.',
    startListening: 'ऐकायला सुरू करा',
    stopListening: 'ऐकणे थांबवा',
    anythingElse: 'काही अजून?',
    didntCatch: "मला समजलं नाही.",
    added: 'जोडले.',
    sendingKitchen: 'किचनला पाठवत आहोत',
    confirmOrder: 'ऑर्डर कन्फर्म करा',
    orderConfirmed: 'ऑर्डर कन्फर्म झाली',
    payNow: 'आता पैसे द्या',
    paymentCompleted: 'पेमेंट पूर्ण',
    orderReady: 'तयार',
    orderPreparing: 'तयार होत आहे',
  },
}

export function useVoiceOrdering({
  enabled,
  page,
  menuItems,
  onCartUpdated,
} = {}) {
  const nav = useNavigate()
  const { state, addCartItemLocal, removeCartItemLocal, setCart } = useContext(OrderSessionContext)


  // We keep menuItems in controller state; voice parsing needs concrete menu item objects.
  const menuItemsRef = useRef(menuItems || null)
  useEffect(() => {
    menuItemsRef.current = menuItems || null
  }, [menuItems])





  const lang = safeLang(state.language)
  // Expose language for controller-page integration that triggers auto-start.

  const copy = useMemo(() => COPY[lang] || COPY.en, [lang])

  const listeningRef = useRef(false)
  const queuedVoiceActionRef = useRef(null)
  const lastHandledTranscriptRef = useRef('')
  const suppressDuringSpeakRef = useRef(false)

  function speakQueued(text, l = lang) {
    suppressDuringSpeakRef.current = true
    speak(text, l)
    setTimeout(() => {
      suppressDuringSpeakRef.current = false
    }, 650)
  }

  const stopAll = () => {
    stopSpeak()
    stopListening()
    listeningRef.current = false
    suppressDuringSpeakRef.current = false
    queuedVoiceActionRef.current = null
  }

  async function confirmOrderFromVoice() {
    // Used by voice CART_CONFIRM flow.

    if (!state.sessionId) return
    if (!state.cart.items.length) return

    const orderRes = await apiConfirmOrder({
      sessionId: state.sessionId,
      cartItems: state.cart.items,
    })

    setCart({ items: [] })

    // Move to kitchen
    nav(`/kitchen?orderId=${encodeURIComponent(orderRes.orderId)}`)
    return orderRes
  }

  async function payFromVoice(orderId) {
    if (!orderId) return
    await apiPayDummy({ orderId })
    nav(`/bill/${encodeURIComponent(orderId)}`)
  }


  // Conversational state machine (voice-first ordering)
  const stepRef = useRef('IDLE')
  const commandLockRef = useRef(false)
  const anythingElseTimerRef = useRef(null)
  const debouncedTimerRef = useRef(null)


  const categoryKeys = ['starter', 'mains', 'main course', 'drinks', 'dessert']

  // Allow MenuPage to control active category via callback.
  // We don't use backend/touch APIs.
  const onSelectCategoryRef = useRef(null)
  // Silence timers: repeat once then go to cart.
  const silenceTimer1Ref = useRef(null)
  const silenceTimer2Ref = useRef(null)

  function normalizeCategoryKey(t) {

    const x = String(t || '').toLowerCase().trim()
    if (x.includes('starter')) return 'starter'
    if (x.includes('dessert')) return 'dessert'
    if (x.includes('drink')) return 'drinks'
    if (x.includes('main course')) return 'main course'
    if (x.includes('mains')) return 'mains'
    if (x === 'main') return 'mains'
    return null
  }

  function isYesIntent(t) {
    const x = String(t || '').toLowerCase().trim()
    return x === 'yes' || x === 'ha' || x === 'haa' || x === 'add more' || x === 'continue' || x === 'more' || x === 'another item' || x === 'another'
  }

  function isNoIntent(t) {
    const x = String(t || '').toLowerCase().trim()
    return x === 'no' || x === 'done' || x === 'enough' || x === 'confirm' || x === 'place order' || x === 'generate bill' || x === 'generate bill' || x.includes('place order') || x.includes('generate bill')
  }

  function extractNumberAndRemainder(text) {
    const raw = String(text || '')
    const norm = raw.toLowerCase().replace(/[,\.!?]/g, ' ')
    const qtyMatch = norm.match(/(\d+)\s*(x|times)?\b/)
    if (qtyMatch) {
      const qty = Number(qtyMatch[1])
      const remainder = norm.replace(qtyMatch[0], '').trim()
      return { qty, remainder }
    }
    // number words best-effort
    const words = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    }
    for (const [w, n] of Object.entries(words)) {
      if (norm.startsWith(w + ' ')) {
        const remainder = norm.replace(w, '').trim()
        return { qty: n, remainder }
      }
    }
    return { qty: null, remainder: norm.trim() }
  }

  function startMenuVoiceFlow() {
    // MENU_PROMPT
    stepRef.current = 'MENU_PROMPT'
    if (typeof onSelectCategoryRef.current === 'function') {
      // reset to first category via current UI; do not force if menu not loaded
    }
    speakQueued('What would you like sir?', lang)
  }

  useEffect(() => {
    if (!enabled) return
    if (page !== 'MENU') return
    // Speak prompt when entering Menu in voice mode
    // Only once per mount.
    stepRef.current = 'IDLE'
    startMenuVoiceFlow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page])

  function handleTranscript(rawTranscript) {

    // Debounce + command lock
    if (commandLockRef.current) return
    commandLockRef.current = true
    if (debouncedTimerRef.current) clearTimeout(debouncedTimerRef.current)
    debouncedTimerRef.current = setTimeout(() => {
      commandLockRef.current = false
    }, 450)

    // Step gating: ignore transcripts while we're in silence-prompt timers.
    if (anythingElseTimerRef.current && stepRef.current === 'ANYTHING_ELSE_WAITING') {
      // allow intents to cancel the waiting loop
    }


    if (!enabled) return
    if (!rawTranscript) return

    // Avoid repeating same transcript
    const norm = String(rawTranscript).trim().toLowerCase()
    if (!norm) return
    if (norm === lastHandledTranscriptRef.current) return
    lastHandledTranscriptRef.current = norm

    if (suppressDuringSpeakRef.current) return

    // Phase-3 conversational parsing (category + yes/no + item)
    const lower = norm
    const categoryIntent = normalizeCategoryKey(lower)
    const yesIntent = isYesIntent(lower)
    const noIntent = isNoIntent(lower)

    const step = stepRef.current

    // CATEGORY selection step
    if (page === 'MENU' && (step === 'MENU_PROMPT' || step === 'CATEGORY_SELECTED' || step === 'ADDING_ITEMS' || step === 'IDLE')) {
      if (categoryIntent) {
        stepRef.current = 'CATEGORY_SELECTED'

        if (anythingElseTimerRef.current) clearTimeout(anythingElseTimerRef.current)

        // Speak and update Menu UI via callback
        if (typeof onSelectCategoryRef.current === 'function') {
          onSelectCategoryRef.current(categoryIntent)
        }

        speakQueued('These are available. Please tell me your items.', lang)
        return
      }
    }


    // Anything-else waiting step
    if (step === 'ANYTHING_ELSE_WAITING') {
      if (yesIntent) {
        if (anythingElseTimerRef.current) clearTimeout(anythingElseTimerRef.current)
        if (silenceTimer1Ref.current) clearTimeout(silenceTimer1Ref.current)
        if (silenceTimer2Ref.current) clearTimeout(silenceTimer2Ref.current)
        stepRef.current = 'ADDING_ITEMS'
        speakQueued('What would you like sir?', lang)
        return
      }
      if (noIntent) {
        nav('/cart')
        return
      }
      // If user says category/item instead of yes, fall through to menu parsing.
    }


    // Cart confirm step (CART_CONFIRM)
    if (page === 'CART') {
      const confirmLike =
        lower === 'yes' ||
        lower === 'confirm' ||
        lower === 'okay' ||
        lower === 'place order' ||
        lower.includes('place order') ||
        lower.includes('confirm') ||
        lower.includes('go ahead')

      if (confirmLike) {
        // Spec: speak prompt then confirm
        speakQueued('Please confirm your order.', lang)
        confirmOrderFromVoice().catch(() => {})
        return
      }

      // YES intents that are not confirm-like are treated as confirmLike in spec
      if (yesIntent) {
        speakQueued('Please confirm your order.', lang)
        confirmOrderFromVoice().catch(() => {})
        return
      }

      // NO intents navigate back to touch-cart flow (no navigation here)
      if (noIntent) {
        return
      }
    }


    const parsed = parseVoice(rawTranscript, menuItemsRef.current || [])


    if (!parsed.intent) {
      speakQueued(copy.didntCatch, lang)
      return
    }

    const intent = parsed.intent

    // Hybrid safety: voice actions should not break touch. They just operate on context.
    if (intent === 'CHANGE_LANGUAGE') {
      if (parsed.language && parsed.language !== state.language) {
        // The session context already has setLanguage in controller pages;
        // since hook can't set language directly without it, we rely on the existing LanguageSelector.
        // Speak only; auto-navigation handled by page integration.
        speakQueued(copy.didntCatch, lang)
      }
      return
    }

    if (intent === 'ADD_ITEM') {
      // Strict step control: only accept items after category is selected.
      if (page === 'MENU' && stepRef.current !== 'CATEGORY_SELECTED' && stepRef.current !== 'ADDING_ITEMS') {
        speakQueued("Please tell me the category first.", lang)
        return
      }

      // Phase-3: After adding, go to silence-waiting loop.
      if (page !== 'MENU') {
        // keep legacy behavior for non-menu pages
      }

      // Determine concrete menu item if we have it; parseVoice already best-matches.
      const matched = parsed.menuItem

      if (matched?.menuItemId) {
        addCartItemLocal({
          ...matched,
          quantity: parsed.qty || 1,
          notes: '',
        })
      } else {
        // Without a concrete menu item id we cannot reliably add to cart.
        speakQueued(copy.didntCatch, lang)
        speakQueued('Please use touch to add items from the menu.', lang)
        return
      }


      // After add: speak prompt and start silence auto-loop.
      speakQueued(copy.added + ' Anything else sir?', lang)
      onCartUpdated?.()

      // Set silence timers ~10s (repeat once, then go cart)
      stepRef.current = 'ANYTHING_ELSE_WAITING'

      if (anythingElseTimerRef.current) clearTimeout(anythingElseTimerRef.current)
      if (silenceTimer1Ref.current) clearTimeout(silenceTimer1Ref.current)
      if (silenceTimer2Ref.current) clearTimeout(silenceTimer2Ref.current)

      silenceTimer1Ref.current = setTimeout(() => {
        // if still waiting, repeat once
        if (stepRef.current !== 'ANYTHING_ELSE_WAITING') return
        speakQueued('Anything else sir?', lang)
        silenceTimer2Ref.current = setTimeout(() => {
          if (stepRef.current !== 'ANYTHING_ELSE_WAITING') return
          nav('/cart')
        }, 10000)
      }, 10000)

      return


    }

    if (intent === 'REMOVE_ITEM') {
      // Remove: remove first matching by best-match again
      const matched = parseVoice(rawTranscript, menuItems || [])
      const itemName = parsed.item || matched?.item
      if (!itemName) return

      const items = state.cart.items || []
      const target = items.find((x) => String(x.name || '').toLowerCase() === String(itemName).toLowerCase())
      if (target) {
        removeCartItemLocal(target.menuItemId, target.name)
      }
      onCartUpdated?.()
      return
    }

    if (intent === 'CONFIRM_ORDER') {
      if (page === 'CART' || page === 'CONFIRM') {
        speakQueued(copy.sendingKitchen, lang)
        confirmOrderFromVoice().catch(() => {})
      }
      return
    }

    if (intent === 'TRACK_ORDER') {
      // For kitchen/track screens we interpret this as navigate to track if possible
      if (page === 'KITCHEN') {
        // If there's orderId in query param, track page already has it.
        // If user asks here, just navigate to the latest order in kitchen list isn't available in hook.
        speakQueued(copy.orderPreparing, lang)
        return
      }
      return
    }

    if (intent === 'PAY') {
      // On track page, the orderId is in route param. Controller page integration should pass a callback.
      // Hook just navigates if orderId was provided via onCartUpdated callback.
      queuedVoiceActionRef.current?.()
      return
    }

    if (intent === 'GENERATE_BILL') {
      // For now, translate to pay-from-voice equivalent.
      return
    }
  }

  useEffect(() => {
    if (!enabled) {
      stopAll()
      return
    }

    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      // Speech API unsupported: do nothing.
      return
    }

    // Only start listening once.
    if (listeningRef.current) return

    try {
      const { stop } = startListening({
        lang,
        onResult: (res) => {
          const transcript = res?.transcript
          if (!transcript) return

          // Handle only when there is a meaningful change
          handleTranscript(transcript)
        },
        onError: () => {},
      })
      listeningRef.current = isListening()
      void stop
    } catch {
      // ignore
    }
  }, [enabled, lang])

  // cleanup
  useEffect(() => {
    return () => {
      stopAll()
      if (debouncedTimerRef.current) {
        clearTimeout(debouncedTimerRef.current)
      }
    }
  }, [])


  return {
    stop: stopAll,
    listening: enabled && isListening(),
    setOnSelectCategory: (cb) => { onSelectCategoryRef.current = cb },
  }

}


