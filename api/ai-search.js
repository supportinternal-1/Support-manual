import { processQuery } from "../lib/AIOrchestrator";

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { query } = req.body;

    // Check empty query
    if (!query || query.trim() === "") {
      return res.status(400).json({
        error: "Query is required",
      });
    }

    // Process query through orchestrator
    const result = await processQuery(query);

    // Return final result
    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("AI Search Error:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
