// Generates assets/icon.png — 512x512
// Design: stylized git branch fork (main trunk → 2 branches) with commit nodes
import { Jimp } from 'jimp'

const SIZE = 512
const img = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 })

function rgba(r, g, b, a = 255) { return (r << 24 | g << 16 | b << 8 | a) >>> 0 }

function circle(img, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) img.setPixelColor(color, x, y)
}

function roundedRect(img, x0, y0, x1, y1, r, color) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const inBody = (x >= x0 + r && x <= x1 - r) || (y >= y0 + r && y <= y1 - r)
      const corners = [
        [(x0 + r), (y0 + r)], [(x1 - r), (y0 + r)],
        [(x0 + r), (y1 - r)], [(x1 - r), (y1 - r)],
      ]
      const inCorner = corners.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)
      if (inBody || inCorner) img.setPixelColor(color, x, y)
    }
}

function bezier(img, x0, y0, cx, cy, x1, y1, steps, thick, color) {
  let px = x0, py = y0
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = Math.round((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1)
    const y = Math.round((1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1)
    circle(img, x, y, thick, color)
    px = x; py = y
  }
}

function line(img, x0, y0, x1, y1, thick, color) {
  const dx = x1 - x0, dy = y1 - y0
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  for (let i = 0; i <= steps; i++) {
    circle(img, Math.round(x0 + dx * i / steps), Math.round(y0 + dy * i / steps), thick, color)
  }
}

// ─── Background ─────────────────────────────────────────────────────────────
roundedRect(img, 0, 0, SIZE - 1, SIZE - 1, 80, rgba(9, 12, 19))

// ─── Design: git branch fork ─────────────────────────────────────────────────
//
//   A ──── B ──── C (top branch)
//           \
//            D ─── E (bottom branch)
//
// A = left node (origin commit)
// B = branch point
// C = top feature branch end
// D = bottom branch junction
// E = bottom feature branch end
//
// With flowing curves for the branches

const BLUE  = rgba(71, 148, 252)
const BLUEG = rgba(120, 180, 255)   // glow / lighter
const WHITE = rgba(255, 255, 255)
const BG    = rgba(9, 12, 19)

const TH = 11   // line thickness
const DOT = 22  // node radius
const CORE = 11 // white inner dot

// Positions
const ax = 110, ay = 256                 // A: origin
const bx = 230, by = 256                 // B: branch point (on trunk)
const cx2 = 400, cy2 = 148              // C: top branch end
const dx = 400, dy = 364               // E: bottom branch end

// Draw trunk: A → B (straight horizontal)
line(img, ax, ay, bx, by, TH, BLUE)

// Top branch: B → C (curve upward)
bezier(img, bx, by, bx + 80, by - 60, cx2, cy2, 80, TH, BLUE)

// Bottom branch: B → D (curve downward)
bezier(img, bx, by, bx + 80, by + 60, dx, dy, 80, TH, BLUE)

// Nodes
circle(img, ax, ay, DOT, BLUE)        // A
circle(img, bx, by, DOT, BLUE)        // B
circle(img, cx2, cy2, DOT, BLUE)      // C
circle(img, dx, dy, DOT, BLUE)        // D

// White cores
circle(img, ax, ay, CORE, WHITE)
circle(img, bx, by, CORE, BLUEG)      // junction: lighter blue not white
circle(img, cx2, cy2, CORE, WHITE)
circle(img, dx, dy, CORE, WHITE)

await img.write('assets/icon.png')
console.log('done')
