import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { ipc, IPC } from '../../hooks/useIpc'
import { useRepoStore } from '../../store/repoStore'
import type { GraphNode } from '../../../shared/types'
import './BranchGraphPanel.css'

const LANE_COLORS = [
  '#58a6ff', '#3fb950', '#f78166', '#d2a8ff', '#ffa657',
  '#79c0ff', '#56d364', '#ff7b72', '#bc8cff', '#ffb86c',
]

const LANE_W = 16
const ROW_H = 28
const DOT_R = 4

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d > 0) return `${d}d`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return 'jetzt'
}

function GraphSvg({ nodes }: { nodes: GraphNode[] }) {
  const maxLane = Math.max(0, ...nodes.map((n) => n.lane))
  const svgW = (maxLane + 1) * LANE_W + 8
  const svgH = nodes.length * ROW_H

  // Build parent→child map for drawing lines
  const indexMap = new Map(nodes.map((n, i) => [n.hash, i]))

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', flexShrink: 0 }}>
      {nodes.map((node, i) => {
        const cx = node.lane * LANE_W + LANE_W / 2 + 4
        const cy = i * ROW_H + ROW_H / 2
        const color = LANE_COLORS[node.lane % LANE_COLORS.length]

        const lines: JSX.Element[] = []
        for (const parentHash of node.parents) {
          const pi = indexMap.get(parentHash)
          if (pi === undefined) continue
          const parent = nodes[pi]
          const px = parent.lane * LANE_W + LANE_W / 2 + 4
          const py = pi * ROW_H + ROW_H / 2
          lines.push(
            <path
              key={`${node.hash}-${parentHash}`}
              d={`M ${cx} ${cy} C ${cx} ${(cy + py) / 2}, ${px} ${(cy + py) / 2}, ${px} ${py}`}
              stroke={color}
              strokeWidth={1.5}
              fill="none"
              opacity={0.7}
            />
          )
        }

        return (
          <g key={node.hash}>
            {lines}
            <circle cx={cx} cy={cy} r={DOT_R} fill={color} />
          </g>
        )
      })}
    </svg>
  )
}

export function BranchGraphPanel() {
  const { currentRepo } = useRepoStore()
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!currentRepo) return
    setLoading(true)
    const result = await ipc.invoke<GraphNode[]>(IPC.BRANCH_GRAPH_GET, currentRepo.path, 120)
    setNodes(result ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentRepo?.path])

  if (!currentRepo) return null

  return (
    <div className="graph-panel">
      <div className="graph-toolbar">
        <span className="panel-label">GRAPH</span>
        <button className="btn-icon" onClick={load} disabled={loading} title="Refresh">
          <RotateCcw size={12} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {loading && nodes.length === 0 && (
        <div className="graph-empty">Lade Graph…</div>
      )}

      {!loading && nodes.length === 0 && (
        <div className="graph-empty">Keine Commits gefunden.</div>
      )}

      {nodes.length > 0 && (
        <div className="graph-scroll" ref={listRef}>
          <div className="graph-rows-wrap">
            <GraphSvg nodes={nodes} />
            <div className="graph-rows">
              {nodes.map((node) => (
                <div key={node.hash} className="graph-row" style={{ height: ROW_H }}>
                  <div className="graph-row-meta">
                    <span className="graph-msg truncate" title={node.message}>{node.message}</span>
                    <div className="graph-row-sub">
                      <span className="graph-author">{node.author}</span>
                      <span className="graph-dot">·</span>
                      <span className="graph-hash">{node.shortHash}</span>
                      <span className="graph-dot">·</span>
                      <span className="graph-time">{timeAgo(node.date)}</span>
                    </div>
                  </div>
                  {node.refs.length > 0 && (
                    <div className="graph-refs">
                      {node.refs.slice(0, 3).map((ref) => {
                        const isRemote = ref.startsWith('origin/')
                        const label = ref.replace('origin/', '')
                        return (
                          <span
                            key={ref}
                            className={`graph-ref ${isRemote ? 'graph-ref--remote' : 'graph-ref--local'}`}
                            title={ref}
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
