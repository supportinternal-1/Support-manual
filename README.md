# Live Support Bot

This project reads live support data from Google Sheets through Google Apps Script and answers queries in a conversational, ChatGPT-like way.

## How it works
1. Google Sheet stores the live knowledge base.
2. Google Apps Script converts the sheet into JSON.
3. `app.py` fetches the JSON live.
4. The bot retrieves the best match and answers naturally.

## Files
- `app.py` — main chatbot logic.
- `config.json` — live JSON URL and tuning settings.
- `requirements.txt` — Python dependencies.
- `README.md` — instructions.

## Setup

### 1. Google Sheet
Keep your support data in Google Sheets.

### 2. Apps Script
Paste the Apps Script code in `Code.gs`.

### 3. Deploy web app
Deploy the script as a web app and copy the `/exec` URL.

### 4. Update config
Paste the web app URL into `config.json` under `data_url`.

### 5. Install dependencies
```bash
pip install -r requirements.txt
```

### 6. Run the bot
```bash
python app.py
```

## Important
- Do not upload the CSV to GitHub.
- Keep the Google Sheet as the live source of truth.
- Re-deploy Apps Script after making changes in the sheet script.

## ChatGPT-like behavior
The bot is designed to respond in a natural, helpful, conversational style.
It uses:
- retrieval from live data,
- prompt-based answer generation,
- fallback to closest matches when confidence is low.

## Notes
If you update the Google Sheet structure, keep the header names consistent.
