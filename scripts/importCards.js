/**
 * CSV → JS 데이터 변환 스크립트
 * 사용법: npm run import-cards
 *
 * 엑셀에서 각 시트를 CSV로 저장 후 아래 경로에 배치:
 *   scripts/csv/survivors.csv
 *   scripts/csv/leaders.csv
 *   scripts/csv/events.csv
 *
 * 컬럼 형식 (survivors.csv):
 *   id, name, type, score, recruitCost, effect, specialBonus, description, emoji, count
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_DIR = path.join(__dirname, 'csv')
const DATA_DIR = path.join(__dirname, '../src/data')

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  파일 없음: ${filePath}`)
    return []
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().replace(/\r/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/\r/g, ''))
    const obj = {}
    headers.forEach((h, i) => {
      const v = values[i] ?? ''
      // 숫자형 컬럼 자동 변환
      obj[h] = isNaN(v) || v === '' ? v : Number(v)
    })
    return obj
  })
}

function writeSurvivors() {
  const rows = parseCSV(path.join(CSV_DIR, 'survivors.csv'))
  if (rows.length === 0) return

  const output = `// 자동 생성된 파일 — importCards.js 로 생성됨
// 직접 수정하지 마세요. CSV를 수정 후 npm run import-cards 실행
import { AFFINITY_MATRIX, LEADER_ADJACENCY_BONUS } from './survivors.js'

export const SURVIVORS_IMPORTED = ${JSON.stringify(rows, null, 2)}
`
  fs.writeFileSync(path.join(DATA_DIR, 'survivors_imported.js'), output)
  console.log(`✅ survivors: ${rows.length}장 변환 완료`)
}

function writeLeaders() {
  const rows = parseCSV(path.join(CSV_DIR, 'leaders.csv'))
  if (rows.length === 0) return

  const output = `// 자동 생성된 파일 — importCards.js 로 생성됨
export const LEADERS_IMPORTED = ${JSON.stringify(rows, null, 2)}
`
  fs.writeFileSync(path.join(DATA_DIR, 'leaders_imported.js'), output)
  console.log(`✅ leaders: ${rows.length}명 변환 완료`)
}

function writeEvents() {
  const rows = parseCSV(path.join(CSV_DIR, 'events.csv'))
  if (rows.length === 0) return

  const output = `// 자동 생성된 파일 — importCards.js 로 생성됨
export const EVENTS_IMPORTED = ${JSON.stringify(rows, null, 2)}
`
  fs.writeFileSync(path.join(DATA_DIR, 'events_imported.js'), output)
  console.log(`✅ events: ${rows.length}장 변환 완료`)
}

// csv 폴더 없으면 생성 + 샘플 헤더 CSV 출력
if (!fs.existsSync(CSV_DIR)) {
  fs.mkdirSync(CSV_DIR)
  fs.writeFileSync(
    path.join(CSV_DIR, 'survivors.csv'),
    'id,name,type,score,recruitCost,effect,specialBonus,description,emoji,count\n'
  )
  fs.writeFileSync(
    path.join(CSV_DIR, 'leaders.csv'),
    'id,name,fullName,type,score,initialBottleCap,initialCan,actionCount,uniqueSkillName,uniqueSkillDesc,description,emoji\n'
  )
  fs.writeFileSync(
    path.join(CSV_DIR, 'events.csv'),
    'id,name,scope,description,targetScore,rewardType,rewardAmount,effect,emoji\n'
  )
  console.log('📁 scripts/csv/ 폴더와 샘플 CSV 헤더를 생성했습니다.')
  console.log('   엑셀 → 다른 이름으로 저장 → CSV → 해당 폴더에 덮어쓰기')
}

writeSurvivors()
writeLeaders()
writeEvents()

console.log('\n🎮 완료! npm run dev 로 반영을 확인하세요.')
