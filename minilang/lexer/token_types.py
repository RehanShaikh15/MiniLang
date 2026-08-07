from enum import Enum, auto
from dataclasses import dataclass

class TokenType(Enum):
    # Keywords
    INT = auto()
    FLOAT = auto()
    BOOL = auto()
    STRING = auto()
    IF = auto()
    ELSE = auto()
    WHILE = auto()
    FOR = auto()
    RETURN = auto()
    FUNC = auto()
    TRUE = auto()
    FALSE = auto()
    VOID = auto()
    PRINT = auto()

    # Operators
    PLUS = auto()      # +
    MINUS = auto()     # -
    MUL = auto()       # *
    DIV = auto()       # /
    MOD = auto()       # %
    EQ = auto()        # ==
    NE = auto()        # !=
    LT = auto()        # <
    LE = auto()        # <=
    GT = auto()        # >
    GE = auto()        # >=
    ASSIGN = auto()    # =
    AND = auto()       # &&
    OR = auto()        # ||
    NOT = auto()       # !

    # Delimiters
    LPAREN = auto()    # (
    RPAREN = auto()    # )
    LBRACE = auto()    # {
    RBRACE = auto()    # }
    LBRACKET = auto()  # [
    RBRACKET = auto()  # ]
    COMMA = auto()     # ,
    SEMICOLON = auto() # ;
    COLON = auto()     # :

    # Literals
    INTEGER_LIT = auto()
    FLOAT_LIT = auto()
    STRING_LIT = auto()
    BOOL_LIT = auto()

    # Identifiers
    IDENTIFIER = auto()

    # Special
    EOF = auto()
    NEWLINE = auto()
    COMMENT = auto()
    UNKNOWN = auto()

@dataclass
class Token:
    type: TokenType
    value: str
    line: int
    column: int

    def __repr__(self):
        return f"Token({self.type.name}, {repr(self.value)}, line={self.line}, col={self.column})"

KEYWORDS = {
    'int': TokenType.INT,
    'float': TokenType.FLOAT,
    'bool': TokenType.BOOL,
    'string': TokenType.STRING,
    'if': TokenType.IF,
    'else': TokenType.ELSE,
    'while': TokenType.WHILE,
    'for': TokenType.FOR,
    'return': TokenType.RETURN,
    'func': TokenType.FUNC,
    'true': TokenType.BOOL_LIT,
    'false': TokenType.BOOL_LIT,
    'void': TokenType.VOID,
    'print': TokenType.PRINT,
}
