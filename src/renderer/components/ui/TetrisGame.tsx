import { useEffect, useRef, useCallback, useState } from 'react'
import { ipc, IPC } from '../../hooks/useIpc'
import './TetrisGame.css'

interface HiEntry { name: string; score: number; date: string }

function loadScores(): HiEntry[] {
  try { return JSON.parse(localStorage.getItem('tetris-scores') ?? '[]') } catch { return [] }
}

function saveScore(name: string, score: number) {
  const all = loadScores()
  all.push({ name, score, date: new Date().toLocaleDateString('de-DE') })
  all.sort((a, b) => b.score - a.score)
  const top = all.slice(0, 10)
  try { localStorage.setItem('tetris-scores', JSON.stringify(top)) } catch {}
  return top
}

const COLS = 10
const ROWS = 20
const BLOCK = 30

const SHAPES = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
]

// Piece-Farben: Index entspricht Theme-Variablen — Canvas zeichnet direkt
function getPieceColors(theme: string): string[] {
  if (theme === 'synthwave') return ['#28E7FF','#FF2BD6','#8B5CFF','#FF8C42','#FFD700','#39FF9F','#FF4FA3']
  if (theme === 'light')     return ['#3b82f6','#ef4444','#8b5cf6','#f97316','#eab308','#22c55e','#ec4899']
  return ['#7c9fcc','#cc7c7c','#a07ccc','#cc9a7c','#ccc07c','#7ccc9a','#cc7ca0']
}

interface Props {
  onClose: () => void
  theme: string
}

export function TetrisGame({ onClose, theme }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const [display, setDisplay]     = useState({ score: 0, lines: 0, level: 1 })
  const [scores, setScores]       = useState<HiEntry[]>(() => loadScores())
  const [playerName, setPlayerName] = useState('Player')
  const [tab, setTab]             = useState<'game' | 'hiscore'>('game')
  const stateRef   = useRef({
    board:     Array.from({ length: ROWS }, () => Array(COLS).fill(0)) as number[][],
    piece:     { shape: SHAPES[0], x: 3, y: 0, color: 0 },
    score:     0,
    lines:     0,
    level:     1,
    running:   true,
    dropTimer: 0,
    lastTime:  0,
  })

  const colors = getPieceColors(theme)

  // Git-Nutzernamen laden
  useEffect(() => {
    ipc.invoke<{ userName?: string; userEmail?: string }>(IPC.REPO_CONFIG_GET).then(cfg => {
      if (cfg?.userName) setPlayerName(cfg.userName)
    }).catch(() => {})
  }, [])

  const newPiece = useCallback(() => {
    const idx = Math.floor(Math.random() * SHAPES.length)
    return { shape: SHAPES[idx], x: Math.floor((COLS - SHAPES[idx][0].length) / 2), y: 0, color: idx }
  }, [])

  const valid = useCallback((shape: number[][], x: number, y: number, board: number[][]) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue
        const nr = r + y, nc = c + x
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc]) return false
      }
    }
    return true
  }, [])

  const rotate = (shape: number[][]) =>
    shape[0].map((_, i) => shape.map(row => row[i]).reverse())

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const s = stateRef.current

    // Background
    ctx.fillStyle = theme === 'light' ? '#f0f0f0' : '#0a0a14'
    ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK)

    // Grid lines
    ctx.strokeStyle = theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let r = 0; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(COLS * BLOCK, r * BLOCK); ctx.stroke()
    }
    for (let c = 0; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, ROWS * BLOCK); ctx.stroke()
    }

    // Board blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (s.board[r][c]) {
          const col = colors[s.board[r][c] - 1]
          ctx.fillStyle = col
          ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2)
          ctx.fillStyle = 'rgba(255,255,255,0.15)'
          ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, 4)
        }
      }
    }

    // Active piece
    const p = s.piece
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) {
          const col = colors[p.color]
          ctx.fillStyle = col
          ctx.fillRect((p.x + c) * BLOCK + 1, (p.y + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2)
          // Neon glow in synthwave
          if (theme === 'synthwave') {
            ctx.shadowColor = col
            ctx.shadowBlur  = 8
            ctx.fillRect((p.x + c) * BLOCK + 1, (p.y + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2)
            ctx.shadowBlur  = 0
          }
          ctx.fillStyle = 'rgba(255,255,255,0.20)'
          ctx.fillRect((p.x + c) * BLOCK + 1, (p.y + r) * BLOCK + 1, BLOCK - 2, 4)
        }
      }
    }

    // Ghost piece (where it would land)
    let ghostY = p.y
    while (valid(p.shape, p.x, ghostY + 1, s.board)) ghostY++
    if (ghostY !== p.y) {
      ctx.globalAlpha = 0.2
      for (let r = 0; r < p.shape.length; r++) {
        for (let c = 0; c < p.shape[r].length; c++) {
          if (p.shape[r][c]) {
            ctx.fillStyle = colors[p.color]
            ctx.fillRect((p.x + c) * BLOCK + 1, (ghostY + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2)
          }
        }
      }
      ctx.globalAlpha = 1
    }
  }, [theme, colors, valid])

  const lock = useCallback(() => {
    const s = stateRef.current
    const p = s.piece
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) s.board[p.y + r][p.x + c] = p.color + 1
      }
    }

    // Clear full lines
    let cleared = 0
    for (let r = ROWS - 1; r >= 0; r--) {
      if (s.board[r].every(v => v)) {
        s.board.splice(r, 1)
        s.board.unshift(Array(COLS).fill(0))
        cleared++; r++
      }
    }
    const pts = [0, 100, 300, 500, 800]
    s.score += (pts[cleared] ?? 0) * s.level
    s.lines += cleared
    s.level  = Math.floor(s.lines / 10) + 1

    const next = newPiece()
    if (!valid(next.shape, next.x, next.y, s.board)) {
      // Game over — save score, then reset
      if (s.score > 0) {
        const updated = saveScore(playerName, s.score)
        setScores(updated)
      }
      s.board   = Array.from({ length: ROWS }, () => Array(COLS).fill(0))
      s.score   = 0
      s.lines   = 0
      s.level   = 1
    }
    s.piece = next
  }, [newPiece, valid, playerName])

  useEffect(() => {
    const s = stateRef.current
    s.piece = newPiece()

    const displayInterval = setInterval(() => {
      setDisplay({ score: s.score, lines: s.lines, level: s.level })
    }, 100)

    let animId: number
    const loop = (ts: number) => {
      if (!s.running) return
      const dt = ts - s.lastTime
      s.lastTime = ts
      const dropInterval = Math.max(100, 800 - (s.level - 1) * 70)
      s.dropTimer += dt
      if (s.dropTimer >= dropInterval) {
        s.dropTimer = 0
        if (valid(s.piece.shape, s.piece.x, s.piece.y + 1, s.board)) {
          s.piece.y++
        } else {
          lock()
        }
      }
      draw()
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    const onKey = (e: KeyboardEvent) => {
      const p = s.piece
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft'  && valid(p.shape, p.x - 1, p.y, s.board)) { p.x--; draw() }
      if (e.key === 'ArrowRight' && valid(p.shape, p.x + 1, p.y, s.board)) { p.x++; draw() }
      if (e.key === 'ArrowDown'  && valid(p.shape, p.x, p.y + 1, s.board)) { p.y++; draw() }
      if (e.key === 'ArrowUp') {
        const r = rotate(p.shape)
        if (valid(r, p.x, p.y, s.board)) { p.shape = r; draw() }
      }
      if (e.key === ' ') {
        while (valid(p.shape, p.x, p.y + 1, s.board)) p.y++
        lock(); draw()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      s.running = false
      cancelAnimationFrame(animId)
      clearInterval(displayInterval)
      window.removeEventListener('keydown', onKey)
    }
  }, [draw, lock, newPiece, onClose, valid])

  return (
    <div className="tetris-overlay">
      <div className="tetris-container">
        <div className="tetris-header">
          <div className="tetris-tabs">
            <button className={`tetris-tab ${tab === 'game' ? 'tetris-tab--active' : ''}`} onClick={() => setTab('game')}>Spiel</button>
            <button className={`tetris-tab ${tab === 'hiscore' ? 'tetris-tab--active' : ''}`} onClick={() => setTab('hiscore')}>Highscores</button>
          </div>
          <button className="tetris-close" onClick={onClose} title="Schliessen (Esc)">✕</button>
        </div>
        <div className="tetris-body">
          {tab === 'game' ? (
            <>
              <canvas
                ref={canvasRef}
                width={COLS * BLOCK}
                height={ROWS * BLOCK}
                className="tetris-canvas"
              />
              <div className="tetris-sidebar">
                <div className="tetris-stat">
                  <span className="tetris-stat-label">SCORE</span>
                  <span className="tetris-stat-value">{display.score}</span>
                </div>
                <div className="tetris-stat">
                  <span className="tetris-stat-label">LINES</span>
                  <span className="tetris-stat-value">{display.lines}</span>
                </div>
                <div className="tetris-stat">
                  <span className="tetris-stat-label">LEVEL</span>
                  <span className="tetris-stat-value">{display.level}</span>
                </div>
                <div className="tetris-player">
                  <span className="tetris-stat-label">SPIELER</span>
                  <span className="tetris-player-name">{playerName}</span>
                </div>
                <div className="tetris-controls">
                  <div>← → Bewegen</div>
                  <div>↑ Drehen</div>
                  <div>↓ Schneller</div>
                  <div>Leertaste Drop</div>
                  <div>Esc Schliessen</div>
                </div>
              </div>
            </>
          ) : (
            <div className="tetris-hiscore">
              <table className="tetris-hiscore-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Spieler</th>
                    <th>Score</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.length === 0 && (
                    <tr><td colSpan={4} className="tetris-hiscore-empty">Noch keine Eintraege -- spiel los!</td></tr>
                  )}
                  {scores.map((e, i) => (
                    <tr key={i} className={e.name === playerName ? 'tetris-hiscore-me' : ''}>
                      <td>{i + 1}</td>
                      <td>{e.name}</td>
                      <td>{e.score.toLocaleString('de-DE')}</td>
                      <td>{e.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="tetris-hiscore-reset" onClick={() => { localStorage.removeItem('tetris-scores'); setScores([]) }}>
                Zuruecksetzen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
