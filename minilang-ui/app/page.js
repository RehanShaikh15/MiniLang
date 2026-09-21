"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Trash2,
  BookOpen,
  WandSparkles,
  CheckCircle2,
  Terminal,
  Command,
  Code2,
  Braces,
  Cpu,
  Workflow,
  AlertCircle,
  Zap,
  Sparkles,
  Search,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import AutomataGraph from "../components/AutomataGraph";

const source = `// MiniLang Sample Program
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

const tabsConfig = [
  ["Tokens", Code2],
  ["AST", Braces],
  ["IR Code", Cpu],
  ["Automata", Workflow],
  ["Output", Terminal],
  ["Errors", AlertCircle],
];

// tokenRows removed since it is dynamic now

function PanelTitle({ icon: Icon, children, hint }) {
  return (
    <div className="panel-title">
      <span className="title-icon"><Icon size={15} /></span>
      <span>{children}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export default function Home() {
  const [code, setCode] = useState(source);
  const [mode, setMode] = useState("API");
  const [tab, setTab] = useState("Tokens");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [dfa, setDfa] = useState("Lexer DFA");
  const [palette, setPalette] = useState(false);
  const [compileResult, setCompileResult] = useState({
    tokens: [],
    ast: null,
    ir: [],
    automata: null,
    output: [],
    errors: [],
  });
  const [aiRunning, setAiRunning] = useState(false);
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const overlayRef = useRef(null);
  
  const handleEditorScroll = (e) => {
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(-${e.target.scrollTop}px)`;
    }
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.target.scrollTop;
      overlayRef.current.scrollLeft = e.target.scrollLeft;
    }
  };
  const [open, setOpen] = useState({
    Program: true,
    FunctionDeclaration: true,
    BlockStatement: true,
    VariableDeclaration: true,
  });

  const lines = useMemo(() => code.split("\n"), [code]);

  const highlightedCode = useMemo(() => {
    return lines.map((line, i) => {
      const isComment = line.trim().startsWith('//');
      return (
        <span key={i}>
          {isComment ? <span style={{ color: '#526c8a' }}>{line}</span> : <span>{line}</span>}
          {i < lines.length - 1 ? '\n' : ''}
        </span>
      );
    });
  }, [lines]);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 0 });

  const updateCursorPos = () => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const textBefore = code.substring(0, pos);
      const linesBefore = textBefore.split('\n');
      setCursorPos({
        line: linesBefore.length,
        col: linesBefore[linesBefore.length - 1].length
      });
    }
  };

  const handleEditorKeyDown = async (e) => {
    // Handle Ctrl+Space for Autocomplete
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault();
      if (aiRunning) return;
      
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const pos = textarea.selectionStart;
      const textBefore = code.substring(0, pos);
      const linesBefore = textBefore.split('\n');
      const cursorLine = linesBefore.length;
      const cursorCol = linesBefore[linesBefore.length - 1].length;
      
      setAiRunning(true);
      try {
        const response = await fetch("http://localhost:8000/api/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            code, 
            cursorLine, 
            cursorCol, 
            backend: mode === "Local" ? "ollama" : "groq" 
          }),
        });
        
        const data = await response.json();
        if (data.suggestion) {
          const newCode = code.substring(0, pos) + data.suggestion + code.substring(pos);
          setCode(newCode);
          
          // Restore cursor position after inserted text
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = pos + data.suggestion.length;
              textareaRef.current.selectionEnd = pos + data.suggestion.length;
              textareaRef.current.focus();
              updateCursorPos();
            }
          }, 10);
        } else if (data.error) {
          alert("Autocomplete Error: " + data.error);
        }
      } catch (err) {
        console.error("Autocomplete failed", err);
      } finally {
        setAiRunning(false);
      }
    }
  };

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
      if (event.key === "Escape") setPalette(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const compile = async () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    setCleared(false);

    let value = 0;
    const timer = setInterval(() => {
      value += 15;
      if (value > 85) value = 85;
      setProgress(value);
    }, 100);

    try { 
        if (true) { const response = await fetch("http://localhost:8000/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, backend: mode === "Local" ? "ollama" : "groq" }),
        });
        const data = await response.json();
        
        setCompileResult({
          tokens: data.tokens || [],
          ast: data.ast || null,
          ir: data.ir || [],
          automata: data.automata || null,
          output: data.output || [],
          errors: data.errors || [],
        });
        
        if (data.errors && data.errors.length > 0) {
          setTab("Errors");
        } else {
          setTab("Output");
        }
      } else {
        // Fallback simulation
        setTimeout(() => {
          setTab("Output");
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      setCompileResult(prev => ({
        ...prev,
        errors: [{ message: "Failed to connect to backend: " + err.message, line: 0, col: 0 }]
      }));
      setTab("Errors");
    } finally {
      clearInterval(timer);
      setProgress(100);
      setTimeout(() => setRunning(false), 300);
    }
  };

  const clear = () => {
    setCode("");
    setCleared(true);
    setRunning(false);
    setProgress(0);
    setTab("Errors");
    setCompileResult({ tokens: [], ast: null, ir: [], automata: null, output: [], errors: [] });
  };

  const choose = (selectedTab) => {
    setTab(selectedTab);
    setPalette(false);
  };

  const refactor = async () => {
    if (!code.trim() || aiRunning) return;
    
    const textarea = textareaRef.current;
    let selectionText = "";
    let startPos = 0;
    let endPos = 0;
    
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      startPos = textarea.selectionStart;
      endPos = textarea.selectionEnd;
      selectionText = code.substring(startPos, endPos);
    } else {
      alert("Please highlight the portion of code you want to refactor first!");
      return;
    }
    
    setAiRunning(true);
    try { 
        if (true) { const response = await fetch("http://localhost:8000/api/refactor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, selection: selectionText, backend: mode === "Local" ? "ollama" : "groq" }),
        });
        const data = await response.json();
        
        let refactoredChunk = "";
        if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          refactoredChunk = data.suggestions[0].refactoredCode || data.suggestions[0].code || selectionText;
        } else if (typeof data.suggestions === 'string') {
          refactoredChunk = data.suggestions;
        } else if (data.error) {
          console.error("AI Error:", data.error);
          alert("AI Error: " + data.error);
          return;
        }
        
        if (refactoredChunk) {
          const newCode = code.substring(0, startPos) + refactoredChunk + code.substring(endPos);
          setCode(newCode);
        }
      } else {
        const formatted = selectionText
          .replace(/\s+/g, " ")
          .replace(/\{\s*/g, "{\n  ")
          .replace(/\s*\}/g, "\n}")
          .replace(/;\s*/g, ";\n  ")
          .replace(/\n\s*\n\s*\}/g, "\n}")
          .trim();
        const newCode = code.substring(0, startPos) + formatted + code.substring(endPos);
        setCode(newCode);
      }
    } catch (err) {
      console.error("Refactor failed:", err);
    } finally {
      setAiRunning(false);
    }
  };

  const generateDocs = async () => {
    if (!code.trim() || aiRunning) return;
    
    setAiRunning(true);
    try { 
        if (true) { const response = await fetch("http://localhost:8000/api/generate-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, backend: mode === "Local" ? "ollama" : "groq" }),
        });
        const data = await response.json();
        
        if (data.documentation) {
          setCode(data.documentation);
        } else if (data.error) {
          console.error("AI Error:", data.error);
          alert("AI Error: " + data.error);
        }
      } else {
        window.alert("Compiler pipeline: Source → Tokens → AST → IR → Automata → Output");
      }
    } catch (err) {
      console.error("Doc generation failed:", err);
    } finally {
      setAiRunning(false);
    }
  };

  const getTabCount = (name) => {
    switch (name) {
      case "Tokens": return compileResult.tokens.length;
      case "AST": return compileResult.ast ? 1 : 0;
      case "IR Code": return compileResult.ir.length;
      case "Automata": return compileResult.automata ? 2 : 0;
      case "Output": return compileResult.output.length;
      case "Errors": return compileResult.errors.length;
      default: return 0;
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo"><Zap size={19} /></div>
          <div>
            <div className="brand-name">Compiler<span>Lab</span></div>
            <div className="subtitle">Interactive compiler inspector</div>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" className="command-hint" onClick={() => setPalette(true)}>
            <Command size={12} /> K
          </button>

          <div className="mode">
            <span className="mode-dot" />
            {mode}
            <button type="button" aria-label="Toggle compiler mode" onClick={() => setMode(mode === "Local" ? "API" : "Local")}>
              <span className={mode === "API" ? "knob api" : "knob"} />
            </button>
          </div>

          <span className="version">v2.5.0</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">SOURCE → ANALYSIS → EXECUTION</div>
          <h1>See your code <em>come alive.</em></h1>
          <p>Trace every compiler stage in a visual workspace built for fast frontend demos.</p>
        </div>

        <div className="hero-orbit">
          <div className="orbit-ring" />
          <div className="orbit-core"><Sparkles size={25} /></div>
          <span className="orbit-node n1">LEX</span>
          <span className="orbit-node n2">AST</span>
          <span className="orbit-node n3">IR</span>
        </div>
      </section>

      {running && (
        <motion.div className="progress-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="progress-label">
            <span><CircleDot size={13} /> Compiler pipeline running</span>
            <b>{progress}%</b>
          </div>
          <div className="progress-track">
            <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} />
          </div>
          <div className="progress-steps">
            <span>Lexing</span><span>Parsing</span><span>AST</span><span>IR</span><span>Runtime</span>
          </div>
        </motion.div>
      )}

      <section className="toolbar">
        <div className="toolbar-left">
          <button type="button" className="ghost" onClick={generateDocs}><BookOpen size={16} /> Gen Docs</button>
          <button type="button" className="ghost" onClick={refactor}><WandSparkles size={16} /> Refactor</button>
        </div>
        <div className="toolbar-right">
          <button type="button" className="primary" onClick={compile} disabled={running}>
            <Play size={16} fill="currentColor" /> {running ? "Compiling…" : "Compile"}
          </button>
          <button type="button" className="clear" onClick={clear}><Trash2 size={16} /> Clear</button>
        </div>
      </section>

      <section className="workspace">
        <div className="editor panel">
          <PanelTitle icon={Code2} hint={`${lines.length} lines`}>Source Code</PanelTitle>
          <div className="editor-body">
            <div className="gutter" ref={gutterRef}>
              {lines.map((_, index) => (
                <div key={index} className={index === 1 ? "active-line" : ""}>
                  {String(index + 1).padStart(2, "0")}
                </div>
              ))}
            </div>
            <div className="editor-input-wrap">
              <div className="editor-overlay" ref={overlayRef} aria-hidden="true">
                {highlightedCode}
              </div>
              <textarea ref={textareaRef} onScroll={handleEditorScroll} value={code} onChange={(event) => { setCode(event.target.value); setCleared(false); updateCursorPos(); }} onClick={updateCursorPos} onKeyUp={updateCursorPos} onKeyDown={handleEditorKeyDown} spellCheck="false" aria-label="Source code editor" />
            </div>
            {running && (
              <motion.div className="cursor-beam" animate={{ top: [25, 210, 360, 510] }} transition={{ duration: 1.05, ease: "easeInOut", repeat: Infinity }} />
            )}
          </div>
          <div className="editor-footer">
            <span>Ln {cursorPos.line}, Col {cursorPos.col + 1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AnimatePresence>
                {aiRunning && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      color: '#c59aff', background: '#211b39',
                      padding: '2px 8px', borderRadius: '12px', border: '1px solid #c59aff44'
                    }}
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ display: 'flex' }}>
                      <Sparkles size={10} />
                    </motion.div>
                    AI thinking...
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="language">● MiniLang</span>
            </div>
          </div>
        </div>

        <div className="inspector panel">
          <div className="tabs">
            {tabsConfig.map(([name, Icon]) => (
              <button type="button" key={name} className={tab === name ? "tab active" : "tab"} onClick={() => setTab(name)}>
                <Icon size={14} /> {name} <b>{getTabCount(name)}</b>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div className="view" key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {tab === "Tokens" && <Tokens tokens={compileResult.tokens} />}
              {tab === "AST" && <AST ast={compileResult.ast} open={open} setOpen={setOpen} />}
              {tab === "IR Code" && <IR ir={compileResult.ir} />}
              {tab === "Automata" && (
                <>
                  <div className="view-head">
                    <div>
                      <h2>Machine diagrams</h2>
                      <p>Drag, zoom and inspect compiler state transitions</p>
                    </div>
                    <div className="seg">
                      <button type="button" className={dfa === "Lexer DFA" ? "sel" : ""} onClick={() => setDfa("Lexer DFA")}>Lexer DFA</button>
                      <button type="button" className={dfa === "Control Flow Graph" ? "sel" : ""} onClick={() => setDfa("Control Flow Graph")}>Control Flow Graph</button>
                    </div>
                  </div>
                  <AutomataGraph mode={dfa} data={compileResult.automata} />
                </>
              )}
              {tab === "Output" && <Output running={running} output={compileResult.output} />}
              {tab === "Errors" && (
                compileResult.errors.length > 0 ? (
                  <div className="errors-list" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {compileResult.errors.map((err, i) => (
                      <ErrorItem key={i} error={err} code={code} mode={mode} />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="result-icon"><CheckCircle2 size={32} /></div>
                    <h2>{cleared ? "Workspace cleared" : "No compilation errors"}</h2>
                    <p>{cleared ? "Add source code and compile to inspect the pipeline." : "Everything looks clean. Your program is ready to compile."}</p>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <footer>
        <span>CompilerLab <b>•</b> Frontend demo</span>
        <span>Lexer <i /> Parser <i /> IR <i /> Runtime</span>
        <span className="ready"><span /> Ready</span>
      </footer>

      <AnimatePresence>
        {palette && (
          <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setPalette(false)}>
            <motion.div className="palette" initial={{ opacity: 0, y: -20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="palette-search"><Search size={16} /><span>Type a command…</span><kbd>ESC</kbd></div>
              {["Compile", "Tokens", "AST", "IR Code", "Automata", "Output", "Errors"].map((item, index) => (
                <button type="button" key={item} onClick={() => item === "Compile" ? (setPalette(false), compile()) : choose(item)}>
                  <span>{index === 0 ? <Play size={14} /> : <ArrowRight size={14} />}</span>
                  {item}
                  <kbd>{index < 2 ? "↵" : ""}</kbd>
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function ErrorItem({ error, code, mode }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const errorLines = (error.message || "").split('\n');
  const isLongError = errorLines.length > 5;
  const displayMessage = expanded || !isLongError ? error.message : errorLines.slice(0, 5).join('\n') + '\n...';

  const explainError = async () => {
    if (explanation || loading) return;
    setLoading(true);
    try { 
      const response = await fetch("http://localhost:8000/api/explain-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: error.message, code, line: error.line, backend: mode === "Local" ? "ollama" : "groq", stream: true }),
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      setExplanation({ rawText: "" });
      setLoading(false);
      
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        
        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.chunk) {
                  setExplanation(prev => ({ ...prev, rawText: (prev?.rawText || "") + data.chunk }));
                }
              } catch(e) {}
            }
          }
        }
      }
    } catch (err) {
      setExplanation({ text: "Failed to fetch explanation from backend." });
      setLoading(false);
    }
  };

  return (
    <div className="error-item" style={{ background: 'rgba(255,50,50,0.05)', border: '1px solid rgba(255,50,50,0.2)', padding: '16px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: '15px' }}>
          <strong style={{ color: '#ff6b6b', fontSize: '13px' }}>Line {error.line}, Col {error.col}</strong>
          <div style={{ marginTop: '4px', fontSize: '14px', color: '#e2e8f0', fontFamily: 'DM Mono, monospace', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
            {displayMessage}
            {isLongError && (
              <span onClick={() => setExpanded(!expanded)} style={{ color: '#4de1ff', cursor: 'pointer', marginLeft: '8px', fontSize: '12px' }}>
                {expanded ? "Show less" : "Show more"}
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={explainError} disabled={loading} style={{ background: '#211b39', border: '1px solid #c59aff', color: '#c59aff', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ display: 'flex' }}><Sparkles size={12} /></motion.div> : <Sparkles size={12} />}
          {loading ? "Thinking..." : "Explain with AI"}
        </button>
      </div>
      
      <AnimatePresence>
        {explanation && (
          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} style={{ overflow: 'hidden', marginTop: '16px' }}>
            <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,50,50,0.1)', color: '#a0aec0', fontSize: '13px', lineHeight: '1.6' }}>
              <strong style={{ color: '#c59aff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><Zap size={14} /> AI Explanation</strong>
              
              {explanation.rawText !== undefined ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{explanation.rawText}</div>
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{explanation.text}</div>
                  {explanation.suggestion && (
                    <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}><strong style={{ color: '#cbd5e1' }}>Suggestion:</strong> {explanation.suggestion}</div>
                  )}
                  {explanation.example && (
                    <div style={{ marginTop: '10px', background: '#0f172a', padding: '10px', borderRadius: '6px', fontFamily: 'DM Mono, monospace', whiteSpace: 'pre-wrap' }}>
                      <strong style={{ color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Example:</strong>
                      <span style={{ color: '#4de1ff' }}>{explanation.example}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tokens({ tokens = [] }) {
  const getTokenClass = (type) => {
    const t = type.toUpperCase();
    if (["INT", "FLOAT", "FUNC", "RETURN", "IF", "ELSE", "PRINT", "VOID", "WHILE", "FOR", "TRUE", "FALSE"].includes(t)) return "keyword";
    if (t === "IDENTIFIER") return "identifier";
    if (t === "STRING_LIT" || t === "INTEGER_LIT" || t === "FLOAT_LIT") return "string";
    if (["ASSIGN", "PLUS", "MINUS", "MUL", "DIV", "MOD", "EQ", "NEQ", "GT", "LT", "GE", "LE", "AND", "OR", "NOT"].includes(t)) return "operator";
    if (["LBRACE", "RBRACE", "LPAREN", "RPAREN", "LBRACKET", "RBRACKET"].includes(t)) return "brace";
    return "";
  };

  return (
    <>
      <div className="view-head">
        <div><h2>Lexical tokens</h2><p>{tokens.length} tokens discovered by the lexer</p></div>
        <span className="success-chip"><CheckCircle2 size={13} /> Valid</span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <table>
          <thead><tr><th>TYPE</th><th>VALUE</th><th>POSITION</th></tr></thead>
          <tbody>
            {tokens.map((token, index) => (
              <motion.tr key={`${token.type}-${index}`} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.01 }}>
                <td><span className={`token ${getTokenClass(token.type)}`}>{token.type}</span></td>
                <td className="mono">{token.value}</td>
                <td className="pos">{token.line}:{token.col}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AST({ ast, open, setOpen }) {
  const renderNode = (node, path = "root") => {
    if (!node) return null;
    if (typeof node !== 'object') return <span>{String(node)}</span>;

    const isOpen = !!open[path];
    
    // Simple property display
    let propsDesc = node.props ? node.props : "";

    return (
      <div className="tree-node" key={path}>
        <button type="button" onClick={() => setOpen((current) => ({ ...current, [path]: !current[path] }))}>
          {node.children && node.children.length > 0 ? (isOpen ? <span>⌄</span> : <span>›</span>) : <span style={{opacity: 0.3}}>•</span>}
          <span>{node.type}</span>
          {propsDesc && <small>{propsDesc}</small>}
        </button>
        {isOpen && node.children && node.children.length > 0 && (
          <div className="tree-children">
            {node.children.map((child, i) => renderNode(child, `${path}-${i}`))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="view-head"><div><h2>Abstract Syntax Tree</h2><p>Nested representation of program structure</p></div></div>
      <div className="tree" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)', paddingBottom: '40px' }}>
        {ast ? renderNode(ast) : <div style={{padding: 20, color: '#888'}}>No AST generated</div>}
      </div>
    </>
  );
}

function IR({ ir = [] }) {
  return (
    <>
      <div className="view-head"><div><h2>Intermediate representation</h2><p>Three-address style instructions</p></div><span className="badge">LLVM-like</span></div>
      <pre className="ir" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        {ir.length > 0 ? ir.map(i => i.text).join('\n') : "No IR generated"}
      </pre>
    </>
  );
}

function Output({ running, output = [] }) {
  return (
    <>
      <div className="view-head"><div><h2>Execution output</h2><p>Runtime console stream</p></div><span className="success-chip"><CheckCircle2 size={13} /> {running ? "Running" : "Exit 0"}</span></div>
      <div className="terminal">
        <div className="terminal-top"><span>● ● ●</span><span>compiler@local ~ /run</span><span>•••</span></div>
        <div className="terminal-body" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 350px)' }}>
          <div><span className="prompt">$</span> compile main.ml</div>
          <div className="dim">→ lexing… <strong>done</strong></div>
          <div className="dim">→ building AST… <strong>done</strong></div>
          <div className="dim">→ generating IR… <strong>done</strong></div>
          {output.map((line, i) => (
             <div key={i} className={line.startsWith("[Runtime Error]") ? "error-line" : "out"} style={line.startsWith("[Runtime Error]") ? { color: '#ff6b6b' } : {}}>
               {line}
             </div>
          ))}
          {!running && <div><span className="prompt">$</span> <span className="cursor" /></div>}
        </div>
      </div>
    </>
  );
}

