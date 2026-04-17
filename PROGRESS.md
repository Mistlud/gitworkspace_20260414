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

### 창 크기/위치 기억 (2026-04-16)
- 앱 종료 시 창 크기/위치를 `userData/window-state.json`에 저장
- 재시작 시 마지막 위치/크기로 복원 (저장값 없으면 기본값 900×640)
- 이동/리사이즈 이벤트 디바운스 처리 (500ms)
- 최대화/최소화 상태에서는 저장 생략

### 안정성 개선 (2026-04-16)
- API 요청 타임아웃 처리 (30초, `AbortSignal.timeout`)
  - 초과 시 "요청 시간이 초과됐습니다" 메시지로 구분 표시
- 오류 발생 시 재시도 버튼 추가
  - 에러 바 우측에 표시, 클릭 시 동일 요청 재실행
  - 성공 또는 새 요청 시작 시 자동 숨김

### 설정 탭 추가 개선 (2026-04-16)
- 프롬프트 편집 UI 추가 (번역 / 문법 교정)
  - textarea + 저장 버튼 좌우 배치
  - 저장 버튼은 textarea와 동일 세로 높이, 보라 계열 색상으로 구분
  - textarea 크기 조절 비활성화
  - 설정 탭 내 순서: JSON 키 → 모델/토큰 → 언어 목록 → 프롬프트 편집
- 설정 탭 스크롤바 스타일 적용 (4px, 다크 테마)

### 설정 탭 확장 (2026-04-16)
- 언어 목록 관리 UI 추가
  - 언어 추가 / 삭제 가능 (Korean, English는 고정 — 삭제 불가)
  - 변경 시 `prompts.json` 즉시 저장 및 번역 탭 드롭다운 동기화
- 모델 선택 UI 추가 (드롭다운)
  - Flash 선택 → `thinking_level: "MINIMAL"` 자동 적용
  - Pro 선택 → `thinking_level` 필드 제거 (API 기본값 HIGH)
- Max Output Tokens 입력 UI 추가 (범위: 256 ~ 8192)
  - `prompts.json`의 `max_output_tokens` 필드와 연동
  - `main.js` 하드코딩 제거
- `save-prompts` IPC 핸들러 추가
- 설정 탭 반응형 처리 (창 크기 변경 시 레이아웃 대응)

### 키 상태 인디케이터 (2026-04-17)
- 번역 탭 컨트롤 바에 키 상태 인디케이터 추가
  - 키 설정됨: `● 키 설정됨` (초록 배지)
  - 키 미설정: `⚠ 키 미설정` (주황 배지)
  - `updateKeyUI()` 호출 시 자동 갱신 (앱 시작, 키 저장/삭제 시)

---

## Pending

### Phase 2 — UX 개선
- 언어 드롭다운 한국어 표시 검토
  - 방안: `prompts.json`의 `languages` 필드를 `{ value, label }` 구조로 변경
- 사용자 안내 문구 추가 (출발어=도착어 → 교정, 다르면 → 번역 자동 적용 설명)

### Phase 4 — 기능 확장
- 앱 이름 결정
- 탭 3 용도 결정 (후보: 히스토리, 프롬프트 미리보기 등)
- 최초 실행 시 홈 탭 추가 (온보딩/안내 화면)
- 프롬프트 내용 검토 및 개선
- 입력/결과창 글자 크기 조절
- 창 투명도 조절
- `Ctrl+Enter` 전송 단축키
- 탭 전환 키보드 단축키

### Phase 5 — 배포
- electron-builder 설정 (포터블 ZIP 형태)
- GitHub Actions 워크플로 작성 (push 시 자동 빌드 → Releases 업로드)
- 앱 아이콘 설정

---

## 참고 사항

### 현재 모델 및 설정
- 모델: `gemini-3-flash-preview` 또는 `gemini-3.1-pro-preview` (설정 탭에서 변경)
- location: `global` 고정 (Gemini 3.x 전용)
- thinking_level: Flash → `MINIMAL` 고정 / Pro → API 기본값(HIGH)
- temperature: `0.1`
- max_output_tokens: `2048` (설정 탭에서 변경 가능)

### JSON 키 저장 위치
- `%APPDATA%/llm-translation-app/saved-key.bin`
- Windows DPAPI로 암호화됨 — 다른 PC에서는 복호화 불가

### 기본 언어 선택
- 앱 실행 시 출발어 Korean, 도착어 English로 자동 설정됨
