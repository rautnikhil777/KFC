let recognition = null
let listening = false
let stoppedManually = false
let onResultCb = null
let onErrorCb = null

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function normalizeResult(eventResult) {
  // SpeechRecognitionResultList
  // We want the best final transcript and confidence if available.
  try {
    const results = eventResult || []
    // Prefer first result that is final
    let bestTranscript = ''
    let bestConfidence = 0

    for (let i = 0; i < results.length; i++) {
      const res = results[i]
      const alt = res?.[0]
      const text = alt?.transcript
      const conf = typeof alt?.confidence === 'number' ? alt.confidence : 0

      if (res?.isFinal && text) {
        return { transcript: text.trim(), confidence: conf }
      }
      if (text && text.trim().length > bestTranscript.length) {
        bestTranscript = text
        bestConfidence = conf
      }
    }

    return { transcript: bestTranscript.trim(), confidence: bestConfidence || 0 }
  } catch {
    return { transcript: '', confidence: 0 }
  }
}

function createRecognition() {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null

  const r = new Ctor()
  r.continuous = true
  r.interimResults = true
  r.lang = 'en-US'

  r.onresult = (event) => {
    const payload = normalizeResult(event.results)
    if (!payload.transcript) return

    if (onResultCb) {
      onResultCb({ transcript: payload.transcript, confidence: payload.confidence })
    }
  }

  r.onerror = (e) => {
    if (onErrorCb) onErrorCb(e)
  }

  r.onend = () => {
    listening = false
    if (!stoppedManually) {
      // Auto-restart continuous listening
      // Delay a bit to avoid rapid restart loops.
      setTimeout(() => {
        if (onResultCb) {
          // resume with last config by reusing recognition instance
          startListening({ lang: recognition?.lang, onResult: onResultCb, onError: onErrorCb, autoRestart: true })
        }
      }, 250)
    }
  }

  return r
}

export function startListening({ lang, onResult, onError } = {}) {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    throw new Error('SpeechRecognition is not supported in this browser.')
  }

  if (!recognition) recognition = createRecognition()
  if (!recognition) throw new Error('Failed to initialize SpeechRecognition')

  onResultCb = typeof onResult === 'function' ? onResult : null
  onErrorCb = typeof onError === 'function' ? onError : null

  stoppedManually = false
  recognition.lang = lang || recognition.lang || 'en-US'

  try {
    listening = true
    recognition.start()
  } catch (e) {
    // Some browsers throw if start called twice; treat as non-fatal.
    listening = true
  }

  return {
    stop: stopListening,
  }
}

export function stopListening() {
  stoppedManually = true
  listening = false
  try {
    recognition?.stop()
  } catch {
    // ignore
  }
}

export function isListening() {
  return listening
}

