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
  const ai = getGenAI();

  try {
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
    if (process.env.API_KEY ? "Key Present" : "Key Missing");
    
    // Attempt to log more details if available
    if (error.message) console.error("Error Message:", error.message);
    
    throw error;
  }
};