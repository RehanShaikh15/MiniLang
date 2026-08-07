# MODULE 2 — PARSER (parser/parser.py)
import os
from lark import Lark, Transformer, v_args
from minilang.parser.ast_nodes import *

class MiniLangTransformer(Transformer):
    def program(self, items):
        return Program(items)

    def func_def(self, items):
        name = str(items[0])
        params = items[1] if items[1] is not None else []
        ret_type = items[2]
        body = items[3]
        return FunctionDefinition(name, params, ret_type, body)

    def params(self, items):
        return [i for i in items if i is not None]

    @v_args(inline=True)
    def param(self, name, type_node):
        return FunctionParameter(str(name), type_node)

    def var_decl_stmt(self, items):
        return items[0]

    def expr_stmt(self, items):
        return items[0]

    def var_decl(self, items):
        type_node = items[0]
        name = str(items[1])
        init = items[2] if len(items) > 2 else None
        return VariableDeclaration(type_node, name, init)

    @v_args(inline=True)
    def assign_stmt(self, name, expr):
        return Assignment(str(name), expr)

    def if_stmt(self, items):
        return IfStatement(items[0], items[1], items[2] if len(items) > 2 else None)

    @v_args(inline=True)
    def while_stmt(self, condition, body):
        return WhileStatement(condition, body)

    @v_args(inline=True)
    def for_stmt(self, init, condition, update, body):
        return ForStatement(init, condition, update, body)

    @v_args(inline=True)
    def return_stmt(self, expr=None):
        return ReturnStatement(expr)

    def stmt_list(self, items):
        return Block([i for i in items if i is not None])

    def block_stmt(self, items):
        return items[0]

    # Expressions
    def _binary_op(self, items):
        items = [i for i in items if i is not None]
        if len(items) == 1: return items[0]
        res = items[0]
        for i in range(1, len(items), 2):
            res = BinaryOp(res, str(items[i]), items[i+1])
        return res

    def logic_or(self, items): return self._binary_op(items)
    def logic_and(self, items): return self._binary_op(items)
    def equality(self, items): return self._binary_op(items)
    def comparison(self, items): return self._binary_op(items)
    def term(self, items): return self._binary_op(items)
    def factor(self, items): return self._binary_op(items)

    @v_args(inline=True)
    def power(self, left, op=None, right=None):
        if op is None: return left
        return BinaryOp(left, str(op), right)

    @v_args(inline=True)
    def unary(self, op=None, expr=None):
        if expr is None: return op
        if op is None: return expr
        return UnaryOp(str(op), expr)

    def int_lit(self, items):
        return Literal(int(items[0]))

    def float_lit(self, items):
        return Literal(float(items[0]))

    def string_lit(self, items):
        val = str(items[0])[1:-1]
        return Literal(val)

    def true_lit(self, _):
        return Literal(True)

    def false_lit(self, _):
        return Literal(False)

    @v_args(inline=True)
    def var_ref(self, name):
        return VariableReference(str(name))

    def func_call(self, items):
        name = str(items[0])
        args = items[1] if (len(items) > 1 and items[1] is not None) else []
        return FunctionCall(name, args)

    def args(self, items):
        return [i for i in items if i is not None]

    def type_int(self, _): return TypeNode("int")
    def type_float(self, _): return TypeNode("float")
    def type_bool(self, _): return TypeNode("bool")
    def type_string(self, _): return TypeNode("string")
    def type_void(self, _): return TypeNode("void")


class Parser:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        grammar_path = os.path.join(current_dir, "..", "grammar", "minilang.lark")
        with open(grammar_path, "r") as f:
            self.grammar = f.read()
        self.lark = Lark(self.grammar, parser="lalr", transformer=MiniLangTransformer(), maybe_placeholders=True)

    def parse(self, text: str) -> Program:
        return self.lark.parse(text)
