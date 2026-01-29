from typing import Dict, Optional
from datetime import datetime
import uuid

class SessionService:
    """
    Manages agent building sessions per user.
    Note: LangGraph checkpoints handle state persistence, SessionService only tracks:
    - Active session_id per user
    - Session metadata (created_at, last_activity)
    - User-to-session mapping
    """
    
    def __init__(self):
        # Maps user_id -> session_id
        self.user_sessions: Dict[str, str] = {}
        # Maps session_id -> metadata
        self.session_metadata: Dict[str, Dict] = {}
    
    def create_session(self, user_id: str) -> str:
        """
        Creates a new session for a user.
        If user already has an active session, returns existing session_id.
        """
        # Check if user already has an active session
        existing_session = self.user_sessions.get(user_id)
        if existing_session and existing_session in self.session_metadata:
            # Update last activity
            self.session_metadata[existing_session]["last_activity"] = datetime.now().isoformat()
            return existing_session
        
        # Create new session
        session_id = str(uuid.uuid4())
        self.user_sessions[user_id] = session_id
        self.session_metadata[session_id] = {
            "user_id": user_id,
            "created_at": datetime.now().isoformat(),
            "last_activity": datetime.now().isoformat()
        }
        return session_id
    
    def get_user_session(self, user_id: str) -> Optional[str]:
        """Returns session_id for a user, or None if no active session"""
        return self.user_sessions.get(user_id)
    
    def get_session_metadata(self, session_id: str) -> Optional[Dict]:
        """Returns session metadata, or None if session doesn't exist"""
        metadata = self.session_metadata.get(session_id)
        if metadata:
            # Update last activity
            metadata["last_activity"] = datetime.now().isoformat()
        return metadata
    
    def delete_session(self, session_id: str) -> bool:
        """Deletes a session and removes user mapping"""
        if session_id not in self.session_metadata:
            return False
        
        user_id = self.session_metadata[session_id].get("user_id")
        if user_id and self.user_sessions.get(user_id) == session_id:
            del self.user_sessions[user_id]
        
        del self.session_metadata[session_id]
        return True
    
    def update_activity(self, session_id: str):
        """Updates last activity timestamp for a session"""
        if session_id in self.session_metadata:
            self.session_metadata[session_id]["last_activity"] = datetime.now().isoformat()
