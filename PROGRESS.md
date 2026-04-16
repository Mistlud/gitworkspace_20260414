# Progress Log

## Status: In Progress

---

## Completed

### Initial Setup (2026-04-14)
- Electron + google-auth-library 설치 완료
- 기본 폴더 구조 구성 (`main.js`, `preload.js`, `renderer/`, `prompts.json`)
- Vertex AI REST API 연동 (google-auth-library 기반 OAuth 토큰 발급)
- UI 초안 구현:
  - JSON 키 입력 (파일 불러오기 / 텍스트 붙여넣기)
  - 작업 유형 선택 (번역 / 문법 교정)
  - 언어 필드 동적 표시 (교정 시 도착 언어 숨김)
  - 결과 출력 영역
  - 로딩 상태 및 에러 메시지 처리
- `prompts.json` 초안 작성 (번역 / 문법 교정 프롬프트)
- GitHub 푸시 완료

### 기능 추가 (2026-04-14)
- `prompts.json`에 `model` 필드 추가 — 관리자가 파일 수정만으로 모델 변경 가능
- `prompts.json`에 `languages` 필드 추가 (Korean, English, Japanese, Russian)
- 언어 선택 UI를 텍스트 입력에서 드롭다운으로 교체
- 드롭다운 옵션을 `prompts.json`에서 동적으로 로드하도록 구현

### UI 전면 재설계 (2026-04-14)
- 프레임리스 윈도우 (타이틀 바 제거), `frame: false`
- 좌측 사이드바 + 우측 콘텐츠 영역 구조로 전환
- 사이드바 전체를 창 드래그 영역으로 설정 (`-webkit-app-region: drag`)
- 닫기 버튼(✕)을 사이드바 하단에 배치, 최소화 버튼 없음
- 탭 1: 상단 컨트롤 바(언어 드롭다운 + 모드 뱃지 + 전송 버튼) + 입력/결과 좌우 분할 레이아웃
- 탭 2: JSON 키 입력(파일 불러오기/붙여넣기) + 유효성 피드백 (OK / 오류 표시)
- 탭 3: "준비 중" 플레이스홀더
- 결과창 복사 버튼 배치
- 사용하지 않는 `.radio-group` CSS 제거

### Vertex AI 연동 수정 (2026-04-16)
- 엔드포인트 URL 수정: `https://global-aiplatform.googleapis.com/...` → `https://aiplatform.googleapis.com/...`
  - Gemini 3.x는 `global` location 전용이나 URL 앞에 붙이지 않음
- 요청 구조 개선: 시스템 프롬프트를 `system_instruction` 필드로 분리
- `generation_config` 추가: `temperature`, `max_output_tokens`, `thinking_config`
- 모델 업데이트: `gemini-1.5-flash` → `gemini-3-flash-preview`
- `prompts.json`에 `thinking_level: "MINIMAL"`, `temperature: 0.1` 필드 추가
- 에러 처리 순서 수정: `response.ok` 먼저 확인 → 실패 시 `.text()`로 메시지 출력
- **번역 / 문법 교정 정상 동작 확인 완료**

### 설정 탭 — JSON 키 영구 저장 (2026-04-16)
- `electron.safeStorage`로 키 암호화 저장 (`userData/saved-key.bin`, DPAPI 기반)
- IPC 핸들러 추가: `save-key`, `load-key`, `delete-key`
- 저장된 키 있을 때: `project_id` 표시 + 삭제 버튼 (키 원문은 화면에 노출하지 않음)
- 저장된 키 없을 때: 파일 불러오기 / 텍스트 입력 + 저장 버튼
- 유효성 검사 통과 후에만 저장 버튼 표시
- 앱 재시작 시 저장된 키 자동 복원

### UX 개선 (2026-04-16)
- 입력창 우하단에 지우기 버튼 추가 (출력창은 건드리지 않음)
- 닫기 버튼 클릭 시 커스텀 스타일 확인 모달 표시 (네이티브 `confirm()` 대체)

---

## Pending

### Phase 1 — 미완료
- 번역 탭에서 키 준비 여부 표시
  - 키 미설정 상태에서 전송 시 에러로만 안내됨 → 컨트롤 바에 키 상태 인디케이터 추가 검토

### Phase 2 — UX 개선
- 언어 드롭다운 한국어 표시 검토
  - 방안: `prompts.json`의 `languages` 필드를 `{ value, label }` 구조로 변경
- 사용자 안내 문구 추가 (출발어=도착어 → 교정, 다르면 → 번역 자동 적용 설명)

### Phase 3 — 설정 탭 확장
- 언어쌍 관리 UI
  - `prompts.json`의 `languages` 목록을 앱 내에서 추가/삭제 가능하도록 구현
- 사용 모델 관리 UI
  - 현재 적용된 모델명 표시 및 변경 입력 필드 제공
- Max Output Tokens 관리 UI
  - 숫자 입력 필드로 `max_output_tokens` 값 조정
- 위 설정 변경 시 `prompts.json`에 즉시 반영 (IPC 경유)

### Phase 4 — 기능 확장
- 탭 3 용도 결정 (후보: 히스토리, 프롬프트 미리보기 등)
- 프롬프트 내용 검토 및 개선

---

## 참고 사항

### 현재 모델 및 설정
- 모델: `gemini-3-flash-preview` (`prompts.json`에서 변경 가능)
- location: `global` 고정 (Gemini 3.x 전용)
- thinking_level: `MINIMAL` (Flash 지원, 번역/교정 단순 작업에 적합)
- temperature: `0.1`

### JSON 키 저장 위치
- `%APPDATA%/llm-translation-app/saved-key.bin`
- Windows DPAPI로 암호화됨 — 다른 PC에서는 복호화 불가

### 기본 언어 선택
- 앱 실행 시 출발어 Korean, 도착어 English로 자동 설정됨
