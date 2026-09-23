// Generates a minimal 256x256 PNG icon for the app.
// Uses only Node.js built-ins — no external deps.
// The result is a valid PNG that electron-builder will convert to ICO/ICNS.

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 256
const outPath = path.join(__dirname, '../assets/icon.png')

// Build a 256x256 RGBA bitmap: dark background + "DC" text rendered as simple pixel art
const pixels = Buffer.alloc(SIZE * SIZE * 4)

// Background: #0f0f0f
for (let i = 0; i < SIZE * SIZE; i++) {
  pixels[i * 4 + 0] = 0x0f // R
  pixels[i * 4 + 1] = 0x0f // G
  pixels[i * 4 + 2] = 0x0f // B
  pixels[i * 4 + 3] = 0xff // A
}

// Draw a centered rounded rectangle accent in #4f8ef7
const accentR = 0x4f, accentG = 0x8e, accentB = 0xf7
const cx = SIZE / 2, cy = SIZE / 2
const rw = 180, rh = 60, radius = 12

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const rx = x - (cx - rw / 2), ry = y - (cy - rh / 2)
    // Inside rounded rect
    const inX = rx >= 0 && rx <= rw
    const inY = ry >= 0 && ry <= rh
    if (!inX || !inY) continue

    // Corner rounding
    let inCorner = true
    if (rx < radius && ry < radius) inCorner = Math.hypot(rx - radius, ry - radius) <= radius
    else if (rx > rw - radius && ry < radius) inCorner = Math.hypot(rx - (rw - radius), ry - radius) <= radius
    else if (rx < radius && ry > rh - radius) inCorner = Math.hypot(rx - radius, ry - (rh - radius)) <= radius
    else if (rx > rw - radius && ry > rh - radius) inCorner = Math.hypot(rx - (rw - radius), ry - (rh - radius)) <= radius

    if (inCorner) {
      const idx = (y * SIZE + x) * 4
      pixels[idx] = accentR; pixels[idx + 1] = accentG; pixels[idx + 2] = accentB; pixels[idx + 3] = 0xff
    }
  }
}

// Simple "DC" text using 5x7 pixel font bitmaps
const glyphs = {
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  C: [0b01111, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b01111],
}

function drawGlyph(char, startX, startY, scale = 5) {
  const rows = glyphs[char]
  if (!rows) return
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < 5; col++) {
      if (rows[row] & (1 << (4 - col))) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = startX + col * scale + sx
            const py = startY + row * scale + sy
            if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue
            const idx = (py * SIZE + px) * 4
            pixels[idx] = 0xff; pixels[idx + 1] = 0xff; pixels[idx + 2] = 0xff; pixels[idx + 3] = 0xff
          }
        }
      }
    }
  }
}

// Center "DC" (each glyph: 5 cols × 5px + 1 gap = 26px wide, 7 rows × 5px = 35px tall)
const glyphW = 5 * 5, glyphH = 7 * 5, gap = 8
const totalW = glyphW * 2 + gap
const startX = Math.floor((SIZE - totalW) / 2)
const startY = Math.floor((SIZE - glyphH) / 2)

drawGlyph('D', startX, startY)
drawGlyph('C', startX + glyphW + gap, startY)

// ── Encode as PNG ──────────────────────────────────────────────────────────────

function adler32(buf) {
  let s1 = 1, s2 = 0
  for (const b of buf) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521 }
  return (s2 << 16) | s1
}

function uint32BE(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}

function crc32(buf) {
  let crc = 0xffffffff
  const table = []
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lenBytes = uint32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  return Buffer.concat([lenBytes, typeBytes, data, uint32BE(crc32(crcInput))])
}

// Build scanlines (filter byte 0 = None per row)
const scanlines = Buffer.alloc(SIZE * (1 + SIZE * 4))
for (let y = 0; y < SIZE; y++) {
  scanlines[y * (1 + SIZE * 4)] = 0 // filter type None
  pixels.copy(scanlines, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const compressed = zlib.deflateSync(scanlines, { level: 6 })

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)  // width
ihdr.writeUInt32BE(SIZE, 4)  // height
ihdr[8] = 8   // bit depth
ihdr[9] = 2   // color type: RGB... wait we need RGBA = 6
ihdr[9] = 6   // RGBA
ihdr[10] = 0  // compression
ihdr[11] = 0  // filter
ihdr[12] = 0  // interlace

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
])

fs.writeFileSync(outPath, png)
console.log(`Icon written to ${outPath} (${png.length} bytes)`)
