from .base import Tool, ToolType
import asyncio
from typing import Dict, Any
from datetime import datetime, timedelta

class SocialChecker(Tool):
    """ACTIVE tool: Checks social media login status"""
    
    def _determine_type(self) -> ToolType:
        return ToolType.ACTIVE
    
    async def check(self) -> Dict[str, Any]:
        platform = self.config.get("platform", "instagram")
        username = self.config.get("username")
        password = self.config.get("password")
        
        # Check last login (placeholder - would use actual API)
        last_login = await self._check_last_login(platform, username, password)
        monitoring_period_days = self.config.get("monitoring_period_days", 180)
        cutoff_date = datetime.now() - timedelta(days=monitoring_period_days)
        
        trigger = False
        if last_login and last_login < cutoff_date:
            trigger = True
        
        return {
            "status": "ok",
            "data": {
                "platform": platform,
                "username": username,
                "last_login": last_login.isoformat() if last_login else None
            },
            "trigger": trigger
        }
    
    async def run_loop(self, callback):
        self.is_running = True
        interval = self.config.get("interval", 86400)  # Daily check
        while self.is_running:
            result = await self.check()
            if result and result.get("trigger"):
                await callback(result)
            await asyncio.sleep(interval)
    
    async def _check_last_login(self, platform: str, username: str, password: str) -> datetime:
        """Checks last login time (placeholder)"""
        # Placeholder - would use actual social media API
        # For demo, return a date
        return datetime.now() - timedelta(days=30)
    
    def _get_config_schema(self) -> Dict[str, Any]:
        return {
            "platform": {"type": "string", "required": True, "default": "instagram"},
            "username": {"type": "string", "required": True},
            "password": {"type": "string", "required": True},
            "monitoring_period_days": {"type": "int", "default": 180},
            "interval": {"type": "int", "default": 86400}
        }
