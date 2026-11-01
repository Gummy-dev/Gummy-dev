# 멸망했는데 바쁨!

생존자 조합으로 탐색하고 유토피아를 찾아가는 2~4인 보드게임 플레이 프로토타입입니다. 현재 규칙 버전은 `expedition-v2`입니다.

```sh
npm install
npm run dev -- --host 0.0.0.0
```

터미널의 Local 주소에서 플레이합니다. 같은 Wi-Fi에서는 Network 주소를 공유하세요. 포트가 사용 중이면 Vite가 다음 포트를 안내합니다. `/`와 `/expedition`은 같은 현재판이며 `?room=방코드`로 합류합니다.

## 기준 문서

- [현재 플레이 규칙](docs/expedition-prototype.md): 낮·밤, 파견·귀환, 자원, 사건, 유토피아와 점수.
- [실행·배포](docs/tabletop-deployment.md): LAN, 방 저장과 배포 구성.
- [문서 안내](docs/README.md): 현재 문서와 과거 기획 구분.

## 코드 구성

| 경로 | 책임 |
| --- | --- |
| `src/expedition/` | 현재 카드·규칙 엔진·봇·화면·사건 |
| `src/tabletop/` | 입장·로비·버전별 연결·SSE·공통 시각 요소 |
| `src/game/types.js` | 공통 타입 이름·색상 |
| `server/` | 방·권한·서버 주사위·저장·배포 서버 |
| `src/data/`, `src/assets/` | 현재 카드가 참조하는 원본 데이터와 이미지 |
| `src/legacy/` | 이전 공동 파견판과 원본판 화면의 호환 경로 |
| `src/game/engine.js`, `restored.js`, `src/store/`, `src/components/`, `src/logic/` | 기존 보관판 구현; 현재판 규칙 변경 대상 아님 |

보관판은 명시적인 `/original`, `/expedition-v1` 주소에서만 선택합니다. 구판 화면은 지연 로딩하며 현재 화면의 규칙·초기 동료·비용에 섞지 않습니다. 현재 엔진의 이전 저장 상태 변환은 별개이며 진행 중인 방을 보존하기 위해 유지합니다.

## 확인

```sh
npm test
npm run build
```

`tests/expedition.test.js`는 현재 규칙, `tests/tabletop.test.js`는 HTTP/SSE와 턴 권한을 검사합니다. `tests/edition-routing.test.js`는 버전별 URL·자리 저장소를 검사합니다. 보관판 회귀 테스트도 기존 저장 게임의 호환을 위해 남깁니다. 과거 브라우저 시나리오는 `tests/archive/`에 분리했고 현재판 검증으로 간주하지 않습니다. 밸런스 시뮬레이션은 별도 확인 도구이며 자동 테스트 통과가 실제 30~45분 플레이의 재미를 보장하지는 않습니다.
