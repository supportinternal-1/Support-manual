const volatileStore = globalThis.__volatileSupportMemory || (globalThis.__volatileSupportMemory = {
  answers: {},
  feedback: {}
});

async function readStore(group, key) {
  return volatileStore[group][key] || null;
}

async function writeStore(group, key, value) {
  volatileStore[group][key] = value;
}

async function deleteStore(group, key) {
  delete volatileStore[group][key];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { feedbackId, answer } = req.body || {};
    const item = await readStore('feedback', feedbackId);

    if (!item) {
      return res.status(404).json({ message: 'Feedback session not found or expired.' });
    }

    const key = item.questionKey;
    const current = (await readStore('answers', key)) || { answer: item.answer, yesCount: 0, noCount: 0 };

    if (answer === 'yes') {
      current.answer = item.answer;
      current.yesCount += 1;
      await writeStore('answers', key, current);
      await deleteStore('feedback', feedbackId);
      if (current.yesCount >= 10) {
        return res.status(200).json({ message: 'Saved. This answer is now trusted, so feedback will stop after this.' });
      }
      return res.status(200).json({ message: `Saved. Confirmed ${current.yesCount} time(s).` });
    }

    if (answer === 'no') {
      current.noCount += 1;
      await writeStore('answers', key, current);
      await deleteStore('feedback', feedbackId);
      return res.status(200).json({ message: 'Saved. The system will trust this answer less next time.' });
    }

    return res.status(400).json({ message: 'Invalid feedback value.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
