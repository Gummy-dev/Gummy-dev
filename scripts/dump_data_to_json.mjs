/**
 * dump_data_to_json.mjs
 * JS 데이터 파일을 직접 import해서 JSON으로 출력합니다.
 * 실행: node scripts/dump_data_to_json.mjs
 * 출력: scripts/_dump_survivors.json / _dump_leaders.json / _dump_events.json
 */

import { writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { SURVIVORS } from "../src/data/survivors.js"
import { LEADERS } from "../src/data/leaders.js"
import { EVENTS } from "../src/data/events.js"
import { KEY_CARD, TREASURE_CARDS } from "../src/data/treasures.js"
import { UTOPIA_CARD_LIST } from "../src/data/utopias.js"

const __dir = dirname(fileURLToPath(import.meta.url))

function write(name, data) {
  const path = resolve(__dir, `_dump_${name}.json`)
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8")
  console.log(`  ✅ ${name}: ${data.length}개 → ${path}`)
}

console.log("📦 데이터 덤프 중...")
write("survivors", SURVIVORS)
write("leaders", LEADERS)
write("events", EVENTS)
write("treasures", [KEY_CARD, ...TREASURE_CARDS])
write("utopias", UTOPIA_CARD_LIST)
console.log("완료")
