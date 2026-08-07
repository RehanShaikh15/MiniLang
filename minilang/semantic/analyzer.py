# MODULE 3 — SEMANTIC ANALYZER (semantic/analyzer.py)
from typing import List, Optional, Union, Dict
from minilang.parser.ast_nodes import *
from minilang.semantic.symbol_table import SymbolTable, Symbol
from minilang.error.error_handler import SemanticError

class SemanticAnalyzer:
    def __init__(self):
        self.symbol_table = SymbolTable()
        self.current_function: Optional[FunctionDefinition] = None
        self.errors: List[str] = []

    def error(self, message: str):
        self.errors.append(message)
        # For now, we collect errors. In a real compiler, we might throw immediately.
        # But collecting allows finding multiple errors.

    def analyze(self, node: ASTNode):
        method_name = f'visit_{node.__class__.__name__}'
        visitor = getattr(self, method_name, self.generic_visit)
        return visitor(node)

    def generic_visit(self, node: ASTNode):
        raise Exception(f"No visit_{node.__class__.__name__} method defined")

    def visit_Program(self, node: Program):
        # Pass 1: Collect function signatures
        for decl in node.declarations:
            if isinstance(decl, FunctionDefinition):
                params_info = [{'name': p.name, 'type': p.type_node.name} for p in decl.params]
                symbol = Symbol(
                    name=decl.name,
                    type_name=decl.return_type.name,
                    category='function',
                    meta={'params': params_info}
                )
                if not self.symbol_table.define(symbol):
                    self.error(f"Function '{decl.name}' already defined in global scope")

        # Pass 2: Analyze everything
        for decl in node.declarations:
            self.analyze(decl)
        
        if self.errors:
            raise SemanticError("\n".join(self.errors))

    def visit_FunctionDefinition(self, node: FunctionDefinition):
        self.current_function = node
        self.symbol_table.enter_scope()
        
        # Define parameters in the function scope
        for param in node.params:
            symbol = Symbol(name=param.name, type_name=param.type_node.name, category='variable')
            if not self.symbol_table.define(symbol):
                self.error(f"Parameter '{param.name}' already defined in function '{node.name}'")
        
        self.analyze(node.body)
        
        self.symbol_table.exit_scope()
        self.current_function = None

    def visit_VariableDeclaration(self, node: VariableDeclaration):
        # Analyze initializer if present
        init_type = None
        if node.init:
            init_type = self.analyze(node.init)
            if init_type != node.type_node.name:
                self.error(f"Type mismatch in declaration of '{node.name}': expected {node.type_node.name}, got {init_type}")
        
        symbol = Symbol(name=node.name, type_name=node.type_node.name, category='variable')
        if not self.symbol_table.define(symbol):
            self.error(f"Variable '{node.name}' already defined in current scope")
        
        return node.type_node.name

    def visit_Assignment(self, node: Assignment):
        symbol = self.symbol_table.lookup(node.name)
        if not symbol:
            self.error(f"Undefined variable '{node.name}'")
            return 'void'
        
        if symbol.category != 'variable':
            self.error(f"'{node.name}' is a function and cannot be assigned to")
            return 'void'

        expr_type = self.analyze(node.expr)
        if expr_type != symbol.type_name:
            self.error(f"Type mismatch in assignment to '{node.name}': expected {symbol.type_name}, got {expr_type}")
        
        return symbol.type_name

    def visit_IfStatement(self, node: IfStatement):
        cond_type = self.analyze(node.condition)
        if cond_type != 'bool':
            self.error(f"If condition must be bool, got {cond_type}")
        
        self.analyze(node.then_branch)
        if node.else_branch:
            self.analyze(node.else_branch)

    def visit_WhileStatement(self, node: WhileStatement):
        cond_type = self.analyze(node.condition)
        if cond_type != 'bool':
            self.error(f"While condition must be bool, got {cond_type}")
        self.analyze(node.body)

    def visit_ForStatement(self, node: ForStatement):
        self.symbol_table.enter_scope()
        if node.init: self.analyze(node.init)
        if node.condition:
            cond_type = self.analyze(node.condition)
            if cond_type != 'bool':
                self.error(f"For condition must be bool, got {cond_type}")
        if node.update: self.analyze(node.update)
        self.analyze(node.body)
        self.symbol_table.exit_scope()

    def visit_ReturnStatement(self, node: ReturnStatement):
        if not self.current_function:
            self.error("Return statement outside of function")
            return 'void'
        
        ret_type = 'void'
        if node.expr:
            ret_type = self.analyze(node.expr)
        
        expected = self.current_function.return_type.name
        if ret_type != expected:
            self.error(f"Return type mismatch in function '{self.current_function.name}': expected {expected}, got {ret_type}")
        
        return ret_type

    def visit_Block(self, node: Block):
        # Note: If it's a function body, we already entered scope.
        # But generic blocks should probably have their own scope? 
        # Our grammar allows block_stmt.
        # For simplicity, let's say every Block {} creates a scope.
        # BUT wait! FunctionDefinition already enters scope.
        # So we should be careful not to double-enter.
        
        # Let's check if we are in a function definition
        # Actually, let's just always enter scope, it's safer.
        self.symbol_table.enter_scope()
        for stmt in node.statements:
            self.analyze(stmt)
        self.symbol_table.exit_scope()

    # Expressions
    def visit_Literal(self, node: Literal):
        if isinstance(node.value, bool): return 'bool'
        if isinstance(node.value, int): return 'int'
        if isinstance(node.value, float): return 'float'
        if isinstance(node.value, str): return 'string'
        return 'void'

    def visit_VariableReference(self, node: VariableReference):
        symbol = self.symbol_table.lookup(node.name)
        if not symbol:
            self.error(f"Undefined variable '{node.name}'")
            return 'void'
        return symbol.type_name

    def visit_BinaryOp(self, node: BinaryOp):
        left_type = self.analyze(node.left)
        right_type = self.analyze(node.right)
        
        if node.op in ['+', '-', '*', '/', '%', '^']:
            if left_type not in ['int', 'float'] or right_type not in ['int', 'float']:
                self.error(f"Arithmetic operator '{node.op}' requires numeric types, got {left_type} and {right_type}")
                return 'float' # Recovery
            return 'float' if (left_type == 'float' or right_type == 'float') else 'int'
        
        if node.op in ['<', '<=', '>', '>=', '==', '!=']:
            if left_type != right_type:
                self.error(f"Comparison operator '{node.op}' requires same types, got {left_type} and {right_type}")
            return 'bool'
        
        if node.op in ['&&', '||']:
            if left_type != 'bool' or right_type != 'bool':
                self.error(f"Logical operator '{node.op}' requires bool types, got {left_type} and {right_type}")
            return 'bool'
        
        return 'void'

    def visit_UnaryOp(self, node: UnaryOp):
        expr_type = self.analyze(node.expr)
        if node.op == '-':
            if expr_type not in ['int', 'float']:
                self.error(f"Unary minus requires numeric type, got {expr_type}")
            return expr_type
        if node.op == '!':
            if expr_type != 'bool':
                self.error(f"Unary logical not requires bool, got {expr_type}")
            return 'bool'
        return 'void'

    def visit_FunctionCall(self, node: FunctionCall):
        symbol = self.symbol_table.lookup(node.name)
        if not symbol:
            # Special case for 'print' if we want it as a built-in
            if node.name == 'print':
                for arg in node.args: self.analyze(arg)
                return 'void'
            self.error(f"Undefined function '{node.name}'")
            return 'void'
        
        if symbol.category != 'function':
            self.error(f"'{node.name}' is literal or variable, not a function")
            return 'void'
        
        expected_params = symbol.meta['params']
        if len(node.args) != len(expected_params):
            self.error(f"Function '{node.name}' expected {len(expected_params)} arguments, got {len(node.args)}")
        else:
            for i, arg in enumerate(node.args):
                arg_type = self.analyze(arg)
                expected_type = expected_params[i]['type']
                if arg_type != expected_type:
                    self.error(f"Argument type mismatch in '{node.name}': expected {expected_type}, got {arg_type}")
        
        return symbol.type_name
