# MODULE 5 — ERROR HANDLER (error/error_handler.py)
from rich.console import Console
from rich.panel import Panel

console = Console()

class CompilerError(Exception):
    def __init__(self, message: str, line: int = 0, col: int = 0, source: str = ""):
        self.message = message
        self.line = line
        self.col = col
        self.source = source
        loc = f" at line {line}, col {col}" if line > 0 else ""
        super().__init__(f"{message}{loc}")

    def display(self):
        title = f"[bold red]{self.__class__.__name__}[/bold red]"
        msg = f"[white]{self.message}[/white]"
        if self.line > 0:
            msg += f"\n[yellow]Location: Line {self.line}, Column {self.col}[/yellow]"
            if self.source:
                lines = self.source.splitlines()
                if 0 < self.line <= len(lines):
                    error_line = lines[self.line - 1]
                    msg += f"\n\n  {error_line}\n  {' ' * (self.col - 1)}[bold red]^[/bold red]"
        
        console.print(Panel(msg, title=title, border_style="red"))

class LexError(CompilerError):   pass
class ParseError(CompilerError): pass
class SemanticError(CompilerError): pass
