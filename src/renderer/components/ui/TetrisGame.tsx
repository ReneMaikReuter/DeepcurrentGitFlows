import { useEffect, useRef, useState, useMemo } from 'react'
import { ipc, IPC } from '../../hooks/useIpc'
import './TetrisGame.css'

const COLS  = 10
const ROWS  = 20
const BLOCK = 28

const SHAPES: number[][][] = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]],
]

interface HiEntry { name: string; score: number; date: string }

function loadScores(): HiEntry[] {
  try { return JSON.parse(localStorage.getItem('tetris-scores') ?? '[]') } catch { return [] }
}
function saveScore(name: string, score: number): HiEntry[] {
  const all = loadScores()
  all.push({ name, score, date: new Date().toLocaleDateString('de-DE') })
  all.sort((a, b) => b.score - a.score)
  const top = all.slice(0, 10)
  try { localStorage.setItem('tetris-scores', JSON.stringify(top)) } catch {}
  return top
}

function getColors(theme: string): string[] {
  if (theme === 'synthwave') return ['#28E7FF','#FF2BD6','#8B5CFF','#FF8C42','#FFD700','#39FF9F','#FF4FA3']
  if (theme === 'light')     return ['#3b82f6','#ef4444','#8b5cf6','#f97316','#eab308','#22c55e','#ec4899']
  return ['#5b8dd9','#d95b5b','#9a5bd9','#d9945b','#d9cc5b','#5bd99a','#d95b9a']
}

function rotate(shape: number[][]): number[][] {
  return shape[0].map((_, i) => shape.map(row => row[i]).reverse())
}

function randomPiece() {
  const idx = Math.floor(Math.random() * SHAPES.length)
  return { shape: SHAPES[idx], colorIdx: idx }
}

function valid(shape: number[][], x: number, y: number, board: number[][]): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const nr = r + y, nc = c + x
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc]) return false
    }
  }
  return true
}

interface Props { onClose: () => void; theme: string }

export function TetrisGame({ onClose, theme }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const nextCanvasRef = useRef<HTMLCanvasElement>(null)

  // Alle Spielzustand in einem Ref damit der RAF-Loop immer aktuelle Werte sieht
  const G = useRef({
    board:    Array.from({ length: ROWS }, () => Array(COLS).fill(0)) as number[][],
    px: 3, py: 0,
    shape:    SHAPES[0],
    colorIdx: 0,
    next:     randomPiece(),
    score:    0,
    lines:    0,
    level:    1,
    dropAcc:  0,
    lastTs:   0,
    running:  true,
  })

  const [display, setDisplay] = useState({ score: 0, lines: 0, level: 1 })
  const [scores,  setScores]  = useState<HiEntry[]>(() => loadScores())
  const [player,  setPlayer]  = useState('Player')
  const [tab,     setTab]     = useState<'game' | 'hi'>('game')
  const playerRef = useRef('Player')

  // useMemo verhindert dass colors bei jedem Render ein neues Array ist
  // (neues Array → useEffect-Dep ändert sich → Loop-Restart → running=false-Bug)
  const colors = useMemo(() => getColors(theme), [theme])

  useEffect(() => {
    ipc.invoke<{ userName?: string }>(IPC.REPO_CONFIG_GET).then(cfg => {
      if (cfg?.userName) { setPlayer(cfg.userName); playerRef.current = cfg.userName }
    }).catch(() => {})
  }, [])

  // Spawn first piece
  useEffect(() => {
    const g = G.current
    const p = randomPiece()
    g.shape    = p.shape
    g.colorIdx = p.colorIdx
    g.px = Math.floor((COLS - p.shape[0].length) / 2)
    g.py = 0
    g.next = randomPiece()
  }, [])

  useEffect(() => {
    const g = G.current
    g.running = true  // Cleanup des vorherigen Runs setzt es auf false — hier zurücksetzen
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const nctx   = nextCanvasRef.current!.getContext('2d')!
    const NB     = 24 // block size for next-preview

    function drawBoard() {
      // Background
      ctx.fillStyle = theme === 'light' ? '#f4f4f8' : '#080612'
      ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK)

      // Grid
      ctx.strokeStyle = theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 0.5
      for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r*BLOCK); ctx.lineTo(COLS*BLOCK, r*BLOCK); ctx.stroke() }
      for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c*BLOCK, 0); ctx.lineTo(c*BLOCK, ROWS*BLOCK); ctx.stroke() }

      // Board
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!g.board[r][c]) continue
          const col = colors[g.board[r][c] - 1]
          ctx.fillStyle = col
          ctx.fillRect(c*BLOCK+1, r*BLOCK+1, BLOCK-2, BLOCK-2)
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
          ctx.fillRect(c*BLOCK+1, r*BLOCK+1, BLOCK-2, 3)
        }
      }

      // Ghost
      let gy = g.py
      while (valid(g.shape, g.px, gy + 1, g.board)) gy++
      if (gy !== g.py) {
        ctx.globalAlpha = 0.18
        ctx.fillStyle = colors[g.colorIdx]
        for (let r = 0; r < g.shape.length; r++)
          for (let c = 0; c < g.shape[r].length; c++)
            if (g.shape[r][c]) ctx.fillRect((g.px+c)*BLOCK+1, (gy+r)*BLOCK+1, BLOCK-2, BLOCK-2)
        ctx.globalAlpha = 1
      }

      // Active piece
      ctx.fillStyle = colors[g.colorIdx]
      if (theme === 'synthwave') { ctx.shadowColor = colors[g.colorIdx]; ctx.shadowBlur = 10 }
      for (let r = 0; r < g.shape.length; r++)
        for (let c = 0; c < g.shape[r].length; c++)
          if (g.shape[r][c]) {
            ctx.fillRect((g.px+c)*BLOCK+1, (g.py+r)*BLOCK+1, BLOCK-2, BLOCK-2)
            ctx.fillStyle = 'rgba(255,255,255,0.22)'
            ctx.fillRect((g.px+c)*BLOCK+1, (g.py+r)*BLOCK+1, BLOCK-2, 3)
            ctx.fillStyle = colors[g.colorIdx]
          }
      ctx.shadowBlur = 0
    }

    function drawNext() {
      const ns = g.next.shape
      const nc = g.next.colorIdx
      const pw = 4 * NB, ph = 4 * NB
      nctx.fillStyle = theme === 'light' ? '#f4f4f8' : '#080612'
      nctx.fillRect(0, 0, pw, ph)
      const offX = Math.floor((4 - ns[0].length) / 2)
      const offY = Math.floor((4 - ns.length) / 2)
      nctx.fillStyle = colors[nc]
      if (theme === 'synthwave') { nctx.shadowColor = colors[nc]; nctx.shadowBlur = 8 }
      for (let r = 0; r < ns.length; r++)
        for (let c = 0; c < ns[r].length; c++)
          if (ns[r][c]) nctx.fillRect((offX+c)*NB+1, (offY+r)*NB+1, NB-2, NB-2)
      nctx.shadowBlur = 0
    }

    function spawnNext() {
      g.shape    = g.next.shape
      g.colorIdx = g.next.colorIdx
      g.px = Math.floor((COLS - g.shape[0].length) / 2)
      g.py = 0
      g.next = randomPiece()
      // Game over check
      if (!valid(g.shape, g.px, g.py, g.board)) {
        if (g.score > 0) {
          const updated = saveScore(playerRef.current, g.score)
          setScores(updated)
        }
        g.board   = Array.from({ length: ROWS }, () => Array(COLS).fill(0))
        g.score   = 0; g.lines = 0; g.level = 1
        const p2 = randomPiece()
        g.shape = p2.shape; g.colorIdx = p2.colorIdx
        g.px = Math.floor((COLS - g.shape[0].length) / 2); g.py = 0
        g.next = randomPiece()
      }
    }

    function lockPiece() {
      for (let r = 0; r < g.shape.length; r++)
        for (let c = 0; c < g.shape[r].length; c++)
          if (g.shape[r][c]) g.board[g.py + r][g.px + c] = g.colorIdx + 1

      let cleared = 0
      for (let r = ROWS - 1; r >= 0; r--) {
        if (g.board[r].every(v => v)) {
          g.board.splice(r, 1)
          g.board.unshift(Array(COLS).fill(0))
          cleared++; r++
        }
      }
      const pts = [0, 100, 300, 500, 800]
      g.score += (pts[Math.min(cleared, 4)] ?? 0) * g.level
      g.lines += cleared
      g.level  = Math.floor(g.lines / 10) + 1
      spawnNext()
    }

    let rafId: number
    function loop(ts: number) {
      if (!g.running) return
      const dt = ts - g.lastTs
      g.lastTs = ts
      const interval = Math.max(80, 850 - (g.level - 1) * 75)
      g.dropAcc += dt
      if (g.dropAcc >= interval) {
        g.dropAcc = 0
        if (valid(g.shape, g.px, g.py + 1, g.board)) {
          g.py++
        } else {
          lockPiece()
        }
      }
      drawBoard()
      drawNext()
      setDisplay({ score: g.score, lines: g.lines, level: g.level })
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft') {
        if (valid(g.shape, g.px - 1, g.py, g.board)) g.px--
      } else if (e.key === 'ArrowRight') {
        if (valid(g.shape, g.px + 1, g.py, g.board)) g.px++
      } else if (e.key === 'ArrowDown') {
        if (valid(g.shape, g.px, g.py + 1, g.board)) { g.py++; g.dropAcc = 0 }
      } else if (e.key === 'ArrowUp') {
        const r = rotate(g.shape)
        if (valid(r, g.px, g.py, g.board)) g.shape = r
        // wall kick
        else if (valid(r, g.px - 1, g.py, g.board)) { g.shape = r; g.px-- }
        else if (valid(r, g.px + 1, g.py, g.board)) { g.shape = r; g.px++ }
      } else if (e.key === ' ') {
        e.preventDefault()
        while (valid(g.shape, g.px, g.py + 1, g.board)) g.py++
        lockPiece()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      g.running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('keydown', onKey)
    }
  }, [theme, colors, onClose])

  return (
    <div className="tetris-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tetris-container">
        <div className="tetris-header">
          <div className="tetris-tabs">
            <button className={`tetris-tab ${tab === 'game' ? 'tetris-tab--active' : ''}`} onClick={() => setTab('game')}>Spiel</button>
            <button className={`tetris-tab ${tab === 'hi' ? 'tetris-tab--active' : ''}`} onClick={() => setTab('hi')}>Highscores</button>
          </div>
          <button className="tetris-close" onClick={onClose} title="Schliessen (Esc)">✕</button>
        </div>

        {tab === 'game' ? (
          <div className="tetris-body">
            <canvas ref={canvasRef} width={COLS * BLOCK} height={ROWS * BLOCK} className="tetris-canvas" />
            <div className="tetris-sidebar">
              <div className="tetris-stat">
                <span className="tetris-stat-label">SCORE</span>
                <span className="tetris-stat-value">{display.score.toLocaleString('de-DE')}</span>
              </div>
              <div className="tetris-stat">
                <span className="tetris-stat-label">LINES</span>
                <span className="tetris-stat-value">{display.lines}</span>
              </div>
              <div className="tetris-stat">
                <span className="tetris-stat-label">LEVEL</span>
                <span className="tetris-stat-value">{display.level}</span>
              </div>
              <div className="tetris-stat">
                <span className="tetris-stat-label">NAECHSTER</span>
                <canvas ref={nextCanvasRef} width={4 * 24} height={4 * 24} className="tetris-next-canvas" />
              </div>
              <div className="tetris-stat">
                <span className="tetris-stat-label">SPIELER</span>
                <span className="tetris-player-name">{player}</span>
              </div>
              <div className="tetris-controls">
                <div>← → Bewegen</div>
                <div>↑ Drehen</div>
                <div>↓ Schneller</div>
                <div>Leertaste Drop</div>
                <div>Esc Schliessen</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="tetris-hiscore">
            <table className="tetris-hiscore-table">
              <thead>
                <tr><th>#</th><th>Spieler</th><th>Score</th><th>Datum</th></tr>
              </thead>
              <tbody>
                {scores.length === 0 && (
                  <tr><td colSpan={4} className="tetris-hiscore-empty">Noch keine Eintraege -- spiel los!</td></tr>
                )}
                {scores.map((e, i) => (
                  <tr key={i} className={e.name === player ? 'tetris-hiscore-me' : ''}>
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
  )
}
