/**
 * listen.js — Pure SpeechRecognition service.
 *
 * Design contract:
 *  - ONE singleton SpeechRecognition instance (never recreated, only started/stopped)
 *  - NO auto-restart on 'onend'. The hook (useVoiceOrdering) owns restart scheduling.
 *  - All callbacks are supplied per startListening() call.
 *  - Barge-in: onBargeIn fires the instant user speech begins (onspeechstart).
 *  - Double-fire prevention: if native isFinal fires, silence-timer is cancelled.
 *  - 'no-speech' and 'aborted' errors are silently swallowed (normal on mobile).
 */

let recognition = null
let isActive = false        // true between .start() and onend
let stoppedManually = false

// Per-session callbacks — replaced on each startListening() call
let onResultCb  = null
let onErrorCb   = null
let onEndCb     = null   // called with { manual: bool } — hook decides whether to restart
let onBargeInCb = null   // called the instant user speech is detected

// Dedup / silence state
let silenceTimer = null
let lastIndex    = 0
let lastFinalTranscript = ''

// ─── Platform detection (computed once at module load) ──────────────────────
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
)
const SILENCE_MS = IS_MOBILE ? 1500 : 1000

// ─── Helpers ────────────────────────────────────────────────────────────────

function getCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function clearSilenceTimer() {
  if (silenceTimer !== null) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
}

// ─── Instance factory ───────────────────────────────────────────────────────

function buildInstance(lang) {
  const Ctor = getCtor()
  if (!Ctor) return null

  const r = new Ctor()
  r.continuous      = true
  r.interimResults  = true
  r.lang            = lang || 'en-US'
  r.maxAlternatives = 1

  // ── Barge-in: fires the moment user voice is detected ────────────────────
  r.onspeechstart = () => {
    if (onBargeInCb) onBargeInCb()
  }

  // ── Results ──────────────────────────────────────────────────────────────
  r.onresult = (event) => {
    if (!onResultCb) return

    let transcript = ''
    let hasFinal   = false

    for (let i = lastIndex; i < event.results.length; i++) {
      const res = event.results[i]
      if (res?.[0]) {
        transcript += res[0].transcript
        if (res.isFinal) hasFinal = true
      }
    }

    transcript = transcript.trim()
    if (!transcript) return

    // Always fire interim so the UI can show "processing..." feedback
    onResultCb({ transcript, isFinal: false })

    if (hasFinal) {
      // Native final result: fire immediately, cancel any pending silence timer
      clearSilenceTimer()
      lastIndex = event.results.length
      if (transcript !== lastFinalTranscript) {
        lastFinalTranscript = transcript
        onResultCb({ transcript, isFinal: true })
      }
      return
    }

    // No native final yet: (re)set silence timer
    clearSilenceTimer()
    const capturedTranscript = transcript
    const capturedIndex      = event.results.length
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      lastIndex    = capturedIndex
      if (capturedTranscript !== lastFinalTranscript) {
        lastFinalTranscript = capturedTranscript
        onResultCb({ transcript: capturedTranscript, isFinal: true })
      }
    }, SILENCE_MS)
  }

  // ── Errors ───────────────────────────────────────────────────────────────
  r.onerror = (e) => {
    // 'no-speech' and 'aborted' are normal on mobile — swallow silently
    if (e.error === 'no-speech' || e.error === 'aborted') return
    if (onErrorCb) onErrorCb(e)
  }

  // ── End ───────────────────────────────────────────────────────────────────
  // NOTE: We do NOT auto-restart here. The hook decides all restart logic.
  r.onend = () => {
    const wasManual = stoppedManually
    isActive        = false
    stoppedManually = false
    clearSilenceTimer()
    if (onEndCb) onEndCb({ manual: wasManual })
  }

  return r
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Start listening.
 *
 * @param {object}   opts
 * @param {string}   opts.lang       BCP-47 tag e.g. 'en-US', 'hi-IN'
 * @param {function} opts.onResult   Called with { transcript, isFinal }
 * @param {function} opts.onError    Called on non-trivial recognition errors
 * @param {function} opts.onEnd      Called when recognition ends — { manual: bool }
 * @param {function} opts.onBargeIn  Called the instant user speech starts (for TTS interrupt)
 */
export function startListening({
  lang      = 'en-US',
  onResult,
  onError,
  onEnd,
  onBargeIn,
} = {}) {
  if (!getCtor()) throw new Error('SpeechRecognition is not supported in this browser.')
  if (isActive) return // Already running — guard against double-start

  onResultCb  = typeof onResult  === 'function' ? onResult  : null
  onErrorCb   = typeof onError   === 'function' ? onError   : null
  onEndCb     = typeof onEnd     === 'function' ? onEnd     : null
  onBargeInCb = typeof onBargeIn === 'function' ? onBargeIn : null

  stoppedManually     = false
  lastIndex           = 0
  lastFinalTranscript = ''
  clearSilenceTimer()

  if (!recognition) {
    recognition = buildInstance(lang)
  } else {
    // Reuse existing instance — just update lang
    recognition.lang = lang
  }

  if (!recognition) throw new Error('Failed to initialize SpeechRecognition.')

  try {
    isActive = true
    recognition.start()
  } catch (e) {
    if (e.name === 'InvalidStateError') {
      // Already started — treat as active (happens on mobile occasionally)
      isActive = true
    } else {
      isActive = false
      throw e
    }
  }
}

/**
 * Stop listening (manual stop — onEnd will fire with manual: true).
 */
export function stopListening() {
  stoppedManually = true
  clearSilenceTimer()
  isActive = false
  try { recognition?.stop() } catch (_) {}
}

/**
 * Returns true if recognition is currently active.
 */
export function isListening() {
  return isActive
}

/**
 * Full teardown — destroys the singleton instance.
 * Call on component unmount so the next mount starts fresh.
 */
export function destroyListener() {
  stoppedManually = true
  isActive        = false
  clearSilenceTimer()
  if (recognition) {
    try { recognition.stop() } catch (_) {}
    recognition.onspeechstart = null
    recognition.onresult      = null
    recognition.onerror       = null
    recognition.onend         = null
    recognition = null
  }
  onResultCb = onErrorCb = onEndCb = onBargeInCb = null
  lastFinalTranscript = ''
  lastIndex = 0
}
