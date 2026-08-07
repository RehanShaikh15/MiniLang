# MODULE 4 — IR GENERATOR (ir/ir_generator.py)
from dataclasses import dataclass
from typing import List, Optional, Union, Dict, Any
from minilang.parser.ast_nodes import *

@dataclass
class TAC:
    op: str
    arg1: Any = None
    arg2: Any = None
    result: Any = None

    def __str__(self):
        if self.op == 'LABEL': return f"{self.arg1}:"
        if self.op == 'GOTO': return f"  GOTO {self.arg1}"
        if self.op == 'IF': return f"  IF {self.arg1} GOTO {self.result}"
        if self.op == 'PARAM': return f"  PARAM {self.arg1}"
        if self.op == 'CALL': return f"  {self.result} = CALL {self.arg1}, {self.arg2}"
        if self.op == 'RET': return f"  RET {self.arg1 if self.arg1 is not None else ''}"
        if self.op == 'ASSIGN': return f"  {self.result} = {self.arg1}"
        if self.arg2 is not None:
            return f"  {self.result} = {self.arg1} {self.op} {self.arg2}"
        if self.arg1 is not None:
            return f"  {self.result} = {self.op} {self.arg1}"
        return f"  {self.op}"

class IRGenerator:
    def __init__(self):
        self.code: List[TAC] = []
        self.temp_count = 0
        self.label_count = 0

    def new_temp(self) -> str:
        self.temp_count += 1
        return f"t{self.temp_count}"

    def new_label(self) -> str:
        self.label_count += 1
        return f"L{self.label_count}"

    def emit(self, op: str, arg1=None, arg2=None, result=None):
        instr = TAC(op, arg1, arg2, result)
        self.code.append(instr)
        return result

    def generate(self, node: ASTNode):
        method_name = f'visit_{node.__class__.__name__}'
        visitor = getattr(self, method_name, self.generic_visit)
        return visitor(node)

    def generic_visit(self, node: ASTNode):
        pass # Some nodes might not generate code directly

    def visit_Program(self, node: Program):
        for decl in node.declarations:
            self.generate(decl)
        return self.code

    def visit_FunctionDefinition(self, node: FunctionDefinition):
        self.emit('LABEL', node.name)
        # In a real TAC, we might emit ENTER or similar
        self.generate(node.body)
        # Ensure every function ends with a RET if it doesn't already
        if not self.code or self.code[-1].op != 'RET':
            self.emit('RET')

    def visit_Block(self, node: Block):
        for stmt in node.statements:
            self.generate(stmt)

    def visit_VariableDeclaration(self, node: VariableDeclaration):
        if node.init:
            val = self.generate(node.init)
            self.emit('ASSIGN', val, result=node.name)
        return node.name

    def visit_Assignment(self, node: Assignment):
        val = self.generate(node.expr)
        self.emit('ASSIGN', val, result=node.name)
        return node.name

    def visit_IfStatement(self, node: IfStatement):
        cond = self.generate(node.condition)
        else_label = self.new_label()
        end_label = self.new_label()
        
        self.emit('IF', cond, result=else_label if node.else_branch else end_label)
        # Wait! IF condition GOTO label usually jumps if TRUE?
        # Let's say IF cond GOTO then_label.
        # But commonly we do: IF FALSE cond GOTO else_label.
        # Let's define IF_FALSE for convenience.
        
        # Actually, let's stick to a simple IF x GOTO label means if x is true.
        then_label = self.new_label()
        self.emit('IF', cond, result=then_label)
        if node.else_branch:
            self.generate(node.else_branch)
        self.emit('GOTO', end_label)
        
        self.emit('LABEL', then_label)
        self.generate(node.then_branch)
        self.emit('LABEL', end_label)

    def visit_WhileStatement(self, node: WhileStatement):
        start_label = self.new_label()
        body_label = self.new_label()
        end_label = self.new_label()
        
        self.emit('LABEL', start_label)
        cond = self.generate(node.condition)
        self.emit('IF', cond, result=body_label)
        self.emit('GOTO', end_label)
        
        self.emit('LABEL', body_label)
        self.generate(node.body)
        self.emit('GOTO', start_label)
        self.emit('LABEL', end_label)

    def visit_ForStatement(self, node: ForStatement):
        # for (init; cond; update) body
        if node.init: self.generate(node.init)
        
        start_label = self.new_label()
        body_label = self.new_label()
        end_label = self.new_label()
        
        self.emit('LABEL', start_label)
        if node.condition:
            cond = self.generate(node.condition)
            self.emit('IF', cond, result=body_label)
            self.emit('GOTO', end_label)
        else:
            self.emit('GOTO', body_label)
            
        self.emit('LABEL', body_label)
        self.generate(node.body)
        if node.update: self.generate(node.update)
        self.emit('GOTO', start_label)
        self.emit('LABEL', end_label)

    def visit_ReturnStatement(self, node: ReturnStatement):
        val = self.generate(node.expr) if node.expr else None
        self.emit('RET', val)

    def visit_Literal(self, node: Literal):
        temp = self.new_temp()
        self.emit('ASSIGN', node.value, result=temp)
        return temp

    def visit_VariableReference(self, node: VariableReference):
        return node.name

    def visit_BinaryOp(self, node: BinaryOp):
        l = self.generate(node.left)
        r = self.generate(node.right)
        temp = self.new_temp()
        self.emit(node.op, l, r, result=temp)
        return temp

    def visit_UnaryOp(self, node: UnaryOp):
        expr = self.generate(node.expr)
        temp = self.new_temp()
        self.emit(node.op, expr, result=temp)
        return temp

    def visit_FunctionCall(self, node: FunctionCall):
        args = []
        for arg in node.args:
            args.append(self.generate(arg))
        
        for arg in args:
            self.emit('PARAM', arg)
        
        temp = self.new_temp()
        self.emit('CALL', node.name, len(args), result=temp)
        return temp
