# MiniLang Project Tasks & Roadmap

- [x] **1. Implement MiniLang AI IDE & Copilot Features**
  - [x] **AI Autocomplete (GitHub Copilot style)**
    - [x] Create `/api/autocomplete` endpoint in Python backend
    - [x] Integrate Symbol Table & AST context into AI prompts for compiler-aware suggestions
    - [x] Add inline "Ghost Text" autocomplete in React Web IDE (`minilang-ui`) with Tab-to-accept
  - [x] **AI Error Explanation**
    - [x] Create `/api/explain-error` endpoint in Python backend that translates raw compiler errors (e.g., "Expected expression") into beginner-friendly explanations with examples (e.g., "You probably forgot to provide a value after '='.")
    - [x] Render interactive error cards / tooltips in `minilang-ui` when syntax/semantic errors occur
  - [x] **AI Refactoring & Quick Fixes**
    - [x] Create `/api/refactor` endpoint in Python backend
    - [x] Add code highlighting / lightbulb suggestions in `minilang-ui` (e.g., suggesting `x++` for `x = x + 1`)
  - [x] **AI Documentation Generator**
    - [x] Create `/api/generate-docs` endpoint in Python backend
    - [x] Add context menu ("Right Click -> Generate documentation") in `minilang-ui` to auto-generate `/// ...` comments for functions and variables
