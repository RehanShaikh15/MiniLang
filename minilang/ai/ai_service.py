# MODULE 5 — AI SERVICE (ai/ai_service.py)
# Centralized Gemini AI client for all AI-powered IDE features.
# Uses the modern google-genai SDK.

import os
import traceback
from typing import Dict, Any, List, Optional

try:
    import groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

# MiniLang language reference for system prompts
MINILANG_REFERENCE = """
MiniLang is a statically-typed language with the following features:
- Types: int, float, bool, string, void
- Variable declarations: `int x = 10;` `float pi = 3.14;` `bool flag = true;` `string msg = "hello";`
- Functions: `func name(param: type, ...) -> returnType { body }`
- Control flow: if/else, while, for
- Operators: +, -, *, /, %, ^, ==, !=, <, <=, >, >=, &&, ||, !
- Built-in: print(value)
- Comments: // single-line
- Semicolons required after statements
- Curly braces for blocks
"""


class AIService:
    """Centralized AI service using Google Gemini for all IDE features."""
    
    def __init__(self):
        self.client = None
        self.available = False
        self._initialize()
    
    def _initialize(self):
        """Initialize the Groq client with API key from environment."""
        if not GROQ_AVAILABLE:
            print("[AI Service] groq not installed. AI features disabled.")
            return
        
        api_key = os.environ.get('GROQ_API_KEY', '')
        if not api_key:
            # Try loading from .env file
            env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '.env')
            if os.path.exists(env_path):
                with open(env_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('GROQ_API_KEY=') and not line.startswith('#'):
                            api_key = line.split('=', 1)[1].strip()
                            break
        
        if not api_key:
            print("[AI Service] No GROQ_API_KEY found. AI features disabled.")
            return
        
        try:
            self.client = groq.Groq(api_key=api_key)
            self.available = True
            print("[AI Service] Groq AI initialized successfully (groq/compound)")
        except Exception as e:
            print(f"[AI Service] Failed to initialize Groq: {e}")
    
    def _generate(self, prompt: str, system_instruction: str = "", max_tokens: int = 512, timeout: int = 60) -> Optional[str]:
        """Internal method to call Groq and return the response text.
        Includes retry logic for rate-limit (429) errors."""
        if not self.available:
            return None
        
        import time
        import re
        
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})
                
                response = self.client.chat.completions.create(
                    model="groq/compound",
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.3,
                    timeout=timeout
                )
                
                if response.choices and response.choices[0].message.content:
                    return response.choices[0].message.content.strip()
                return None
                
            except Exception as e:
                error_str = str(e)
                # Retry on rate-limit errors
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                    # Try to extract retry delay from error message
                    delay_match = re.search(r'retryDelay.*?(\d+)', error_str)
                    wait_time = int(delay_match.group(1)) + 2 if delay_match else (attempt + 1) * 15
                    print(f"[AI Service] Rate limited (attempt {attempt+1}/{max_retries}). Waiting {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                
                print(f"[AI Service] Generation error: {e}")
                return None
        
        print(f"[AI Service] All {max_retries} retries exhausted due to rate limiting.")
        return None
    
    # ─────────────────────────────────────────────
    # Feature 1: Autocomplete
    # ─────────────────────────────────────────────
    def get_autocomplete(self, code_before: str, code_after: str, symbols_text: str) -> Optional[str]:
        """Generate code completion suggestion.
        
        Args:
            code_before: Code text before the cursor position
            code_after: Code text after the cursor position  
            symbols_text: Formatted string of symbols in scope
        
        Returns:
            Completion text to insert at cursor, or None
        """
        system = f"""You are a code completion engine for MiniLang, a statically-typed programming language.
{MINILANG_REFERENCE}

Rules:
- Return ONLY the completion text that should be inserted at the cursor position. No explanation, no markdown, no code fences.
- Complete the current line or statement naturally.
- Use the symbols in scope to make type-correct suggestions.
- Keep completions short (1-3 lines max). Prefer completing the current statement first.
- If there's nothing useful to complete, return exactly the text: NO_SUGGESTION
- Do NOT repeat code that already exists before the cursor.
- Do NOT include any backticks or markdown formatting."""

        prompt = f"""{symbols_text}

Code before cursor:
{code_before}
█ <-- cursor is here
Code after cursor:
{code_after}

Complete from the cursor position:"""

        result = self._generate(prompt, system, max_tokens=200)
        
        if result and result != 'NO_SUGGESTION' and not result.startswith('```'):
            # Clean up: remove any markdown code fences that might slip through
            result = result.replace('```minilang', '').replace('```', '').strip()
            return result
        return None
    
    # ─────────────────────────────────────────────
    # Feature 2: Error Explanation
    # ─────────────────────────────────────────────
    def explain_error(self, error_message: str, code: str) -> Optional[Dict[str, str]]:
        """Explain a compiler error in beginner-friendly terms.
        
        Args:
            error_message: The raw compiler error message
            code: The full source code that caused the error
        
        Returns:
            Dict with 'explanation', 'suggestion', and 'example' keys, or None
        """
        system = f"""You are a friendly coding tutor helping beginners understand compiler errors in MiniLang.
{MINILANG_REFERENCE}

When explaining errors:
- Be EXTREMELY concise. The UI space is limited.
- Use simple, beginner-friendly language
- Explain what the error means in plain English (max 2 sentences)
- Suggest how to fix it (max 1 sentence)
- Show a corrected code example

Respond in this exact format (use these exact headers):
EXPLANATION: <max 2 sentences plain English explanation>
SUGGESTION: <max 1 sentence how to fix it>
EXAMPLE: <corrected code snippet>"""

        prompt = f"""The following MiniLang code:
```
{code}
```

Produced this compiler error:
{error_message}

Please explain this error to a beginner:"""

        result = self._generate(prompt, system, max_tokens=500)
        
        if not result:
            return None
        
        # Parse the structured response
        parsed = {'explanation': '', 'suggestion': '', 'example': ''}
        current_key = None
        
        for line in result.split('\n'):
            line_stripped = line.strip()
            # Clean up potential markdown formatting like **EXPLANATION:** or # EXPLANATION:
            clean_start = line_stripped.replace('**', '').replace('*', '').replace('#', '').strip()
            
            if clean_start.startswith('EXPLANATION:'):
                current_key = 'explanation'
                parsed[current_key] = clean_start.replace('EXPLANATION:', '').strip()
            elif clean_start.startswith('SUGGESTION:'):
                current_key = 'suggestion'
                parsed[current_key] = clean_start.replace('SUGGESTION:', '').strip()
            elif clean_start.startswith('EXAMPLE:'):
                current_key = 'example'
                parsed[current_key] = clean_start.replace('EXAMPLE:', '').strip()
            elif current_key:
                parsed[current_key] += '\n' + line
        
        # Clean up example (remove markdown fences)
        parsed['example'] = parsed['example'].replace('```minilang', '').replace('```', '').strip()
        
        return parsed
    
    # ─────────────────────────────────────────────
    # Feature 3: Refactoring
    # ─────────────────────────────────────────────
    def suggest_refactor(self, code: str, selection: str) -> Optional[List[Dict[str, str]]]:
        """Suggest refactoring options for selected code.
        
        Args:
            code: The full source code
            selection: The selected/highlighted code portion
        
        Returns:
            List of dicts with 'title', 'description', 'refactoredCode' keys, or None
        """
        system = f"""You are a code refactoring assistant for MiniLang.
{MINILANG_REFERENCE}

Given selected code, suggest 1-3 refactoring improvements. For each suggestion, provide:
- A short title
- A brief description of what changes and why
- The refactored code

Respond in this exact format (repeat the block for multiple suggestions, separated by ---):
TITLE: <short title>
DESCRIPTION: <what changes and why>
CODE: <refactored code>
---"""

        prompt = f"""Full program:
```
{code}
```

Selected code to refactor:
```
{selection}
```

Suggest refactoring improvements:"""

        result = self._generate(prompt, system, max_tokens=2048)
        try:
            print(f"[AI Service] Raw Refactor Result:\n{result}\n{'='*40}")
        except UnicodeEncodeError:
            # Fallback for Windows console if it can't print certain characters
            safe_result = result.encode('ascii', 'replace').decode('ascii')
            print(f"[AI Service] Raw Refactor Result:\n{safe_result}\n{'='*40}")
        
        if not result:
            return None
        
        # Parse multiple suggestions separated by ---
        suggestions = []
        blocks = result.split('---')
        
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            
            suggestion = {'title': '', 'description': '', 'refactoredCode': ''}
            current_key = None
            in_code_fence = False
            code_lines = []
            
            for line in block.split('\n'):
                line_stripped = line.strip()
                clean_start = line_stripped.replace('**', '').replace('*', '').replace('#', '').strip()
                
                # Detect CODE: header (may or may not have backticks on same line)
                if clean_start.startswith('CODE:'):
                    current_key = 'refactoredCode'
                    remainder = clean_start.replace('CODE:', '').strip()
                    # Strip opening backtick fence if on same line: CODE: ```minilang
                    if remainder.startswith('```'):
                        in_code_fence = True
                        remainder = ''
                    if remainder:
                        code_lines.append(remainder)
                    continue
                
                # Track code fences for the CODE section
                if current_key == 'refactoredCode':
                    if line_stripped.startswith('```') and not in_code_fence:
                        # Opening fence
                        in_code_fence = True
                        continue
                    elif line_stripped.startswith('```') and in_code_fence:
                        # Closing fence
                        in_code_fence = False
                        continue
                    else:
                        code_lines.append(line)
                        continue
                
                # Detect TITLE: and DESCRIPTION: headers
                if clean_start.startswith('TITLE:'):
                    current_key = 'title'
                    suggestion['title'] = clean_start.replace('TITLE:', '').strip()
                elif clean_start.startswith('DESCRIPTION:'):
                    current_key = 'description'
                    suggestion['description'] = clean_start.replace('DESCRIPTION:', '').strip()
                elif line_stripped.startswith('```') and current_key == 'description':
                    # AI skipped CODE: and jumped to a code fence — treat as code
                    current_key = 'refactoredCode'
                    in_code_fence = True
                elif current_key == 'title':
                    suggestion['title'] += ' ' + line_stripped
                elif current_key == 'description':
                    suggestion['description'] += ' ' + line_stripped
            
            # Assemble the refactored code
            suggestion['refactoredCode'] = '\n'.join(code_lines).strip()
            # Final cleanup: remove any stray markdown fences
            suggestion['refactoredCode'] = suggestion['refactoredCode'].replace('```minilang', '').replace('```', '').strip()
            
            if suggestion['title'] and suggestion['refactoredCode']:
                suggestions.append(suggestion)
        
        return suggestions if suggestions else None
    
    # ─────────────────────────────────────────────
    # Feature 4: Documentation Generator
    # ─────────────────────────────────────────────
    def generate_docs(self, code: str, target_info: Dict[str, Any]) -> Optional[str]:
        """Generate documentation comment for a function or variable.
        
        Args:
            code: The full source code
            target_info: Dict with 'kind' ('function'|'variable'), 'text' (the declaration line)
        
        Returns:
            A MiniLang doc comment string (/// ...), or None
        """
        system = f"""You are a documentation generator for MiniLang.
{MINILANG_REFERENCE}

Generate documentation comments using the /// prefix (triple-slash).
For functions, document:
- What the function does
- Each parameter and its purpose
- The return value

For variables, document:
- What the variable represents

Keep documentation concise but informative.
Return ONLY the doc comment lines (each starting with ///), nothing else. No markdown formatting."""

        kind = target_info.get('kind', 'function')
        text = target_info.get('text', '')
        
        prompt = f"""Full program context:
```
{code}
```

Generate a documentation comment for this {kind}:
{text}"""

        result = self._generate(prompt, system, max_tokens=300)
        
        if not result:
            return None
        
        # Ensure each line starts with ///
        doc_lines = []
        for line in result.split('\n'):
            line = line.strip()
            if line.startswith('///'):
                doc_lines.append(line)
            elif line.startswith('//'):
                doc_lines.append('/' + line)  # Convert // to ///
            elif line and not line.startswith('```'):
                doc_lines.append('/// ' + line)
        
        return '\n'.join(doc_lines) if doc_lines else None


# Global singleton instance
_ai_service = None

def get_ai_service() -> AIService:
    """Get or create the global AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
