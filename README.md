# LLM Translation & Grammar Correction

Google Vertex AI를 활용한 번역 및 문법 교정 데스크톱 앱.

## 실행 방법

```bash
npm install
npm start
```

## 파일 구조

```
gitworkspace_20260414/
├── main.js           # Electron 메인 프로세스, Vertex AI API 호출, IPC 핸들러
├── preload.js        # 메인-렌더러 간 보안 브릿지 (IPC)
├── prompts.json      # 관리자 설정 파일
├── renderer/
│   ├── index.html    # UI 구조
│   ├── style.css     # 스타일
│   └── renderer.js   # UI 로직
├── PLAN.md           # 초기 설계 문서
└── PROGRESS.md       # 진행 상황 및 참고 사항
```

## prompts.json 설정 가이드

관리자가 코드 수정 없이 아래 항목을 변경할 수 있다.

```json
{
  "model": "gemini-3-flash-preview",
  "thinking_level": "MINIMAL",
  "temperature": 0.1,
  "max_output_tokens": 2048,
  "languages": ["Korean", "English", "Japanese", "Russian", "French"],
  "translation": "번역 시 사용할 프롬프트",
  "grammar": "문법 교정 시 사용할 프롬프트"
}
```

| 필드 | 설명 |
|---|---|
| `model` | 사용할 Gemini 모델명 |
| `thinking_level` | Gemini thinking 수준 — Flash: `MINIMAL` 고정 / Pro: 생략(API 기본값 HIGH) |
| `temperature` | 생성 온도 (0.0 ~ 1.0) |
| `max_output_tokens` | 최대 출력 토큰 수 (256 ~ 8192) |
| `languages` | 드롭다운에 표시할 언어 목록 (Korean, English는 고정) |
| `translation` | 번역 작업용 시스템 프롬프트 |
| `grammar` | 문법 교정 작업용 시스템 프롬프트 |

## 탭 구성

| 탭 | 내용 |
|---|---|
| 번역 | 언어 선택 + 텍스트 입력/결과 화면 |
| 설정 | JSON 키 / 모델 / Max Output Tokens / 언어 목록 / 프롬프트 편집 |
| 기타 | 미정 |

## 작동 방식

- 출발어 ≠ 도착어 → **번역** 모드
- 출발어 = 도착어 → **문법 교정** 모드
- 사용자는 언어만 선택하면 모드가 자동 적용됨

## JSON 키 저장

- 설정 탭에서 입력한 JSON 키는 `electron.safeStorage`로 암호화하여 영구 저장됨
- 저장 위치: `%APPDATA%/llm-translation-app/saved-key.bin`
- Windows DPAPI 기반 암호화 — 다른 PC에서는 복호화 불가
- 앱 재시작 시 저장된 키 자동 복원

## 오류 처리

- API 요청은 **30초 타임아웃** 적용 — 초과 시 안내 메시지 표시
- 오류 발생 시 에러 바 우측에 **재시도 버튼** 표시

## 알려진 제한사항

- **Vertex AI 리전**: `global`로 고정되어 있음 (Gemini 3.x 전용).
