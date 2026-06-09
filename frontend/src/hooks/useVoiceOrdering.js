import { useContext, useEffect, useMemo, useRef, useState } from 'react'

import { useNavigate } from 'react-router-dom'
import { OrderSessionContext } from '../context/OrderSessionContext.jsx'
import { apiConfirmOrder, apiPayDummy } from '../services/api.js'
import {
  CATEGORY_DISPLAY_NAMES,
  detectCategoryIntent,
  isAmbiguousQuantity,
  isRepeatLastIntent,
  parseVoice,
} from '../services/intentParser.js'
import { isListening, startListening, stopListening } from '../services/listen.js'
import { isSpeaking, setSpeakStateListener, speak, stopSpeak } from '../services/speak.js'

function safeLang(stateLang) {
  if (stateLang === 'hi' || stateLang === 'mr' || stateLang === 'en') return stateLang
  return 'en'
}

function catLabel(key) {
  return CATEGORY_DISPLAY_NAMES[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : '')
}

const COPY = {
  en: {
    anythingElse:    'Anything else sir?',
    didntCatch:      "Sir, I did not understand. You may choose starters, main course, drinks, or dessert.",
    added:           'Added to cart.',
    sendingKitchen:  'Your order has been sent to kitchen.',
    orderPreparing:  'Preparing',
    categoryPrompt:  'Sir, what would you like today? You may choose starters, main course, drinks, or dessert.',
    whichItem:       'Which item sir?',
    howMany:         'How many sir?',
    emptCart:        'Your cart is empty. Please add some items first.',
    noRepeat:        "I do not have a previous item to repeat. What would you like to order?",
    notFound:        'I could not find that item. Please try again.',
    cartGreeting:    'Sir, please review your order.',
    cartEmpty:       'Sir, your cart is empty. Please go back to the menu and add items.',
    switching:       (label) => `Okay sir, showing ${label}.`,
    opening:         (label) => `Sir, currently showing ${label}. You may order items or switch category.`,
    whatOrder:       'What would you like to order?',
    recovery:        'Sir, I did not understand. You may choose starters, main course, drinks or dessert.',
    confidenceLow:   'Sorry sir, I did not understand.',
    categoryUnclear: 'Would you like starters, main course, drinks or dessert?',
    itemUnclear:     'Please tell item name again.',
  },
  hi: {
    anythingElse:    'कुछ और चाहिए सर?',
    didntCatch:      'मुझे समझ नहीं आया। कृपया स्टार्टर, मेन कोर्स, ड्रिंक्स, या डेज़र्ट चुनें।',
    added:           'कार्ट में जोड़ दिया।',
    sendingKitchen:  'आपका ऑर्डर किचन को भेज दिया गया।',
    orderPreparing:  'तैयार हो रहा है',
    categoryPrompt:  'सर, आज आप क्या लेना चाहेंगे? आप स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट चुन सकते हैं।',
    whichItem:       'कौन सा आइटम सर?',
    howMany:         'कितने सर?',
    emptCart:        'कार्ट खाली है।',
    noRepeat:        'कोई पिछला आइटम नहीं मिला।',
    notFound:        'वह आइटम नहीं मिला।',
    cartGreeting:    'सर, ये आपके चुने हुए आइटम हैं। कृपया जाँचें और ऑर्डर कन्फर्म करें।',
    cartEmpty:       'सर, कार्ट खाली है।',
    switching:       (label) => `ठीक है सर, ${label} दिखा रहे हैं।`,
    opening:         (label) => `सर, अभी ${label} दिखाया जा रहा है।`,
    whatOrder:       'आप क्या ऑर्डर करना चाहेंगे?',
    recovery:        'सर, समझ नहीं आया। कृपया स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट चुनें।',
    confidenceLow:   'माफ़ कीजिये सर, मुझे समझ नहीं आया।',
    categoryUnclear: 'क्या आप स्टार्टर, मेन कोर्स, ड्रिंक्स या डेज़र्ट लेना चाहेंगे?',
    itemUnclear:     'कृपया आइटम का नाम फिर से बताएं।',
  },
  mr: {
    anythingElse:    'काही अजून सर?',
    didntCatch:      'मला समजलं नाही. कृपया स्टार्टर, मेन कोर्स, ड्रिंक्स, किंवा डेझर्ट निवडा.',
    added:           'कार्टमध्ये जोडले.',
    sendingKitchen:  'आपला ऑर्डर किचनला पाठवला.',
    orderPreparing:  'तयार होत आहे',
    categoryPrompt:  'सर, आज आपण काय घेणार आहात? आपण स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट निवडू शकता.',
    whichItem:       'कोणता आयटम सर?',
    howMany:         'किती सर?',
    emptCart:        'कार्ट रिकामे आहे.',
    noRepeat:        'मागील आयटम सापडला नाही.',
    notFound:        'तो आयटम सापडला नाही.',
    cartGreeting:    'सर, हे आपले निवडलेले आयटम आहेत. कृपया तपासा आणि ऑर्डर कन्फर्म करा.',
    cartEmpty:       'सर, कार्ट रिकामे आहे.',
    switching:       (label) => `ठीक आहे सर, ${label} दाखवत आहे.`,
    opening:         (label) => `सर, सध्या ${label} दाखवत आहे.`,
    whatOrder:       'आपण काय ऑर्डर करणार आहात?',
    recovery:        'सर, समजलं नाही. कृपया स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट निवडा.',
    confidenceLow:   'माफ करा सर, मला समजले नाही.',
    categoryUnclear: 'तुम्हाला स्टार्टर, मेन कोर्स, ड्रिंक्स किंवा डेझर्ट हवे आहे का?',
    itemUnclear:     'कृपया आयटमचे नाव पुन्हा सांगा.',
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

  const menuItemsRef = useRef(menuItems || null)
  useEffect(() => { menuItemsRef.current = menuItems || null }, [menuItems])

  const lang = safeLang(state.language)
  const copy = useMemo(() => COPY[lang] || COPY.en, [lang])

  const [voiceStatus, setVoiceStatus] = useState('IDLE')

  const listeningRef             = useRef(false)
  const lastHandledTranscriptRef = useRef('')

  const stepRef        = useRef('IDLE') // MENU_ENTRY | CATEGORY_SELECTION | ITEM_SELECTION | WAITING_FOR_QTY | ANYTHING_ELSE | CART_CONFIRM | KITCHEN | PAYMENT
  const commandLockRef = useRef(false)
  const debounceRef    = useRef(null)

  const silenceTimer1Ref     = useRef(null)
  const silenceTimer2Ref     = useRef(null)
  const anythingElseTimerRef = useRef(null)

  const currentVoiceCategoryRef = useRef(null)
  const lastAddedItemRef        = useRef(null)

  // Clarification memory
  const pendingItemRef          = useRef(null)
  const pendingQtyRef           = useRef(null)

  const onSelectCategoryRef = useRef(null)

  function clearSilenceTimers() {
    if (silenceTimer1Ref.current)     { clearTimeout(silenceTimer1Ref.current);     silenceTimer1Ref.current     = null }
    if (silenceTimer2Ref.current)     { clearTimeout(silenceTimer2Ref.current);     silenceTimer2Ref.current     = null }
    if (anythingElseTimerRef.current) { clearTimeout(anythingElseTimerRef.current); anythingElseTimerRef.current = null }
  }

  function speakNow(text, l = lang) {
    stopSpeak()
    setVoiceStatus('SPEAKING')
    speak(text, l)
  }

  async function confirmOrderFromVoice() {
    if (!state.sessionId) return
    if (!state.cart.items.length) return
    const orderRes = await apiConfirmOrder({
      sessionId: state.sessionId,
      cartItems: state.cart.items,
    })
    setCart({ items: [] })
    nav(`/kitchen?orderId=${encodeURIComponent(orderRes.orderId)}`)
    return orderRes
  }

  function getItemsForCategory(catKey) {
    const all = menuItemsRef.current || []
    if (!catKey) return all
    const k = String(catKey).toLowerCase().trim()
    return all.filter((it) => {
      const cat = String(it?.category || '').toLowerCase().trim()
      if (!cat) return false
      if (cat === k) return true
      if (cat.includes(k) || k.includes(cat)) return true
      if ((k === 'mains' || k === 'main course' || k === 'main') && cat.includes('main')) return true
      if (k === 'starter'  && (cat.includes('starter') || cat.includes('start')))    return true
      if (k === 'drinks'   && (cat.includes('drink')   || cat.includes('beverage'))) return true
      if (k === 'dessert'  && (cat.includes('dessert')  || cat.includes('sweet')))   return true
      return false
    })
  }

  function applyCategory(catKey, switching = false) {
    currentVoiceCategoryRef.current = catKey
    stepRef.current = 'CATEGORY_SELECTION'
    clearSilenceTimers()

    if (typeof onSelectCategoryRef.current === 'function') {
      onSelectCategoryRef.current(catKey)
    }

    const label    = catLabel(catKey)
    const catItems = getItemsForCategory(catKey)
    const first5   = catItems.slice(0, 5)
    const names    = first5.map((it) => it.name).filter(Boolean).join(', ')

    let text = ""
    if (lang === 'hi') {
      text = `ठीक है सर, ${label} दिखा रहे हैं। ${names ? `सर, ये उपलब्ध आइटम हैं: ${names}. ` : ''}आप क्या ऑर्डर करना चाहेंगे?`
    } else if (lang === 'mr') {
      text = `ठीक आहे सर, ${label} दाखवत आहे. ${names ? `सर, हे उपलब्ध आयटम्स आहेत: ${names}. ` : ''}आपण काय ऑर्डर करणार आहात?`
    } else {
      text = `Okay sir, showing ${label}. ${names ? `Sir, these are available items: ${names}. ` : ''}What would you like to order?`
    }

    speakNow(text, lang)
  }

  function addItemAndSchedule(menuItem, qty) {
    addCartItemLocal({ ...menuItem, quantity: qty || 1, notes: '' })
    lastAddedItemRef.current = menuItem
    if (onCartUpdated) onCartUpdated()
    clearSilenceTimers()

    speakNow(copy.added + " " + copy.anythingElse, lang)
    stepRef.current = 'ANYTHING_ELSE'

    silenceTimer1Ref.current = setTimeout(() => {
      if (stepRef.current !== 'ANYTHING_ELSE') return
      speakNow(copy.anythingElse, lang)

      silenceTimer2Ref.current = setTimeout(() => {
        if (stepRef.current !== 'ANYTHING_ELSE') return
        speakNow(copy.anythingElse, lang)

        anythingElseTimerRef.current = setTimeout(() => {
          if (stepRef.current !== 'ANYTHING_ELSE') return
          nav('/cart')
        }, 5000)
      }, 5000)
    }, 5000)
  }

  function handleTranscript(rawTranscript) {
    if (isSpeaking()) {
      return
    }

    if (commandLockRef.current) return
    commandLockRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      commandLockRef.current = false
      setVoiceStatus(isListening() ? 'LISTENING' : 'IDLE')
    }, 450)

    if (!enabled) return
    if (!rawTranscript) return

    const norm = String(rawTranscript).trim().toLowerCase()
    if (!norm) return
    if (norm === lastHandledTranscriptRef.current) return
    lastHandledTranscriptRef.current = norm

    const lower = norm
    const step  = stepRef.current

    const parsed = parseVoice(rawTranscript, menuItemsRef.current || [])
    
    console.log('--- VOICE DEBUG ---')
    console.log('Original transcript:', rawTranscript)
    console.log('Normalized transcript:', norm)
    console.log('Detected category:', parsed.category || null)
    console.log('Detected item:', parsed.item || (parsed.menuItem ? parsed.menuItem.name : null))
    console.log('Match confidence:', parsed.confidence || 0)
    console.log('-------------------')

    // Category Switching / Recognition can happen at ANY time when we are on MENU page
    if (page === 'MENU') {
      const catKey = detectCategoryIntent(rawTranscript)
      if (catKey) {
        const isExplicitCategorySwitch = /\b(show|open|display|let me see|switch to|go to|actually|change to)\b/i.test(lower)
        const pureCategories = ['starter', 'starters', 'snacks', 'appetizer', 'main', 'main course', 'maincourse', 'meal', 'food', 'lunch', 'dinner', 'drink', 'drinks', 'beverage', 'cold drink', 'dessert', 'desserts', 'sweets']
        const isPure = pureCategories.some(c => lower.includes(c))

        if (isExplicitCategorySwitch || isPure) {
          const switching = currentVoiceCategoryRef.current !== null && currentVoiceCategoryRef.current !== catKey
          applyCategory(catKey, switching)
          return
        }
      }
    }

    // WAITING FOR QUANTITY state
    if (step === 'WAITING_FOR_QTY') {
      const parsedQty = isAmbiguousQuantity(rawTranscript) || isRepeatLastIntent(rawTranscript) ? null : parseInt(lower, 10)
      const qty = parsedQty || parseInt(lower.match(/\d+/)?.[0] || '1', 10)
      if (pendingItemRef.current) {
        addItemAndSchedule(pendingItemRef.current, qty)
        pendingItemRef.current = null
        return
      }
    }

    // WAITING FOR ITEM (ITEM_SELECTION) state when quantity was provided
    if (step === 'ITEM_SELECTION') {
      if (parsed.intent === 'ADD_ITEM' && parsed.menuItem) {
        addItemAndSchedule(parsed.menuItem, pendingQtyRef.current || 1)
        pendingQtyRef.current = null
        return
      }
    }

    // ANYTHING_ELSE loop responses
    if (step === 'ANYTHING_ELSE') {
      if (parsed.intent === 'YES') {
        clearSilenceTimers()
        stepRef.current = 'MENU_ENTRY'
        speakNow(copy.categoryPrompt, lang)
        return
      }
      if (parsed.intent === 'NO') {
        clearSilenceTimers()
        nav('/cart')
        return
      }
    }

    // CART page specific handling
    if (page === 'CART') {
      if (parsed.intent === 'CONFIRM_ORDER' || parsed.intent === 'YES') {
        if (!state.cart.items.length) {
          speakNow(copy.emptCart, lang)
          return
        }
        speakNow(copy.sendingKitchen, lang)
        confirmOrderFromVoice().catch(() => {})
        return
      }
      if (parsed.intent === 'REMOVE_ITEM') {
        nav('/menu')
        return
      }
    }

    // General parsing fallbacks
    const intent = parsed.intent

    if (intent === 'SWITCH_CATEGORY') {
      if (page === 'MENU') {
        const catKey = parsed.category
        const switching = currentVoiceCategoryRef.current !== null && currentVoiceCategoryRef.current !== catKey
        applyCategory(catKey, switching)
      }
      return
    }

    if (intent === 'AMBIGUOUS_QTY') {
      if (page === 'MENU') {
        pendingQtyRef.current = parsed.qty || 1
        stepRef.current = 'ITEM_SELECTION'
        speakNow(copy.whichItem, lang)
      }
      return
    }

    if (intent === 'ADD_ITEM_MISSING_QTY') {
      if (page === 'MENU') {
        pendingItemRef.current = parsed.menuItem
        stepRef.current = 'WAITING_FOR_QTY'
        speakNow(copy.howMany, lang)
      }
      return
    }

    if (intent === 'ADD_ITEM') {
      if (page === 'MENU') {
        if (!parsed.menuItem) {
          speakNow(copy.itemUnclear, lang)
          return
        }
        addItemAndSchedule(parsed.menuItem, parsed.qty || 1)
      }
      return
    }

    if (intent === 'REPEAT_LAST') {
      if (page === 'MENU') {
        const last = lastAddedItemRef.current
        if (!last?.menuItemId) {
          speakNow(copy.noRepeat, lang)
          return
        }
        addItemAndSchedule(last, parsed.qty || 1)
      }
      return
    }

    if (intent === 'TRACK_ORDER') {
      if (page === 'KITCHEN') {
        speakNow(copy.orderPreparing, lang)
      }
      return
    }

    if (intent === 'CATEGORY_UNCLEAR') {
      speakNow(copy.categoryUnclear, lang)
      return
    }

    if (intent === 'ITEM_UNCLEAR') {
      speakNow(copy.itemUnclear, lang)
      return
    }

    if (intent === 'BACK') {
      if (page === 'CART') {
        nav('/menu')
      } else if (page === 'MENU') {
        nav('/')
      }
      return
    }

    if (intent === 'SHOW_MENU') {
      if (page !== 'MENU') {
        nav('/menu')
      } else {
        speakNow(copy.categoryPrompt, lang)
      }
      return
    }

    if (intent === 'LOW_CONFIDENCE') {
      speakNow(copy.confidenceLow, lang)
      return
    }
  }

  const stopAll = () => {
    stopSpeak()
    stopListening()
    listeningRef.current = false
    clearSilenceTimers()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setVoiceStatus('IDLE')
  }

  useEffect(() => {
    if (!enabled) {
      stopAll()
      return
    }
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return
    if (listeningRef.current) return

    try {
      startListening({
        lang,
        silenceMs: 900,
        onSpeechStart: () => {
          if (isSpeaking()) {
            stopSpeak()
            setVoiceStatus('LISTENING')
          }
        },
        onResult: (res) => {
          const transcript = res?.transcript
          if (!transcript) return
          if (!res.isFinal) {
            setVoiceStatus('PROCESSING')
          } else {
            handleTranscript(transcript)
          }
        },
        onError: () => {},
      })
      listeningRef.current = true
      setVoiceStatus('LISTENING')
    } catch (e) {
      console.error(e)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lang])

  useEffect(() => {
    if (!enabled) return
    setSpeakStateListener((speakState) => {
      if (speakState === 'SPEAKING') {
        setVoiceStatus('SPEAKING')
      } else {
        setVoiceStatus(isListening() ? 'LISTENING' : 'IDLE')
      }
    })
    return () => setSpeakStateListener(null)
  }, [enabled])

  // Entry flow triggers
  useEffect(() => {
    if (!enabled) return
    if (page === 'MENU') {
      stepRef.current = 'MENU_ENTRY'
      speakNow(copy.categoryPrompt, lang)
    } else if (page === 'CART') {
      stepRef.current = 'CART_CONFIRM'
      speakNow(copy.cartGreeting, lang)
    } else if (page === 'KITCHEN') {
      stepRef.current = 'KITCHEN'
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page])

  useEffect(() => {
    return () => {
      stopAll()
      setSpeakStateListener(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    stop:                stopAll,
    listening:           enabled && isListening(),
    voiceStatus,
    setOnSelectCategory: (cb) => { onSelectCategoryRef.current = cb },
  }
}
