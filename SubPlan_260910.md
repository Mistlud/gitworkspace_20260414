# SubPLAN: Text Comparison Tab

Date: 2026-09-10

## Objective

Replace the existing `기타` (Other) placeholder tab with a local text-comparison workspace. A user enters or pastes two texts side by side, runs a comparison, and can clearly see common and differing passages in paired result panels.

The feature must work fully offline. It must not call either configured LLM provider, store API credentials, or require a new IPC channel.

## Product Decisions

### Separate editing from highlighted output

Use two ordinary `textarea` elements for the left and right source texts, plus two non-editable HTML result panes for the highlighted comparison.

`textarea` cannot safely render partial-text highlighting. An overlay or a `contenteditable` replacement would introduce caret, IME (especially Korean composition), paste, selection, and scroll-sync problems. Keeping the source fields as native textareas makes editing predictable; rendering highlights in dedicated result panes makes the comparison reliable and accessible.

### Explicit comparison action

Provide a `비교` button. Do not re-run a full comparison on every keystroke in the first release. This avoids unnecessary work with long pasted text and prevents visual flicker while a user is composing Korean text. The result is refreshed when the user presses `비교` or `Ctrl+Enter` while either comparison input is focused.

### Highlight meaning

| Side | Highlight | Meaning |
| --- | --- | --- |
| Both panes | neutral text | Text matched on both sides |
| Left pane | red/pink background | Text only present on the left, or replaced from the left |
| Right pane | green/blue background | Text only present on the right, or replaced on the right |
| Both panes | muted placeholder | Empty input or no result yet |

Show a concise status line above the result: identical, number of common segments, and number of left-only/right-only segments. Do not rely on colour alone: include labels and provide sufficient contrast.

## UI Design

```
┌──────────────────────────────────────────────────────────────┐
│ 비교                                             [초기화]     │
│ 왼쪽 텍스트                                  오른쪽 텍스트    │
│ ┌────────────────────────┐  ┌────────────────────────┐       │
│ │ editable textarea      │  │ editable textarea      │       │
│ └────────────────────────┘  └────────────────────────┘       │
│ [왼쪽 원문 복사] 1,234자 · 예상 520토큰  [오른쪽 원문 복사] ... │
│                  [ 좌우 교체 ]  [ 비교 ]                      │
│ [공백 무시] [대소문자 무시] [줄바꿈 무시]                     │
│ 다름 3곳 · 공통 구간 12개       [이전 차이] 3 / 12 [다음 차이] │
│ 왼쪽 결과                                    오른쪽 결과      │
│ ┌────────────────────────┐  ┌────────────────────────┐       │
│ │ common / left-only     │  │ common / right-only    │       │
│ └────────────────────────┘  └────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

- Keep the translation tab unchanged. The comparison UI exists only in `#tab-tab4`.
- Make the input row and result row side-by-side on normal desktop width, with a compact single-column fallback for narrow windows.
- Include individual clear buttons, a global reset button, and a dedicated copy button for each source input (`왼쪽 원문 복사`, `오른쪽 원문 복사`). Do not add a combined copy or result-pane copy action in the initial release.
- Preserve whitespace visually in result panes with `white-space: pre-wrap` and `overflow-wrap: anywhere`.

### Comparison controls

- Add `좌우 교체` to exchange both source values and refresh their metrics. It must not alter translation-tab state.
- Add `이전 차이` and `다음 차이` controls. The status must expose the current position in the form `3 / 12번째 차이` and focus/scroll both result panes to the selected difference region. Disable both controls when there is no difference.
- Add three comparison-only toggles: `공백 무시`, `대소문자 무시`, and `줄바꿈 무시`. They change equivalence testing only; source inputs and displayed text preserve the original characters. The active options must be included in the comparison status so the result cannot be misinterpreted.
- Do not implement synchronized scrolling between the two result panes. It cannot reliably preserve useful alignment after large insertions, removals, or reordered paragraphs and is outside this scope.

### Input metrics

Show independent live metrics below each source input in the form `1,234자 · 예상 520토큰`. Also show the character and estimated-token delta in the comparison status when a result exists.

- Character count is an exact JavaScript count of the entered string. It includes spaces and line breaks so it matches what is compared.
- Token count is explicitly an estimate, not the selected provider's billed or API-reported token count. It must never be labelled as exact.
- Estimate by character category: Korean/Japanese/Chinese characters use a higher per-character weight; Latin letters and digits use an approximate four characters per token; whitespace has a low weight; punctuation, emoji, URLs, and code-like symbols have a higher weight.
- Round the final result up to a whole token. Keep the calculation local, deterministic, and dependency-free.
- Add a tooltip or concise help text: `모델별 토크나이저에 따라 실제 토큰 수와 차이가 날 수 있습니다.`

## Comparison Algorithm

### Tokenization

Tokenize source text with `Intl.Segmenter('ko', { granularity: 'word' })` where available. This provides meaningful word-like boundaries for Korean as well as spaced languages. Include whitespace tokens so line breaks and spacing changes remain visible.

Use a character-token fallback when `Intl.Segmenter` is unavailable. Treat punctuation and line-break changes as differences; do not normalize the source text before the comparison, because the user needs to see those changes.

### Diff output

Use a battle-tested sequence-diff implementation (for example, the small `diff`/jsdiff dependency) rather than a hand-written quadratic LCS routine. Its output provides ordered `added`, `removed`, and unchanged segments, which can be mapped directly to the right, left, and both result panes.

- An unchanged segment is appended to both panes.
- A removed segment is appended only to the left pane with the left-difference class.
- An added segment is appended only to the right pane with the right-difference class.
- Consecutive removed/added segments are presented as one replacement region in the status count.

Escape all text before inserting it into HTML. Prefer creating text nodes and `<mark>` elements with DOM APIs, not constructing unescaped `innerHTML` from user input.

### Scale and failure behavior

- Define and display a practical size limit before comparing (recommended initial limit: 100,000 characters per side). This prevents a pasted document from freezing the renderer.
- For an empty side, show a local validation message and leave prior result hidden.
- For identical non-empty text, show the text in both result panes and the status `두 텍스트가 동일합니다.`
- Keep all comparison state in renderer memory in the first release. Do not persist potentially sensitive pasted content to `app-config.json` or disk.

## Implementation Scope

### 1. `package.json` and lockfile

- Add the selected client-side diff dependency if it is not implemented locally.
- Keep the dependency renderer-only; no provider, Electron main-process, or security-storage change is required.

### 2. `renderer/index.html`

- Replace the `준비 중` placeholder in `#tab-tab4` with semantic comparison controls.
- Add two labelled `textarea` inputs, comparison/reset controls, an `aria-live` status element, and two result panes.
- Add clear labels and keyboard-accessible buttons. The comparison feature must not reuse translation IDs.

### 3. `renderer/renderer.js`

- Bind comparison tab controls after the existing DOM initialization.
- Implement live character count and estimated-token calculation for each input.
- Implement source-specific copy controls, source swap, comparison option state, validation, tokenization, diff conversion, safe DOM rendering, segment summary, clear/reset, difference navigation, and the focused `Ctrl+Enter` shortcut.
- Avoid modifying translation mode, history, prompts, provider settings, or existing IPC calls.

### 4. `renderer/style.css`

- Replace `.placeholder` usage with dedicated comparison layout classes.
- Add semantic difference classes with adequate contrast in the app's dark theme.
- Ensure each result pane scrolls independently and long unbroken strings do not overflow.
- Include a responsive layout for a narrowed app window.

### 5. Documentation

- Update `README.md` to describe the `기타` tab as text comparison rather than an undecided feature.
- Update `PROGRESS.md` with the delivered capability and manual verification result.

## Validation Checklist

- The Other tab no longer shows `준비 중` and opens the comparison workspace.
- Korean, English, punctuation, whitespace, and newline-only changes are highlighted correctly.
- Each source input shows an exact character count and an explicitly estimated token count; the count updates while typing, pasting, clearing, and resetting.
- The token estimate handles Korean, Latin text, whitespace, punctuation, emoji, URLs, and mixed-language content without an error or negative value.
- Each source-copy button copies only its corresponding unmodified input, with clear success and failure feedback.
- `좌우 교체` swaps both inputs and their metrics without changing any other tab's state.
- Each comparison option changes only equivalence testing, preserves the visible source text, and is reflected in the result status.
- Difference navigation visits every difference in order, keeps both result panes focused on the selected regions, and is disabled when texts are identical.
- Identical text produces an explicit identical result without difference markup.
- Added, removed, and replacement passages appear on the appropriate side with the correct colour and labels.
- Text containing `<`, `>`, `&`, quotes, or pasted HTML is displayed as text and cannot create markup or execute code.
- `Ctrl+Enter` compares when a comparison textarea is focused and does not alter the translation-tab behaviour.
- Individual clear and global reset controls reset only comparison-tab state.
- Long text at the documented limit remains responsive; text over the limit receives a clear local message.
- Translation, history, settings, provider switching, and production ZIP build continue to work.

## Out of Scope for Initial Release

- LLM-based semantic comparison, proofreading, or translation.
- Saving comparison documents or comparison history to disk.
- Three-way comparison, file upload, PDF/Word parsing, merge/edit application, or collaboration features.
- Pixel-perfect line-to-line alignment for substantially reordered paragraphs. The initial release shows an accurate ordered diff; advanced alignment can be evaluated after real usage feedback.
