"""
MiniLang AST Interpreter
Walks the AST produced by the parser and executes the program,
capturing print() output into a buffer returned to the caller.
"""

from minilang.parser.ast_nodes import (
    Program, FunctionDefinition, FunctionParameter, VariableDeclaration,
    Assignment, IfStatement, WhileStatement, ForStatement, ReturnStatement,
    Block, BinaryOp, UnaryOp, Literal, VariableReference, FunctionCall, TypeNode
)


class ReturnSignal(Exception):
    """Used to unwind the call stack when a return statement is hit."""
    def __init__(self, value):
        self.value = value


class BreakSignal(Exception):
    """Used to break out of loops."""
    pass


class ContinueSignal(Exception):
    """Used to continue to the next iteration of a loop."""
    pass


class RuntimeError(Exception):
    """A runtime error during interpretation."""
    def __init__(self, message):
        self.message = message
        super().__init__(message)


class Environment:
    """A scoped variable environment (linked-list of dictionaries)."""

    def __init__(self, parent=None):
        self.vars = {}
        self.parent = parent

    def get(self, name):
        if name in self.vars:
            return self.vars[name]
        if self.parent is not None:
            return self.parent.get(name)
        raise RuntimeError(f"Undefined variable '{name}'")

    def set(self, name, value):
        """Set in the nearest scope that already has the variable, else current."""
        if name in self.vars:
            self.vars[name] = value
            return
        if self.parent is not None:
            try:
                self.parent.get(name)  # check it exists up the chain
                self.parent.set(name, value)
                return
            except RuntimeError:
                pass
        self.vars[name] = value

    def define(self, name, value):
        """Define a new variable in the current (innermost) scope."""
        self.vars[name] = value


class Interpreter:
    """
    Tree-walking interpreter for MiniLang.

    Usage:
        interp = Interpreter()
        interp.run(ast)          # ast is a Program node
        print(interp.output)     # list of printed strings
    """

    def __init__(self):
        self.global_env = Environment()
        self.functions = {}       # name -> FunctionDefinition node
        self.output = []          # captured print() output lines

    # ── public API ────────────────────────────────────────────

    def run(self, program: Program):
        """Execute a full Program AST."""
        # First pass: register functions and execute top-level declarations
        for decl in program.declarations:
            if isinstance(decl, FunctionDefinition):
                self.functions[decl.name] = decl
            elif isinstance(decl, VariableDeclaration):
                self._exec_var_decl(decl, self.global_env)

        # If there is a main() function, call it automatically
        if 'main' in self.functions:
            self._call_function('main', [], self.global_env)

    # ── statements ────────────────────────────────────────────

    def _exec(self, node, env):
        """Execute a statement node."""
        if node is None:
            return None

        if isinstance(node, Block):
            return self._exec_block(node, env)
        elif isinstance(node, VariableDeclaration):
            return self._exec_var_decl(node, env)
        elif isinstance(node, Assignment):
            return self._exec_assignment(node, env)
        elif isinstance(node, IfStatement):
            return self._exec_if(node, env)
        elif isinstance(node, WhileStatement):
            return self._exec_while(node, env)
        elif isinstance(node, ForStatement):
            return self._exec_for(node, env)
        elif isinstance(node, ReturnStatement):
            return self._exec_return(node, env)
        elif isinstance(node, FunctionCall):
            # expression-statement (e.g. standalone print(...) )
            return self._eval(node, env)
        else:
            # Try evaluating as an expression (covers expression-statements)
            return self._eval(node, env)

    def _exec_block(self, block, env):
        child_env = Environment(parent=env)
        for stmt in block.statements:
            self._exec(stmt, child_env)

    def _exec_var_decl(self, node, env):
        value = None
        if node.init is not None:
            value = self._eval(node.init, env)
        else:
            # Default values by type
            type_name = node.type_node.name if node.type_node else 'int'
            if type_name == 'int':
                value = 0
            elif type_name == 'float':
                value = 0.0
            elif type_name == 'string':
                value = ""
            elif type_name == 'bool':
                value = False
        env.define(node.name, value)

    def _exec_assignment(self, node, env):
        value = self._eval(node.expr, env)
        env.set(node.name, value)

    def _exec_if(self, node, env):
        cond = self._eval(node.condition, env)
        if self._truthy(cond):
            self._exec(node.then_branch, env)
        elif node.else_branch is not None:
            self._exec(node.else_branch, env)

    def _exec_while(self, node, env):
        while self._truthy(self._eval(node.condition, env)):
            try:
                self._exec(node.body, env)
            except BreakSignal:
                break
            except ContinueSignal:
                continue

    def _exec_for(self, node, env):
        loop_env = Environment(parent=env)
        if node.init is not None:
            self._exec(node.init, loop_env)
        while True:
            if node.condition is not None:
                if not self._truthy(self._eval(node.condition, loop_env)):
                    break
            try:
                self._exec(node.body, loop_env)
            except BreakSignal:
                break
            except ContinueSignal:
                pass
            if node.update is not None:
                self._exec(node.update, loop_env)

    def _exec_return(self, node, env):
        value = None
        if node.expr is not None:
            value = self._eval(node.expr, env)
        raise ReturnSignal(value)

    # ── expressions ───────────────────────────────────────────

    def _eval(self, node, env):
        """Evaluate an expression node and return its value."""
        if node is None:
            return None

        if isinstance(node, Literal):
            return node.value
        elif isinstance(node, VariableReference):
            return env.get(node.name)
        elif isinstance(node, BinaryOp):
            return self._eval_binary(node, env)
        elif isinstance(node, UnaryOp):
            return self._eval_unary(node, env)
        elif isinstance(node, FunctionCall):
            return self._eval_call(node, env)
        elif isinstance(node, Assignment):
            # Assignment can also be an expression in for-update
            self._exec_assignment(node, env)
            return env.get(node.name)
        elif isinstance(node, VariableDeclaration):
            self._exec_var_decl(node, env)
            return None
        else:
            raise RuntimeError(f"Cannot evaluate node type: {type(node).__name__}")

    def _eval_binary(self, node, env):
        left = self._eval(node.left, env)
        op = node.op

        # Short-circuit logical operators
        if op == '&&':
            if not self._truthy(left):
                return False
            right = self._eval(node.right, env)
            return self._truthy(right)
        elif op == '||':
            if self._truthy(left):
                return True
            right = self._eval(node.right, env)
            return self._truthy(right)
        
        # Evaluate right operand for other operators
        right = self._eval(node.right, env)

        if op == '+':
            return left + right
        elif op == '-':
            return left - right
        elif op == '*':
            return left * right
        elif op == '/':
            if right == 0:
                raise RuntimeError("Division by zero")
            # Integer division if both are ints
            if isinstance(left, int) and isinstance(right, int):
                return left // right
            return left / right
        elif op == '%':
            if right == 0:
                raise RuntimeError("Modulo by zero")
            return left % right
        elif op == '==':
            return left == right
        elif op == '!=':
            return left != right
        elif op == '<':
            return left < right
        elif op == '>':
            return left > right
        elif op == '<=':
            return left <= right
        elif op == '>=':
            return left >= right
        else:
            raise RuntimeError(f"Unknown binary operator: {op}")

    def _eval_unary(self, node, env):
        val = self._eval(node.expr, env)
        if node.op == '-':
            return -val
        elif node.op == '!':
            return not self._truthy(val)
        else:
            raise RuntimeError(f"Unknown unary operator: {node.op}")

    def _eval_call(self, node, env):
        # Built-in: print
        if node.name == 'print':
            args = [self._eval(arg, env) for arg in node.args]
            for arg in args:
                display = self._display_value(arg)
                self.output.append(display)
            return None

        return self._call_function(node.name, node.args, env)

    def _call_function(self, name, arg_nodes, caller_env):
        if name not in self.functions:
            raise RuntimeError(f"Undefined function '{name}'")

        func = self.functions[name]

        # Evaluate arguments in the caller's environment
        arg_values = [self._eval(arg, caller_env) for arg in arg_nodes]

        # Create a new environment for the function body (lexical scope from global)
        func_env = Environment(parent=self.global_env)

        # Bind parameters
        for param, value in zip(func.params, arg_values):
            func_env.define(param.name, value)

        # Execute body
        try:
            self._exec(func.body, func_env)
        except ReturnSignal as ret:
            return ret.value

        return None

    # ── helpers ────────────────────────────────────────────────

    @staticmethod
    def _truthy(value):
        """Determine if a value is truthy (C-like semantics)."""
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return len(value) > 0
        return value is not None

    @staticmethod
    def _display_value(value):
        """Convert a value to its display string."""
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, str):
            return value
        if value is None:
            return "null"
        return str(value)
