# MODULE 5 — CLI (cli.py)
import argparse
import sys
from rich.console import Console
from rich.table import Table
from minilang.lexer.lexer import Lexer
from minilang.parser.parser import Parser
from minilang.semantic.analyzer import SemanticAnalyzer
from minilang.ir.ir_generator import IRGenerator
from minilang.error.error_handler import CompilerError

console = Console()

def run_compiler():
    parser = argparse.ArgumentParser(description="MiniLang Compiler Front-End")
    parser.add_argument("file", help="Source file to compile")
    parser.add_argument("--lex", action="store_true", help="Display tokens")
    parser.add_argument("--ast", action="store_true", help="Display AST (JSON-like)")
    parser.add_argument("--ir", action="store_true", help="Display Three-Address Code")
    
    args = parser.parse_args()
    
    try:
        with open(args.file, "r") as f:
            source = f.read()
            
        # 1. Lexing
        if args.lex:
            console.print("[bold blue]Running Lexer...[/bold blue]")
            lexer = Lexer(source)
            tokens = lexer.tokenize()
            table = Table(title=f"Tokens for {args.file}")
            table.add_column("Type", style="cyan")
            table.add_column("Value", style="magenta")
            table.add_column("Line:Col", style="green")
            for t in tokens:
                table.add_row(t.type.name, str(t.value), f"{t.line}:{t.column}")
            console.print(table)
            
        # 2. Parsing
        parser_obj = Parser()
        ast = parser_obj.parse(source)
        if args.ast:
            console.print("[bold blue]Generated AST:[/bold blue]")
            console.print(ast) # Dataclass __repr__ is decent
            
        # 3. Semantic Analysis
        analyzer = SemanticAnalyzer()
        analyzer.analyze(ast)
        
        # 4. IR Generation
        gen = IRGenerator()
        ir = gen.generate(ast)
        if args.ir:
            console.print("[bold blue]Generated Three-Address Code (TAC):[/bold blue]")
            for instr in ir:
                console.print(str(instr))
        
        console.print("[bold green]Compilation successful![/bold green]")
        
    except FileNotFoundError:
        console.print(f"[bold red]Error:[/bold red] File '{args.file}' not found.")
    except CompilerError as e:
        e.source = source # Provide source for better context
        e.display()
    except Exception as e:
        console.print(f"[bold red]Unexpected Error:[/bold red] {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_compiler()
