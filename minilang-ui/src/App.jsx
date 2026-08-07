import { useState, useRef, useCallback, useEffect } from 'react'
import AutomataView from './AutomataView'
import './App.css'

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
  const textareaRef = useRef(null)

  const lineCount = code.split('\n').length

  const handleCompile = useCallback(async () => {
    setStatus('compiling')
    setErrors([])

    try {
      const response = await fetch('http://localhost:8000', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  useEffect(() => {
    const handler = setTimeout(() => {
      handleCompile()
    }, 500) // 500ms debounce
    return () => clearTimeout(handler)
  }, [handleCompile])

  const handleClear = () => {
    setCode('')
    setTokens([])
    setAst(null)
    setIrCode([])
    setAutomata(null)
    setErrors([])
    setStatus('ready')
    setCompiledOnce(false)
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
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Compiler IDE</span>
        </div>
        <div className="navbar-actions">
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
            <span className="panel-header-badge">MiniLang v1.0</span>
          </div>
          <div className="editor-container">
            <div className="line-numbers">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="code-textarea"
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
              placeholder="Write your MiniLang code here..."
            />
          </div>
        </div>

        {/* Resizer */}
        <div className="resizer" />

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
          <span>Lines: {lineCount}</span>
          <span>MiniLang v1.0</span>
        </div>
      </div>
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
