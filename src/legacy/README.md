# 보관판과 저장 호환

현재 규칙은 `src/expedition/`입니다.

- `expedition-v1/`: `/expedition-v1`에서 명시적으로 여는 과거 공동 파견판. 8일 제한·기본 동료 등 현재와 다른 규칙입니다.
- `RestoredBoard.jsx`, `OriginalRules.jsx`: `/original`의 원본판 화면과 설명. 원본 엔진·저장소는 기존 `src/game/restored.js`, `src/store/`를 사용합니다.
- `omens.js`: 지속 환경 사건으로 전환하기 전, 일회 대응 징조를 가진 저장 상태의 읽기·마이그레이션 호환. 새 게임 사건 정의는 `src/expedition/events.js`입니다.

화면은 `src/tabletop/editionConfig.jsx`에서 지연 로딩합니다. 새로운 현재 규칙이나 카드 설명을 이 폴더에 추가하지 않습니다. 저장 파일의 구버전 선택을 처리하는 동안에는 해당 엔진과 테스트를 함께 유지해야 합니다.
