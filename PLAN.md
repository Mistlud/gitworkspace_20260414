# Project Plan: LLM Translation & Grammar Correction Desktop App

## Overview
A desktop application that allows users to send translation or grammar correction requests to Google Vertex AI, using pre-configured admin prompts. Users only see the LLM response.

## Tech Stack
- **Electron** — cross-platform desktop app framework (Node.js based)
- **google-auth-library** — OAuth token generation from service account JSON
- **Vertex AI REST API** — LLM requests via direct HTTP calls

## User Inputs (5 fields)
1. **Vertex AI JSON key** — file upload or paste as text
2. **Task type** — Translation or Grammar Correction
3. **Source language** — always shown
4. **Target language** — shown only when Translation is selected (hidden for Grammar Correction)
5. **Input text** — the sentence/paragraph to process

## UI Flow
1. User fills in the 5 fields
2. User clicks Submit
3. App combines admin prompt + user input internally
4. Request sent to Vertex AI
5. Only the LLM response is displayed to the user

## Prompt Management
- Prompts are stored in `prompts.json` (not visible to users)
- Separate prompts for translation and grammar correction
- Admin edits prompts by modifying `prompts.json` directly

## Folder Structure
```
gitworkspace_20260414/
├── main.js            # Electron main process
├── preload.js         # Secure bridge between main and renderer
├── prompts.json       # Admin-managed prompts
├── renderer/
│   ├── index.html
│   ├── style.css
│   └── renderer.js    # UI logic + API calls
├── package.json
└── .gitignore
```

## Implementation Order
1. `package.json` init + Electron install
2. Electron base setup (main.js, preload.js)
3. UI layout (index.html, style.css)
4. Vertex AI integration (renderer.js)
5. Prompt file setup (prompts.json)
6. Test and commit
