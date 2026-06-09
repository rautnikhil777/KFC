const LANG_MAP = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
}

let currentUtterance = null
let speaking = false
let queue = []
let speakStateListener = null

export let voiceState = 'idle' // 'idle' | 'listening' | 'speaking' | 'processing'

// Registry for listen callbacks to avoid circular dependencies
let listenCallbacks = {
  isListening: () => false,
  stopListening: () => {},
}

export function setListenCallbacks({ isListening, stopListening }) {
  if (typeof isListening === 'function') listenCallbacks.isListening = isListening
  if (typeof stopListening === 'function') listenCallbacks.stopListening = stopListening
}

export function setVoiceState(state) {
  const allowed = ['idle', 'listening', 'speaking', 'processing']
  if (allowed.includes(state)) {
    voiceState = state
    notifyState(state.toUpperCase())

    // Mutex rule: if state transitioned to idle, process any queued speech
    if (state === 'idle') {
      const next = queue.shift()
      if (next) {
        // Stop listening before speaking
        listenCallbacks.stopListening()
        speakOne(next.text, next.lang)
      }
    }
  }
}

export function getVoiceState() {
  return voiceState
}

export function setSpeakStateListener(cb) {
  speakStateListener = cb
}

export function isSpeaking() {
  return speaking
}

function notifyState(state) {
  if (speakStateListener) {
    try {
      speakStateListener(state)
    } catch (e) {
      console.error('Error in speakStateListener:', e)
    }
  }
}

export function stopSpeak() {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  currentUtterance = null
  speaking = false
  queue = []
  setVoiceState('idle')
}

function speakOne(text, lang) {
  if (!window.speechSynthesis) return false

  const utterance = new SpeechSynthesisUtterance(text)
  const targetLang = LANG_MAP[lang] || LANG_MAP.en

  utterance.lang = targetLang
  const voices = window.speechSynthesis.getVoices() || []
  if (voices.length > 0) {
    const wanted = targetLang.toLowerCase()
    const byLang = voices.find((v) => (v.lang || '').toLowerCase() === wanted)
    if (byLang) {
      utterance.voice = byLang
    } else {
      const prefix = wanted.split('-')[0]
      const fallback = voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix))
      if (fallback) utterance.voice = fallback
    }
  }

  utterance.onstart = () => {
    speaking = true
    currentUtterance = utterance
    setVoiceState('speaking')
  }

  utterance.onend = () => {
    speaking = false
    currentUtterance = null
    setVoiceState('idle')
  }

  utterance.onerror = () => {
    speaking = false
    currentUtterance = null
    setVoiceState('idle')
  }

  window.speechSynthesis.speak(utterance)
  return true
}

export function queueSpeech(text, lang) {
  const clean = String(text || '').trim()
  if (!clean) return

  if (!window.speechSynthesis) return

  // Mutex rule: If currently speaking or listening is active, queue it
  if (speaking || listenCallbacks.isListening()) {
    queue.push({ text: clean, lang })
    return
  }

  queue = []
  // Mutex rule: If speaking = true -> listening MUST stop
  listenCallbacks.stopListening()
  speakOne(clean, lang)
}

export function speak(text, lang) {
  // Ensure listening stops immediately before starting new speech
  listenCallbacks.stopListening()
  stopSpeak()
  queueSpeech(text, lang)
}
