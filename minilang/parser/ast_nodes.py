# MODULE 2 — AST NODES (parser/ast_nodes.py)
from dataclasses import dataclass, field
from typing import List, Optional, Union

@dataclass
class ASTNode:
    pass

@dataclass
class Expression(ASTNode):
    pass

@dataclass
class Statement(ASTNode):
    pass

@dataclass
class TypeNode(ASTNode):
    name: str

@dataclass
class Literal(Expression):
    value: Union[int, float, str, bool]

@dataclass
class VariableReference(Expression):
    name: str

@dataclass
class BinaryOp(Expression):
    left: Expression
    op: str
    right: Expression

@dataclass
class UnaryOp(Expression):
    op: str
    expr: Expression

@dataclass
class FunctionCall(Expression):
    name: str
    args: List[Expression]

@dataclass
class VariableDeclaration(Statement):
    type_node: TypeNode
    name: str
    init: Optional[Expression] = None

@dataclass
class Assignment(Statement):
    name: str
    expr: Expression

@dataclass
class IfStatement(Statement):
    condition: Expression
    then_branch: Statement
    else_branch: Optional[Statement] = None

@dataclass
class WhileStatement(Statement):
    condition: Expression
    body: Statement

@dataclass
class ForStatement(Statement):
    init: Optional[Expression]
    condition: Optional[Expression]
    update: Optional[Expression]
    body: Statement

@dataclass
class ReturnStatement(Statement):
    expr: Optional[Expression] = None

@dataclass
class Block(Statement):
    statements: List[Statement]

@dataclass
class FunctionParameter(ASTNode):
    name: str
    type_node: TypeNode

@dataclass
class FunctionDefinition(ASTNode):
    name: str
    params: List[FunctionParameter]
    return_type: TypeNode
    body: Block

@dataclass
class Program(ASTNode):
    declarations: List[Union[FunctionDefinition, VariableDeclaration]]
