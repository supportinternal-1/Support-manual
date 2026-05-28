import synonymMap from "./synonymMap";
import keywordRules from "./keywordRules";

function normalizeQuery(query) {
  let normalizedQuery = query.toLowerCase();

  Object.keys(synonymMap).forEach((phrase) => {
    if (normalizedQuery.includes(phrase.toLowerCase())) {
      normalizedQuery += ` ${synonymMap[phrase]}`;
    }
  });

  return normalizedQuery;
}

function calculateConfidence(rule, normalizedQuery) {
  let score = 0;

  rule.requiredKeywords.forEach((keyword) => {
    if (normalizedQuery.includes(keyword)) {
      score += 50;
    }
  });

  rule.optionalKeywords.forEach((keyword) => {
    if (normalizedQuery.includes(keyword)) {
      score += 10;
    }
  });

  return Math.min(score / 100, 1);
}

export function fallbackSearch(query) {
  const normalizedQuery = normalizeQuery(query);

  let bestMatch = null;
  let highestConfidence = 0;

  keywordRules.forEach((rule) => {
    const hasAllRequired = rule.requiredKeywords.every((keyword) =>
      normalizedQuery.includes(keyword)
    );

    if (!hasAllRequired) return;

    const confidence = calculateConfidence(rule, normalizedQuery);

    if (confidence > highestConfidence) {
      highestConfidence = confidence;

      bestMatch = {
        intentId: rule.intentId,
        category: rule.category,
        type: rule.type,
        subType: rule.subType,
        confidence,
      };
    }
  });

  return bestMatch || {
    message: "No strong match found",
    confidence: 0,
  };
}
