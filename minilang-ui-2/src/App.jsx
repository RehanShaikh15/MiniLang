import React, { useState, useEffect } from 'react';
import EditorModule from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c'; // MiniLang is C-like
import { 
  Code2, History, Settings, Play, CheckCircle, 
  AlertTriangle, RefreshCw, X, Lightbulb, 
  ChevronRight, Zap, Code, ShieldAlert, Cpu
} from 'lucide-react';
import AutomataView from './AutomataView';
import './App.css';

const Editor = EditorModule.default || EditorModule;

// Prism language definition for MiniLang
Prism.languages.minilang = Prism.languages.extend('c', {
  'keyword': /\b(?:int|void|func|return|if|else|while|for|break|continue|print)\b/,
  'type': /\b(?:int|void|string|bool)\b/,
});

const API_BASE = 'http://localhost:8000';

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
}`;

const WORKFLOW_STATES = {
  IDLE: 'IDLE',
  COMPILING: 'COMPILING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

function App() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [workflowState, setWorkflowState] = useState(WORKFLOW_STATES.IDLE);
  const [results, setResults] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRefactorLoading, setAiRefactorLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('tokens');
  
  const handleCompile = async () => {
    setWorkflowState(WORKFLOW_STATES.COMPILING);
    setErrorDetails(null);
    setResults(null);
    
    try {
      const response = await fetch(`${API_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      const data = await response.json();
      
      if (data.errors && data.errors.length > 0) {
        setResults(data);
        setWorkflowState(WORKFLOW_STATES.ERROR);
        const errObj = data.errors[0];
        const errorMsg = errObj.message ? `Line ${errObj.line}: ${errObj.message}` : JSON.stringify(errObj);
        explainError(errorMsg);
      } else {
        setResults(data);
        setWorkflowState(WORKFLOW_STATES.SUCCESS);
      }
    } catch (err) {
      setWorkflowState(WORKFLOW_STATES.ERROR);
      setErrorDetails({ 
        explanation: "Network Error: Could not connect to the compiler backend. Is the Python server running on port 8000?" 
      });
    }
  };

  const explainError = async (errStr) => {
    setAiLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/explain-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, error: errStr })
      });
      const data = await response.json();
      setErrorDetails({ original: errStr, explanation: data.explanation, fix: data.fix });
    } catch (e) {
      setErrorDetails({ original: errStr, explanation: "AI Service Unavailable" });
    }
    setAiLoading(false);
  };

  const handleRefactor = async () => {
    setAiRefactorLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/refactor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await response.json();
      if (data.refactored_code) {
        setCode(data.refactored_code);
        setWorkflowState(WORKFLOW_STATES.IDLE);
        setResults(null);
      }
    } catch (e) {
      console.error("Refactor failed", e);
    }
    setAiRefactorLoading(false);
  };

  const tabs = [
    { id: 'tokens', label: 'Tokens', count: results?.tokens?.length || 0 },
    { id: 'ast', label: 'AST', count: results?.ast ? 1 : 0 },
    { id: 'ir', label: 'IR Code', count: results?.ir?.length || 0 },
    { id: 'automata', label: 'Automata', count: results?.automata ? 1 : 0 },
    { id: 'output', label: 'Output', count: results?.output?.length || 0 },
    { id: 'errors', label: 'Errors', count: results?.errors?.length || 0 },
  ];

  return (
    <div className="app-container">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon"><Code2 size={16} /></div>
            <span>MiniLang</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item active"><Code size={16} /> Workspace</div>
          <div className="nav-item"><History size={16} /> Activity History</div>
          <div className="nav-item"><Cpu size={16} /> Compiler Settings</div>
          <div className="nav-item" style={{ marginTop: 'auto' }}><Settings size={16} /> Account</div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-area">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="breadcrumbs">
            MiniLang <ChevronRight size={14} /> Workspace <ChevronRight size={14} /> <span className="active">main.ml</span>
          </div>
          
          <div className="topbar-actions">
            <div className={`status-badge ${
              workflowState === WORKFLOW_STATES.SUCCESS ? 'ready' : 
              workflowState === WORKFLOW_STATES.ERROR ? 'error' : 
              workflowState === WORKFLOW_STATES.COMPILING ? 'processing' : 'ready'
            }`}>
              {workflowState === WORKFLOW_STATES.COMPILING ? (
                <><RefreshCw size={12} className="spin" /> Compiling</>
              ) : workflowState === WORKFLOW_STATES.SUCCESS ? (
                <><CheckCircle size={12} /> Success</>
              ) : workflowState === WORKFLOW_STATES.ERROR ? (
                <><ShieldAlert size={12} /> Failed</>
              ) : (
                <><CheckCircle size={12} /> System Ready</>
              )}
            </div>
            
            <button 
              className="btn btn-secondary" 
              onClick={handleRefactor}
              disabled={aiRefactorLoading || workflowState === WORKFLOW_STATES.COMPILING}
            >
              {aiRefactorLoading ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />} 
              AI Refactor
            </button>
            
            <button 
              className="btn btn-primary" 
              onClick={handleCompile}
              disabled={workflowState === WORKFLOW_STATES.COMPILING}
            >
              {workflowState === WORKFLOW_STATES.COMPILING ? (
                <><RefreshCw size={14} className="spin" /> Processing...</>
              ) : (
                <><Play size={14} /> Compile & Run</>
              )}
            </button>
          </div>
        </header>

        {/* WORKSPACE (SPLIT PANE) */}
        <div className="workspace">
          
          {/* LEFT: CODE EDITOR */}
          <div className="pane-left">
            <div className="pane-header">
              <span>main.ml</span>
            </div>
            <div className="editor-container">
              <div className="editor-wrapper">
                <Editor
                  value={code}
                  onValueChange={code => setCode(code)}
                  highlight={code => Prism.highlight(code, Prism.languages.minilang, 'minilang')}
                  padding={0}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 14,
                    minHeight: '100%',
                  }}
                  textareaClassName="focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: OUTPUT & AI INTELLIGENCE */}
          <div className="pane-right">
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
              {workflowState === WORKFLOW_STATES.IDLE && (
                <div className="empty-state">
                  <div className="empty-state-icon">⚡</div>
                  <div>Click <strong>Compile & Run</strong> to see the output here</div>
                </div>
              )}
              
              {workflowState === WORKFLOW_STATES.COMPILING && (
                <div className="output-placeholder">
                  <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
                  <div>Generating AST and Intermediate Representation...</div>
                </div>
              )}

              {(workflowState === WORKFLOW_STATES.SUCCESS || workflowState === WORKFLOW_STATES.ERROR) && results && (
                <>
                  {activeTab === 'tokens' && (
                    <table className="token-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Value</th>
                          <th>Line:Col</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.tokens?.map((t, i) => (
                          <tr key={i}>
                            <td className="token-type">{t.type}</td>
                            <td className="token-value">{t.value}</td>
                            <td className="token-location">{t.line}:{t.col}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'ast' && results.ast && (
                    <ASTTreeNode node={results.ast} depth={0} />
                  )}

                  {activeTab === 'ir' && results.ir && (
                    <div className="ir-code">
                      {results.ir.map((line, i) => (
                        <div key={i} className={`ir-${line.type}`}>{line.text}</div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'automata' && results.automata && (
                    <AutomataView automata={results.automata} />
                  )}

                  {activeTab === 'output' && (
                    (!results.output || results.output.length === 0) ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">💻</div>
                        <div>No output — program did not produce any print statements</div>
                      </div>
                    ) : (
                      <div className="program-output">
                        <div className="output-terminal">
                          {results.output.map((line, i) => (
                            <div key={i} className={`output-line ${line.startsWith('[Runtime Error]') ? 'output-error' : ''}`}>
                              <span className="output-prompt">{'>'}</span> {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}

                  {activeTab === 'errors' && (
                    (!results.errors || results.errors.length === 0) ? (
                      <div className="success-message">
                        <div className="success-icon">✓</div>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>Compilation Successful</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No errors found</div>
                      </div>
                    ) : (
                      results.errors.map((err, i) => (
                        <div key={i} className="error-item">
                          <div className="error-header">⚠ {err.message || err}</div>
                          {err.line > 0 && (
                            <div className="error-location">Line {err.line}, Column {err.col}</div>
                          )}
                          
                          {aiLoading ? (
                            <div className="output-placeholder" style={{ height: 160, marginTop: 12 }}>
                              <RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)' }} />
                              <div style={{ fontSize: 13 }}>AI is analyzing the error...</div>
                            </div>
                          ) : errorDetails ? (
                            <div className="ai-explanation" style={{ marginTop: 12 }}>
                              <div className="ai-section">
                                <div className="ai-label"><Lightbulb size={14} /> Why this happened</div>
                                <div className="ai-text">{errorDetails.explanation}</div>
                              </div>
                              
                              {errorDetails.fix && (
                                <div className="ai-section" style={{ marginTop: 24 }}>
                                  <div className="ai-label" style={{ color: 'var(--success)' }}>
                                    <CheckCircle size={14} /> Suggested Fix
                                  </div>
                                  <div className="ai-code" style={{ borderColor: 'var(--success-bg)' }}>{errorDetails.fix}</div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))
                    )
                  )}
                </>
              )}
            </div>
          </div>
          
        </div>
      </main>

      {/* TECHNICAL DRAWER (AST / Tokens) */}
      {showDrawer && (
        <>
          <div className="drawer-overlay" onClick={() => setShowDrawer(false)} />
          <div className="drawer">
            <div className="drawer-header">
              <span className="drawer-title flex items-center gap-2">
                <Cpu size={16} style={{ color: 'var(--accent-primary)' }}/> System Trace
              </span>
              <button className="btn btn-secondary" style={{ padding: 6, height: 28 }} onClick={() => setShowDrawer(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="drawer-content">
              {results ? (
                <>
                  <details>
                    <summary><ChevronRight size={14} /> Lexer Tokens ({results.tokens?.length})</summary>
                    <div className="details-content">
                      {JSON.stringify(results.tokens, null, 2)}
                    </div>
                  </details>
                  
                  <details>
                    <summary><ChevronRight size={14} /> Abstract Syntax Tree (AST)</summary>
                    <div className="details-content">
                      {JSON.stringify(results.ast, null, 2)}
                    </div>
                  </details>

                  {results.automata && (
                    <details>
                      <summary><ChevronRight size={14} /> Automata Graph</summary>
                      <div className="details-content">
                        {JSON.stringify(results.automata, null, 2)}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="text-muted" style={{ textAlign: 'center', marginTop: 60 }}>
                  No compilation trace available.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// AST Tree Component
function ASTTreeNode({ node, depth }) {
  const [expanded, setExpanded] = useState(depth < 3);
  const hasChildren = node.children && node.children.length > 0;

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
  );
}

export default App;
