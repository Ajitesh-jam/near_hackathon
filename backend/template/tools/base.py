from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from enum import Enum

class ToolType(Enum):
    ACTIVE = "active"    # Continuously monitors/reacts
    REACTIVE = "reactive"  # On-demand execution

class Tool(ABC):
    """
    Unified base class for all tools.
    ACTIVE tools override check() and run_loop()
    REACTIVE tools override execute()
    """
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.tool_type = self._determine_type()
        self.name = self.__class__.__name__
        self.is_running = False
    
    @abstractmethod
    def _determine_type(self) -> ToolType:
        """Subclass must specify if ACTIVE or REACTIVE"""
        pass
    
    # ACTIVE tools implement these
    def check(self) -> Optional[Dict[str, Any]]:
        """
        ACTIVE tools: Performs monitoring check.
        Returns: {"status": "ok", "data": {...}, "trigger": bool} or None
        """
        return None
    
    async def run_loop(self, callback) -> None:
        """
        ACTIVE tools: Continuously runs check() and calls callback when trigger=True
        """
        if self.tool_type != ToolType.ACTIVE:
            raise ValueError(f"{self.name} is not an ACTIVE tool")
        # Default implementation
        pass
    
    # REACTIVE tools implement this
    def execute(self, **kwargs) -> Dict[str, Any]:
        """
        REACTIVE tools: Executes action immediately.
        Returns: {"status": "success", "result": {...}}
        """
        if self.tool_type != ToolType.REACTIVE:
            raise ValueError(f"{self.name} is not a REACTIVE tool")
        raise NotImplementedError
    
    def get_metadata(self) -> Dict[str, Any]:
        """Returns tool metadata for UI/registry"""
        return {
            "name": self.name,
            "type": self.tool_type.value,
            "description": self.__doc__ or "",
            "config_schema": self._get_config_schema()
        }
    
    @abstractmethod
    def _get_config_schema(self) -> Dict[str, Any]:
        """Returns expected configuration schema"""
        pass
