# LLM Translation & Grammar Correction

## 텍스트 비교

`비교` 탭에서 두 원문을 좌우에 입력한 뒤 차이점과 공통 부분을 확인할 수 있습니다. 이 기능은 로컬에서만 동작하며, 비교 텍스트를 LLM API로 전송하거나 디스크에 저장하지 않습니다.

- 왼쪽 전용 차이와 오른쪽 전용 차이를 각각 색으로 표시
- 각 원문의 정확한 글자 수와 `예상 토큰` 수, 비교 후 글자·토큰 차이 표시
- 공백·대소문자·줄바꿈을 무시하는 비교 옵션(토글 스위치)
- 좌우 원문 교체, 각 원문 개별 복사, 초기화
- 이전/다음 차이 탐색 및 `Ctrl+Enter` 비교 단축키
- 성능 보호를 위해 원문당 최대 20,000자 입력 지원

Google Vertex AI(Gemini) 및 OpenAI 호환 API(OpenAI, OpenRouter, Ollama 등)를 활용한 번역 및 문법 교정 데스크톱 앱.

## 다운로드

[최신 버전 릴리즈](https://github.com/Mistlud/gitworkspace_20260414/releases/latest)에서 `LLMTransTool-*-win.zip`을 받아 압축 해제 후 실행하세요. 현재 릴리즈 버전은 `v0.9.4`입니다.

## 개발 환경 실행

```bash
npm install
npm start
```

## 빌드

```bash
npm run build
# dist/ 폴더에 win.zip 생성
```

## 파일 구조

```
gitworkspace_20260414/
├── main.js           # Electron 메인 프로세스, API 호출 및 분기, IPC 핸들러
├── preload.js        # 메인-렌더러 간 보안 브릿지 (IPC)
├── prompts.json      # 관리자 설정 파일 (프롬프트, 모델 등)
├── renderer/
│   ├── index.html    # UI 구조
│   ├── style.css     # 스타일
│   └── renderer.js   # UI 로직
├── PLAN.md           # 초기 설계 문서
├── SubPLAN.md        # OpenAI Compatible 추가 설계 문서
├── SubPLAN_260909.md # Vertex 모델 목록 및 Thinking Level 확장 계획
└── PROGRESS.md       # 진행 상황 및 참고 사항
```

## 탭 구성

| 탭 | 내용 |
|---|---|
| 홈 | 앱 설명 / Provider별 등록 방법 / 번역·교정 모드 안내 / 기타 기능 안내 / 선택된 API 상태 및 인증 안내 |
| 번역 | 모드 토글 + 도착어 선택 + API 상태 인디케이터 + 텍스트 입력/결과 화면 |
| 이력 | 번역·교정 이력 목록 (최대 10건, 앱 종료 시 초기화) + 입력/결과 뷰 + 결과 복사 버튼 |
| 기타 | 미정 |
| 설정 | API Provider 선택 / Vertex AI JSON 키 / Vertex 모델 목록 / Thinking Level / OpenAI 호환 프로필 목록 / 온도 / 언어 목록 / 프롬프트 편집 |

## 작동 방식

- 번역 탭 상단 토글 버튼으로 **번역 / 교정** 모드를 명시적으로 전환
- 번역 모드: 도착어 드롭다운 표시, `Target language`를 user message에 포함
- 교정 모드: 도착어 드롭다운 숨김, 언어 힌트 없이 텍스트만 전달 (모델이 언어 자동 감지)

## API Provider 연동 및 설정

### A. Google Vertex AI
- **인증**: 서비스 계정 JSON 키 파일을 불러오거나 직접 텍스트로 붙여넣어 등록합니다.
- **저장 파일**: `%APPDATA%/llm-translation-app/saved-key.bin` (안전하게 암호화되어 저장됨)
- **모델 설정**: 설정 탭에서 Vertex 모델명을 등록·삭제하고, 등록 목록에서 요청에 사용할 모델을 선택합니다.
- **생성 설정**: Thinking Level을 `MINIMAL`/`LOW`/`HIGH`로 지정하거나 생략하여 Vertex API 기본 동작을 사용할 수 있습니다. Max Output Tokens는 Vertex AI 요청에만 적용됩니다.

### B. OpenAI Compatible (다중 프로필 지원)
- **여러 프로필 관리**: 여러 엔드포인트와 모델 정보를 프로필 목록으로 만들어 저장할 수 있습니다.
- **인증**: 프로필마다 API 키를 개별 등록하며, 각 키는 `%APPDATA%/llm-translation-app/custom-key-{id}.bin` 파일로 암호화하여 저장됩니다.
- **활성화**: 프로필 목록 중 하나를 클릭하여 즉시 활성 프로필로 지정할 수 있습니다.

### C. 설정 파일
- `%APPDATA%/llm-translation-app/app-config.json`에 현재 선택된 `provider`, `activeProfileId`, 그리고 생성된 `profiles` 목록(비민감 정보)이 저장됩니다.

### 설정 순서
1. 설정 탭에서 사용할 API Provider를 선택합니다.
2. Vertex AI는 서비스 계정 JSON 키를 등록합니다.
3. OpenAI Compatible은 이름, Endpoint, 모델, API Key로 프로필을 등록하고 해당 프로필을 활성화합니다.
4. 번역 탭에서 번역 또는 교정 모드를 선택합니다. 도착어 선택은 번역 모드에서만 필요합니다.

## 컨트롤 바

번역 탭 상단 컨트롤 바에 아래 요소가 표시됨:

| 요소 | 설명 |
|---|---|
| 모드 토글 버튼 | 클릭할 때마다 번역 / 교정 전환 |
| 도착언어 드롭다운 | 번역 모드에서만 표시 |
| API 상태 인디케이터 | 선택된 API 및 현재 활성화된 프로필 상태 실시간 표시 (`● Vertex AI` 또는 `● 프로필명 — 모델명`) |
| 전송 버튼 | API 요청 실행 |

## prompts.json 설정 가이드

관리자가 코드 수정 없이 아래 항목을 기본값으로 변경할 수 있다.

```json
{
  "model": "gemini-3-flash-preview",
  "vertexModels": ["gemini-3-flash-preview", "gemini-3.1-pro-preview"],
  "thinking_level": "MINIMAL",
  "temperature": 0.1,
  "max_output_tokens": 2048,
  "languages": ["Korean", "English", "Japanese", "Russian"],
  "translation": "번역 시 사용할 프롬프트",
  "grammar": "문법 교정 시 사용할 프롬프트"
}
```

| 필드 | 설명 |
|---|---|
| `model` | 사용할 Gemini 모델명 (Vertex AI 선택 시에만 적용) |
| `vertexModels` | 설정 탭의 Vertex 모델 드롭다운에 표시할 등록 모델 목록 |
| `thinking_level` | Vertex AI Thinking Level. `MINIMAL`/`LOW`/`HIGH` 중 하나이며, 필드가 없으면 `thinking_config`를 보내지 않고 API 기본값을 사용 |
| `temperature` | 생성 온도 (설정 탭에서 저장하지 않고 비워두면 요청 시 파라미터가 생략됨) |
| `max_output_tokens` | 최대 출력 토큰 수 (Vertex AI에 적용, 설정 탭에서도 변경 가능) |
| `languages` | 드롭다운에 표시할 언어 목록 (Korean, English는 고정) |
| `translation` | 번역 작업용 시스템 프롬프트 |
| `grammar` | 문법 교정 작업용 시스템 프롬프트 |

설정 탭에서 Vertex 모델 목록, 선택 모델, Thinking Level, 온도, 언어 목록, 프롬프트를 UI로 직접 변경할 수 있으며 `prompts.json`에 즉시 반영됩니다. Thinking Level은 `MINIMAL`/`LOW`/`HIGH`를 선택하거나 `API 기본값 사용 (생략)`으로 설정할 수 있습니다.

## 사이드바 하단 버튼

| 버튼 | 기능 |
|---|---|
| `📌` | 창 항상 위 고정 토글 (활성 시 파란색) |
| `🔆` | 투명도 슬라이더 팝오버 열기 (20~100%, 실시간 반영) |
| `✕` | 앱 종료 확인 모달 표시 |

## 뒤집기 버튼

번역 탭 두 패널 사이의 `⇐` 버튼을 누르면 결과창 텍스트를 입력창으로 옮긴다. 결과를 수정하거나 재번역할 때 사용한다. 결과창이 비어 있으면 동작하지 않는다.

## 단축키

| 단축키 | 동작 |
|---|---|
| `Ctrl+Enter` | 전송 확인 모달 표시 (모달에서 Enter → 바로 전송) |

## 창 상태 기억

- 앱 종료 시 창 크기/위치/투명도를 `userData/window-state.json`에 저장
- 재시작 시 마지막 상태로 복원 (기본값 900×640, 투명도 100%)

## 오류 처리 및 예외 복구

- API 요청은 **30초 타임아웃** 적용 — 초과 시 안내 메시지 표시
- 오류 발생 시 에러 바 우측에 **재시도 버튼** 표시
- 이력 탭에서 이력이 많이 쌓여도 영역이 찌그러지지 않고 스크롤바가 정상 생성되도록 레이아웃 안정화 완료

## 알려진 제한사항

- **리전 고정**: Google Vertex AI 리전은 `global`로 고정되어 있습니다. (Gemini 3.x 전용)
- **로컬 보안 암호화**: Vertex AI JSON 키 및 OpenAI호환 API 키는 Windows DPAPI로 로컬 PC에서만 암호화/복호화됩니다. 해당 바이너리 파일을 타 PC에 복사할 경우 호환되지 않아 키를 재입력해야 합니다.
- **Azure OpenAI 미지원**: 현재 일반 OpenAI 규격 엔드포인트 URL 구조만 지원하여 Azure OpenAI의 전용 호출 파라미터 구조는 지원하지 않습니다.
- **최대 출력 토큰 제한**: OpenAI 호환 API 사용 시에는 설정 탭의 `Max Output Tokens` 파라미터가 요청 body에서 생략되어 적용되지 않습니다. (모델 기본 값에 의존)
