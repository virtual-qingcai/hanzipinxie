import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateCharacterExplanation = async (character: string): Promise<string> => {
  if (!apiKey) {
    return "API Key 缺失。请配置环境变量。";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `请为汉字"${character}"提供一段简洁生动（80字以内）的中文讲解。包括其含义、字源或字形结构的简要说明，以及常见用法。语调应具有教育意义，适合博物馆或展亭的大众观众。`,
    });
    
    return response.text || "暂无解释。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "暂时无法获取解释。";
  }
};