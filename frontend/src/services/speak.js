const LANG_MAP = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
}

let currentUtterance = null
let speaking = false
let queue = []

function getBestVoice(targetLang) {
  if (!window.speechSynthesis || !window.speechSynthesis.getVoices) return null

  const voices = window.speechSynthesis.getVoices() || []
  if (!voices.length) return null

  const wanted = (targetLang || '').toLowerCase()
  const byLang = voices.find((v) => (v.lang || '').toLowerCase() === wanted)
  if (byLang) return byLang

  // Fallback: match prefix (e.g., hi -> hi-IN)
  const prefix = wanted.split('-')[0]
  return voices.find((v) => (v.lang || '').toLowerCase().startsWith(prefix)) || null
}

export function stopSpeak() {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  currentUtterance = null
  speaking = false
  queue = []
}

function speakOne(text, lang) {
  if (!window.speechSynthesis) return false

  const utterance = new SpeechSynthesisUtterance(text)
  const targetLang = LANG_MAP[lang] || LANG_MAP.en

  utterance.lang = targetLang
  const voice = getBestVoice(targetLang)
  if (voice) utterance.voice = voice

  utterance.onstart = () => {
    speaking = true
    currentUtterance = utterance
  }

  utterance.onend = () => {
    speaking = false
    currentUtterance = null
    // dequeue next
    const next = queue.shift()
    if (next) speakOne(next.text, next.lang)
  }

  utterance.onerror = () => {
    speaking = false
    currentUtterance = null
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

