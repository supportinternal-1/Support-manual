# Support Bot

## What this does
- Reads your support knowledge base from CSV
- Finds the best matching issue using hybrid retrieval
- Gives a ChatGPT-like answer if OpenAI API key is set
- Falls back to the nearest matches if confidence is low

## Files
- `app.py` = main bot logic
- `requirements.txt` = libraries
- `config.json` = tuning settings
- `knowledge_base.csv` = your support data
- `README.md` = instructions

## Setup
1. Put all files in the same GitHub repo root.
2. Upload your CSV as `knowledge_base.csv`.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Optional: set your OpenAI key:
   ```bash
   export OPENAI_API_KEY=your_key
   ```
5. Run:
   ```bash
   python app.py
   ```

## CSV format
Your CSV should have these columns:
- Category
- Type
- Sub Type
- Pre-checks
- Escalation Path
