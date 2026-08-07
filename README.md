# 🧠 MiniLang Compiler

> A complete, from-scratch compiler front-end for a custom statically-typed language — built to demonstrate core **Automata Theory** and **Compiler Design** concepts.

**MiniLang** is a fully functional compiler pipeline paired with a modern **React Web IDE**. Write code in your browser, and watch it get lexed, parsed, semantically analyzed, and transformed into Three-Address Code in real-time.

---

## ✨ Features

| Stage | Description |
|---|---|
| 🔡 **Lexical Analysis** | Regex-powered scanner with line/column tracking & DFA visualization |
| 🌳 **Syntax Analysis** | EBNF/CFG grammar parsed via LALR(1), producing a clean AST |
| ✅ **Semantic Analysis** | Visitor-pattern type checker, scope resolution, function signature verification |
| ⚙️ **IR Generation** | AST → Three-Address Code (TAC) with temp variables & GOTO control flow |
| 🌐 **Web IDE** | React + Vite IDE with live compilation, token viewer, AST panel & IR output |
| 🖥️ **CLI** | Rich terminal interface with formatted, color-coded error reporting |

---

## 🏗️ Architecture

```
minilang/
├── lexer/          # Token patterns & Lexer (Finite Automata)
├── grammar/        # EBNF grammar file (minilang.lark)
├── parser/         # LALR(1) Parser & AST node definitions
├── semantic/       # Symbol Table & Semantic Analyzer
├── ir/             # Three-Address Code (TAC) Generator
├── error/          # Formatted compiler error handling
└── cli.py          # Command-line interface

minilang-ui/        # React + Vite Web IDE
server.py           # Python HTTP API (compiler backend)
main.py             # CLI entry point
tests/              # Pytest test suite
```

---

## 🔬 Compiler Concepts Demonstrated

1. **Finite Automata & Regular Languages** — The lexer is implemented using regular expressions that map to DFA patterns for tokens like `INTEGER_LIT`, `FLOAT_LIT`, `STRING_LIT`, identifiers, and operators. The Web IDE even visualizes these DFAs.

2. **Context-Free Grammars & Parsing** — The grammar is defined in EBNF (`.lark` file) and processed by a LALR(1) parser. This demonstrates how CFGs describe the syntactic structure of a language.

3. **Abstract Syntax Trees** — The parser transforms the flat token stream into a structured tree of typed AST nodes, which subsequent stages traverse.

4. **Semantic Analysis & Symbol Tables** — A Visitor-pattern analyzer walks the AST to enforce type rules, resolve variable scope, and verify function signatures using a symbol table.

5. **Intermediate Representation** — The IR generator flattens the AST into Three-Address Code, using temporary variables and explicit `GOTO` jumps to represent control flow — a step toward real code generation.

---

## 🚀 Getting Started

### Prerequisites
- Python **3.10+**
- Node.js **18+** & npm

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/minilang-compiler.git
cd minilang-compiler
```

### 2. Set Up the Python Backend
```bash
# Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### 3. Set Up the React Frontend
```bash
cd minilang-ui
npm install
```

---

## 🖥️ Usage

### Option A — Web IDE (Recommended)

**Terminal 1:** Start the Python compiler API
```bash
# From the root directory
.\venv\Scripts\activate
python server.py
# API running at http://localhost:8000
```

**Terminal 2:** Start the React frontend
```bash
cd minilang-ui
npm run dev
# UI running at http://localhost:5173
```

Open `http://localhost:5173` in your browser. Features:
- ✍️ Live code editor with syntax highlighting
- 📋 Token table viewer
- 🌳 Interactive AST panel
- ⚙️ Three-Address Code output
- 🔴 Inline error highlighting

---

### Option B — Command Line Interface

```bash
.\venv\Scripts\activate
python main.py example.ml --lex --ast --ir
```

| Flag | Description |
|---|---|
| `--lex` | Display the token table |
| `--ast` | Display the AST structure |
| `--ir` | Display the generated Three-Address Code |

---

## 📝 MiniLang Syntax

```js
// Variables
int x = 10;
float pi = 3.14;
bool flag = true;
string msg = "hello";

// Functions
func add(a: int, b: int) -> int {
    return a + b;
}

// Control Flow
func main() -> void {
    int sum = add(x, 5);
    print("Sum is:");
    print(sum);

    if (sum > 10) {
        print("Greater than 10");
    } else {
        print("10 or less");
    }
}
```

---

## 🧪 Running Tests

```bash
# From the root directory (with venv activated)
$env:PYTHONPATH="."       # Windows PowerShell
# export PYTHONPATH=.     # macOS/Linux

pytest -v
```

Test coverage includes:
- `test_lexer.py` — Token recognition and error cases
- `test_parser.py` — Grammar rule validation and AST structure
- `test_semantic.py` — Type checking and scope rules
- `test_ir.py` — TAC instruction generation

---

## 🔌 REST API Endpoints

The Python backend (`server.py`) exposes the following endpoints, consumed by the Web IDE:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/compile` | Full compile pipeline — returns tokens, AST, IR, and errors |
| `GET` | `/api/dfa` | Returns DFA state/transition data for the lexer visualizer |

**Example Request:**
```bash
curl -X POST http://localhost:8000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code": "int x = 42;"}'
```

---

## 🛠️ Tech Stack

**Backend**
- Python 3.10+
- [lark-parser](https://github.com/lark-parser/lark) — LALR(1) parsing
- [rich](https://github.com/Textualize/rich) — Terminal formatting
- `http.server` — Lightweight API server

**Frontend**
- [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- Vanilla CSS

---

## 📄 License

This project was built as part of an Automata Theory course project at **VIT University**.

---

<div align="center">
  Made with ❤️ for Automata Theory & Compiler Design
</div>
# MiniLang
