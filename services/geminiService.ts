import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getAIResponse = async (
  prompt: string, 
  subjectContext: string
): Promise<string> => {
  try {
    const modelId = 'gemini-2.5-flash';
    const systemInstruction = `You are an expert Technical Interview Tutor specializing in ${subjectContext}. 
    Help the user understand concepts, solve problems, or generate study plans. 
    Keep answers concise, practical, and formatted with Markdown.`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to fetch AI response.");
  }
};
