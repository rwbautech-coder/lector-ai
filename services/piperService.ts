import * as piper from '@diffusionstudio/piper-wasm';

const VOICES = {
  pl: {
    id: 'pl_PL-gosia-medium',
    base: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/gosia/medium/pl_PL-gosia-medium'
  },
  en: {
    id: 'en_US-lessac-medium',
    base: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium'
  }
};

let tts: any = null;
let currentLanguage: 'pl' | 'en' | null = null;

export const initPiper = async () => {
  if (tts) return tts;
  
  console.log("[PiperService] Initializing WASM...");
  
  try {
      tts = await piper.getTypeToSpeech({
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
    
    // Load voice if needed
    if (currentLanguage !== lang) {
        console.log(`[PiperService] Loading ${lang} voice...`);
        const voiceConfig = VOICES[lang];
        
        // Fetch model files manually as Blobs to bypass filesystem restrictions
        // We use a CORS proxy or direct HF link if allowed. HF usually allows CORS.
        try {
            const [onnxRes, jsonRes] = await Promise.all([
                fetch(voiceConfig.base + '.onnx'),
                fetch(voiceConfig.base + '.onnx.json')
            ]);

            if (!onnxRes.ok || !jsonRes.ok) throw new Error("Failed to download voice models");

            const onnxBlob = await onnxRes.blob();
            const jsonBlob = await jsonRes.blob();

            // Install voice into the WASM virtual filesystem
            await engine.install({ 
                file: voiceConfig.id + '.onnx', 
                blob: onnxBlob 
            }, {
                file: voiceConfig.id + '.onnx.json',
                blob: jsonBlob 
            });
            
            currentLanguage = lang;
        } catch (err) {
            console.error("[PiperService] Voice load failed", err);
            throw err;
        }
    }

    const voiceId = VOICES[lang].id;
    
    console.log(`[PiperService] Synthesizing...`);
    const result = await engine.speak({
        text: text,
        voice: voiceId,
    });
    
    // The library returns an object with a 'blob' property containing the WAV audio
    return result.blob;
};
