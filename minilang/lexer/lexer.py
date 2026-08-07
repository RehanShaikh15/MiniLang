"""
MODULE 1 — LEXICAL ANALYZER (lexer/)

Each token pattern is a regular expression, which the Python 're' engine 
compiles into a DFA. This directly models a Nondeterministic Finite 
Automaton (NFA) converted to a DFA via the subset construction 
algorithm — the theoretical basis of all regex-based lexers.
"""

import re
from typing import cast, List, Optional, Dict
from .token_types import TokenType, Token, KEYWORDS
from ..error.error_handler import LexError

class Lexer:
    TOKEN_PATTERNS = [
        ('FLOAT_LIT',   r'\d+\.\d+'),
        ('INTEGER_LIT', r'\d+'),
        ('STRING_LIT',  r'"(?:[^"\\]|\\.)*"'),
        ('IDENTIFIER',  r'[a-zA-Z_]\w*'),
        ('OP_2CHAR',    r'==|!=|<=|>=|&&|\|\|'),
        ('OP_1CHAR',    r'[+\-*/%=<>!]'),
        ('DELIMITER',   r'[(){}\[\] ,;:]'),
        ('NEWLINE',     r'\n'),
        ('SKIP',        r'[ \t]+'),
        ('COMMENT',     r'//[^\n]*'),
        ('MISMATCH',    r'.'),
    ]

    def __init__(self, source: str):
        self.source = source
        self.tokens = []
        self.errors = []
        self.line = 1
        self.column_start = 0
        
        # Each regex pattern evaluates to a DFA internally.
        # Subset construction handles the conversion from NFA to DFA.
        regex_parts = [f'(?P<{name}>{pattern})' for name, pattern in self.TOKEN_PATTERNS]
        self.master_regex = re.compile('|'.join(regex_parts))

    def tokenize(self) -> list[Token]:
        pos = 0
        while pos < len(self.source):
            match = self.master_regex.match(self.source, pos)
            if not match:
                # Should not happen because of MISMATCH pattern
                break
            
            kind = match.lastgroup
            if kind is None:
                break
            value = match.group(kind)
            column = match.start() - self.column_start + 1

            if kind == 'FLOAT_LIT':
                self.tokens.append(Token(TokenType.FLOAT_LIT, value, self.line, column))
            elif kind == 'INTEGER_LIT':
                self.tokens.append(Token(TokenType.INTEGER_LIT, value, self.line, column))
            elif kind == 'STRING_LIT':
                # Remove quotes
                if value is not None and len(value) >= 2:
                    s_value: str = cast(str, value)
                    val = s_value[1:-1].replace('\\"', '"').replace('\\\\', '\\')
                    self.tokens.append(Token(TokenType.STRING_LIT, val, self.line, column))
                else:
                    self.tokens.append(Token(TokenType.STRING_LIT, "", self.line, column))
            elif kind == 'IDENTIFIER':
                # Disambiguate keywords from identifiers
                # Theoretical concept: Keywords are reserved symbols in the language's alphabet.
                token_type = KEYWORDS.get(value, TokenType.IDENTIFIER)
                self.tokens.append(Token(token_type, value, self.line, column))
            elif kind == 'OP_2CHAR' or kind == 'OP_1CHAR':
                token_type = self._map_operator(value)
                self.tokens.append(Token(token_type, value, self.line, column))
            elif kind == 'DELIMITER':
                token_type = self._map_delimiter(value)
                if token_type:
                    self.tokens.append(Token(token_type, value, self.line, column))
            elif kind == 'NEWLINE':
                self.line += 1
                self.column_start = match.end()
            elif kind == 'SKIP' or kind == 'COMMENT':
                pass
            elif kind == 'MISMATCH':
                # Error recovery: record errors and continue
                self.errors.append(LexError(f"Unexpected character: {value!r}", self.line, column))
            
            pos = match.end()
        
        self.tokens.append(Token(TokenType.EOF, "", self.line, len(self.source) - self.column_start + 1))
        return self.tokens

    def _map_operator(self, op: str) -> TokenType:
        mapping = {
            '+': TokenType.PLUS, '-': TokenType.MINUS, '*': TokenType.MUL, '/': TokenType.DIV,
            '%': TokenType.MOD, '==': TokenType.EQ, '!=': TokenType.NE, '<': TokenType.LT,
            '<=': TokenType.LE, '>': TokenType.GT, '>=': TokenType.GE, '=': TokenType.ASSIGN,
            '&&': TokenType.AND, '||': TokenType.OR, '!': TokenType.NOT
        }
        return mapping.get(op, TokenType.UNKNOWN)

    def _map_delimiter(self, delim: str) -> TokenType | None:
        mapping = {
            '(': TokenType.LPAREN, ')': TokenType.RPAREN,
            '{': TokenType.LBRACE, '}': TokenType.RBRACE,
            '[': TokenType.LBRACKET, ']': TokenType.RBRACKET,
            ',': TokenType.COMMA, ';': TokenType.SEMICOLON, ':': TokenType.COLON
        }
        return mapping.get(delim)
