const recognitionRef = { current: null }
const isListeningRef = { current: false }
const isRestartingRef = { current: false }
let pendingStartConfig = null

let listening = false
let stoppedManually = false
let onResultCb = null
let onErrorCb = null
let onSpeechStartCb = null

let silenceTimer = null
let silenceMs = 900
let lastProcessedIndex = 0
let speechStarted = false

// Registry for speak callbacks to avoid circular dependencies
let speakCallbacks = {
  isSpeaking: () => false,
  stopSpeak: () => {},
  setVoiceState: () => {},
}

export function setSpeakCallbacks({ isSpeaking, stopSpeak, setVoiceState }) {
  if (typeof isSpeaking === 'function') speakCallbacks.isSpeaking = isSpeaking
  if (typeof stopSpeak === 'function') speakCallbacks.stopSpeak = stopSpeak
  if (typeof setVoiceState === 'function') speakCallbacks.setVoiceState = setVoiceState
}

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
    // Barge-in: if currently speaking, stop it immediately
    if (speakCallbacks.isSpeaking()) {
      speakCallbacks.stopSpeak()
      speakCallbacks.setVoiceState('listening')
    }
    if (onSpeechStartCb && !speechStarted) {
      speechStarted = true
      onSpeechStartCb()
    }
  }

  r.onresult = (event) => {
    // Barge-in check: user started speaking
    if (speakCallbacks.isSpeaking()) {
      speakCallbacks.stopSpeak()
      speakCallbacks.setVoiceState('listening')
    }

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
    isListeningRef.current = false
    listening = false
    speechStarted = false
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }

    // Process pending start request if queued
    if (pendingStartConfig) {
      const config = pendingStartConfig
      pendingStartConfig = null
      try {
        startListening(config)
      } catch (e) {
        console.error('Failed to start pending listening:', e)
      }
      return
    }

    if (stoppedManually) {
      isRestartingRef.current = false
      return
    }

    if (isRestartingRef.current) {
      return
    }

    // Do not restart if TTS is active
    if (speakCallbacks.isSpeaking()) {
      return
    }

    const isMobile = /Android|iPhone|iPad/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
    const restartDelay = isMobile ? 1800 : 1200

    isRestartingRef.current = true

    setTimeout(() => {
      isRestartingRef.current = false
      if (stoppedManually || pendingStartConfig) return
      if (speakCallbacks.isSpeaking()) return
      if (isListeningRef.current) return

      try {
        startListening({
          lang: recognitionRef.current?.lang || 'en-US',
          silenceMs,
          onSpeechStart: onSpeechStartCb,
          onResult: onResultCb,
          onError: onErrorCb
        })
      } catch (e) {
        console.error('Failed to restart listening:', e)
      }
    }, restartDelay)
  }

  return r
}

export function startListening({ lang, silenceMs: customSilenceMs, onSpeechStart, onResult, onError } = {}) {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    throw new Error('SpeechRecognition is not supported in this browser.')
  }

  // Queue if already running or restarting to ensure singleton execution
  if (isListeningRef.current || isRestartingRef.current) {
    pendingStartConfig = { lang, silenceMs: customSilenceMs, onSpeechStart, onResult, onError }
    stopListening()
    return {
      stop: stopListening,
    }
  }

  onResultCb = typeof onResult === 'function' ? onResult : null
  onErrorCb = typeof onError === 'function' ? onError : null
  onSpeechStartCb = typeof onSpeechStart === 'function' ? onSpeechStart : null

  const isMobile = /Android|iPhone|iPad/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (customSilenceMs) {
    silenceMs = customSilenceMs
  } else {
    silenceMs = isMobile ? 1200 : 900
  }

  stoppedManually = false

  if (!recognitionRef.current) {
    recognitionRef.current = createRecognition()
  }
  if (!recognitionRef.current) throw new Error('Failed to initialize SpeechRecognition')

  recognitionRef.current.lang = lang || recognitionRef.current.lang || 'en-US'
  lastProcessedIndex = 0
  speechStarted = false

  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }

  try {
    isListeningRef.current = true
    listening = true
    recognitionRef.current.start()
    speakCallbacks.setVoiceState('listening')
  } catch (e) {
    // Treat start called twice as non-fatal
    isListeningRef.current = true
    listening = true
  }

  return {
    stop: stopListening,
  }
}

export function stopListening() {
  stoppedManually = true
  pendingStartConfig = null
  isListeningRef.current = false
  listening = false
  speechStarted = false
  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
  try {
    recognitionRef.current?.stop()
  } catch (e) {
    // ignore
  }
  speakCallbacks.setVoiceState('idle')
}

export function isListening() {
  return isListeningRef.current || listening
}

export function cleanupListener() {
  stoppedManually = true
  pendingStartConfig = null
  isListeningRef.current = false
  listening = false
  speechStarted = false
  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
  if (recognitionRef.current) {
    try {
      recognitionRef.current.stop()
    } catch (e) {
      // ignore
    }
    recognitionRef.current.onspeechstart = null
    recognitionRef.current.onresult = null
    recognitionRef.current.onerror = null
    recognitionRef.current.onend = null
    recognitionRef.current = null
  }
  speakCallbacks.setVoiceState('idle')
}
