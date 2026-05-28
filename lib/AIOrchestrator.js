import { fallbackSearch } from "./fallbackEngine";

async function callGemini(query) {
  try {
    const response = await fetch("/api/gemini-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("Gemini failed");
    }

    return await response.json();
  } catch (error) {
    console.log("Gemini Error:", error.message);
    return null;
  }
}

async function callGroq(query) {
  try {
    const response = await fetch("/api/groq-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("Groq failed");
    }

    return await response.json();
  } catch (error) {
    console.log("Groq Error:", error.message);
    return null;
  }
}

async function callOpenAI(query) {
  try {
    const response = await fetch("/api/openai-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("OpenAI failed");
    }

    return await response.json();
  } catch (error) {
    console.log("OpenAI Error:", error.message);
    return null;
  }
}

export async function processQuery(query) {
  // STEP 1 → Gemini
  const geminiResult = await callGemini(query);

  if (geminiResult && geminiResult.confidence >= 0.85) {
    return {
      source: "Gemini",
      ...geminiResult,
    };
  }

  // STEP 2 → Groq
  const groqResult = await callGroq(query);

  if (groqResult && groqResult.confidence >= 0.85) {
    return {
      source: "Groq",
      ...groqResult,
    };
  }

  // STEP 3 → OpenAI
  const openaiResult = await callOpenAI(query);

  if (openaiResult && openaiResult.confidence >= 0.85) {
    return {
      source: "OpenAI",
      ...openaiResult,
    };
  }

  // STEP 4 → Fallback Engine
  const fallbackResult = fallbackSearch(query);

  return {
    source: "Fallback Engine",
    ...fallbackResult,
  };
}
