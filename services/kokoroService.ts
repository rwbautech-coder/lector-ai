import { KokoroTTS } from "kokoro-js";
import { createWavBlob } from "../utils/audioUtils";
import { env } from "onnxruntime-web";

// Configure ONNX Runtime for compatibility (GitHub Pages lacks COOP/COEP headers for threads)
env.wasm.numThreads = 1; // Force single-threaded execution
env.wasm.proxy = false;  // Disable proxy worker to avoid cross-origin issues on iOS

// Set wasm paths explicitly to ensure they are found
// By default ORT looks in the same directory as the JS file, but in Vite this can be tricky.
// Using CDN as a fallback if they are not in public/assets
const ORT_WASM_VERSION = "1.23.2"; // Matching package.json
env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_WASM_VERSION}/dist/`;

// Singleton instance
let tts: KokoroTTS | null = null;
let modelLoading: Promise<KokoroTTS> | null = null;

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export const initKokoro = async (): Promise<KokoroTTS> => {
  if (tts) return tts;
  if (modelLoading) return modelLoading;

  console.log("[KokoroService] Initializing model...");
  
  modelLoading = KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q4",      // 4-bit quantization (~40MB) to save memory on mobile
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
  
  console.log(`[KokoroService] Generating audio for: "${text.substring(0, 30)}..." with voice ${voiceId}`);

  try {
    // Generate returns an object containing audio data
    // Casting voiceId to any to bypass strict typing of Voice enum in kokoro-js
    const result = await instance.generate(text, { voice: voiceId as any });
    
    if (!result || !result.audio) {
        throw new Error("Kokoro generation failed: No audio data returned");
    }
    
    if (result.audio.length === 0) {
        throw new Error("Kokoro generation failed: Audio data is empty");
    }

    // Check sample range for debugging
    let max = 0;
    let sum = 0;
    for (let i = 0; i < Math.min(5000, result.audio.length); i++) {
        const abs = Math.abs(result.audio[i]);
        if (abs > max) max = abs;
        sum += abs;
    }
    
    console.log("[KokoroService] Generation result:", {
      audioLength: result.audio.length,
      samplingRate: result.sampling_rate,
      maxSampleAmplitude: max,
      avgSampleAmplitude: sum / Math.min(5000, result.audio.length)
    });

    if (max === 0) {
        console.warn("[KokoroService] Generated audio is silent (all zeros)!");
    }
    
    // Create WAV blob from Float32Array
    // Sampling rate defaults to 24000 for Kokoro
    const sampleRate = result.sampling_rate || 24000;
    const blob = createWavBlob(result.audio, sampleRate);
    
    console.log(`[KokoroService] Created WAV blob: ${blob.size} bytes, type: ${blob.type}`);
    return blob;
  } catch (err) {
    console.error("[KokoroService] Error during generation:", err);
    throw err;
  }
};
