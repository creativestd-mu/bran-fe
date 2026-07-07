/// <reference types="vite/client" />

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult
  length: number
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  length: number
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition
  webkitSpeechRecognition?: new () => SpeechRecognition
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}
