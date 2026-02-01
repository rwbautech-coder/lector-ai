import { createWavBlob } from "../utils/audioUtils";
import { getTypeToSpeech } from '@diffusionstudio/piper-wasm';

// Voice configuration
const VOICES = {
  pl: {
    id: 'pl_PL-gosia-medium',
    name: 'Gosia (PL)',
    modelUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx',
    configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/gosia/medium/pl_PL-gosia-medium.onnx.json'
  },
  en: {
    id: 'en_US-lessac-medium',
    name: 'Lessac (EN)',
    modelUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json'
  }
};

let tts: any = null;
let currentVoiceId: string | null = null;

export const initPiper = async () => {
  if (tts) return tts;
  
  console.log("[PiperService] Initializing WASM...");
  try {
      tts = await getTypeToSpeech({
          wasmPath: '/piper.wasm', // Explicitly provide path to WASM
          logger: (msg: any) => console.log(`[PiperWASM]`, msg)
      });
  } catch (e) {
      console.error("Piper init failed", e);
      throw e;
  }
  return tts;
};

export const generateSpeechPiper = async (text: string, lang: 'pl' | 'en'): Promise<Blob> => {
    const engine = await initPiper();
    
    const voiceConfig = VOICES[lang];
    
    if (currentVoiceId !== voiceConfig.id) {
        console.log(`[PiperService] Loading voice: ${voiceConfig.id}...`);
        
        try {
            const [onnxRes, jsonRes] = await Promise.all([
                fetch(voiceConfig.modelUrl),
                fetch(voiceConfig.configUrl)
            ]);

            if (!onnxRes.ok || !jsonRes.ok) throw new Error("Failed to download voice models");

            const onnxBlob = await onnxRes.blob();
            const jsonBlob = await jsonRes.blob();

            await engine.install({ 
                file: `${voiceConfig.id}.onnx`, 
                blob: onnxBlob 
            }, {
                file: `${voiceConfig.id}.onnx.json`,
                blob: jsonBlob 
            });
            
            currentVoiceId = voiceConfig.id;
        } catch (err) {
            console.error("[PiperService] Voice load failed", err);
            throw err;
        }
    }

    console.log(`[PiperService] Synthesizing...`);
    const result = await engine.speak({
        text: text,
        voice: voiceConfig.id,
        output: { type: 'wav' }
    });
    
    return result.blob as Blob;
};