<div align="center">

```
███╗   ███╗██╗███╗   ██╗██╗██╗      █████╗ ███╗   ██╗ ██████╗
████╗ ████║██║████╗  ██║██║██║     ██╔══██╗████╗  ██║██╔════╝
██╔████╔██║██║██╔██╗ ██║██║██║     ███████║██╔██╗ ██║██║  ███╗
██║╚██╔╝██║██║██║╚██╗██║██║██║     ██╔══██║██║╚██╗██║██║   ██║
██║ ╚═╝ ██║██║██║ ╚████║██║███████╗██║  ██║██║ ╚████║╚██████╔╝
╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝
```

**A fully-featured compiler front-end for a custom statically-typed language,**
**paired with an AI-powered Web IDE — built for Automata Theory and Compiler Design.**

<br/>

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Lark](https://img.shields.io/badge/LALR(1)-Lark_Parser-FF6B6B?style=for-the-badge)](https://github.com/lark-parser/lark)
[![License](https://img.shields.io/badge/License-VIT_University-4ECDC4?style=for-the-badge)](https://vit.ac.in)

</div>

---

## 🗺️ Overview

MiniLang is a **complete compiler pipeline** from source text to Three-Address Code, wrapped in a rich browser-based IDE with AI co-pilot features. Write code in the browser, and watch it flow through each compiler stage in real-time.

```
Source Code  ──►  Lexer  ──►  Parser  ──►  Semantic Analyzer  ──►  IR Generator  ──►  Interpreter
     │               │           │                  │                    │                  │
  .ml file       Tokens &       AST              Type-checked          TAC              Program
               DFA Diagram    Nodes            Symbol Table          Output             Output
```

---

## ✨ Compiler Pipeline

<table>
<tr>
<td width="50%">

### 🔡 Lexical Analysis
Regex-powered scanner that tokenizes source code into a structured stream. Tracks line/column positions for precise error reporting. The Web IDE renders an interactive **DFA visualizer** for each token pattern.

</td>
<td width="50%">

### 🌳 Syntax Analysis
EBNF grammar defined in a .lark file, processed by a **LALR(1) parser**. Produces a clean, typed **Abstract Syntax Tree** of named AST nodes rather than a raw parse tree.

</td>
</tr>
<tr>
<td width="50%">

### ✅ Semantic Analysis
Visitor-pattern type checker that walks the AST to enforce **type rules**, resolve **variable scope**, and verify **function signatures** using a multi-scope symbol table.

</td>
<td width="50%">

### ⚙️ IR Generation
Flattens the AST into **Three-Address Code (TAC)** with compiler-generated temporaries and explicit GOTO jumps for control flow — a step toward real machine-code generation.

</td>
</tr>
<tr>
<td width="50%">

### 🏃 Interpreter
A **tree-walking interpreter** that directly executes the AST, capturing all print() output into a buffer. Supports functions, loops, conditionals, and all MiniLang types.

</td>
<td width="50%">

### 🌐 Web IDE
React + Vite browser IDE with live compilation, token viewer, AST panel, IR output, and a **program output console**. Runs the full compiler pipeline on every keystroke (debounced).

</td>
</tr>
</table>

---

## 🤖 AI Co-Pilot Features

MiniLang ships with a full **AI-assisted development** layer, powered by a configurable LLM backend (Ollama / Gemini / OpenAI):

| Feature | Trigger | Description |
|---|---|---|
| 🔮 **Ghost Text Autocomplete** | Type in editor, then Tab to accept | Context-aware completions using the live symbol table and AST |
| 🔴 **Error Explanation** | Click an error card | Translates raw compiler errors into beginner-friendly explanations with code examples |
| 💡 **Refactoring Suggestions** | Select code, then click Refactor | Suggests idiomatic rewrites (e.g. x = x + 1 → x++) |
| 📄 **Docs Generator** | Click the Docs button | Rewrites the entire file with /// triple-slash documentation comments |

> **Streaming support**: Error explanations are streamed token-by-token via Server-Sent Events for instant feedback.

---

## 🏗️ Project Structure

```
AT CP/
│
├── minilang/                    # 🧠 Core compiler library
│   ├── lexer/                   #   Token patterns & DFA-based Lexer
│   ├── grammar/                 #   EBNF grammar file (minilang.lark)
│   ├── parser/                  #   LALR(1) Parser & typed AST nodes
│   ├── semantic/                #   Symbol Table & Semantic Analyzer
│   ├── ir/                      #   Three-Address Code (TAC) Generator
│   ├── interpreter/             #   AST Tree-Walking Interpreter
│   ├── ai/                      #   AI service, context extraction & prompts
│   └── error/                   #   Formatted compiler error handling
│
├── minilang-ui/                 # 🌐 React + Vite Web IDE
│   └── src/
│       ├── App.jsx              #   Main IDE shell & state management
│       ├── CodeEditor.jsx       #   Editor with ghost-text autocomplete
│       └── AutomataView.jsx     #   DFA state-machine visualizer
│
├── server.py                    # 🔌 Python HTTP API server (port 8000)
├── main.py                      # 💻 CLI entry point
├── example.ml                   # 📝 Sample MiniLang program
└── requirements.txt
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| Node.js + npm | 18+ |
| Ollama *(optional, for AI features)* | Latest |

### 1 · Clone the Repository

```bash
git clone https://github.com/<your-username>/minilang-compiler.git
cd minilang-compiler
```

### 2 · Set Up the Python Backend

```bash
# Create and activate a virtual environment
python -m venv venv

.\venv\Scripts\activate         # Windows
# source venv/bin/activate      # macOS / Linux

# Install Python dependencies
pip install -r requirements.txt
```

### 3 · Set Up the React Frontend

```bash
cd minilang-ui
npm install
```

---

## 🖥️ Usage

### Option A — Web IDE *(Recommended)*

**Terminal 1** — Start the Python API:

```bash
.\venv\Scripts\activate
python server.py
# API running at http://localhost:8000
```

**Terminal 2** — Start the React frontend:

```bash
cd minilang-ui
npm run dev
# UI running at http://localhost:5173
```

Open **http://localhost:5173** in your browser:

- ✍️ Live editor with syntax highlighting and ghost-text autocomplete
- 📋 Token stream viewer
- 🌳 Interactive AST panel
- ⚙️ Three-Address Code output panel
- 🏃 Program output console (interpreter)
- 🔴 Inline error cards with AI explanations
- 🔵 DFA state-machine visualizer

---

### Option B — Command Line Interface

```bash
.\venv\Scripts\activate
python main.py example.ml --lex --ast --ir
```

| Flag | Description |
|---|---|
| --lex | Display the full token table |
| --ast | Pretty-print the AST structure |
| --ir | Display the generated Three-Address Code |

---

## 📝 MiniLang Language Reference

MiniLang is a **statically-typed, C-like language** with first-class functions.

### Types

```js
int    x    = 10;
float  pi   = 3.14;
bool   flag = true;
string msg  = "hello, world";
```

### Functions

```js
func add(a: int, b: int) -> int {
    return a + b;
}
```

### Control Flow

```js
func main() -> void {
    int sum = add(x, 5);
    print("Sum is:");
    print(sum);

    if (sum > 10) {
        print("Greater than 10");
    } else {
        print("10 or less");
    }

    int i = 0;
    while (i < 5) {
        print(i);
        i = i + 1;
    }
}
```

### Operators

| Category | Operators |
|---|---|
| Arithmetic | + - * / % |
| Comparison | == != < > <= >= |
| Logical | && or ! |
| Assignment | = |

---

## 🔌 REST API Reference

The Python backend (server.py) runs on **port 8000**:

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/compile | Full pipeline — returns tokens, ast, ir, output, and errors |
| GET | /api/dfa | DFA state/transition data for the lexer visualizer |
| POST | /api/autocomplete | AI ghost-text suggestion given cursor position and symbol context |
| POST | /api/explain-error | AI beginner-friendly error explanation (SSE streaming supported) |
| POST | /api/refactor | AI refactoring suggestions for selected code |
| POST | /api/generate-docs | AI re-writes full source with /// doc comments |

**Example — compile a snippet:**

```bash
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code": "int x = 42; func main() -> void { print(x); }"}'
```

<details>
<summary>📦 Example JSON Response</summary>

```json
{
  "status": "success",
  "tokens": [
    { "type": "INT",        "value": "int", "line": 1, "col": 1 },
    { "type": "IDENTIFIER", "value": "x",   "line": 1, "col": 5 }
  ],
  "ast":    { "type": "Program", "declarations": ["..."] },
  "ir":     ["x = 42", "CALL main"],
  "output": ["42"],
  "errors": []
}
```

</details>

---

## 🔬 Compiler Concepts Demonstrated

1. **Finite Automata and Regular Languages** — The lexer maps each token pattern to a DFA. The IDE visualizes these state machines interactively.

2. **Context-Free Grammars and Parsing** — The EBNF grammar (minilang.lark) is processed by a LALR(1) parser, demonstrating bottom-up shift-reduce parsing of a CFG.

3. **Abstract Syntax Trees** — The parser transforms a flat token stream into a strongly-typed AST where every node corresponds to a language construct.

4. **Semantic Analysis and Symbol Tables** — A Visitor-pattern analyzer enforces type rules, resolves variable scope, and verifies function signatures via a multi-scope symbol table.

5. **Intermediate Representation** — The IR generator flattens the AST into Three-Address Code with temporaries and explicit GOTO control flow — bridging the gap to real code generation.

6. **Tree-Walking Interpretation** — The interpreter directly executes the AST, showing that the AST itself carries enough semantic information to run a program without a separate IR step.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | Python 3.10+ | Compiler pipeline and API server |
| Parsing | lark-parser LALR(1) | Grammar processing and parse-tree generation |
| CLI output | rich | Color-coded, formatted terminal output |
| Frontend | React 19 + Vite 8 | Web IDE shell |
| Styling | Vanilla CSS | Custom dark-mode design system |
| AI Backend | Ollama / Gemini / OpenAI | Co-pilot features: autocomplete, explanations, refactoring, docs |

---

## 📄 License

This project was built as part of an **Automata Theory** course at **VIT University**.

---

<div align="center">

Made with ❤️ for **Automata Theory and Compiler Design**

*VIT University · Semester 4 · 2026*

</div>
