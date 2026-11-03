# Android APK 제작 준비 및 검토 사항

작성일: 2026-10-12

기준 프로젝트: LLMTransTool v0.9.5

상태: 검토 자료 — 구현 방식, 기능 범위, 인증 및 배포 방식 모두 미결정

## 1. 문서 목적과 현재 상태

이 문서는 Android 이식을 시작할 때 필요한 준비 사항과 선택지를 정리한다. 특정 기술이나 기능을 채택하는 개발 계획이 아니며, 구현 착수·설치·키 생성·APK 빌드를 승인한 문서도 아니다. 앞선 대화에서 언급한 Capacitor 역시 검토 후보로만 남긴다.

- 기존 Windows 앱은 사용자가 정상 동작을 확인했다. Android 준비를 이유로 기본 기능 전체를 다시 검증하는 것을 전제로 하지 않는다.
- 현재 앱은 Electron이며 `npm run build`는 Windows x64 ZIP을 만든다. APK 빌드 설정은 없다.
- Electron의 공식 지원 플랫폼은 Windows·macOS·Linux이다. Android에서는 실행 환경과 OS 연결 부분을 이식해야 한다. [Electron 지원 플랫폼](https://github.com/electron/electron#platform-support)
- 작성일의 로컬 정리에서 개발 의존성은 `bak/node_modules`, 이전 배포본은 `bak/dist`, 과거 설계 문서는 `bak/docs`에 보관했다. 2026-11-03 Windows 개발을 위해 의존성을 프로젝트 루트의 `node_modules`로 복원했다.
- Android Studio·SDK·JDK·에뮬레이터의 현재 PC 설치 상태는 확인하지 않았다.
- 이 문서 작성 과정에서 앱 소스·의존성·빌드 설정을 변경하거나 백업을 복원하지 않았다.

현 구조의 근거는 [package.json](package.json), [main.js](main.js), [preload.js](preload.js), [renderer/renderer.js](renderer/renderer.js), [README.md](README.md)이며, 정리 상태는 [실용 점검 보고서](PRACTICAL_AUDIT.md)를 참고한다.

## 2. 재사용과 이식이 필요한 부분

| 현재 구성 | Android에서 검토할 작업 | 판단 상태 |
|---|---|---|
| `renderer/index.html`, `style.css` | 웹 화면 방식이면 재사용 가능. 작은 화면·터치·키보드에 맞게 조정 | 재사용 범위 미결정 |
| renderer의 비교·문자 수·예상 토큰 계산 | 웹 방식이면 로직 재사용 가능. Android WebView의 API 호환성과 성능 확인 | Android 동작 미검증 |
| 결과→비교, 이력→다시 편집 | 작업 흐름을 유지할지 정하고 UI 연결을 이식 | 기능 유지 여부 미결정 |
| `preload.js`의 `window.api` | Electron IPC 대신 Android 연결 계층 마련 | 연결 방식 미결정 |
| `main.js`의 Provider 분기·API 요청 | 요청 형식은 참고 가능. Node/Electron 의존 인증·저장·통신 코드는 교체 | 통신 위치·라이브러리 미결정 |
| `google-auth-library`의 Vertex 인증 | 현재 Node용 인증을 그대로 WebView에 넣지 않고 모바일 인증 경로 설계 | 인증 방식 미결정 |
| `safeStorage`로 암호화한 키 파일 | Android용 암호화 저장 설계. Windows의 기존 암호화 파일을 그대로 이전할 수 없음 | 저장 방식 미결정 |
| `app-config.json`, `prompts.json` | 기본값과 편집값을 분리하고 변경값은 앱의 쓰기 가능한 저장소에 보관 | 저장·복원 정책 미결정 |
| 최근 10건의 메모리 이력 | 현재처럼 종료 시 초기화할지, 선택형 보존을 제공할지 결정 | 보존 여부 미결정 |
| 항상 위 고정·창 투명도·위치/크기 기억 | 데스크톱 전용 기능의 제외·대체 여부 검토 | 제외도 아직 결정하지 않음 |
| `Ctrl+Enter`, 복사, 종료 확인 | 터치 동작·Android 뒤로 가기·클립보드·앱 생명주기에 맞게 조정 | UX 미결정 |

재사용 가능하다는 판단은 현재 코드 구조를 기준으로 한다. Android에서 그대로 동작하거나 기존 화면만 포장하면 충분하다는 의미는 아니다.

## 3. 구현 방식 선택지

아래 비교는 현 프로젝트를 기준으로 한 정성적 판단이다. 작업 기간·비용·APK 크기는 아직 산정하지 않았다. 어느 방식도 채택하지 않았다.

| 후보 | 기존 자산 활용 | 추가 준비 / 특성 |
|---|---|---|
| Capacitor + 기존 웹 UI | HTML/CSS/JS 및 비교 로직을 활용할 수 있음 | Android 프로젝트, 플러그인 또는 네이티브 연결 계층, 모바일 UI 조정 필요 |
| Kotlin + Android WebView | 기존 웹 UI와 JS를 활용할 수 있음 | WebView 구성·JS 연결·저장·통신·생명주기를 직접 설계하고 관리 |
| Kotlin + Jetpack Compose | 기능 사양·프롬프트·요청 구조를 참고 | 화면을 Android 네이티브 UI로 다시 작성하며 JS 로직도 이식 검토 |

Capacitor는 기존 웹 프로젝트에 추가할 수 있으며, 웹 자산 디렉토리와 그 안의 `index.html` 등이 필요하다. [Capacitor 설치 문서](https://capacitorjs.com/docs/getting-started)

Android WebView는 웹 화면과 네이티브 코드 연결을 제공한다. 연결 API를 노출할 페이지와 외부 링크 처리를 함께 설계해야 한다. [Android WebView 문서](https://developer.android.com/develop/ui/views/layout/webapps/webview)

Compose는 Android 네이티브 UI 작성 후보이다. [Jetpack Compose 문서](https://developer.android.com/compose)

Windows와 Android의 공통 로직을 어디에 둘지, 같은 저장소에 Android 프로젝트를 추가할지, 별도 프로젝트로 분리할지도 미결정이다.

## 4. API 연결과 인증 선택지

### OpenAI 호환 API

현재 Endpoint·모델·API 키 프로필 구조를 모바일에 이식하는 것은 검토 가능하다. 키 입력 주체와 보관 방식, 통신이 앱에서 직접 이루어질지 서버를 통할지 결정해야 한다.

- 웹 요청을 사용하면 대상 Endpoint의 CORS 정책을 확인한다.
- 네이티브 HTTP 요청을 사용하면 해당 라이브러리의 오류·타임아웃·취소 처리와 응답 형식을 확인한다. Capacitor에는 네이티브 HTTP 기능이 있다. [Capacitor HTTP 문서](https://capacitorjs.com/docs/apis/http)
- 로컬 Ollama 등의 프로필도 지원한다면 PC 주소, 같은 네트워크 접근, HTTP 연결 허용 범위를 검토한다. 휴대전화의 `localhost`는 PC를 가리키지 않는다.
- 개발자 공통 API 키를 앱에 넣을지, 사용자가 자신의 키를 입력할지 등 운영 정책도 미결정이다. 공통 비밀키의 APK 내장은 피하고 필요한 경우 서버 보관 구조를 검토한다.

### Vertex AI

Vertex 지원 유지 여부와 인증 방식은 별도 결정 항목이다. Google은 클라이언트 앱에서 서비스 계정 대신 사용자 자격증명 등을 활용하고, 서비스 계정 키를 바이너리에 내장하지 않도록 안내한다. [Google 서비스 계정 키 관리 지침](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)

| 검토 방향 | 준비 사항 / 판단 기준 |
|---|---|
| 사용자 OAuth 기반 인증 | 로그인·토큰 갱신·프로젝트 권한·Vertex 호출 권한 설계 및 실제 대상 계정 검증 |
| 서버에서 Vertex 요청 처리 | 서버 인증, 사용자 접근 통제, 비용 관리, 배포·운영 준비. 서버 실행 환경의 인증 방식 검토 |
| 개인용 키 직접 등록 흐름 유지 | 현재 UX를 유지할 수 있는지 모바일 토큰 발급·암호화 보관 구현을 조사. 공식 지침과의 차이 및 개인 사용 범위 확인 필요 |
| 초기 Android 버전에서 Vertex 미포함 | 기능 축소를 수용할지 판단. 현재는 제외를 결정하지 않음 |

서버는 모든 구현 방식에서 필수인 것으로 확정하지 않는다. 서버 사용 여부는 인증·사용 대상·배포 방식에 따라 결정한다. 위 선택지의 권한 설정과 실행 가능성은 아직 검증하지 않았다.

## 5. 설정·키·이력 저장 준비

- 비민감 설정과 API 키·토큰의 저장 경로를 분리한다.
- Android Keystore에 암호화 키를 보관하고, 그 키로 API 키 등의 저장 데이터를 암호화하는 구성을 검토한다. Keystore를 임의 문자열 저장소로 간주하지 않는다. [Android Keystore 문서](https://developer.android.com/privacy-and-security/keystore)
- APK에 포함된 기본 프롬프트와 사용자가 편집한 프롬프트를 구분한다. 쓰기 가능한 앱 전용 저장소, 기본값 복원, 설정 변경 실패 처리, 버전 변경 시 마이그레이션을 검토한다.
- Windows 암호화 키 파일의 직접 복사는 지원 가능하다고 가정하지 않는다. 설정 이동을 제공할 경우 비민감 정보 이전과 키 재입력 절차를 구분한다.
- 이력 보존·최대 건수·사용자 삭제·앱 재시작 시 복원 여부를 결정한다. 현재 Windows의 메모리 이력을 Android에서도 그대로 유지하는 선택지도 열어 둔다.
- Android 자동 백업, 앱 재설치, 암호화 키 소실 후 복구 또는 재입력 동작을 확인한다.
- 실용 점검에서 발견한 사용자 입력의 HTML 삽입과 설정 실패 안내 부족은 이식 시 별도 수정 후보이다. 기능 삭제나 수정 착수는 아직 결정하지 않았다.

## 6. 개발·빌드 환경 준비

| 준비 항목 | 확인할 내용 | 현재 상태 |
|---|---|---|
| 개발 환경 | 선택한 방식과 호환되는 Android Studio·SDK·Build Tools·JDK·Gradle | 설치·호환성 미확인 |
| Node.js / npm | 웹 방식 채택 시 필요한 버전과 의존성 | 채택 방식·버전 미결정 |
| Android 기기 또는 에뮬레이터 | 지원할 OS 버전, 화면 크기, WebView 버전, 실기기 연결 | 대상 미결정 |
| 앱 식별 정보 | 앱 이름, package ID/applicationId, 아이콘, 버전 번호 | 미결정 |
| 네트워크 설정 | INTERNET 권한, HTTPS 기본 사용, 로컬 HTTP 지원 여부와 범위 | 미결정 |
| 서명 | 릴리스 서명키, 보관 위치, 비밀번호 관리, 업데이트 전략 | 미결정, 생성하지 않음 |
| 빌드 산출물 | 테스트 APK, 서명된 릴리스 APK, 필요한 경우 AAB | 생성하지 않음 |

Capacitor 8을 선택하는 경우 작성일 공식 문서의 기준은 Node.js 22 이상, Android Studio 2025.2.1 이상 및 Android SDK이다. Android Studio는 적절한 JDK를 제공한다. 이는 후보별 참고 요구사항이며 도입 버전을 확정하는 것이 아니다. 실제 시작 시 플러그인·SDK·Gradle까지 호환되는 조합을 확인한다. [Capacitor 환경 요구사항](https://capacitorjs.com/docs/getting-started/environment-setup)

Windows 앱의 기존 의존성은 2026-11-03 `bak/node_modules`에서 프로젝트 루트의 `node_modules`로 복원했으며, `npm start`로 Windows 앱을 실행했다. 이를 그대로 Android 의존성으로 간주하지 않는다. Android용 의존성 설치는 프레임워크 선택 후 별도로 검토한다.

## 7. 모바일 UX 및 검증 준비

기존 Windows의 확인된 기본 흐름을 반복하는 것보다 이식으로 달라지는 부분에 집중한다.

- 작은 화면에서 번역 입력/결과와 비교 패널의 세로 배치 또는 전환 방식.
- 설정·프로필 편집의 터치 크기, 화면 키보드, 시스템 바와 화면 여백, 긴 텍스트 스크롤.
- 뒤로 가기 동작, 복사·붙여넣기, 파일 선택, 키 입력, 외부 링크 처리.
- 화면 회전·백그라운드 이동·프로세스 종료 이후 입력 및 설정 상태.
- 요청 중 화면 전환, 네트워크 변경, 타임아웃, 중복 전송과 응답 도착 순서.
- 한글·이모지, 비교 옵션, 20,000자 경계 및 긴 비교 작업의 실기기 성능.
- 설치·설정 저장·재시작·업데이트 후 설정 유지·키 복호화 실패 안내.

검증 범위와 담당은 구현 범위 결정 후 정한다. 실제 API 호출과 별개로 요청 구성 및 실패 처리는 모의 응답으로 확인할 수 있다. Android에서 아직 검증된 기능은 없다.

## 8. 배포와 서명 준비

| 선택지 | 준비할 내용 | 상태 |
|---|---|---|
| 개인 기기에 APK 직접 설치 | 설치 가능한 APK, 서명 및 업데이트용 키 보관, 실제 기기 설치 확인 | 미결정 |
| 제한된 대상에 APK 전달 | 릴리스 서명, 버전·업데이트 전달 방식, 키 입력·설정 안내 | 미결정 |
| Google Play 배포 | AAB, Play Console, 서명·스토어 정책·대상 SDK 등 출시 시점 요구사항 확인 | 미결정 |

직접 배포하는 앱의 업데이트에는 서명키 연속성이 중요하다. 릴리스 키·비밀번호는 저장소와 분리해 보관하는 구성을 준비한다. API 저장용 Keystore와 APK 서명키는 역할이 다르다. [Android 앱 서명 문서](https://developer.android.com/studio/publish/app-signing)

Google Play 신규 앱은 AAB로 등록하는 것이 요구된다. APK 직접 배포 여부와 Play 등록 여부는 아직 선택하지 않았다. [Android App Bundle 문서](https://developer.android.com/guide/app-bundle)

## 9. 미결정 항목 목록

| ID | 결정 항목 | 선택지 / 정할 내용 | 상태 |
|---|---|---|---|
| D01 | 사용 대상 | 개인용 / 제한된 사용자 / 일반 배포 | 미결정 |
| D02 | 실행 구조 | 휴대전화에서 직접 처리 / 서버 경유 / PC 연동 | 미결정 |
| D03 | UI·실행 기술 | Capacitor / 직접 WebView / Compose 등 | 미결정 |
| D04 | 첫 버전 기능 | 번역·교정·비교·이력·설정의 포함 범위 | 미결정 |
| D05 | Provider | OpenAI 호환·Vertex 각각의 포함 여부 | 미결정 |
| D06 | Vertex 인증 | 사용자 인증 / 서버 처리 / 개인용 직접 등록 조사 등 | 미결정 |
| D07 | 키 소유·운영 | 사용자 자신의 키 / 서비스 제공자가 운영하는 인증·비용 구조 | 미결정 |
| D08 | 설정·이력 정책 | 저장·이전·백업·복원·삭제·보존 범위 | 미결정 |
| D09 | 모바일 화면 | 패널 배치·탭 이동·뒤로 가기·데스크톱 기능 대체 | 미결정 |
| D10 | 지원 기기 | 최소 Android 버전·휴대전화/태블릿·화면 방향 | 미결정 |
| D11 | 프로젝트 관리 | 같은 저장소 / 별도 저장소, Windows와 공유할 코드 범위 | 미결정 |
| D12 | 배포 정보 | 앱 이름·ID·아이콘·서명키·APK/AAB·업데이트 방식 | 미결정 |

## 10. 결정 후 진행 가능한 작업 순서

다음은 향후 실행 순서의 초안이며 현재 승인·착수된 작업이 아니다.

1. 사용 대상·기능·Provider·인증 범위 기록 → 첫 Android 버전의 포함/제외 범위.
2. 구현 방식과 코드 공유 구조 선택 → 필요한 연결 계층 및 변경 파일 목록.
3. 설치 상태 확인 및 개발 환경 준비 → 호환 버전과 빌드 경로 확인.
4. 화면·설정 저장·API 연결을 최소 범위로 이식 → 선택한 기능의 테스트 APK.
5. Android에서 달라진 경로를 검증 → 실제 확인 결과와 미확인 경계 정리.
6. 배포 방식과 서명 설정 준비 → 해당하는 릴리스 APK/AAB 및 업데이트 안내.

일정·비용·APK 용량은 범위와 기술 선택 후 추정한다. 이 문서만으로 추가 패키지 설치, Android 프로젝트 생성, 인증키 생성, 코드 수정, 릴리스 발행을 시작하지 않는다.
