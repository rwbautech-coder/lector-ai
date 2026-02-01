/// <reference types="vite/client" />
import { PiperVoice } from '@diffusionstudio/piper-wasm';

declare module '*?url' {
  const content: string;
  export default content;
}

declare module '@diffusionstudio/piper-wasm';
