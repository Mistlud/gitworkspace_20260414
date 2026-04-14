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

---

## Pending

- 언어 선택 기능 세부 논의 및 구현 (예: 드롭다운 옵션 등)
- 프롬프트 내용 검토 및 개선
- 실제 Vertex AI 키로 동작 테스트
- 기타 기능 논의 예정
