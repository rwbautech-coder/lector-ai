/// <reference types="vite/client" />
// import { PiperVoice } from '@diffusionstudio/piper-wasm'; // Niepotrzebne, bo nie używamy PiperVoice bezpośr.

declare module '*?url' {
  const content: string;
  export default content;
}

declare module '@diffusionstudio/piper-wasm' {
  export function getTypeToSpeech(options?: { wasmPath?: string; logger?: (msg: any) => void }): Promise<any>;
  // Dodaj inne eksporty, jeśli będą potrzebne, np. klasy PiperVoice, SpeakResult
}
