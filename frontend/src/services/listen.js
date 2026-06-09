let recognition = null
let listening = false
let stoppedManually = false
let onResultCb = null
let onErrorCb = null
let onSpeechStartCb = null

let silenceTimer = null
let silenceMs = 900
let lastProcessedIndex = 0
let speechStarted = false

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

function getActiveTranscript(results, startIndex) {
  let transcript = ''
  let hasFinal = false
  let bestConfidence = 0

  for (let i = startIndex; i < results.length; i++) {
    const res = results[i]
    if (res && res[0]) {
      transcript += res[0].transcript + ' '
      if (res.isFinal) {
        hasFinal = true
      }
      const conf = typeof res[0].confidence === 'number' ? res[0].confidence : 0
      if (conf > bestConfidence) {
        bestConfidence = conf
      }
    }
  }
  return { transcript: transcript.trim(), hasFinal, confidence: bestConfidence }
}

function createRecognition() {
  const Ctor = getRecognitionCtor()
  if (!Ctor) return null

  const r = new Ctor()
  r.continuous = true
  r.interimResults = true
  r.lang = 'en-US'

  r.onspeechstart = () => {
    if (onSpeechStartCb && !speechStarted) {
      speechStarted = true
      onSpeechStartCb()
    }
  }

  r.onresult = (event) => {
    if (onSpeechStartCb && !speechStarted) {
      speechStarted = true
      onSpeechStartCb()
    }

    const { transcript, hasFinal, confidence } = getActiveTranscript(event.results, lastProcessedIndex)
    if (!transcript) return

    if (onResultCb) {
      onResultCb({ transcript, confidence, isFinal: false })
    }

    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      if (onResultCb && transcript) {
        onResultCb({ transcript, confidence, isFinal: true })
      }
      lastProcessedIndex = event.results.length
      speechStarted = false
      if (silenceTimer) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }
    }, silenceMs)

    if (hasFinal) {
      if (silenceTimer) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }
      if (onResultCb && transcript) {
        onResultCb({ transcript, confidence, isFinal: true })
      }
      lastProcessedIndex = event.results.length
      speechStarted = false
    }
  }

  r.onerror = (e) => {
    if (onErrorCb) onErrorCb(e)
  }

  r.onend = () => {
    listening = false
    speechStarted = false
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
    if (!stoppedManually) {
      // Auto-restart continuous listening
      setTimeout(() => {
        if (onResultCb) {
          try {
            startListening({ lang: recognition?.lang, silenceMs, onSpeechStart: onSpeechStartCb, onResult: onResultCb, onError: onErrorCb })
          } catch (e) {
            console.error('Failed to restart listening:', e)
          }
        }
      }, 250)
    }
  }

  return r
}

export function startListening({ lang, silenceMs: customSilenceMs, onSpeechStart, onResult, onError } = {}) {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    throw new Error('SpeechRecognition is not supported in this browser.')
  }

  onResultCb = typeof onResult === 'function' ? onResult : null
  onErrorCb = typeof onError === 'function' ? onError : null
  onSpeechStartCb = typeof onSpeechStart === 'function' ? onSpeechStart : null

  if (customSilenceMs) {
    silenceMs = customSilenceMs
  }

  stoppedManually = false

  if (!recognition) recognition = createRecognition()
  if (!recognition) throw new Error('Failed to initialize SpeechRecognition')

  recognition.lang = lang || recognition.lang || 'en-US'
  lastProcessedIndex = 0
  speechStarted = false

  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }

  try {
    listening = true
    recognition.start()
  } catch (e) {
    // Treat start called twice as non-fatal
    listening = true
  }

  return {
    stop: stopListening,
  }
}

export function stopListening() {
  stoppedManually = true
  listening = false
  speechStarted = false
  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
  try {
    recognition?.stop()
  } catch (e) {
    // ignore
  }
}

export function isListening() {
  return listening
}
