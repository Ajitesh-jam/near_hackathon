import ast
from typing import List, Dict, Any, Optional
from pathlib import Path

class CodeValidationError:
    """Represents a code validation error"""
    def __init__(self, file_path: str, error_type: str, message: str, line_number: Optional[int] = None):
        self.file_path = file_path
        self.error_type = error_type  # "syntax" or "import"
        self.message = message
        self.line_number = line_number
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "error_type": self.error_type,
            "message": self.message,
            "line_number": self.line_number
        }

class CodeValidator:
    """
    Validates Python code for syntax and import errors.
    """
    
    def __init__(self):
        pass
    
    def validate_code(self, file_path: str, code: str, template_code: Optional[Dict[str, str]] = None) -> List[CodeValidationError]:
        """
        Validates Python code for syntax and import errors.
        
        Args:
            file_path: Path to the file being validated
            code: The code content to validate
            template_code: Dictionary of all files in the template (for import checking)
        
        Returns:
            List of validation errors
        """
        errors = []
        
        # Validate syntax
        syntax_errors = self._validate_syntax(file_path, code)
        errors.extend(syntax_errors)
        
        # If syntax is valid, validate imports
        if not syntax_errors:
            import_errors = self._validate_imports(file_path, code, template_code or {})
            errors.extend(import_errors)
        
        return errors
    
    def _validate_syntax(self, file_path: str, code: str) -> List[CodeValidationError]:
        """Validates Python syntax using AST"""
        errors = []
        try:
            ast.parse(code)
        except SyntaxError as e:
            errors.append(CodeValidationError(
                file_path=file_path,
                error_type="syntax",
                message=str(e.msg),
                line_number=e.lineno
            ))
        except Exception as e:
            errors.append(CodeValidationError(
                file_path=file_path,
                error_type="syntax",
                message=f"Unexpected error: {str(e)}",
                line_number=None
            ))
        return errors
    
    def _validate_imports(self, file_path: str, code: str, template_code: Dict[str, str]) -> List[CodeValidationError]:
        """Validates that imports can be resolved"""
        errors = []
        
        try:
            tree = ast.parse(code)
            
            # Extract all imports
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        module_name = alias.name
                        # Check if it's a relative import
                        if module_name.startswith('.'):
                            # Relative import - check if base.py exists for tools
                            if file_path.startswith("tools/") and ".base" in module_name:
                                if "tools/base.py" not in template_code:
                                    errors.append(CodeValidationError(
                                        file_path=file_path,
                                        error_type="import",
                                        message=f"Relative import '{module_name}' cannot be resolved: base.py not found in tools directory",
                                        line_number=node.lineno if hasattr(node, 'lineno') else None
                                    ))
                elif isinstance(node, ast.ImportFrom):
                    module_name = node.module or ""
                    # Check relative imports
                    if node.level > 0:  # Relative import (e.g., from .base import ...)
                        if file_path.startswith("tools/") and "base" in module_name:
                            if "tools/base.py" not in template_code:
                                errors.append(CodeValidationError(
                                    file_path=file_path,
                                    error_type="import",
                                    message=f"Relative import 'from {'.' * node.level}{module_name}' cannot be resolved: base.py not found",
                                    line_number=node.lineno if hasattr(node, 'lineno') else None
                                ))
                        # Check if imported module exists in template_code
                        imported_module_path = self._resolve_relative_import(file_path, node.level, module_name)
                        if imported_module_path and imported_module_path not in template_code:
                            errors.append(CodeValidationError(
                                file_path=file_path,
                                error_type="import",
                                message=f"Relative import 'from {'.' * node.level}{module_name}' cannot be resolved: {imported_module_path} not found",
                                line_number=node.lineno if hasattr(node, 'lineno') else None
                            ))
                    else:
                        # Absolute import - check if it's a tool import
                        if file_path.startswith("tools/") and module_name.startswith("tools."):
                            tool_name = module_name.split(".")[-1]
                            tool_path = f"tools/{tool_name}.py"
                            if tool_path not in template_code and tool_name != "__init__":
                                errors.append(CodeValidationError(
                                    file_path=file_path,
                                    error_type="import",
                                    message=f"Import '{module_name}' cannot be resolved: {tool_path} not found",
                                    line_number=node.lineno if hasattr(node, 'lineno') else None
                                ))
        
        except Exception as e:
            errors.append(CodeValidationError(
                file_path=file_path,
                error_type="import",
                message=f"Error validating imports: {str(e)}",
                line_number=None
            ))
        
        return errors
    
    def _resolve_relative_import(self, file_path: str, level: int, module_name: str) -> Optional[str]:
        """Resolves a relative import to a file path"""
        if not module_name:
            return None
        
        # Get directory of current file
        file_dir = "/".join(file_path.split("/")[:-1])
        
        # Go up 'level' directories
        parts = file_dir.split("/")
        if level > len(parts):
            return None
        
        parent_dir = "/".join(parts[:-level]) if level > 0 else file_dir
        
        # Construct path
        module_path = f"{parent_dir}/{module_name}.py"
        return module_path
    
    def validate_template(self, template_code: Dict[str, str]) -> List[CodeValidationError]:
        """
        Validates all files in a template codebase.
        
        Args:
            template_code: Dictionary mapping file paths to code content
        
        Returns:
            List of all validation errors across all files
        """
        all_errors = []
        
        for file_path, code in template_code.items():
            # Only validate Python files
            if file_path.endswith('.py'):
                errors = self.validate_code(file_path, code, template_code)
                all_errors.extend(errors)
        
        return all_errors
