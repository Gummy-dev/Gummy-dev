# 공동 파견 Implementation Plan

**Goal:** 원본을 보존하면서 온라인에서 끝까지 플레이 가능한 공동 파견 실험판 제공.
**Architecture:** 기존 방 서버·접속 훅·로비·이미지 재사용, rulesVersion으로 독립 엔진과 화면 선택.
**Tech Stack:** 기존 React/Vite/Node, 추가 의존성 없음.
**Spec:** docs/expedition-prototype.md

## Global Constraints
구판 엔진과 카드 데이터 불변. PC 우선. 카드 내부 실행 버튼 금지. 서버 소유 난수·방별 권한 유지.

## Review Focus
- 다른 자리/다른 단계의 명령 거절과 입력 상태 불변
- 보상/귀환 도중 날짜 진행 및 중복 지급 방지
- 낙오·재난·덱 소진·무인 파티에서도 합법 행동 유지
- 서로 다른 rulesVersion 방의 상태·재접속 격리
- 인쇄 카드와 실행 능력 일치, 동일 앞면과 상대 소유 표시

## Tasks
- [x] src/expedition/cards.js, engine.js: 데이터·행동·해결·귀환·재난·종료·봇 및 tests/expedition.test.js.
- [x] server/rooms.js, useRoom.js: 버전 분기와 기존 방 회귀 테스트.
- [x] src/expedition/Board.jsx, expedition.css, TabletopApp/App: 새판과 버전 선택, 카드/파견/경로/재난/후속 선택.
- [x] 브라우저 2자리 플레이·재접속 및 화면 검증, npm test/build, 백업과 구판 소스 불변 검증.

사용자가 설계 반영과 실행을 승인한 범위에서 같은 세션에서 직접 구현한다.
