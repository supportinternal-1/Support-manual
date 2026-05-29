import os, json, re
from pathlib import Path
import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

BASE = Path(__file__).resolve().parent
CFG = json.loads((BASE / "config.json").read_text())
CSV_PATH = BASE / CFG["sheet_path"]

SYNONYMS = {
    "otp": ["otp", "one time password", "verification code"],
    "kyc": ["kyc", "identity verification"],
    "login": ["login", "sign in", "sign up", "signin", "signup"],
    "portfolio": ["portfolio", "cams", "kfin", "mf central"],
    "selfie": ["selfie", "photo capture", "camera"],
    "bank": ["bank", "account verification", "lodgement"],
    "sell off": ["sell off", "selloff", "partial sell off"],
}

def normalize_text(t):
    t = str(t).lower().strip()
    t = re.sub(r"[^a-z0-9\s\-/]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

def expand_query(q):
    qn = normalize_text(q)
    extra = []
    for k, vals in SYNONYMS.items():
        if k in qn or any(v in qn for v in vals):
            extra.extend(vals)
    return normalize_text(qn + " " + " ".join(extra))

class SupportBot:
    def __init__(self, csv_path=CSV_PATH):
        self.df = pd.read_csv(csv_path).fillna("")
        for c in ["Category", "Type", "Sub Type", "Pre-checks", "Escalation Path"]:
            if c not in self.df.columns:
                self.df[c] = ""
        self.df = self.df[
            self.df[["Category", "Type", "Sub Type", "Pre-checks", "Escalation Path"]]
            .astype(str)
            .apply(lambda r: any(v.strip() for v in r), axis=1)
        ].copy()
        for c in ["Category", "Type", "Sub Type", "Pre-checks", "Escalation Path"]:
            self.df[c] = self.df[c].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
        self.df["doc"] = self.df[["Category", "Type", "Sub Type", "Pre-checks", "Escalation Path"]].agg(" | ".join, axis=1)
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        self.X = self.vectorizer.fit_transform(self.df["doc"])
        self.client = None
        if os.getenv("OPENAI_API_KEY") and OpenAI is not None:
            self.client = OpenAI()

    def retrieve(self, query, top_k=None):
        top_k = top_k or CFG["top_k"]
        q = expand_query(query)
        qv = self.vectorizer.transform([q])
        sem = cosine_similarity(qv, self.X).flatten()
        lex = np.array([fuzz.token_set_ratio(q, d) / 100.0 for d in self.df["doc"].tolist()])
        scores = CFG["semantic_weight"] * sem + CFG["lexical_weight"] * lex
        q_low = q.lower()
        for i, row in self.df.iterrows():
            boost = 1.0
            cat = normalize_text(row["Category"])
            typ = normalize_text(row["Type"])
            sub = normalize_text(row["Sub Type"])
            if cat and cat in q_low:
                boost *= CFG["category_boost"]
            if typ and typ in q_low:
                boost *= CFG["category_boost"]
            if sub and sub in q_low:
                boost *= CFG["subtype_boost"]
            if any(x in q_low for x in [cat, typ, sub] if x):
                boost *= CFG["exact_match_boost"]
            scores[i] *= boost
        idx = np.argsort(-scores)[:top_k]
        out = self.df.iloc[idx].copy()
        out["score"] = scores[idx]
        return out

    def format_context(self, hits):
        parts = []
        for _, r in hits.iterrows():
            parts.append(
                f"Category: {r['Category']}\nType: {r['Type']}\nSub Type: {r['Sub Type']}\nPre-checks: {r['Pre-checks']}\nEscalation: {r['Escalation Path']}"
            )
        return "\n\n---\n\n".join(parts)

    def generate_llm(self, query, hits):
        if not self.client:
            best = hits.iloc[0]
            return (
                f"I found a close match: {best['Category']} > {best['Type']} > {best['Sub Type']}.\n\n"
                f"Pre-checks:\n{best['Pre-checks']}\n\nEscalation:\n{best['Escalation Path']}"
            )
        context = self.format_context(hits)
        prompt = f"""You are a support assistant. Answer in a natural, clear, ChatGPT-like style.
Use only the provided knowledge base context. If uncertain, say so and give the nearest matches.
Keep it concise, practical, and friendly.

User query: {query}

Knowledge base context:
{context}

Return:
1) direct answer
2) steps or checks
3) escalation if needed
"""
        resp = self.client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "You are a precise customer support assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content

    def answer(self, query):
        hits = self.retrieve(query, top_k=CFG["top_k"])
        best_score = float(hits.iloc[0]["score"]) if len(hits) else 0.0
        if best_score < CFG["confidence_threshold"]:
            return {
                "status": "low_confidence",
                "best_matches": hits[["Category", "Type", "Sub Type", "score"]].to_dict(orient="records"),
                "response": "Mujhe exact match nahi mila. Nearest matches niche hain."
            }
        return {
            "status": "success",
            "best_matches": hits[["Category", "Type", "Sub Type", "score"]].to_dict(orient="records"),
            "response": self.generate_llm(query, hits)
        }

if __name__ == "__main__":
    bot = SupportBot()
    while True:
        q = input("Query: ").strip()
        if q.lower() in {"exit", "quit"}:
            break
        print(json.dumps(bot.answer(q), ensure_ascii=False, indent=2))
