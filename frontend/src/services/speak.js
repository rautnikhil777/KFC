/**
 * speak.js — Pure Text-to-Speech service.
 *
 * Design contract:
 *  - No queue (hook sequences speech explicitly via speakThen pattern)
 *  - No voice-state management (hook owns all state)
 *  - speak(text, lang, onEnd) is the one public API
 *  - stopSpeak() cancels current utterance silently (no callback fires)
 *  - isSpeaking() reflects live TTS flag
 */

const LANG_MAP = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
}

let _speaking         = false
let _currentUtterance = null

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns true if TTS is currently active.
 */
export function isSpeaking() {
  return _speaking
}

/**
 * Cancel any current utterance immediately.
 * Does NOT fire the onEnd callback — caller handles state transitions.
 */
export function stopSpeak() {
  if (!window?.speechSynthesis) return
  window.speechSynthesis.cancel()
  _speaking         = false
  _currentUtterance = null
}

/**
 * Speak text, then call onEnd when done.
 * Cancels any currently playing utterance first (no queue — caller sequences).
 *
 * @param {string}   text   Text to speak
 * @param {string}   lang   'en' | 'hi' | 'mr'
 * @param {function} onEnd  Called when utterance finishes (success, error, or replaced)
 */
export function speak(text, lang, onEnd) {
  if (!window?.speechSynthesis) {
    if (typeof onEnd === 'function') onEnd()
    return
  }

  // Cancel previous utterance — its onend will NOT fire after .cancel()
  window.speechSynthesis.cancel()
  _speaking         = false
  _currentUtterance = null

  const clean = String(text || '').trim()
  if (!clean) {
    if (typeof onEnd === 'function') onEnd()
    return
  }

  const utterance  = new SpeechSynthesisUtterance(clean)
  utterance.lang   = LANG_MAP[lang] || LANG_MAP.en
  utterance.rate   = 1.0
  utterance.pitch  = 1.0

  // ── Voice selection ───────────────────────────────────────────────────────
  const voices = window.speechSynthesis.getVoices() || []
  if (voices.length > 0) {
    const target  = utterance.lang.toLowerCase()
    const exact   = voices.find(v => (v.lang || '').toLowerCase() === target)
    if (exact) {
      utterance.voice = exact
    } else {
      const prefix  = target.split('-')[0]
      const partial = voices.find(v => (v.lang || '').toLowerCase().startsWith(prefix))
      if (partial) utterance.voice = partial
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  utterance.onstart = () => {
    _speaking         = true
    _currentUtterance = utterance
  }

  const endHandler = () => {
    // Only update state if this utterance is still the active one
    if (_currentUtterance === utterance) {
      _speaking         = false
      _currentUtterance = null
    }
    if (typeof onEnd === 'function') onEnd()
  }

  utterance.onend   = endHandler
  utterance.onerror = endHandler

  window.speechSynthesis.speak(utterance)
}
