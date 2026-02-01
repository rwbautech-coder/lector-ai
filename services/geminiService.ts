import { GoogleGenAI, Modality } from "@google/genai";

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

export const generateSpeechFromText = async (
  text: string,
  voiceName: string = 'Kore'
): Promise<string> => {
  console.log(`[GeminiService] Generating speech for text length: ${text?.length}, Voice: ${voiceName}`);
  
  try {
    const apiKey = process.env.API_KEY;
    console.log(`[GeminiService] API Key Status: ${apiKey ? (apiKey.length > 5 ? apiKey.substring(0, 5) + '...' : 'Present (Short)') : 'Missing/Undefined'}`);
    
    const ai = getGenAI();
    console.log(`[GeminiService] AI Client initialized.`);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      console.error("Gemini Response (No Audio):", JSON.stringify(response, null, 2));
      throw new Error("No audio data received from Gemini.");
    }

    return audioData;
  } catch (error: any) {
    console.error("Error generating speech:", error);
    console.error("API Key Status:", process.env.API_KEY ? "Present" : "Missing");
    
    // Attempt to log more details if available
    if (error.message) console.error("Error Message:", error.message);
    
    throw error;
  }
};