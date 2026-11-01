> 보관 문서: 과거 기획·실험 기록입니다. 현재 규칙은 [프로토타입 규칙](../expedition-prototype.md)을 따릅니다.

# 생존자 엑셀 열 배치 참조

- 원본 파일: `멸망했는데_바쁨_데이터.xlsx`
- 헤더 행: `3`
- 데이터 시작 행: `4`
- 생존자 후보 시트: `V1_생존자카드`, `V1_생존자카드 재욱테스트`
- 권장 기본 시트: `V1_생존자카드`

## 주의
- 엑셀에는 정확히 "생존자"라는 시트명은 없고 V1_생존자카드 계열 시트가 존재한다.
- V1_생존자카드 재욱테스트도 같은 열 구조를 사용하지만 테스트/재배치용 데이터가 섞여 있으므로 실제 연결 전 선택이 필요하다.
- 현재 import_from_excel.py는 일부 예전 헤더 별칭을 사용하므로, 배치 보너스 등은 이 매핑을 기준으로 보강해야 한다.

## V1_생존자카드

- 데이터 행 수: `34`
- 샘플 ID: `s_weird_1`, `s_coward_1`, `s_weird_7`, `s_coward_4`, `s_coward_5`, `s_military_5`, `s_mood_twins`, `s_mood_5`

| 열 | 헤더 | 정규화 | 연결 필드 | 코드 필드 | 메모 |
|---|---|---|---|---|---|
| A(1) | ID | `ID` | `id` | `survivor.id` | 카드 고유 ID |
| B(2) | 단계 | `단계` | `tier` | `survivor.tier/searchTier` | 생존자 수색 단계 |
| C(3) | 속성 | `속성` | `type` | `survivor.type` | 생존자 타입 |
| D(4) | 이모지 | `이모지` | `emoji` | `survivor.emoji` | 임시/대표 얼굴 아이콘 |
| E(5) | 이름 | `이름` | `name` | `survivor.name` | 카드명 |
| F(6) | 점수 | `점수` | `score` | `survivor.score` | 최종 점수 |
| G(7) | 영입<br>비용 | `영입비용` | `recruitCost` | `survivor.recruitCost` | 영입 비용 |
| H(8) | 장수 | `장수` | `count` | `survivor.count` | 덱 포함 장수 |
| I(9) | 기본 기능 | `기본기능` | `effect` | `survivor.effect` | 카드 기능 문구 |
| J(10) | 캐릭터 설명 | `캐릭터설명` | `description` | `survivor.description` | 컨셉 설명 문구 |
| K(11) | 배치 보너스 | `배치보너스` | `specialBonus` | `survivor.specialBonus` | 배치/위치 보너스 문구 |
| L(12) | 겹침<br>그룹키 | `겹침그룹키` | `stackKey` | `survivor.stackKey` | 겹침 판정 그룹 키 |
| M(13) | 트리거<br>(코드) | `트리거(코드)` | `triggers` | `survivor.triggers` | 코드 트리거 존재 여부/메모 |
| N(14) | 메모 | `메모` | `memo` | `` | 기획 메모, 코드 연결 제외 |
| O(15) | 1열 | `1열` | `printColumnGroup` | `` | 인쇄/레이아웃 보조 컬럼으로 추정 |
| P(16) |  | `` | `` | `` | 빈 컬럼 또는 아직 매핑되지 않은 보조 컬럼 |

## V1_생존자카드 재욱테스트

- 데이터 행 수: `34`
- 샘플 ID: `s_weird_1`, `s_coward_twins`, `s_weird_6`, `s_weird_3`, `s_weird_5`, `s_weird_2`, `s_weird_4`, `s_coward_1`

| 열 | 헤더 | 정규화 | 연결 필드 | 코드 필드 | 메모 |
|---|---|---|---|---|---|
| A(1) | ID | `ID` | `id` | `survivor.id` | 카드 고유 ID |
| B(2) | 단계 | `단계` | `tier` | `survivor.tier/searchTier` | 생존자 수색 단계 |
| C(3) | 속성 | `속성` | `type` | `survivor.type` | 생존자 타입 |
| D(4) | 이모지 | `이모지` | `emoji` | `survivor.emoji` | 임시/대표 얼굴 아이콘 |
| E(5) | 이름 | `이름` | `name` | `survivor.name` | 카드명 |
| F(6) | 점수 | `점수` | `score` | `survivor.score` | 최종 점수 |
| G(7) | 영입<br>비용 | `영입비용` | `recruitCost` | `survivor.recruitCost` | 영입 비용 |
| H(8) | 장수 | `장수` | `count` | `survivor.count` | 덱 포함 장수 |
| I(9) | 기본 기능 | `기본기능` | `effect` | `survivor.effect` | 카드 기능 문구 |
| J(10) | 캐릭터 설명 | `캐릭터설명` | `description` | `survivor.description` | 컨셉 설명 문구 |
| K(11) | 배치 보너스 | `배치보너스` | `specialBonus` | `survivor.specialBonus` | 배치/위치 보너스 문구 |
| L(12) | 겹침<br>그룹키 | `겹침그룹키` | `stackKey` | `survivor.stackKey` | 겹침 판정 그룹 키 |
| M(13) | 트리거<br>(코드) | `트리거(코드)` | `triggers` | `survivor.triggers` | 코드 트리거 존재 여부/메모 |
| N(14) | 메모 | `메모` | `memo` | `` | 기획 메모, 코드 연결 제외 |
| O(15) | 1열 | `1열` | `printColumnGroup` | `` | 인쇄/레이아웃 보조 컬럼으로 추정 |
| P(16) |  | `` | `` | `` | 빈 컬럼 또는 아직 매핑되지 않은 보조 컬럼 |
