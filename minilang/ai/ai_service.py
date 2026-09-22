# MODULE 5 — AI SERVICE (ai/ai_service.py)
# Centralized Gemini AI client for all AI-powered IDE features.
# Uses the modern google-genai SDK.

import os
import traceback
import json
import urllib.request
import urllib.error
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
        """Initialize the AI client with API key or local model from environment."""
        self.ollama_model = os.environ.get('OLLAMA_MODEL', 'deepseek-coder:6.7b')
        self.ollama_available = False
        self.groq_available = False
        
        # Check Ollama
        try:
            req = urllib.request.Request("http://localhost:11434/")
            with urllib.request.urlopen(req, timeout=1) as response:
                if response.status == 200:
                    self.ollama_available = True
                    print(f"[AI Service] Ollama initialized locally ({self.ollama_model})")
        except Exception as e:
            print(f"[AI Service] Local Ollama not available on localhost:11434")
            
        # Check Groq
        if GROQ_AVAILABLE:
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
            
            if api_key:
                try:
                    self.client = groq.Groq(api_key=api_key)
                    self.groq_available = True
                    print("[AI Service] Groq AI initialized successfully (groq/compound)")
                except Exception as e:
                    print(f"[AI Service] Failed to initialize Groq: {e}")
        else:
            print("[AI Service] groq module not installed.")
            
        self.available = self.ollama_available or self.groq_available
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
    
    def _generate(self, prompt: str, system_instruction: str = "", max_tokens: int = 512, timeout: int = 180, backend: Optional[str] = None, api_key: Optional[str] = None) -> Optional[str]:
        """Internal router method that calls the configured backend."""
        # Allow passing through if api_key is provided for groq, even if global service is not available
        is_groq_req = (backend == 'groq' or (self.groq_available and backend != 'ollama'))
        if not self.available and not (is_groq_req and api_key):
            return None
            
        if backend == 'ollama' and self.ollama_available:
            return self._generate_ollama(prompt, system_instruction, max_tokens, timeout)
        elif is_groq_req:
            return self._generate_groq(prompt, system_instruction, max_tokens, timeout, api_key=api_key)
        else:
            return None

    def _generate_ollama(self, prompt: str, system_instruction: str = "", max_tokens: int = 512, timeout: int = 180) -> Optional[str]:
        """Internal method to call local Ollama and return the response text."""
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": max_tokens
            }
        }
        
        try:
            req = urllib.request.Request(
                "http://localhost:11434/api/chat",
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                result = json.loads(response.read().decode('utf-8'))
                if "message" in result and "content" in result["message"]:
                    return result["message"]["content"].strip()
            return None
        except Exception as e:
            print(f"[AI Service] Ollama generation error: {e}")
            return None
    def _generate_stream(self, prompt: str, system_instruction: str = "", max_tokens: int = 512, timeout: int = 180, backend: Optional[str] = None, api_key: Optional[str] = None):
        """Internal router method for streaming."""
        is_groq_req = (backend == 'groq' or (self.groq_available and backend != 'ollama'))
        if not self.available and not (is_groq_req and api_key):
            return
            
        if backend == 'ollama' and self.ollama_available:
            yield from self._generate_ollama_stream(prompt, system_instruction, max_tokens, timeout)
        elif is_groq_req:
            # We will fallback to non-streaming for groq for now, and just yield it all at once
            res = self._generate_groq(prompt, system_instruction, max_tokens, timeout, api_key=api_key)
            if res:
                yield res

    def _generate_ollama_stream(self, prompt: str, system_instruction: str = "", max_tokens: int = 512, timeout: int = 180):
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.3
            }
        }
        try:
            req = urllib.request.Request(
                "http://localhost:11434/api/chat",
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                for line in response:
                    if line:
                        data = json.loads(line.decode('utf-8'))
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]
        except Exception as e:
            print(f"[AI Service] Ollama generation error: {e}")

    def _generate_groq(self, prompt: str, system_instruction: str = "", max_tokens: int = 512, timeout: int = 60, api_key: Optional[str] = None) -> Optional[str]:
        """Internal method to call Groq and return the response text.
        Includes retry logic for rate-limit (429) errors."""
        if not self.available and not api_key:
            return None
        
        import time
        import re
        
        max_retries = 3
        
        client = groq.Groq(api_key=api_key) if api_key else self.client
        if not client:
            return None
            
        for attempt in range(max_retries):
            try:
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})
                
                response = client.chat.completions.create(
                    model="llama3-70b-8192",
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
    def get_autocomplete(self, code_before: str, code_after: str, symbols_text: str, backend: Optional[str] = None, api_key: Optional[str] = None) -> Optional[str]:
        """Generate code completion suggestion."""
        # Truncate context to improve speed and focus for local models
        before_lines = code_before.split('\n')
        after_lines = code_after.split('\n')
        
        truncated_before = '\n'.join(before_lines[-15:])
        truncated_after = '\n'.join(after_lines[:15])
        
        system = f"""You are a strict code completion engine for MiniLang, a statically-typed programming language.
{MINILANG_REFERENCE}

CRITICAL RULES:
- The user will provide code with a [MISSING_CODE] marker.
- Return ONLY the exact characters that belong in place of [MISSING_CODE].
- NO markdown formatting (do not use ```).
- NO explanations or conversational text.
- Complete the current statement naturally.
- Keep completions short (1-3 lines max).
- If there's nothing useful to complete, return exactly: NO_SUGGESTION"""

        prompt = f"""{symbols_text}

```minilang
{truncated_before}[MISSING_CODE]{truncated_after}
```

Please output ONLY the text that replaces [MISSING_CODE]:"""

        result = self._generate(prompt, system, max_tokens=60, backend=backend, api_key=api_key)
        
        if result and result != 'NO_SUGGESTION':
            # Clean up: remove any markdown code fences that might slip through
            result = result.replace('```minilang', '').replace('```', '')
            return result
        return None
    
    # ─────────────────────────────────────────────
    # Feature 2: Error Explanation
    # ─────────────────────────────────────────────
    def explain_error(self, error_message: str, code: str, backend: Optional[str] = None, api_key: Optional[str] = None) -> Optional[Dict[str, str]]:
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

        result = self._generate(prompt, system, max_tokens=500, backend=backend, api_key=api_key)
        
        if not result:
            return None
        
        # Parse the structured response
        parsed = {'explanation': '', 'suggestion': '', 'example': ''}
        current_key = None
        
        for line in result.split('\n'):
            line_stripped = line.strip()
            # Clean up potential markdown formatting like **EXPLANATION:** or # EXPLANATION:
            clean_start = line_stripped.replace('**', '').replace('*', '').replace('#', '').strip()
            
            if clean_start.upper().startswith('EXPLANATION:'):
                current_key = 'explanation'
                parsed[current_key] = clean_start[12:].strip()
            elif clean_start.upper().startswith('SUGGESTION:'):
                current_key = 'suggestion'
                parsed[current_key] = clean_start[11:].strip()
            elif clean_start.upper().startswith('EXAMPLE:'):
                current_key = 'example'
                parsed[current_key] = clean_start[8:].strip()
            elif current_key:
                parsed[current_key] += '\n' + line
        
        # Clean up example (remove markdown fences)
        parsed['example'] = parsed['example'].replace('```minilang', '').replace('```', '').strip()
        
        return parsed

    def explain_error_stream(self, error_message: str, code: str, backend: Optional[str] = None, api_key: Optional[str] = None):
        """Explain a compiler error, yielding chunks as they are generated."""
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

        yield from self._generate_stream(prompt, system, max_tokens=500, backend=backend, api_key=api_key)    
    # ─────────────────────────────────────────────
    # Feature 3: Refactoring
    # ─────────────────────────────────────────────
    def suggest_refactor(self, code: str, selection: str, backend: Optional[str] = None, api_key: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
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

        result = self._generate(prompt, system, max_tokens=2048, backend=backend, api_key=api_key)
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
    def generate_full_docs(self, code: str, backend: Optional[str] = None, api_key: Optional[str] = None) -> Optional[str]:
        """Generate documentation comments for all functions and important variables in the codebase.
        
        Args:
            code: The full source code
        
        Returns:
            The complete source code with MiniLang doc comments added.
        """
        system = f"""You are a documentation generator for MiniLang.
{MINILANG_REFERENCE}

Generate helpful documentation comments using the /// prefix (triple-slash) for functions, variables, and major logical blocks.
GUIDELINES:
1. Provide clear, descriptive comments (MAX 2 LINES per item).
2. If a comment spans multiple lines, EVERY SINGLE LINE must start with the /// prefix.
3. Document the purpose, arguments, and return values of functions.
4. Document important variables and state changes.
5. Place the /// comments immediately preceding the target line.
6. Return the complete, fully-documented source code without omitting anything.
7. Do NOT wrap it in markdown formatting or ``` blocks."""

        prompt = f"""Please add /// documentation comments to this entire codebase:
```
{code}
```"""

        result = self._generate(prompt, system, max_tokens=1500, backend=backend, api_key=api_key)
        
        if not result:
            return None
            
        # Clean up example (remove markdown fences if the AI stubbornly adds them)
        result = result.replace('```minilang', '').replace('```', '').strip()
        
        return result



# Global singleton instance
_ai_service = None

def get_ai_service() -> AIService:
    """Get or create the global AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
