import { useState, useMemo } from 'react'

// Color palette for DFA pattern groups
const PATTERN_COLORS = [
  { fill: 'rgba(139, 92, 246, 0.15)', stroke: '#8b5cf6', text: '#c084fc' },
  { fill: 'rgba(99, 102, 241, 0.15)', stroke: '#6366f1', text: '#818cf8' },
  { fill: 'rgba(52, 211, 153, 0.15)', stroke: '#34d399', text: '#6ee7b7' },
  { fill: 'rgba(251, 191, 36, 0.15)', stroke: '#fbbf24', text: '#fde68a' },
  { fill: 'rgba(244, 114, 182, 0.15)', stroke: '#f472b6', text: '#f9a8d4' },
]

/* ───────────────── DFA VISUALIZATION ───────────────── */
function DFAView({ dfa }) {
  const [hoveredPattern, setHoveredPattern] = useState(null)
  if (!dfa || dfa.length === 0) return <div className="empty-state"><div className="empty-state-icon">⊛</div><div>No DFA data</div></div>

  return (
    <div className="automata-dfa-grid">
      {dfa.map((pattern, pi) => {
        const color = PATTERN_COLORS[pi % PATTERN_COLORS.length]
        const isHovered = hoveredPattern === pi
        const states = pattern.states || []
        const transitions = pattern.transitions || []

        // Layout states in a row
        const stateSpacing = 160
        const yCenter = 100
        const xStart = 80
        const svgWidth = Math.max(500, xStart + states.length * stateSpacing + 80)
        const svgHeight = 220

        const statePositions = {}
        states.forEach((s, i) => {
          statePositions[s.id] = { x: xStart + i * stateSpacing, y: yCenter }
        })

        return (
          <div
            key={pattern.name}
            className={`automata-dfa-card ${isHovered ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredPattern(pi)}
            onMouseLeave={() => setHoveredPattern(null)}
            style={{ borderColor: color.stroke }}
          >
            <div className="automata-dfa-card-header">
              <span className="automata-dfa-name" style={{ color: color.text }}>{pattern.name}</span>
              <span className="automata-dfa-regex">{pattern.regex}</span>
            </div>
            <svg width={svgWidth} height={svgHeight} className="automata-svg">
              <defs>
                <marker id={`arrow-${pi}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color.stroke} />
                </marker>
              </defs>

              {/* Transitions (edges) */}
              {transitions.map((t, ti) => {
                const from = statePositions[t.from]
                const to = statePositions[t.to]
                if (!from || !to) return null

                if (t.from === t.to) {
                  // Self-loop
                  const cx = from.x
                  const cy = from.y - 32
                  return (
                    <g key={ti}>
                      <path
                        className="dfa-edge"
                        d={`M ${cx - 16} ${cy + 6} C ${cx - 28} ${cy - 36}, ${cx + 28} ${cy - 36}, ${cx + 16} ${cy + 6}`}
                        fill="none"
                        stroke={color.stroke}
                        strokeWidth={1.5}
                        opacity={0.7}
                        markerEnd={`url(#arrow-${pi})`}
                        style={{ animationDelay: `${ti * 0.1}s` }}
                      />
                      <path
                        className="flow-line"
                        d={`M ${cx - 16} ${cy + 6} C ${cx - 28} ${cy - 36}, ${cx + 28} ${cy - 36}, ${cx + 16} ${cy + 6}`}
                        fill="none"
                        stroke={color.stroke}
                      />
                      <text x={cx} y={cy - 24} textAnchor="middle" fill="var(--bg-secondary)" stroke="var(--bg-secondary)" strokeWidth={4} strokeLinejoin="round" fontSize={11} fontFamily="JetBrains Mono, monospace">
                        {t.label}
                      </text>
                      <text x={cx} y={cy - 24} textAnchor="middle" fill={color.text} fontSize={11} fontFamily="JetBrains Mono, monospace">
                        {t.label}
                      </text>
                    </g>
                  )
                }

                // Edge geometry
                const r = 30
                const dx = to.x - from.x
                const dy = to.y - from.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 1

                // If transition goes backwards or skips states forward, draw a curved edge
                const isForwardSkip = dx > stateSpacing + 10
                const isBackward = dx < 0
                
                if (isForwardSkip || isBackward) {
                   // Always curve from the bottom
                   const offset = 60 + (Math.abs(dx) * 0.05)
                   const midX = (from.x + to.x) / 2
                   const midY = from.y + offset
                   
                   const outAngle = Math.atan2(midY - from.y, midX - from.x)
                   const sx = from.x + Math.cos(outAngle) * r
                   const sy = from.y + Math.sin(outAngle) * r
                   
                   const inAngle = Math.atan2(to.y - midY, to.x - midX)
                   const ex = to.x - Math.cos(inAngle) * (r + 6)
                   const ey = to.y - Math.sin(inAngle) * (r + 6)
                   
                   const dPath = `M ${sx} ${sy} Q ${midX} ${midY} ${ex} ${ey}`
                   
                   // The apex of a quadratic curve at t=0.5
                   const curveY = 0.25 * sy + 0.5 * midY + 0.25 * ey
                   const textY = curveY + 16
                   
                   return (
                     <g key={ti}>
                        <path className="dfa-edge" d={dPath} fill="none" stroke={color.stroke} strokeWidth={1.5} opacity={0.7} markerEnd={`url(#arrow-${pi})`} style={{animationDelay: `${ti*0.1}s`}} />
                        <path className="flow-line" d={dPath} fill="none" stroke={color.stroke} />
                        <text x={midX} y={textY} textAnchor="middle" fill="var(--bg-secondary)" stroke="var(--bg-secondary)" strokeWidth={4} strokeLinejoin="round" fontSize={11} fontFamily="JetBrains Mono, monospace">{t.label}</text>
                        <text x={midX} y={textY} textAnchor="middle" fill={color.text} fontSize={11} fontFamily="JetBrains Mono, monospace">{t.label}</text>
                     </g>
                   )
                }

                // Normal adjacent straight edge
                const nx = dx / dist
                const ny = dy / dist

                return (
                  <g key={ti}>
                    <line
                      className="dfa-edge"
                      x1={from.x + nx * r}
                      y1={from.y + ny * r}
                      x2={to.x - nx * (r + 6)}
                      y2={to.y - ny * (r + 6)}
                      stroke={color.stroke}
                      strokeWidth={1.5}
                      opacity={0.7}
                      markerEnd={`url(#arrow-${pi})`}
                      style={{ animationDelay: `${ti * 0.1}s` }}
                    />
                    <line
                      className="flow-line"
                      x1={from.x + nx * r}
                      y1={from.y + ny * r}
                      x2={to.x - nx * (r + 6)}
                      y2={to.y - ny * (r + 6)}
                      stroke={color.stroke}
                    />
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 12}
                      textAnchor="middle"
                      fill="var(--bg-secondary)"
                      stroke="var(--bg-secondary)"
                      strokeWidth={4}
                      strokeLinejoin="round"
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {t.label}
                    </text>
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 12}
                      textAnchor="middle"
                      fill={color.text}
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {t.label}
                    </text>
                  </g>
                )
              })}

              {/* Start arrow */}
              {states.length > 0 && (
                <line
                  className="dfa-edge"
                  x1={statePositions[states[0].id].x - 50}
                  y1={yCenter}
                  x2={statePositions[states[0].id].x - 26}
                  y2={yCenter}
                  stroke={color.stroke}
                  strokeWidth={1.5}
                  markerEnd={`url(#arrow-${pi})`}
                />
              )}

              {/* States (nodes) */}
              {states.map((s, i) => {
                const pos = statePositions[s.id]
                const isAccepting = s.accepting
                return (
                  <g key={s.id} className="dfa-node-group" style={{ animationDelay: `${i * 0.1}s` }}>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={30}
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth={isAccepting ? 2.5 : 1.5}
                    />
                    {isAccepting && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={24}
                        fill="none"
                        stroke={color.stroke}
                        strokeWidth={1}
                      />
                    )}
                    <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill={color.text} fontSize={11} fontWeight={600} fontFamily="JetBrains Mono, monospace">
                      {s.label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────── CFG VISUALIZATION ───────────────── */
function CFGView({ cfg }) {
  const layout = useMemo(() => {
    if (!cfg || !cfg.nodes || cfg.nodes.length === 0) return null

    const nodes = cfg.nodes
    const nodeWidth = 240
    const nodeBaseHeight = 60
    const lineHeight = 20
    const yGap = 90
    const xCenter = 400

    // Calculate positions for each node (vertical layout)
    const positions = {}
    let currentY = 40
    nodes.forEach((node, i) => {
      const instrCount = (node.instructions || []).length
      const h = nodeBaseHeight + instrCount * lineHeight
      positions[node.id] = { x: xCenter - nodeWidth / 2, y: currentY, w: nodeWidth, h }
      currentY += h + yGap
    })

    return { positions, totalHeight: currentY + 40, totalWidth: xCenter * 2, yGap }
  }, [cfg])

  if (!cfg || !cfg.nodes || cfg.nodes.length === 0) {
    return <div className="empty-state"><div className="empty-state-icon">◇</div><div>No control flow data — write code with functions, loops, or conditionals</div></div>
  }
  if (!layout) return null

  const { positions, totalHeight, totalWidth, yGap } = layout

  return (
    <div className="automata-cfg-container">
      <svg width={totalWidth} height={totalHeight} className="automata-svg automata-cfg-svg">
        <defs>
          <marker id="cfg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
          </marker>
          <marker id="cfg-arrow-cond" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
          </marker>
          <filter id="cfg-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {(cfg.edges || []).map((edge, ei) => {
          const fromPos = positions[edge.from]
          const toPos = positions[edge.to]
          if (!fromPos || !toPos) return null

          const isCond = edge.label && edge.label.startsWith('if')
          const isFall = edge.label === 'fall'
          const color = isCond ? '#f59e0b' : isFall ? '#64748b' : '#8b5cf6'
          const marker = isCond ? 'url(#cfg-arrow-cond)' : 'url(#cfg-arrow)'

          const fromCx = fromPos.x + fromPos.w / 2
          const fromBottom = fromPos.y + fromPos.h
          const toCx = toPos.x + toPos.w / 2
          const toTop = toPos.y
          const posW = fromPos.w

          // Back edge (loop)
          if (toPos.y <= fromPos.y) {
            // Back edge — curve around the right side
            const rightX = fromPos.x + posW + 60
            const pFromX = fromCx + posW / 4
            const pToX = toCx + posW / 4
            return (
              <g key={ei}>
                <path
                  className={isFall ? "cfg-edge dashed" : "cfg-edge"}
                  d={`M ${pFromX} ${fromBottom} 
                      C ${rightX} ${fromBottom + 30}, ${rightX} ${toTop - 30}, ${pToX} ${toTop}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={isFall ? '4 4' : 'none'}
                  opacity={0.7}
                  markerEnd={marker}
                  style={{ animationDelay: `${ei * 0.1}s` }}
                />
                {!isFall && (
                  <path
                    className="flow-line"
                    d={`M ${pFromX} ${fromBottom} 
                        C ${rightX} ${fromBottom + 30}, ${rightX} ${toTop - 30}, ${pToX} ${toTop}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}
                {edge.label && !isFall && (
                  <>
                    <text x={rightX + 4} y={(fromBottom + toTop) / 2} fill="var(--bg-primary)" stroke="var(--bg-primary)" strokeWidth={4} strokeLinejoin="round" fontSize={11} fontFamily="JetBrains Mono, monospace">
                      {edge.label}
                    </text>
                    <text x={rightX + 4} y={(fromBottom + toTop) / 2} fill={color} fontSize={11} fontFamily="JetBrains Mono, monospace">
                      {edge.label}
                    </text>
                  </>
                )}
              </g>
            )
          }

          // Forward skip edge
          if (toTop - fromBottom > yGap + 10) {
            // Forward edge that skips a block — curve around the left side
            const leftX = fromPos.x - 60
            const pFromX = fromCx - posW / 4
            const pToX = toCx - posW / 4
            return (
              <g key={ei}>
                <path
                  className={isFall ? "cfg-edge dashed" : "cfg-edge"}
                  d={`M ${pFromX} ${fromBottom} 
                      C ${leftX} ${fromBottom + 40}, ${leftX} ${toTop - 40}, ${pToX} ${toTop - 8}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={isFall ? '4 4' : 'none'}
                  opacity={0.7}
                  markerEnd={marker}
                  style={{ animationDelay: `${ei * 0.1}s` }}
                />
                {!isFall && (
                  <path
                    className="flow-line"
                    d={`M ${pFromX} ${fromBottom} 
                        C ${leftX} ${fromBottom + 40}, ${leftX} ${toTop - 40}, ${pToX} ${toTop - 8}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}
                {edge.label && !isFall && (
                  <>
                    <text x={leftX - 4} y={(fromBottom + toTop) / 2} textAnchor="end" fill="var(--bg-primary)" stroke="var(--bg-primary)" strokeWidth={4} strokeLinejoin="round" fontSize={11} fontFamily="JetBrains Mono, monospace">
                      {edge.label}
                    </text>
                    <text x={leftX - 4} y={(fromBottom + toTop) / 2} textAnchor="end" fill={color} fontSize={11} fontFamily="JetBrains Mono, monospace">
                      {edge.label}
                    </text>
                  </>
                )}
              </g>
            )
          }

          // Adjacent forward edge — could be straight or offset
          const offsetX = isCond ? -20 : isFall ? 0 : 20
          if (Math.abs(fromCx - toCx) < 5 && isFall) {
            // Straight down
            return (
              <g key={ei}>
                <line
                  className={isFall ? "cfg-edge dashed" : "cfg-edge"}
                  x1={fromCx}
                  y1={fromBottom}
                  x2={toCx}
                  y2={toTop - 8}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeDasharray={isFall ? '4 4' : 'none'}
                  opacity={0.7}
                  markerEnd={marker}
                  style={{ animationDelay: `${ei * 0.1}s` }}
                />
                {!isFall && (
                  <line
                    className="flow-line"
                    x1={fromCx}
                    y1={fromBottom}
                    x2={toCx}
                    y2={toTop - 8}
                    stroke={color}
                    strokeWidth={1.5}
                  />
                )}
              </g>
            )
          }

          // Curved edge
          return (
            <g key={ei}>
              <path
                className={isFall ? "cfg-edge dashed" : "cfg-edge"}
                d={`M ${fromCx + offsetX} ${fromBottom} 
                    C ${fromCx + offsetX} ${fromBottom + 40}, ${toCx + offsetX} ${toTop - 40}, ${toCx + offsetX} ${toTop - 8}`}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={isFall ? '4 4' : 'none'}
                opacity={0.7}
                markerEnd={marker}
                style={{ animationDelay: `${ei * 0.1}s` }}
              />
              {!isFall && (
                <path
                  className="flow-line"
                  d={`M ${fromCx + offsetX} ${fromBottom} 
                      C ${fromCx + offsetX} ${fromBottom + 40}, ${toCx + offsetX} ${toTop - 40}, ${toCx + offsetX} ${toTop - 8}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                />
              )}
              {edge.label && !isFall && (
                <>
                  <text x={fromCx + offsetX - 8} y={(fromBottom + toTop) / 2} fill="var(--bg-primary)" stroke="var(--bg-primary)" strokeWidth={4} strokeLinejoin="round" fontSize={11} fontFamily="JetBrains Mono, monospace" textAnchor="end">
                    {edge.label}
                  </text>
                  <text x={fromCx + offsetX - 8} y={(fromBottom + toTop) / 2} fill={color} fontSize={11} fontFamily="JetBrains Mono, monospace" textAnchor="end">
                    {edge.label}
                  </text>
                </>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {cfg.nodes.map((node, i) => {
          const pos = positions[node.id]
          if (!pos) return null
          const isFunction = node.instructions?.some(i => i.includes('RET')) || node.label === node.id

          return (
            <g key={node.id} className="cfg-node-group" style={{ animationDelay: `${i * 0.1}s` }}>
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.w}
                height={pos.h}
                rx={8}
                ry={8}
                fill="rgba(26, 26, 58, 0.8)"
                stroke="rgba(139, 92, 246, 0.4)"
                strokeWidth={1.5}
              />
              {/* Block label bar */}
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.w}
                height={26}
                rx={8}
                ry={8}
                fill="rgba(139, 92, 246, 0.12)"
              />
              <rect
                x={pos.x}
                y={pos.y + 18}
                width={pos.w}
                height={8}
                fill="rgba(139, 92, 246, 0.12)"
              />
              <text x={pos.x + 12} y={pos.y + 18} fill="#c084fc" fontSize={12} fontWeight={700} fontFamily="JetBrains Mono, monospace">
                {node.label}:
              </text>

              {/* Instructions */}
              {(node.instructions || []).map((instr, ii) => {
                let instrColor = '#94a3b8'
                const s = instr.trim()
                if (s.startsWith('IF') || s.startsWith('GOTO')) instrColor = '#f59e0b'
                else if (s.startsWith('RET')) instrColor = '#f472b6'
                else if (s.includes('CALL')) instrColor = '#34d399'
                else if (s.includes('PARAM')) instrColor = '#60a5fa'

                return (
                  <text
                    key={ii}
                    x={pos.x + 14}
                    y={pos.y + 44 + ii * 20}
                    fill={instrColor}
                    fontSize={11}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {instr.trim()}
                  </text>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ───────────────── MAIN AUTOMATA VIEW ───────────────── */
export default function AutomataView({ automata }) {
  const [subTab, setSubTab] = useState('dfa')

  if (!automata) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⊛</div>
        <div>Compile code to see automata visualizations</div>
      </div>
    )
  }

  return (
    <div className="automata-view">
      <div className="automata-subtabs">
        <button
          className={`automata-subtab ${subTab === 'dfa' ? 'active' : ''}`}
          onClick={() => setSubTab('dfa')}
        >
          ⊛ Lexer DFA
        </button>
        <button
          className={`automata-subtab ${subTab === 'cfg' ? 'active' : ''}`}
          onClick={() => setSubTab('cfg')}
        >
          ◇ Control Flow Graph
        </button>
      </div>

      <div className="automata-content">
        {subTab === 'dfa' && <DFAView dfa={automata.dfa} />}
        {subTab === 'cfg' && <CFGView cfg={automata.cfg} />}
      </div>
    </div>
  )
}
