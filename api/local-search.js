const data = require("../data.json");

function scoreMatch(query, row) {
  const q = query.toLowerCase();

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
      if (word.length > 2 && text.includes(word)) {
        score += 1;
      }
    });
  });

  return score;
}

module.exports = function handler(req, res) {

  const query = req.query.q || "";

  if (!query.trim()) {
    return res.status(400).json({
      error: "Query required"
    });
  }

  const ranked = data
    .map(row => ({
      row,
      score: scoreMatch(query, row)
    }))
    .sort((a, b) => b.score - a.score);

  return res.status(200).json({
    success: true,
    bestMatch: ranked[0]?.row || null,
    score: ranked[0]?.score || 0
  });
};
