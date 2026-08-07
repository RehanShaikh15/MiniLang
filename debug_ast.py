from minilang.parser.parser import Parser
from minilang.parser.ast_nodes import *
import pprint

with open("example.ml", "r") as f:
    source = f.read()

p = Parser()
ast = p.parse(source)
print("AST STRUCTURE:")
pprint.pprint(ast)
