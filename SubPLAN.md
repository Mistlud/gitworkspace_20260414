# SubPLAN: OpenAI Compatible API Integration & Multi-Provider Support

This plan outlines the design and implementation details for expanding the LLM Translation & Grammar Correction Desktop App to support custom, OpenAI-compatible API endpoints while retaining the existing Google Vertex AI integration.

---

## 1. Goal & Objectives
* **Multi-Provider Support**: Allow users to toggle between Google Vertex AI and any OpenAI-compatible API (e.g., OpenAI, OpenRouter, DeepSeek, Ollama, LocalAI).
* **Flexible Configuration**: Enable direct user configuration of custom API endpoints (URL), API keys, and model names via the settings UI.
* **Persistent Security**: Encrypt and store custom API keys securely on the user's local machine using Electron's `safeStorage` API.

---

## 2. API Design & Payloads

Depending on the active provider selected in the settings, the application will route requests differently:

### A. Google Vertex AI (Existing)
* **Auth**: Google OAuth 2.0 Access Token generated from a local Service Account JSON key.
* **Endpoint**: `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`
* **Request Header**: `Authorization: Bearer ${token}`
* **Payload Structure**:
  ```json
  {
    "system_instruction": { "parts": [{ "text": "systemPrompt" }] },
    "contents": [
      { "role": "user", "parts": [{ "text": "userMessage" }] }
    ],
    "generation_config": {
      "temperature": 0.1,
      "max_output_tokens": 2048,
      "thinking_config": { "thinking_level": "MINIMAL" }
    }
  }
  ```

### B. OpenAI-Compatible API (New)
* **Auth**: Direct API Key authorization.
* **Endpoint**: User-defined URL (e.g., `https://api.openai.com/v1/chat/completions`).
* **Request Header**: `Authorization: Bearer <user_api_key>`
* **Payload Structure (Standard Chat Completion)**:
  ```json
  {
    "model": "<user_configured_model_name>",
    "messages": [
      { "role": "system", "content": "systemPrompt" },
      { "role": "user", "content": "userMessage" }
    ],
    "temperature": 0.1,
    "max_tokens": 2048
  }
  ```

---

## 3. UI/UX Refinement (Settings Tab)

The "Settings" Tab will be restructured to accommodate the provider selection:

```
┌──────────────────────────────────────────────────────────┐
│ Settings                                                 │
│                                                          │
│  API Provider: [ Vertex AI  │ OpenAI Compatible ]        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ If Vertex AI Selected:                             │  │
│  │ [ Upload Service Account JSON Key ]                │  │
│  │ Saved Project ID: my-project-id                    │  │
│  │ Model: [ gemini-3-flash-preview  ▼ ]               │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ If OpenAI Compatible Selected:                     │  │
│  │ Endpoint URL: [ https://api.openai.com/v1/...   ]  │  │
│  │ API Key:     [ **************************       ]  │  │
│  │ Request Model:[ gpt-4o                           ]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ Save Config ]                                         │
└──────────────────────────────────────────────────────────┘
```

### Key UI Features:
1. **API Provider Toggle**: A segmented button or dropdown selector between `Vertex AI` and `OpenAI Compatible`.
2. **Dynamic Section Display**: Hiding/showing relevant input fields based on the selected provider.
3. **Encrypted Key Feedback**: Showing encryption/save status for custom API keys.
4. **Validation**: Real-time checking of URL format and ensuring fields are not empty before enabling the save button.

---

## 4. Storage & Security Plan

### Persistence Strategy
Config data will be saved within the Electron user data directory (`userData`).

1. **API Selection & Settings**: A file named `app-config.json` will store non-sensitive config options:
   ```json
   {
     "provider": "openai-compatible",
     "customEndpoint": "https://api.openai.com/v1/chat/completions",
     "customModel": "gpt-4o"
   }
   ```
2. **Sensitive API Keys**: 
   * **Vertex AI**: Remains in `saved-key.bin` encrypted via `safeStorage`.
   * **OpenAI-Compatible Key**: Encrypted via `safeStorage` and stored in `saved-custom-key.bin`.

---

## 5. Implementation Roadmap

### Step 1: Main Process & IPC Updates (`main.js`)
* Create new IPC handlers:
  * `save-custom-config`: Save/load/delete endpoint URLs, model names, and encrypted custom API keys.
  * Update `send-to-vertex` (or introduce a new unified handler `send-to-llm`) to check the selected provider and invoke the appropriate fetch call.

### Step 2: Preload Interface (`preload.js`)
* Expose new config and key handling methods to the renderer process.

### Step 3: Frontend Layout & Styling (`renderer/index.html`, `renderer/style.css`)
* Implement the new selector and inputs in the settings panel.
* Style new buttons, inputs, and validation feedback messages.

### Step 4: UI Logic & API Handlers (`renderer/renderer.js`)
* Bind UI elements to the new config APIs.
* Manage state transitions (switching between providers).
* Route the "Submit" click through the chosen provider's flow.
