import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const OUT_DIR = 'src/assets/personal-icons'
const SURVIVOR_OUT_DIR = join(OUT_DIR, 'survivors')
const SIZE = 128

function crc32(buf) {
  let crc = -1
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function createCanvas(size = SIZE) {
  const data = new Uint8Array(size * size * 4)

  function blendPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const idx = (y * size + x) * 4
    const alpha = color[3] / 255
    const inv = 1 - alpha
    data[idx] = Math.round(color[0] * alpha + data[idx] * inv)
    data[idx + 1] = Math.round(color[1] * alpha + data[idx + 1] * inv)
    data[idx + 2] = Math.round(color[2] * alpha + data[idx + 2] * inv)
    data[idx + 3] = Math.min(255, Math.round(color[3] + data[idx + 3] * inv))
  }

  function circle(cx, cy, r, color) {
    const minX = Math.floor(cx - r)
    const maxX = Math.ceil(cx + r)
    const minY = Math.floor(cy - r)
    const maxY = Math.ceil(cy + r)
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - cx
        const dy = y + 0.5 - cy
        if (dx * dx + dy * dy <= r * r) blendPixel(x, y, color)
      }
    }
  }

  function rect(x, y, w, h, color) {
    for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy += 1) {
      for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx += 1) blendPixel(xx, yy, color)
    }
  }

  function line(x1, y1, x2, y2, width, color) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 2)
    for (let i = 0; i <= steps; i += 1) {
      const t = steps === 0 ? 0 : i / steps
      circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color)
    }
  }

  function polygon(points, color) {
    const minY = Math.floor(Math.min(...points.map((p) => p[1])))
    const maxY = Math.ceil(Math.max(...points.map((p) => p[1])))
    for (let y = minY; y <= maxY; y += 1) {
      const nodes = []
      let j = points.length - 1
      for (let i = 0; i < points.length; i += 1) {
        const pi = points[i]
        const pj = points[j]
        if ((pi[1] < y && pj[1] >= y) || (pj[1] < y && pi[1] >= y)) {
          nodes.push(pi[0] + ((y - pi[1]) / (pj[1] - pi[1])) * (pj[0] - pi[0]))
        }
        j = i
      }
      nodes.sort((a, b) => a - b)
      for (let k = 0; k < nodes.length; k += 2) {
        for (let x = Math.floor(nodes[k]); x < Math.ceil(nodes[k + 1] ?? nodes[k]); x += 1) blendPixel(x, y, color)
      }
    }
  }

  function png() {
    const raw = Buffer.alloc((size * 4 + 1) * size)
    for (let y = 0; y < size; y += 1) {
      const rowStart = y * (size * 4 + 1)
      raw[rowStart] = 0
      raw.set(data.subarray(y * size * 4, (y + 1) * size * 4), rowStart + 1)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(size, 0)
    ihdr.writeUInt32BE(size, 4)
    ihdr[8] = 8
    ihdr[9] = 6
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }

  return { circle, rect, line, polygon, png }
}

const COLORS = {
  can: [239, 68, 68, 255],
  cap: [245, 158, 11, 255],
  neutral: [156, 163, 175, 255],
  survivor: [45, 212, 191, 255],
  shadow: [17, 24, 39, 180],
}

const icons = {
  'can.png': (c) => {
    c.rect(26, 5, 76, 118, COLORS.can)
    c.rect(18, 14, 92, 14, [248, 113, 113, 255])
    c.rect(18, 100, 92, 14, [185, 28, 28, 255])
    c.rect(41, 43, 46, 40, [254, 202, 202, 255])
    c.line(35, 6, 93, 6, 8, [254, 226, 226, 255])
  },
  'bottle-cap.png': (c) => {
    c.circle(64, 64, 61, [156, 163, 175, 255])
    c.circle(64, 64, 45, [209, 213, 219, 255])
    c.circle(64, 64, 27, [75, 85, 99, 255])
    for (let i = 0; i < 16; i += 1) {
      const a = (Math.PI * 2 * i) / 16
      c.line(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48, 64 + Math.cos(a) * 61, 64 + Math.sin(a) * 61, 7, [55, 65, 81, 220])
    }
  },
  'sword.png': (c) => {
    c.polygon([[84, 1], [124, 24], [43, 103], [25, 85]], COLORS.neutral)
    c.line(25, 105, 74, 56, 15, COLORS.neutral)
    c.line(16, 78, 50, 112, 15, COLORS.neutral)
    c.line(3, 124, 32, 95, 18, COLORS.neutral)
  },
  'negotiate.png': (c) => {
    c.line(3, 58, 43, 18, 20, COLORS.neutral)
    c.line(43, 18, 83, 58, 20, COLORS.neutral)
    c.line(125, 58, 85, 18, 20, COLORS.neutral)
    c.line(85, 18, 45, 58, 20, COLORS.neutral)
    c.line(24, 86, 104, 86, 17, COLORS.neutral)
    c.circle(35, 88, 17, COLORS.neutral)
    c.circle(93, 88, 17, COLORS.neutral)
  },
  'survivor-face.png': (c) => {
    c.circle(64, 45, 41, COLORS.shadow)
    c.circle(64, 53, 34, [251, 191, 36, 255])
    c.circle(50, 50, 5, COLORS.shadow)
    c.circle(78, 50, 5, COLORS.shadow)
    c.line(51, 76, 77, 76, 7, COLORS.shadow)
    c.circle(64, 105, 45, COLORS.survivor)
  },
  'score.png': (c) => {
    const points = []
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? 62 : 27
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 10
      points.push([64 + Math.cos(a) * r, 64 + Math.sin(a) * r])
    }
    c.polygon(points, [52, 211, 153, 255])
  },
  'clue.png': (c) => {
    c.rect(16, 2, 96, 124, [250, 204, 21, 255])
    c.rect(31, 25, 66, 10, COLORS.shadow)
    c.rect(31, 54, 66, 10, COLORS.shadow)
    c.rect(31, 83, 48, 10, COLORS.shadow)
  },
}

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(SURVIVOR_OUT_DIR, { recursive: true })

for (const [filename, draw] of Object.entries(icons)) {
  const canvas = createCanvas()
  draw(canvas)
  writeFileSync(join(OUT_DIR, filename), canvas.png())
}

const survivorData = JSON.parse(readFileSync('src/data/survivors_from_excel.json', 'utf8'))
const survivorPlaceholder = join(OUT_DIR, 'survivor-face.png')

survivorData.forEach((survivor) => {
  if (!survivor?.id) return
  const survivorImagePath = join(SURVIVOR_OUT_DIR, `${survivor.id}.png`)
  if (!existsSync(survivorImagePath)) {
    writeFileSync(survivorImagePath, readFileSync(survivorPlaceholder))
  }
})
