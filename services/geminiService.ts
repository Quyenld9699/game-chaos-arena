import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

// Initialize strictly with the environment variable
if (process.env.API_KEY) {
  aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateCommentary = async (gameEvent: string, currentScore: number, hp: number): Promise<string> => {
  if (!aiClient) return "AI chưa được kết nối...";

  try {
    const prompt = `
      Bạn là một bình luận viên thể thao điện tử (Esports Caster) cực kỳ hào hứng và hơi hài hước.
      Trò chơi là một game sinh tồn 2D nơi Streamer đang bị Người xem (Viewers) "bón hành" bằng cách thả quái vật.
      
      Tình huống vừa xảy ra: "${gameEvent}".
      Điểm hiện tại: ${currentScore}.
      Máu người chơi: ${hp}%.
      
      Hãy đưa ra một câu bình luận ngắn gọn (dưới 20 từ) bằng tiếng Việt thật 'chất' và cảm xúc để phản ứng với tình huống trên.
    `;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Trận đấu đang rất căng thẳng!";
  } catch (error) {
    console.error("Gemini Commentary Error:", error);
    return "";
  }
};
