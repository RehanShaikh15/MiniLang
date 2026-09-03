import { useState, useRef, useCallback, useEffect } from 'react'
import AutomataView from './AutomataView'
import CodeEditor from './CodeEditor'
import './App.css'

const API_BASE = 'http://localhost:8000'

const SAMPLE_CODE = `// MiniLang Sample Program
int x = 10;
int y = 5;

func add(a: int, b: int) -> int {
    return a + b;
}

func main() -> void {
    int sum = add(x, y);
    print("The sum is:");
    print(sum);
    
    if (sum > 10) {
        print("Sum is greater than 10");
    } else {
        print("Sum is 10 or less");
    }
}`

function App() {
  const [code, setCode] = useState(SAMPLE_CODE)
  const [activeTab, setActiveTab] = useState('tokens')
  const [status, setStatus] = useState('ready') // ready | compiling | success | error
  const [tokens, setTokens] = useState([])
  const [ast, setAst] = useState(null)
  const [irCode, setIrCode] = useState([])
  const [automata, setAutomata] = useState(null)
  const [errors, setErrors] = useState([])
  const [compiledOnce, setCompiledOnce] = useState(false)

  // AI Feature States
  const [suggestion, setSuggestion] = useState(null)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 0 })
  const [errorExplanations, setErrorExplanations] = useState({}) // keyed by error index
  const [explainLoading, setExplainLoading] = useState({})
  const [refactorResult, setRefactorResult] = useState(null) // { suggestions: [...] }
  const [refactorLoading, setRefactorLoading] = useState(false)
  const [showRefactorPopover, setShowRefactorPopover] = useState(false)
  const [refactorRange, setRefactorRange] = useState({ start: 0, end: 0, originalText: '' })
  const [docsLoading, setDocsLoading] = useState(false)
  const [toast, setToast] = useState(null) // { message, type }

  const abortControllerRef = useRef(null)

  const lineCount = code.split('\n').length

  // ─────────────────────────────────────────────
  // Compile
  // ─────────────────────────────────────────────
  const handleCompile = useCallback(async () => {
    setStatus('compiling')
    setErrors([])
    setErrorExplanations({})

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      
      if (!response.ok && response.status !== 400) {
        throw new Error(`Server returned status: ${response.status}`)
      }
      
      const data = await response.json()
      
      setTokens(data.tokens || [])
      setAst(data.ast || null)
      setIrCode(data.ir || [])
      setAutomata(data.automata || null)
      
      if (data.status === 'success') {
        setStatus('success')
        setCompiledOnce(true)
      } else {
        setErrors(data.errors || [])
        setStatus('error')
        setCompiledOnce(true)
      }
    } catch (err) {
      setErrors([{ message: 'Failed to connect to compiler API. Is the server running (python server.py)?', line: 0, col: 0 }])
      setStatus('error')
      setCompiledOnce(true)
    }
  }, [code])

  // Auto-compile on code change (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      handleCompile()
    }, 500)
    return () => clearTimeout(handler)
  }, [handleCompile])

  // ─────────────────────────────────────────────
  // AI Feature 1: Autocomplete
  // ─────────────────────────────────────────────

  // Cursor tracking (lightweight — no API calls)
  const handleCursorChange = useCallback(({ line, col }) => {
    setCursorInfo({ line, col })
  }, [])

  // Clear suggestion whenever the user types (code changes)
  useEffect(() => {
    setSuggestion(null)
    // Cancel any in-flight request when the user starts typing again
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [code])

  // Ctrl+Space — manually trigger autocomplete
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (!(e.ctrlKey && e.code === 'Space')) return
      e.preventDefault()

      // Don't autocomplete on very short code
      if (code.trim().length < 5) return

      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Grab cursor position at the moment the shortcut fires
      const textarea = document.querySelector('.code-textarea')
      if (!textarea) return
      const pos = textarea.selectionStart
      const textBefore = code.substring(0, pos)
      const linesArr = textBefore.split('\n')
      const line = linesArr.length
      const col = linesArr[linesArr.length - 1].length

      // Skip if current line is a comment
      const currentLine = code.split('\n')[line - 1] || ''
      if (currentLine.trim().startsWith('//')) return

      const controller = new AbortController()
      abortControllerRef.current = controller

      setAutocompleteLoading(true)
      setSuggestion(null)
      try {
        const response = await fetch(`${API_BASE}/api/autocomplete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, cursorLine: line, cursorCol: col }),
          signal: controller.signal
        })
        const data = await response.json()
        if (!controller.signal.aborted) {
          setSuggestion(data.suggestion || null)
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Autocomplete error:', err)
        }
      }
      if (!controller.signal.aborted) {
        setAutocompleteLoading(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [code]) // re-bind when code changes so the closure has the latest value

  const handleAcceptSuggestion = useCallback(() => {
    if (!suggestion) return

    // Insert suggestion at cursor position
    const textarea = document.querySelector('.code-textarea')
    if (!textarea) return
    const pos = textarea.selectionStart
    const before = code.substring(0, pos)
    const after = code.substring(pos)
    setCode(before + suggestion + after)

    setSuggestion(null)
  }, [suggestion, code])

  // ─────────────────────────────────────────────
  // AI Feature 2: Error Explanation
  // ─────────────────────────────────────────────
  const handleExplainError = useCallback(async (errorIndex, errorMessage) => {
    setExplainLoading(prev => ({ ...prev, [errorIndex]: true }))

    try {
      const response = await fetch(`${API_BASE}/api/explain-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: errorMessage, code })
      })
      const data = await response.json()
      setErrorExplanations(prev => ({ ...prev, [errorIndex]: data }))
    } catch (err) {
      setErrorExplanations(prev => ({
        ...prev,
        [errorIndex]: { explanation: 'Failed to connect to AI service.', suggestion: '', example: '' }
      }))
    }

    setExplainLoading(prev => ({ ...prev, [errorIndex]: false }))
  }, [code])

  // ─────────────────────────────────────────────
  // AI Feature 3: Refactoring
  // ─────────────────────────────────────────────
  const handleRefactor = useCallback(async () => {
    // Get selected text from the code
    const textarea = document.querySelector('.code-textarea')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selection = code.substring(start, end)

    if (!selection.trim()) {
      showToast('Select some code first to refactor', 'warning')
      return
    }

    // Store both the range AND the original selected text for safe replacement
    setRefactorRange({ start, end, originalText: selection })
    setRefactorLoading(true)
    setRefactorResult(null)
    setShowRefactorPopover(true)

    try {
      const response = await fetch(`${API_BASE}/api/refactor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, selection })
      })
      const data = await response.json()
      setRefactorResult(data)
    } catch (err) {
      setRefactorResult({ suggestions: null, error: 'Failed to connect to AI service.' })
    }

    setRefactorLoading(false)
  }, [code])

  const applyRefactoring = useCallback((refactoredCode) => {
    if (!refactoredCode || !refactoredCode.trim()) {
      showToast('No refactored code to apply', 'warning')
      return
    }

    const { start, end, originalText } = refactorRange

    // Strategy 1: Use the original selected text to find and replace (most robust)
    if (originalText && code.includes(originalText)) {
      const newCode = code.replace(originalText, refactoredCode)
      setCode(newCode)
    } else {
      // Strategy 2: Fall back to index-based replacement
      const before = code.substring(0, start)
      const after = code.substring(end)
      setCode(before + refactoredCode + after)
    }

    setShowRefactorPopover(false)
    setRefactorResult(null)
    showToast('Refactoring applied!', 'success')
  }, [code, refactorRange])

  // Keyboard shortcut: Ctrl+Shift+R for refactor
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        handleRefactor()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRefactor])

  // ─────────────────────────────────────────────
  // AI Feature 4: Documentation Generator
  // ─────────────────────────────────────────────
  const handleGenerateDocs = useCallback(async () => {
    setDocsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/generate-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, targetLine: cursorInfo.line })
      })
      const data = await response.json()

      if (data.documentation && data.insertLine) {
        // Insert docs above the target line
        const lines = code.split('\n')
        const insertIdx = data.insertLine - 1
        const indent = lines[insertIdx] ? lines[insertIdx].match(/^(\s*)/)[1] : ''
        const docLines = data.documentation.split('\n').map(l => indent + l)
        lines.splice(insertIdx, 0, ...docLines)
        setCode(lines.join('\n'))
        showToast(`Documentation generated for ${data.targetKind}`, 'success')
      } else {
        showToast(data.error || 'No target found at cursor line', 'warning')
      }
    } catch (err) {
      showToast('Failed to connect to AI service', 'error')
    }

    setDocsLoading(false)
  }, [code, cursorInfo])

  // ─────────────────────────────────────────────
  // Toast Notifications
  // ─────────────────────────────────────────────
  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─────────────────────────────────────────────
  // Clear
  // ─────────────────────────────────────────────
  const handleClear = () => {
    setCode('')
    setTokens([])
    setAst(null)
    setIrCode([])
    setAutomata(null)
    setErrors([])
    setStatus('ready')
    setCompiledOnce(false)
    setSuggestion(null)
    setErrorExplanations({})
    setRefactorResult(null)
    setShowRefactorPopover(false)
  }

  const tabs = [
    { id: 'tokens', label: 'Tokens', count: tokens.length },
    { id: 'ast', label: 'AST', count: ast ? 1 : 0 },
    { id: 'ir', label: 'IR Code', count: irCode.length },
    { id: 'automata', label: 'Automata', count: automata ? 1 : 0 },
    { id: 'errors', label: 'Errors', count: errors.length },
  ]

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <div className="logo-icon">M</div>
            <span>MiniLang</span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>AI-Powered Compiler IDE</span>
        </div>
        <div className="navbar-actions">
          <button className="btn btn-ai" onClick={handleGenerateDocs} disabled={docsLoading} title="Generate docs for function at cursor">
            {docsLoading ? '⟳' : '📄'} Docs
          </button>
          <button className="btn btn-ai" onClick={handleRefactor} disabled={refactorLoading} title="Refactor selected code (Ctrl+Shift+R)">
            {refactorLoading ? '⟳' : '💡'} Refactor
          </button>
          <button className="btn btn-compile" onClick={handleCompile} disabled={status === 'compiling'}>
            {status === 'compiling' ? '⟳ Compiling...' : '▶ Compile'}
          </button>
          <button className="btn btn-clear" onClick={handleClear}>
            ✕ Clear
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="main-content">
        {/* Editor Panel */}
        <div className="editor-panel">
          <div className="panel-header">
            <span>📝 Code Editor</span>
            <div className="panel-header-right">
              {autocompleteLoading && (
                <span className="ai-loading-badge">
                  <span className="ai-spinner"></span>
                  AI
                </span>
              )}
              <span className="panel-header-badge">MiniLang v1.0</span>
            </div>
          </div>
          <div className="editor-container">
            <CodeEditor
              code={code}
              onChange={setCode}
              suggestion={suggestion}
              onAcceptSuggestion={handleAcceptSuggestion}
              onCursorChange={handleCursorChange}
            />
          </div>
        </div>

        {/* Resizer */}
        <div className="resizer" />

        {/* Refactor Popover */}
        {showRefactorPopover && (
          <div className="refactor-overlay" onClick={() => setShowRefactorPopover(false)}>
            <div className="refactor-popover" onClick={e => e.stopPropagation()}>
              <div className="refactor-header">
                <span>💡 Refactoring Suggestions</span>
                <button className="refactor-close" onClick={() => setShowRefactorPopover(false)}>✕</button>
              </div>
              <div className="refactor-body">
                {refactorLoading && (
                  <div className="refactor-loading">
                    <span className="ai-spinner large"></span>
                    <span>Analyzing code...</span>
                  </div>
                )}
                {!refactorLoading && refactorResult?.suggestions && refactorResult.suggestions.map((s, i) => (
                  <div key={i} className="refactor-suggestion">
                    <div className="refactor-suggestion-title">{s.title}</div>
                    <div className="refactor-suggestion-desc">{s.description}</div>
                    <pre className="refactor-suggestion-code">{s.refactoredCode}</pre>
                    <button 
                      className="btn btn-apply" 
                      onClick={() => applyRefactoring(s.refactoredCode)}
                      disabled={!s.refactoredCode}
                    >
                      ✓ Apply
                    </button>
                  </div>
                ))}
                {!refactorLoading && refactorResult?.error && (
                  <div className="refactor-error">{refactorResult.error}</div>
                )}
                {!refactorLoading && !refactorResult?.suggestions && !refactorResult?.error && (
                  <div className="refactor-error">No suggestions available.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Output Panel */}
        <div className="output-panel">
          <div className="output-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`output-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="output-content">
            {!compiledOnce && (
              <div className="empty-state">
                <div className="empty-state-icon">⚡</div>
                <div>Click <strong>Compile</strong> to see the output here</div>
              </div>
            )}

            {compiledOnce && activeTab === 'tokens' && (
              <table className="token-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Value</th>
                    <th>Line:Col</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t, i) => (
                    <tr key={i}>
                      <td className="token-type">{t.type}</td>
                      <td className="token-value">{t.value}</td>
                      <td className="token-location">{t.line}:{t.col}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {compiledOnce && activeTab === 'ast' && ast && (
              <ASTTreeNode node={ast} depth={0} />
            )}

            {compiledOnce && activeTab === 'ir' && (
              <div className="ir-code">
                {irCode.map((line, i) => (
                  <div key={i} className={`ir-${line.type}`}>{line.text}</div>
                ))}
              </div>
            )}

            {compiledOnce && activeTab === 'automata' && (
              <AutomataView automata={automata} />
            )}

            {compiledOnce && activeTab === 'errors' && (
              errors.length === 0 ? (
                <div className="success-message">
                  <div className="success-icon">✓</div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Compilation Successful</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No errors found</div>
                </div>
              ) : (
                errors.map((err, i) => (
                  <div key={i} className="error-item">
                    <div className="error-header">⚠ {err.message}</div>
                    {err.line > 0 && (
                      <div className="error-location">Line {err.line}, Column {err.col}</div>
                    )}
                    {/* AI Error Explanation */}
                    {!errorExplanations[i] && (
                      <button
                        className="btn btn-explain"
                        onClick={() => handleExplainError(i, err.message)}
                        disabled={explainLoading[i]}
                      >
                        {explainLoading[i] ? (
                          <><span className="ai-spinner"></span> Analyzing...</>
                        ) : (
                          '✨ Explain this error'
                        )}
                      </button>
                    )}
                    {errorExplanations[i] && (
                      <div className="error-explanation">
                        <div className="error-explanation-section">
                          <div className="error-explanation-label">💡 Explanation</div>
                          <div className="error-explanation-text">{errorExplanations[i].explanation}</div>
                        </div>
                        {errorExplanations[i].suggestion && (
                          <div className="error-explanation-section">
                            <div className="error-explanation-label">🔧 How to fix</div>
                            <div className="error-explanation-text">{errorExplanations[i].suggestion}</div>
                          </div>
                        )}
                        {errorExplanations[i].example && (
                          <div className="error-explanation-section">
                            <div className="error-explanation-label">📝 Corrected code</div>
                            <pre className="error-explanation-code">{errorExplanations[i].example}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <div className="status-indicator">
            <div className={`status-dot ${status === 'compiling' ? 'compiling' : status === 'error' ? 'error' : 'ready'}`} />
            <span>
              {status === 'ready' && 'Ready'}
              {status === 'compiling' && 'Compiling...'}
              {status === 'success' && 'Compilation successful'}
              {status === 'error' && 'Compilation failed'}
            </span>
          </div>
        </div>
        <div className="status-right">
          <span>Ln {cursorInfo.line}, Col {cursorInfo.col}</span>
          <span>Lines: {lineCount}</span>
          {suggestion && <span className="status-hint">Tab to accept • Esc to dismiss</span>}
          <span>MiniLang v1.0</span>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'warning' && '⚠ '}
          {toast.type === 'error' && '✕ '}
          {toast.message}
        </div>
      )}
    </>
  )
}

// AST Tree Component
function ASTTreeNode({ node, depth }) {
  const [expanded, setExpanded] = useState(depth < 3)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="ast-node" style={{ marginLeft: depth === 0 ? 0 : 20 }}>
      <div className="ast-node-label" onClick={() => setExpanded(!expanded)}>
        {hasChildren && (
          <span className="ast-toggle">{expanded ? '▾' : '▸'}</span>
        )}
        {!hasChildren && <span className="ast-toggle">•</span>}
        <span className="ast-node-type">{node.type}</span>
        {node.props && <span className="ast-node-props">({node.props})</span>}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <ASTTreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default App
