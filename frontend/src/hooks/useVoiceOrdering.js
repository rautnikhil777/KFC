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


  function handleTranscript(rawTranscript) {
    if (!enabled) return
    if (!rawTranscript) return

    // Avoid repeating same transcript
    const norm = String(rawTranscript).trim().toLowerCase()
    if (!norm) return
    if (norm === lastHandledTranscriptRef.current) return
    lastHandledTranscriptRef.current = norm

    if (suppressDuringSpeakRef.current) return

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


      speakQueued(copy.added, lang)

      // After add: loop anything else.
      speakQueued(copy.anythingElse, lang)
      onCartUpdated?.()
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
    return () => stopAll()
  }, [])

  return {
    stop: stopAll,
    listening: enabled && isListening(),
  }

}

