import os, json, re
from pathlib import Path
import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    import requests
except Exception:
    requests = None

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

BASE = Path(__file__).resolve().parent
CFG = json.loads((BASE / 'config.json').read_text())
DATA_URL = CFG.get('data_url', '')
LOCAL_CACHE = BASE / CFG.get('cache_file', 'live_cache.json')

SYNONYMS = {
    'otp': ['otp', 'one time password', 'verification code'],
    'kyc': ['kyc', 'identity verification'],
    'login': ['login', 'sign in', 'sign up', 'signin', 'signup'],
    'portfolio': ['portfolio', 'cams', 'kfin', 'mf central'],
    'selfie': ['selfie', 'photo capture', 'camera'],
    'bank': ['bank', 'account verification', 'lodgement'],
    'sell off': ['sell off', 'selloff', 'partial sell off'],
    'mandate': ['mandate', 'auto debit', 'umrn', 'upi mandate'],
    'repayment': ['repayment', 'payment', 'emi', 'pos not updated'],
    'withdrawal': ['withdrawal', 'disbursal', 'amount not received'],
    'foreclosure': ['foreclosure', 'loan closure', 'lien removal'],
    'pledge': ['pledge', 'pledging', 'lien marking', 'lamf'],
}

COLMAP = {
    'module': ['module', 'Module'],
    'category': ['category', 'Category'],
    'type': ['type', 'Type'],
    'sub_type': ['sub_type', 'sub type', 'Sub Type'],
    'keywords': ['keywords', 'Keywords'],
    'user_query_variants': ['user_query_variants', 'user query variants'],
    'pre_checks': ['pre_checks', 'pre-checks', 'Pre-checks'],
    'answer_steps': ['answer_steps', 'answer steps'],
    'escalation_path': ['escalation_path', 'escalation path', 'Escalation Path'],
    'platform': ['platform', 'Platform'],
    'priority': ['priority', 'Priority'],
}

def normalize_text(t):
    t = str(t).lower().strip()
    t = re.sub(r'[^a-z0-9\s\-/]+', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def expand_query(q):
    qn = normalize_text(q)
    extra = []
    for k, vals in SYNONYMS.items():
        if k in qn or any(v in qn for v in vals):
            extra.extend(vals)
    return normalize_text(qn + ' ' + ' '.join(extra))

def safe_list(v):
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        return [v]
    return []

def fetch_rows():
    if DATA_URL and requests is not None:
        r = requests.get(DATA_URL, timeout=20)
        r.raise_for_status()
        payload = r.json()
        if isinstance(payload, dict):
            for key in ['data', 'rows', 'records', 'items']:
                if key in payload and isinstance(payload[key], list):
                    return payload[key]
            return [payload]
        if isinstance(payload, list):
            return payload
    if LOCAL_CACHE.exists():
        payload = json.loads(LOCAL_CACHE.read_text())
        return payload if isinstance(payload, list) else safe_list(payload)
    raise RuntimeError('No data source available')

def row_get(row, keys, default=''):
    for k in keys:
        if k in row and str(row[k]).strip() != 'nan':
            return row[k]
    return default

class SupportBot:
    def __init__(self):
        rows = fetch_rows()
        norm = []
        for row in rows:
            item = {}
            for out, keys in COLMAP.items():
                item[out] = str(row_get(row, keys, '')).strip()
            if any(item.values()):
                norm.append(item)

        self.df = pd.DataFrame(norm).fillna('')
        if self.df.empty:
            raise RuntimeError('No usable rows found in live data')

        self.df = self.df[
            self.df[['category', 'type', 'sub_type', 'pre_checks', 'escalation_path']]
            .astype(str)
            .apply(lambda r: any(v.strip() for v in r), axis=1)
        ].copy()

        for c in self.df.columns:
            self.df[c] = self.df[c].astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()

        self.df['doc'] = (
            self.df['keywords'] + ' | ' + self.df['user_query_variants'] + ' | ' +
            self.df['category'] + ' | ' + self.df['type'] + ' | ' + self.df['sub_type'] + ' | ' + self.df['pre_checks']
        )

        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        self.X = self.vectorizer.fit_transform(self.df['doc'])
        self.client = OpenAI() if os.getenv('OPENAI_API_KEY') and OpenAI is not None else None

    def retrieve(self, query, top_k=None):
        top_k = top_k or CFG.get('top_k', 5)
        q = expand_query(query)
        qv = self.vectorizer.transform([q])
        sem = cosine_similarity(qv, self.X).flatten()
        lex = np.array([fuzz.token_set_ratio(q, d) / 100.0 for d in self.df['doc'].tolist()])
        scores = CFG.get('semantic_weight', 0.55) * sem + CFG.get('lexical_weight', 0.35) * lex
        q_low = q.lower()

        for i, row in self.df.iterrows():
            boost = 1.0
            for field, mult in [('category', CFG.get('category_boost', 1.2)), ('type', CFG.get('category_boost', 1.2)), ('sub_type', CFG.get('subtype_boost', 1.15))]:
                val = normalize_text(row[field])
                if val and val in q_low:
                    boost *= mult

            for token in [x.strip() for x in row['keywords'].split(',') if len(x.strip()) > 3]:
                if token in q_low:
                    boost *= CFG.get('exact_match_boost', 1.5)
                    break

            scores[i] *= boost

        idx = np.argsort(-scores)[:top_k]
        out = self.df.iloc[idx].copy()
        out['score'] = scores[idx]
        return out

    def format_context(self, hits):
        parts = []
        for _, r in hits.iterrows():
            parts.append(
                f"Issue: {r['sub_type']}\n"
                f"Category: {r['category']} > {r['type']}\n"
                f"Steps: {r['pre_checks'] or r['answer_steps']}\n"
                f"Escalation: {r['escalation_path']}"
            )
        return '\n\n---\n\n'.join(parts)

    def generate_llm(self, query, hits):
        if not self.client:
            best = hits.iloc[0]
            return (
                f"{best['sub_type']}. {best['pre_checks'] or best['answer_steps']} "
                f"If it still doesn't work, {best['escalation_path']}"
            )

        context = self.format_context(hits)
        prompt = f"""You are a helpful customer support assistant.
Reply like ChatGPT in natural language.
Do NOT use headings, bullet points, labels, or section titles unless absolutely necessary.
Write in one or two smooth paragraphs.
Be concise, human, and conversational.
If the answer is uncertain, say so naturally.
Use only the provided knowledge base context.

User query: {query}

Knowledge base context:
{context}
"""
        resp = self.client.chat.completions.create(
            model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[
                {'role': 'system', 'content': 'You are a precise, friendly support assistant. Speak naturally and avoid headings unless the user explicitly asks for structure.'},
                {'role': 'user', 'content': prompt}
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content

    def answer(self, query):
        hits = self.retrieve(query, top_k=CFG.get('top_k', 5))
        best_score = float(hits.iloc[0]['score']) if len(hits) else 0.0
        threshold = CFG.get('confidence_threshold', 0.45)

        if best_score < threshold:
            return {
                'status': 'low_confidence',
                'response': 'I could not find an exact match. Closest results are below.',
                'best_matches': hits[['category', 'type', 'sub_type', 'score']].to_dict(orient='records')
            }

        return {
            'status': 'success',
            'response': self.generate_llm(query, hits),
            'best_matches': hits[['category', 'type', 'sub_type', 'score']].head(3).to_dict(orient='records')
        }

if __name__ == '__main__':
    bot = SupportBot()
    while True:
        q = input('\nQuery: ').strip()
        if q.lower() in {'exit', 'quit'}:
            break
        print(json.dumps(bot.answer(q), ensure_ascii=False, indent=2))
