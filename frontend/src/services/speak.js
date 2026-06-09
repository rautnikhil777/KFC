const LANG_MAP = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
}

let currentUtterance = null
let speaking = false
let queue = []
let speakStateListener = null

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
  notifyState('IDLE')
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
    notifyState('SPEAKING')
  }

  utterance.onend = () => {
    speaking = false
    currentUtterance = null
    notifyState('IDLE')
    // dequeue next
    const next = queue.shift()
    if (next) speakOne(next.text, next.lang)
  }

  utterance.onerror = () => {
    speaking = false
    currentUtterance = null
    notifyState('IDLE')
    const next = queue.shift()
    if (next) speakOne(next.text, next.lang)
  }

  window.speechSynthesis.speak(utterance)
  return true
}

export function queueSpeech(text, lang) {
  const clean = String(text || '').trim()
  if (!clean) return

  if (!window.speechSynthesis) return

  // If currently speaking, append to queue
  if (speaking) {
    queue.push({ text: clean, lang })
    return
  }

  // If not speaking, speak immediately
  queue = []
  speakOne(clean, lang)
}

export function speak(text, lang) {
  stopSpeak()
  queueSpeech(text, lang)
}
