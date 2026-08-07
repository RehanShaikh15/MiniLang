# MiniLang Project Tasks & Roadmap

- [ ] **1. Implement MiniLang AI IDE & Copilot Features**
  - [ ] **AI Autocomplete (GitHub Copilot style)**
    - [ ] Create `/api/autocomplete` endpoint in Python backend
    - [ ] Integrate Symbol Table & AST context into AI prompts for compiler-aware suggestions
    - [ ] Add inline "Ghost Text" autocomplete in React Web IDE (`minilang-ui`) with Tab-to-accept
  - [ ] **AI Error Explanation**
    - [ ] Create `/api/explain-error` endpoint in Python backend that translates raw compiler errors (e.g., "Expected expression") into beginner-friendly explanations with examples (e.g., "You probably forgot to provide a value after '='.")
    - [ ] Render interactive error cards / tooltips in `minilang-ui` when syntax/semantic errors occur
  - [ ] **AI Refactoring & Quick Fixes**
    - [ ] Create `/api/refactor` endpoint in Python backend
    - [ ] Add code highlighting / lightbulb suggestions in `minilang-ui` (e.g., suggesting `x++` for `x = x + 1`)
  - [ ] **AI Documentation Generator**
    - [ ] Create `/api/generate-docs` endpoint in Python backend
    - [ ] Add context menu ("Right Click -> Generate documentation") in `minilang-ui` to auto-generate `/// ...` comments for functions and variables
