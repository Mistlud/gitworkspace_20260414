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
├── main.js           # Electron 메인 프로세스, Vertex AI API 호출
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
  "model": "gemini-1.5-flash",
  "languages": ["Korean", "English", "Japanese", "Russian"],
  "translation": "번역 시 사용할 프롬프트",
  "grammar": "문법 교정 시 사용할 프롬프트"
}
```

| 필드 | 설명 |
|---|---|
| `model` | 사용할 Gemini 모델명 |
| `languages` | 드롭다운에 표시할 언어 목록 |
| `translation` | 번역 작업용 시스템 프롬프트 |
| `grammar` | 문법 교정 작업용 시스템 프롬프트 |

## 탭 구성

| 탭 | 내용 |
|---|---|
| 번역 | 언어 선택 + 텍스트 입력/결과 화면 |
| 설정 | Vertex AI JSON 키 입력 및 유효성 확인 |
| 기타 | 미정 |

## 작동 방식

- 출발어 ≠ 도착어 → **번역** 모드
- 출발어 = 도착어 → **문법 교정** 모드
- 사용자는 언어만 선택하면 모드가 자동 적용됨

## 알려진 제한사항

- **JSON 키 휘발성**: 앱 종료 시 설정 탭의 JSON 키가 초기화됨. 재실행 시 다시 입력 필요.
- **Vertex AI 리전**: `global`로 고정되어 있음.
