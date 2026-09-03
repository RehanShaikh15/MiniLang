import os
import sys
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import traceback

# Add the current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from minilang.lexer.lexer import Lexer
from minilang.parser.parser import Parser
from minilang.semantic.analyzer import SemanticAnalyzer
from minilang.ir.ir_generator import IRGenerator
from minilang.error.error_handler import CompilerError
from minilang.ai.ai_service import get_ai_service
from minilang.ai.context import extract_symbols, get_code_around_cursor, format_symbols_for_prompt, find_target_at_line

def generate_lexer_dfa():
    """Generate a simplified DFA representation from the lexer's token patterns.
    Returns a list of pattern groups, each with states and transitions."""
    patterns = [
        {'name': 'FLOAT_LIT', 'regex': r'\d+\.\d+', 'states': [
            {'id': 'F0', 'label': 'Start'},
            {'id': 'F1', 'label': 'Digits'},
            {'id': 'F2', 'label': 'Dot'},
            {'id': 'F3', 'label': 'Accept', 'accepting': True}
        ], 'transitions': [
            {'from': 'F0', 'to': 'F1', 'label': '[0-9]'},
            {'from': 'F1', 'to': 'F1', 'label': '[0-9]'},
            {'from': 'F1', 'to': 'F2', 'label': '.'},
            {'from': 'F2', 'to': 'F3', 'label': '[0-9]'},
            {'from': 'F3', 'to': 'F3', 'label': '[0-9]'}
        ]},
        {'name': 'INTEGER_LIT', 'regex': r'\d+', 'states': [
            {'id': 'I0', 'label': 'Start'},
            {'id': 'I1', 'label': 'Accept', 'accepting': True}
        ], 'transitions': [
            {'from': 'I0', 'to': 'I1', 'label': '[0-9]'},
            {'from': 'I1', 'to': 'I1', 'label': '[0-9]'}
        ]},
        {'name': 'STRING_LIT', 'regex': r'"[^"]*"', 'states': [
            {'id': 'S0', 'label': 'Start'},
            {'id': 'S1', 'label': 'Open'},
            {'id': 'S2', 'label': 'Chars'},
            {'id': 'S3', 'label': 'Accept', 'accepting': True}
        ], 'transitions': [
            {'from': 'S0', 'to': 'S1', 'label': '"'},
            {'from': 'S1', 'to': 'S2', 'label': '[^"]'},
            {'from': 'S2', 'to': 'S2', 'label': '[^"]'},
            {'from': 'S2', 'to': 'S3', 'label': '"'},
            {'from': 'S1', 'to': 'S3', 'label': '"'}
        ]},
        {'name': 'IDENTIFIER', 'regex': r'[a-zA-Z_]\w*', 'states': [
            {'id': 'D0', 'label': 'Start'},
            {'id': 'D1', 'label': 'Accept', 'accepting': True}
        ], 'transitions': [
            {'from': 'D0', 'to': 'D1', 'label': '[a-zA-Z_]'},
            {'from': 'D1', 'to': 'D1', 'label': '[a-zA-Z0-9_]'}
        ]},
        {'name': 'OPERATORS', 'regex': r'==|!=|<=|>=|&&|\|\|', 'states': [
            {'id': 'O0', 'label': 'Start'},
            {'id': 'O1', 'label': 'First Char'},
            {'id': 'O2', 'label': 'Accept', 'accepting': True}
        ], 'transitions': [
            {'from': 'O0', 'to': 'O1', 'label': '= ! < > & |'},
            {'from': 'O1', 'to': 'O2', 'label': '= & |'},
            {'from': 'O0', 'to': 'O2', 'label': '+ - * / %'}
        ]}
    ]
    return patterns

def build_cfg(ir_code):
    """Build a Control Flow Graph from Three-Address Code instructions.
    Returns {nodes: [...], edges: [...]} for graph visualization."""
    if not ir_code:
        return {'nodes': [], 'edges': []}
    
    blocks = []
    current_block = {'id': 'entry', 'label': 'Entry', 'instructions': []}
    label_to_block = {}

    for instr in ir_code:
        if instr.op == 'LABEL':
            # Save current block if it has instructions
            if current_block['instructions']:
                blocks.append(current_block)
            block_id = str(instr.arg1)
            current_block = {'id': block_id, 'label': str(instr.arg1), 'instructions': []}
            label_to_block[block_id] = current_block
        else:
            current_block['instructions'].append(str(instr))

    if current_block['instructions'] or current_block['id'] != 'entry':
        blocks.append(current_block)

    # If entry block has no instructions and we have other blocks, remove it
    if blocks and blocks[0]['id'] == 'entry' and not blocks[0]['instructions']:
        blocks.pop(0)

    # Build edges from GOTO and IF instructions
    edges = []
    for i, block in enumerate(blocks):
        last_instr_text = block['instructions'][-1] if block['instructions'] else ''
        has_jump = False
        for instr_text in block['instructions']:
            stripped = instr_text.strip()
            if stripped.startswith('GOTO '):
                target = stripped.replace('GOTO ', '').strip()
                edges.append({'from': block['id'], 'to': target, 'label': ''})
                has_jump = True
            elif stripped.startswith('IF '):
                # IF t1 GOTO L3
                parts = stripped.split(' GOTO ')
                if len(parts) == 2:
                    cond = parts[0].replace('IF ', '').strip()
                    target = parts[1].strip()
                    edges.append({'from': block['id'], 'to': target, 'label': f'if {cond}'})
        
        # Fallthrough to next block if no unconditional jump at end
        last_stripped = last_instr_text.strip() if last_instr_text else ''
        if not last_stripped.startswith('GOTO ') and not last_stripped.startswith('RET') and i + 1 < len(blocks):
            edges.append({'from': block['id'], 'to': blocks[i + 1]['id'], 'label': 'fall'})

    # Convert instruction lists to display strings
    nodes = []
    for block in blocks:
        nodes.append({
            'id': block['id'],
            'label': block['label'],
            'instructions': block['instructions'][:8]  # Limit display length
        })

    return {'nodes': nodes, 'edges': edges}


def ast_to_ui(node):
    if node is None:
        return None
    name = node.__class__.__name__
    
    try:
        if name == 'Program':
            return {"type": "Program", "children": [ast_to_ui(d) for d in node.declarations]}
        elif name == 'FunctionDefinition':
            params_str = ", ".join([f"{p.name}: {p.type_node.name}" for p in node.params])
            return {
                "type": "FuncDef",
                "props": f"{node.name}({params_str}) -> {node.return_type.name}",
                "children": [ast_to_ui(node.body)]
            }
        elif name == 'VariableDeclaration':
            props = f"{node.type_node.name} {node.name}"
            children = [ast_to_ui(node.init)] if node.init else []
            return {"type": "VarDecl", "props": props, "children": children}
        elif name == 'Assignment':
            return {"type": "Assignment", "props": f"{node.name} =", "children": [ast_to_ui(node.expr)]}
        elif name == 'IfStatement':
            children = [
                {"type": "Condition", "children": [ast_to_ui(node.condition)]},
                {"type": "Then", "children": [ast_to_ui(node.then_branch)]}
            ]
            if node.else_branch:
                 children.append({"type": "Else", "children": [ast_to_ui(node.else_branch)]})
            return {"type": "IfStmt", "children": children}
        elif name == 'WhileStatement':
            return {"type": "WhileStmt", "children": [
                {"type": "Condition", "children": [ast_to_ui(node.condition)]},
                {"type": "Body", "children": [ast_to_ui(node.body)]}
            ]}
        elif name == 'ForStatement':
            return {"type": "ForStmt", "children": [
                {"type": "Init", "children": [ast_to_ui(node.init)] if node.init else []},
                {"type": "Cond", "children": [ast_to_ui(node.condition)] if node.condition else []},
                {"type": "Update", "children": [ast_to_ui(node.update)] if node.update else []},
                {"type": "Body", "children": [ast_to_ui(node.body)]}
            ]}
        elif name == 'ReturnStatement':
            return {"type": "ReturnStmt", "children": [ast_to_ui(node.expr)] if node.expr else []}
        elif name == 'Block':
            return {"type": "Block", "children": [ast_to_ui(s) for s in node.statements]}
        elif name == 'BinaryOp':
            return {"type": "BinaryOp", "props": str(node.op), "children": [ast_to_ui(node.left), ast_to_ui(node.right)]}
        elif name == 'UnaryOp':
            return {"type": "UnaryOp", "props": str(node.op), "children": [ast_to_ui(node.expr)]}
        elif name == 'Literal':
            return {"type": "Literal", "props": str(node.value)}
        elif name == 'VariableReference':
            return {"type": "VarRef", "props": node.name}
        elif name == 'FunctionCall':
            return {"type": "FuncCall", "props": node.name, "children": [ast_to_ui(arg) for arg in node.args]}
        elif name == 'TypeNode':
            return {"type": "Type", "props": node.name}
        elif name == 'FunctionParameter':
            return {"type": "Param", "props": f"{node.name}: {node.type_node.name}"}
    except Exception as e:
        return {"type": "Error", "props": str(e)}

    return {"type": name}

# Global parser instance to significantly speed up compilation (avoid grammar recompilation)
_GLOBAL_PARSER = None

class CompilerAPI(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        BaseHTTPRequestHandler.end_headers(self)

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        global _GLOBAL_PARSER
        
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            req = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self._send_json(400, {"status": "error", "errors": [{"message": "Invalid JSON"}]})
            return

        # Route to the correct handler based on path
        path = self.path
        
        if path == '/api/autocomplete':
            self._handle_autocomplete(req)
        elif path == '/api/explain-error':
            self._handle_explain_error(req)
        elif path == '/api/refactor':
            self._handle_refactor(req)
        elif path == '/api/generate-docs':
            self._handle_generate_docs(req)
        else:
            # Default: compile endpoint (handles both / and /api/compile)
            self._handle_compile(req)

    def _handle_compile(self, req):
        """Handle the main compile endpoint."""
        global _GLOBAL_PARSER
        source = req.get('code', '')
        
        response = {
            "status": "success",
            "tokens": [],
            "ast": None,
            "ir": [],
            "automata": None,
            "errors": []
        }
        
        try:
            # 1. Lexer
            lexer = Lexer(source)
            tokens = lexer.tokenize()
            response['tokens'] = [
                {"type": t.type.name, "value": t.value, "line": t.line, "col": t.column}
                for t in tokens if t.type.name != 'EOF'
            ]
            if lexer.errors:
                for err in lexer.errors:
                    response['errors'].append({"message": err.message, "line": err.line, "col": err.col})
                self._send_json(400, response)
                return
            
            # 2. Parser
            if _GLOBAL_PARSER is None:
                _GLOBAL_PARSER = Parser()
            ast = _GLOBAL_PARSER.parse(source)
            response['ast'] = ast_to_ui(ast)
            
            # 3. Semantic Analysis
            analyzer = SemanticAnalyzer()
            analyzer.analyze(ast)
            
            # 4. IR Generator
            gen = IRGenerator()
            gen.generate(ast)
            ir = gen.code
            ir_list = []
            for instr in ir:
                text = str(instr)
                instr_type = "op"
                if "LABEL" in instr.op or ":" in text: instr_type = "label"
                elif "GOTO" in instr.op or "IF" in instr.op: instr_type = "goto"
                elif "=" in text and not ("CALL" in text or "op" in text): instr_type = "assign"
                ir_list.append({"type": instr_type, "text": text})
            response['ir'] = ir_list

            # 5. Automata data
            response['automata'] = {
                'dfa': generate_lexer_dfa(),
                'cfg': build_cfg(ir)
            }

        except CompilerError as e:
            response["status"] = "error"
            response["errors"].append({
                "message": e.message,
                "line": getattr(e, 'line', 0),
                "col": getattr(e, 'col', 0)
            })
        except Exception as e:
            response["status"] = "error"
            response["errors"].append({
                "message": f"Unexpected compiler error: {str(e)}\n{traceback.format_exc()}",
                "line": 0,
                "col": 0
            })

        self._send_json(200, response)
    
    # ─────────────────────────────────────────────
    # AI Feature 1: Autocomplete
    # ─────────────────────────────────────────────
    def _handle_autocomplete(self, req):
        """Handle POST /api/autocomplete — AI-powered code completion."""
        code = req.get('code', '')
        cursor_line = req.get('cursorLine', 1)
        cursor_col = req.get('cursorCol', 0)
        
        ai = get_ai_service()
        if not ai.available:
            self._send_json(200, {"suggestion": None, "error": "AI service not available"})
            return
        
        try:
            # Extract compiler context
            symbols = extract_symbols(code)
            symbols_text = format_symbols_for_prompt(symbols)
            context = get_code_around_cursor(code, cursor_line, cursor_col)
            
            # Get AI suggestion
            suggestion = ai.get_autocomplete(
                code_before=context['before'],
                code_after=context['after'],
                symbols_text=symbols_text
            )
            
            self._send_json(200, {"suggestion": suggestion})
            
        except Exception as e:
            print(f"[Autocomplete Error] {e}")
            traceback.print_exc()
            self._send_json(200, {"suggestion": None, "error": str(e)})
    
    # ─────────────────────────────────────────────
    # AI Feature 2: Error Explanation
    # ─────────────────────────────────────────────
    def _handle_explain_error(self, req):
        """Handle POST /api/explain-error — beginner-friendly error explanations."""
        error_message = req.get('error', '')
        code = req.get('code', '')
        
        ai = get_ai_service()
        if not ai.available:
            self._send_json(200, {"explanation": None, "error": "AI service not available"})
            return
        
        try:
            result = ai.explain_error(error_message, code)
            self._send_json(200, result or {"explanation": "Could not generate explanation.", "suggestion": "", "example": ""})
            
        except Exception as e:
            print(f"[Error Explanation Error] {e}")
            traceback.print_exc()
            self._send_json(200, {"explanation": None, "error": str(e)})
    
    # ─────────────────────────────────────────────
    # AI Feature 3: Refactoring
    # ─────────────────────────────────────────────
    def _handle_refactor(self, req):
        """Handle POST /api/refactor — AI refactoring suggestions."""
        code = req.get('code', '')
        selection = req.get('selection', '')
        
        ai = get_ai_service()
        if not ai.available:
            self._send_json(200, {"suggestions": None, "error": "AI service not available"})
            return
        
        if not selection.strip():
            self._send_json(200, {"suggestions": None, "error": "No code selected"})
            return
        
        try:
            suggestions = ai.suggest_refactor(code, selection)
            self._send_json(200, {"suggestions": suggestions})
            
        except Exception as e:
            print(f"[Refactor Error] {e}")
            traceback.print_exc()
            self._send_json(200, {"suggestions": None, "error": str(e)})
    
    # ─────────────────────────────────────────────
    # AI Feature 4: Documentation Generator
    # ─────────────────────────────────────────────
    def _handle_generate_docs(self, req):
        """Handle POST /api/generate-docs — auto-generate doc comments."""
        code = req.get('code', '')
        target_line = req.get('targetLine', 1)
        
        ai = get_ai_service()
        if not ai.available:
            self._send_json(200, {"documentation": None, "error": "AI service not available"})
            return
        
        try:
            target = find_target_at_line(code, target_line)
            if not target:
                self._send_json(200, {"documentation": None, "error": "No function or variable found at this line"})
                return
            
            docs = ai.generate_docs(code, target)
            self._send_json(200, {
                "documentation": docs,
                "insertLine": target['line'],
                "targetKind": target['kind']
            })
            
        except Exception as e:
            print(f"[Doc Generator Error] {e}")
            traceback.print_exc()
            self._send_json(200, {"documentation": None, "error": str(e)})

    def _send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

if __name__ == '__main__':
    port = 8000
    server_address = ('', port)
    httpd = HTTPServer(server_address, CompilerAPI)
    print(f"Starting Python Compiler API on port {port}...")
    print(f"  POST /           — Compile MiniLang code")
    print(f"  POST /api/autocomplete   — AI autocomplete")
    print(f"  POST /api/explain-error  — AI error explanation")
    print(f"  POST /api/refactor       — AI refactoring")
    print(f"  POST /api/generate-docs  — AI doc generator")
    httpd.serve_forever()

