/// <reference types="vite/client" />

declare module '*?url' {
  const content: string;
  export default content;
}

declare module '@diffusionstudio/piper-wasm';
