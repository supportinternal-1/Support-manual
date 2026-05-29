const data = require("../data.json");

function localMatch(query) {

  const q = query.toLowerCase();

  let bestRow = null;
  let bestScore = 0;

  data.forEach(row => {

    let score = 0;

    const fields = [
      row["Category"] || "",
      row["Type"] || "",
      row["Sub Type"] || "",
      row["Pre-checks"] || "",
      row["Escalation Path"] || "",
      row["Extra Details"] || ""
    ];

    fields.forEach(field => {

      const text = field.toLowerCase();

      q.split(" ").forEach(word => {

        if (
          word.length > 2 &&
          text.includes(word)
        ) {
          score++;
        }

      });

    });

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }

  });

  return {
    confidence: Math.min(
      95,
      bestScore * 10
    ),
    row: bestRow
  };
}

module.exports = async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Query required"
      });
    }

    const result =
      localMatch(query);

    return res.status(200).json({
      success: true,
      source: "Fallback Search",
      confidence:
        result.confidence,
      result:
        result.row
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Internal Error"
    });

  }

};
