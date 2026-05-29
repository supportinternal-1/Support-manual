const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwAqD2jfG2cKo7K7LojTWweEFPinjhQYVsgYA9wPHOCHRIJIw-QQdin59l9dgPMmkbk/exec';

const volatileStore = globalThis.__volatileSupportMemory || (globalThis.__volatileSupportMemory = {
  answers: {},
  feedback: {}
});

function normalizeText(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pls|plz)\b/g, 'please')
    .replace(/\bkyc\b/g, 'kyc verification')
    .replace(/\blogin\b/g, 'sign in login')
    .replace(/\bsignin\b/g, 'sign in')
    .replace(/\bsignup\b/g, 'sign up')
    .replace(/\bpf\b/g, 'portfolio')
    .replace(/\broi\b/g, 'returns roi')
    .replace(/\bapp\b/g, 'application app')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str = '') {
  return [...new Set(normalizeText(str).split(' ').filter(Boolean))];
}

function memoryKey(question) {
  return normalizeText(question);
}

function buildSearchText(row) {
  return [row.category, row.type, row.subType, row.preChecks, row.escalationPath, row.extraDetails].join(' ');
}

function keywordScore(query, row) {
  const qTokens = tokenize(query);
  const text = normalizeText(buildSearchText(row));
  const title = normalizeText(`${row.type} ${row.subType}`);
  let score = 0;

  qTokens.forEach(token => {
    if (title.includes(token)) score += 5;
    else if (text.includes(token)) score += 2;
  });

  const joined = normalizeText(query);
  if (title.includes(joined)) score += 14;
  if (normalizeText(row.subType).includes(joined)) score += 10;
  if (normalizeText(row.type).includes(joined)) score += 8;

  return score;
}

function stringSimilarity(a = '', b = '') {
  a = normalizeText(a);
  b = normalizeText(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let same = 0;
  for (const word of tokenize(shorter)) {
    if (longer.includes(word)) same += 1;
  }
  return same / Math.max(tokenize(longer).length, 1);
}

function scoreRow(query, row) {
  const keyword = keywordScore(query, row);
  const sim1 = stringSimilarity(query, row.subType);
  const sim2 = stringSimilarity(query, row.type);
  const sim3 = stringSimilarity(query, buildSearchText(row));
  return Math.min(0.99, (keyword / 30) + sim1 * 0.35 + sim2 * 0.2 + sim3 * 0.25);
}

async function getSupportData() {
  const response = await fetch(APPS_SCRIPT_URL, { method: 'GET', redirect: 'follow' });
  if (!response.ok) throw new Error(`Sheet fetch failed with ${response.status}`);
  const data = await response.json();
  return data.map(row => ({
    category: (row['Category'] || '').toString().trim(),
    type: (row['Type'] || '').toString().trim(),
    subType: (row['Sub Type'] || '').toString().trim(),
    preChecks: (row['Pre-checks'] || '').toString().trim(),
    escalationPath: (row['Escalation Path'] || '').toString().trim(),
    extraDetails: (row['Extra Details'] || '').toString().trim()
  })).filter(r => r.type && r.subType);
}

async function readStore(group, key) {
  return volatileStore[group][key] || null;
}

async function writeStore(group, key, value) {
  volatileStore[group][key] = value;
}

async function deleteStore(group, key) {
  delete volatileStore[group][key];
}

function shouldAskFeedback(answerStats) {
  if (!answerStats) return true;
  return (answerStats.yesCount || 0) < 10;
}

async function callGroq(question, matches) {
  if (!process.env.GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY');
  const prompt = `User question: ${question}\n\nSupport matches:\n${matches.map((m, i) => `${i + 1}. ${m.category} > ${m.type} > ${m.subType}`).join('\n')}\n\nReturn only JSON: {"bestIndex": number, "reason": string}`;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Pick the best matching support case for the user query. Respond in JSON only.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`Groq failed ${response.status}`);
  const json = await response.json();
  return { provider: 'groq', text: json.choices?.[0]?.message?.content || '' };
}

async function callGemini(question, matches) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');
  const prompt = `Pick the best matching support case for this question: ${question}\n\n${matches.map((m, i) => `${i + 1}. ${m.category} > ${m.type} > ${m.subType}`).join('\n')}\n\nReturn JSON only: {"bestIndex": number, "reason": string}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!response.ok) throw new Error(`Gemini failed ${response.status}`);
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return { provider: 'gemini', text };
}

async function callOpenRouter(question, matches) {
  if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  const prompt = `Pick the best matching support case for this question: ${question}\n\n${matches.map((m, i) => `${i + 1}. ${m.category} > ${m.type} > ${m.subType}`).join('\n')}\n\nReturn JSON only: {"bestIndex": number, "reason": string}`;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'HTTP-Referer': process.env.PUBLIC_APP_URL || 'https://support-manual.vercel.app',
      'X-Title': 'Volt Support Manual AI'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'Pick the best matching support case for the user query. Respond in JSON only.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenRouter failed ${response.status}`);
  const json = await response.json();
  return { provider: 'openrouter', text: json.choices?.[0]?.message?.content || '' };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function providerFallback(question, matches) {
  const callers = [callGroq, callGemini, callOpenRouter];
  const errors = [];
  for (const fn of callers) {
    try {
      const out = await fn(question, matches);
      const parsed = extractJson(out.text);
      if (parsed && Number.isInteger(parsed.bestIndex)) {
        return { provider: out.provider, parsed };
      }
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { provider: 'local', parsed: null, errors };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const qKey = memoryKey(question);
    const memoryAnswer = await readStore('answers', qKey);
    if (memoryAnswer?.answer && (memoryAnswer.yesCount || 0) >= 10) {
      return res.status(200).json({
        mode: 'answer',
        bestMatch: memoryAnswer.answer,
        confidence: 0.99,
        provider: 'memory',
        feedbackId: null
      });
    }

    const data = await getSupportData();
    const scored = data.map(row => ({ ...row, score: scoreRow(question, row) }))
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 5);
    if (!top.length || top[0].score < 0.18) {
      return res.status(200).json({ mode: 'none', message: 'No strong support match found. Try asking in a little more detail.' });
    }

    let best = top[0];
    let provider = 'local';

    if (top.length > 1 && top[0].score - top[1].score < 0.12) {
      const aiDecision = await providerFallback(question, top.slice(0, 4));
      if (aiDecision.parsed?.bestIndex >= 1 && aiDecision.parsed.bestIndex <= Math.min(4, top.length)) {
        best = top[aiDecision.parsed.bestIndex - 1];
        provider = aiDecision.provider;
      }
    }

    if (best.score < 0.44 && top.length > 1) {
      return res.status(200).json({ mode: 'multiple', matches: top.slice(0, 4), provider });
    }

    const feedbackId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    if (shouldAskFeedback(memoryAnswer)) {
      await writeStore('feedback', feedbackId, { questionKey: qKey, answer: best, createdAt: Date.now() });
    }

    return res.status(200).json({
      mode: 'answer',
      bestMatch: best,
      confidence: best.score,
      provider,
      feedbackId: shouldAskFeedback(memoryAnswer) ? feedbackId : null
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
