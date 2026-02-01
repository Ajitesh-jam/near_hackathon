from .base import Tool, ToolType
import asyncio
from typing import Dict, Any

class CryptoPriceMonitor(Tool):
    """ACTIVE tool: Monitors crypto price continuously"""
    
    def _determine_type(self) -> ToolType:
        return ToolType.ACTIVE
    
    async def check(self) -> Dict[str, Any]:
        symbol = self.config.get("symbol", "BTC")
        threshold = self.config.get("threshold")
        
        # Fetch price (placeholder - would use actual API/oracle)
        price = await self._fetch_price(symbol)
        
        trigger = False
        if threshold:
            above_threshold = self.config.get("above_threshold", True)
            trigger = price >= threshold if above_threshold else price <= threshold
        
        return {
            "status": "ok",
            "data": {"symbol": symbol, "price": price},
            "trigger": trigger
        }
    
    async def run_loop(self, callback):
        self.is_running = True
        interval = self.config.get("interval", 60)
        while self.is_running:
            result = await self.check()
            if result and result.get("trigger"):
                await callback(result)
            await asyncio.sleep(interval)
    
    async def _fetch_price(self, symbol: str) -> float:
        """Fetches price from oracle/API"""
        # Placeholder implementation
        # In production, would use NEAR oracle or external API
        import random
        return random.uniform(40000, 50000)  # Mock BTC price
    
    def _get_config_schema(self) -> Dict[str, Any]:
        return {
            "symbol": {"type": "string", "required": True, "default": "BTC"},
            "threshold": {"type": "float", "required": False},
            "interval": {"type": "int", "default": 60},
            "above_threshold": {"type": "bool", "default": True}
        }
