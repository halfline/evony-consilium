import ast
import unittest
from pathlib import Path


class AssetArchitectureTest(unittest.TestCase):
    def test_package_imports_resolve_without_cycles(self):
        root = Path(__file__).resolve().parents[2] / "src" / "consilium_assets"
        edges = {}
        for path in root.glob("*.py"):
            dependencies = set()
            for node in ast.walk(ast.parse(path.read_text())):
                if not isinstance(node, ast.ImportFrom):
                    continue
                if node.level == 1:
                    dependencies.add(node.module or "__init__")
                elif node.module and node.module.startswith("consilium_assets."):
                    dependencies.add(node.module.split(".")[1])
            edges[path.stem] = dependencies
        completed = set()

        def visit(module, trail):
            self.assertIn(module, edges, f"Missing package dependency: {module}")
            self.assertNotIn(module, trail, " -> ".join([*trail, module]))
            if module in completed:
                return
            for dependency in edges[module]:
                visit(dependency, [*trail, module])
            completed.add(module)

        for module in edges:
            visit(module, [])
