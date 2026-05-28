import { GoogleGenerativeAI } from "@google/generative-ai";
import data from "../data.json";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { query } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    // Only send relevant operational context
    const prompt = `
You are a finance support operational routing engine.

Your job is NOT to generate answers.

Your ONLY task:
1. Understand user issue
2. Match closest SOP
3. Return JSON only

Available SOP data:
${JSON.stringify(data).slice(0, 12000)}

User Query:
"${query}"

Return ONLY valid JSON format:

{
  "intentId": "",
  "category": "",
  "type": "",
  "subType": "",
  "confidence": 0.0
}
`;

    const result = await model.generateContent(prompt);

    const text = result.response.text();

    // Remove markdown formatting if model adds it
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Gemini Error:", error);

    return res.status(500).json({
      error: "Gemini failed",
    });
  }
}
