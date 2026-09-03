# MODULE 5 — AI CONTEXT (ai/context.py)
# Extracts compiler context (symbols, code around cursor) for AI prompts.

import os
import sys
from typing import List, Dict, Any, Optional, Tuple

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from minilang.lexer.lexer import Lexer
from minilang.parser.parser import Parser
from minilang.semantic.analyzer import SemanticAnalyzer
from minilang.semantic.symbol_table import SymbolTable, Symbol


def extract_symbols(code: str) -> List[Dict[str, Any]]:
    """Run the compiler pipeline on the given code and extract all symbols from the symbol table.
    
    Gracefully handles partial/broken code — returns whatever symbols were collected
    before an error occurred (useful for autocomplete on incomplete code).
    """
    symbols = []
    
    try:
        # Try to parse and analyze
        parser = Parser()
        ast = parser.parse(code)
        
        analyzer = SemanticAnalyzer()
        # We need to capture symbols as they are defined.
        # We'll run analysis but catch errors so we still get partial symbols.
        try:
            analyzer.analyze(ast)
        except Exception:
            pass  # Partial analysis is fine
        
        # Walk all scopes to collect symbols
        for scope in analyzer.symbol_table.scopes:
            for name, sym in scope.items():
                entry = {
                    'name': sym.name,
                    'type': sym.type_name,
                    'category': sym.category,
                }
                if sym.meta:
                    entry['meta'] = sym.meta
                symbols.append(entry)
                
    except Exception:
        # If parsing totally fails, try to extract at least keywords/identifiers from tokens
        try:
            lexer = Lexer(code)
            tokens = lexer.tokenize()
            # Extract declared variable names from patterns like "int x" or "float y"
            type_keywords = {'int', 'float', 'bool', 'string', 'void'}
            for i in range(len(tokens) - 1):
                if tokens[i].value in type_keywords and tokens[i+1].type.name == 'IDENTIFIER':
                    symbols.append({
                        'name': tokens[i+1].value,
                        'type': tokens[i].value,
                        'category': 'variable',
                    })
        except Exception:
            pass  # Return empty symbols if everything fails
    
    return symbols


def get_code_around_cursor(code: str, line: int, col: int) -> Dict[str, str]:
    """Split code into before-cursor and after-cursor portions.
    
    Returns:
        { 'before': str, 'after': str, 'current_line': str }
    """
    lines = code.split('\n')
    
    # Clamp to valid range
    line_idx = max(0, min(line - 1, len(lines) - 1))
    
    before_lines = lines[:line_idx]
    current_line = lines[line_idx] if line_idx < len(lines) else ''
    after_lines = lines[line_idx + 1:]
    
    # Split current line at cursor column
    col_idx = max(0, min(col, len(current_line)))
    before_cursor_in_line = current_line[:col_idx]
    after_cursor_in_line = current_line[col_idx:]
    
    before = '\n'.join(before_lines + [before_cursor_in_line]) if before_lines else before_cursor_in_line
    after = '\n'.join([after_cursor_in_line] + after_lines) if after_lines else after_cursor_in_line
    
    return {
        'before': before,
        'after': after,
        'current_line': current_line,
    }


def format_symbols_for_prompt(symbols: List[Dict[str, Any]]) -> str:
    """Format extracted symbols into a human-readable string for AI prompts."""
    if not symbols:
        return "No symbols in scope."
    
    lines = []
    for sym in symbols:
        if sym['category'] == 'function':
            params = sym.get('meta', {}).get('params', [])
            params_str = ', '.join([f"{p['name']}: {p['type']}" for p in params])
            lines.append(f"  func {sym['name']}({params_str}) -> {sym['type']}")
        else:
            lines.append(f"  {sym['type']} {sym['name']}")
    
    return "Symbols in scope:\n" + '\n'.join(lines)


def find_target_at_line(code: str, target_line: int) -> Optional[Dict[str, Any]]:
    """Find the function or variable declaration at the given line number.
    
    Used by the documentation generator to identify what to document.
    Returns info about the target, or None if nothing interesting is at that line.
    """
    lines = code.split('\n')
    if target_line < 1 or target_line > len(lines):
        return None
    
    line_text = lines[target_line - 1].strip()
    
    # Check for function definition
    if line_text.startswith('func '):
        return {
            'kind': 'function',
            'line': target_line,
            'text': line_text,
        }
    
    # Check for variable declaration (type name pattern)
    type_keywords = ['int', 'float', 'bool', 'string']
    for tk in type_keywords:
        if line_text.startswith(tk + ' '):
            return {
                'kind': 'variable',
                'line': target_line,
                'text': line_text,
            }
    
    # Check surrounding lines (user might click inside a function body)
    # Walk upward to find the enclosing function
    for i in range(target_line - 1, -1, -1):
        check_line = lines[i].strip()
        if check_line.startswith('func '):
            return {
                'kind': 'function',
                'line': i + 1,
                'text': check_line,
            }
    
    return None
