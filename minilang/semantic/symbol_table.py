# MODULE 3 — SYMBOL TABLE (semantic/symbol_table.py)
from dataclasses import dataclass
from typing import Dict, List, Optional, Any

@dataclass
class Symbol:
    name: str
    type_name: str # e.g., 'int', 'float', 'bool', 'string', 'void'
    category: str  # 'variable', 'function'
    meta: Dict[str, Any] = None # Extra info like function params, return type

class SymbolTable:
    def __init__(self):
        # Stack of scopes (each scope is a Dict[str, Symbol])
        self.scopes: List[Dict[str, Symbol]] = [{}]

    def enter_scope(self):
        self.scopes.append({})

    def exit_scope(self):
        if len(self.scopes) > 1:
            self.scopes.pop()

    def define(self, symbol: Symbol) -> bool:
        """Define a symbol in the current scope. Returns False if already defined."""
        current_scope = self.scopes[-1]
        if symbol.name in current_scope:
            return False
        current_scope[symbol.name] = symbol
        return True

    def lookup(self, name: str) -> Optional[Symbol]:
        """Look up a symbol by name in all scopes (innermost to outermost)."""
        for scope in reversed(self.scopes):
            if name in scope:
                return scope[name]
        return None

    def lookup_current_scope(self, name: str) -> Optional[Symbol]:
        """Look up a symbol ONLY in the current scope."""
        return self.scopes[-1].get(name)
