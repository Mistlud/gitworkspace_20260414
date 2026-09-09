# SubPLAN: Vertex Model Registry and Thinking Level Settings

Date: 2026-09-09

## Objective

Allow Vertex AI users to register model names directly in the settings screen and select a registered model for requests. Provide Thinking Level as an independent option rather than coupling it to the selected model.

## Current State

- The Vertex AI model dropdown hardcodes two entries: `gemini-3-flash-preview` and `gemini-3.1-pro-preview`.
- Selecting Flash saves `thinking_level` as `MINIMAL`.
- Selecting Pro removes `thinking_level`; therefore, the request omits `thinking_config` and uses the Vertex API default behavior.
- Saving an empty temperature already removes `temperature`, and both Vertex AI and OpenAI-compatible requests omit that parameter when it is absent.
- OpenAI-compatible profiles already accept a user-entered model name.

## Target Features

### 1. Vertex Model Registry

- Users can add and remove Vertex model names in the settings tab.
- Registered models immediately appear in the Vertex model dropdown.
- The selected model is saved in `prompts.json` and used in the Vertex request URL.
- Keep `gemini-3-flash-preview` as the default model.
- Define a safe fallback and user feedback for an empty model list or deletion of the currently selected model.

### 2. Independent Thinking Level Setting

- Decouple Thinking Level from model selection.
- Add a dedicated settings control with `Omit`, `MINIMAL`, `LOW`, and `HIGH` options.
- Selecting `Omit` removes `thinking_level` from the configuration and omits the complete `thinking_config` object from Vertex request bodies.
- Selecting `MINIMAL`, `LOW`, or `HIGH` sends that value as `thinking_config.thinking_level`.
- Remove the existing automatic Flash/Pro-specific Thinking Level behavior.

### 3. Preserve Temperature Omission Behavior

- Saving an empty temperature removes `temperature` from the configuration.
- When no value is configured, both Vertex AI and OpenAI-compatible request bodies omit `temperature`.
- This behavior already exists and must be covered by regression checks during this work.

## Proposed Configuration Shape

```json
{
  "model": "gemini-3-flash-preview",
  "vertexModels": [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview"
  ],
  "thinking_level": "MINIMAL",
  "temperature": 0.1,
  "max_output_tokens": 3000
}
```

- When Thinking Level is `Omit`, do not persist the `thinking_level` key.
- For an existing `prompts.json` without `vertexModels`, initialize a compatible model list using the current model and the default model.

## Implementation Scope

1. `renderer/index.html`
   - Add a Vertex model list UI (list, input, and remove actions) and update the model dropdown.
   - Add a dedicated Thinking Level selector.

2. `renderer/renderer.js`
   - Implement adding, removing, rendering, and synchronizing the Vertex model list with the dropdown.
   - Remove the current automatic Thinking Level modification on model change.
   - Persist `Omit` by deleting the key; persist other options as their selected value.

3. `main.js`
   - Retain the existing conditional construction of `thinking_config`.
   - No additional IPC or API-routing change is required for model-list management.

4. `prompts.json`
   - Add the initial `vertexModels` list.

5. Documentation
   - Update `README.md` and `PROGRESS.md` to describe model management and Thinking Level behavior.

## Validation Checklist

- A newly registered Vertex model can be selected and remains available after restarting the app.
- The selected model is used exactly in the Vertex request URL.
- Each Thinking Level value is represented correctly in the request body.
- With Thinking Level set to `Omit`, the request body contains no `thinking_config`.
- With an empty temperature, both Vertex and OpenAI-compatible request bodies contain no `temperature`.
- Existing direct model entry for OpenAI-compatible profiles continues to work.

## Notes and Constraints

- A registered model must be supported by Vertex AI and enabled for the configured project. Typographical errors, unsupported models, or missing permissions should be surfaced as API errors.
- Thinking Level availability may differ by model. The app should send the selected value as configured and clearly display any API error returned by the provider.
