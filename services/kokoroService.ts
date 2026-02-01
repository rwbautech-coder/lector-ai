import { KokoroTTS } from "kokoro-js";

// Singleton instance
let tts: KokoroTTS | null = null;
let modelLoading: Promise<KokoroTTS> | null = null;

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export const initKokoro = async (): Promise<KokoroTTS> => {
  if (tts) return tts;
  if (modelLoading) return modelLoading;

  console.log("[KokoroService] Initializing model...");
  
  modelLoading = KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",      // Quantized for browser performance (smaller download)
    device: "wasm",   // WebAssembly (safest for broad compatibility)
  }).then(instance => {
    tts = instance;
    console.log("[KokoroService] Model loaded successfully.");
    return instance;
  }).catch(err => {
    console.error("[KokoroService] Failed to load model:", err);
    modelLoading = null;
    throw err;
  });

  return modelLoading;
};

// Map typical application voice names to Kokoro voice IDs
// Kokoro voices: af_heart, af_bella, af_nicole, af_sarah, af_sky, am_adam, am_michael, bf_emma, bf_isabella, bm_george, bm_lewis
export const getKokoroVoiceId = (voiceName: string): string => {
  const mapping: Record<string, string> = {
    'Kore': 'af_heart',      // American Female - Soft/Heart
    'Fenrir': 'am_adam',     // American Male - Deep
    'Puck': 'am_michael',    // American Male - Balanced
    'Charon': 'bm_george',   // British Male
    'Zephyr': 'af_bella',    // American Female - Bella
  };
  return mapping[voiceName] || 'af_heart';
};

export const generateSpeechKokoro = async (text: string, voiceName: string): Promise<Blob> => {
  const instance = await initKokoro();
  const voiceId = getKokoroVoiceId(voiceName);
  
  console.log(`[KokoroService] Generating audio for: "${text.substring(0, 20)}..." with voice ${voiceId}`);

  // Generate returns an object containing audio data
  // Casting voiceId to any to bypass strict typing of Voice enum in kokoro-js
  const audio = await instance.generate(text, { voice: voiceId as any });
  
  // audio.save() is for Node.js. For browser, we likely get an audio buffer or raw data.
  // Inspection of kokoro-js (based on transformers.js) suggests it might return an AudioBuffer-like object 
  // or we need to extract the raw data.
  // Assuming standard RawAudio output from generate(): { audio: Float32Array, sampling_rate: number }
  
  // Let's create a WAV blob from the raw data.
  return audio.toBlob();
};
