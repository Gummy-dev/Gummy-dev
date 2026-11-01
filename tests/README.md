# 검사 범위

`npm test`는 최상위 `*.test.js`를 실행합니다. 현재판은 `expedition.test.js`, 공통 데이터는 `current-data.test.js`, 온라인 권한·동기화는 `tabletop.test.js`, 진입 경로는 `edition-routing.test.js`가 담당합니다.

`expedition-v1.test.js`와 `restored.test.js`는 보관판과 기존 방 호환의 회귀 검사입니다.

`archive/`는 과거 브라우저 검증 시나리오입니다. 일회 대응 재난·동료 안전 탐색·옛 귀환·교대 턴 등의 픽스처가 남아 있어 현재판 자동 검증으로 실행하지 않습니다. 사용 전 현재 엔진·문구·선택자로 갱신해야 합니다. 현재판의 화면 검증 결과는 실제 수행 범위만 작업 보고에 남깁니다.
