import os
import logging
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

logger = logging.getLogger("PersonaBot.AIManager")

GEMINI_MODEL_NAME = "gemini-2.0-flash-001"

# Safety configuration for roleplaying
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]

# Generation parameters optimized for roleplaying
GENERATION_CONFIG = {
    "temperature": 0.9,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 2048,
}

class AIError(Exception):
    """Base exception for AI-related errors"""
    pass

class RateLimitExceeded(AIError):
    """Raised when API rate limits are exceeded"""
    pass

class ContentBlocked(AIError):
    """Raised when content is blocked by safety filters"""
    pass

class GeminiManager:
    """Manager for Google Gemini AI interactions with rate limiting and error handling"""
    
    RATE_LIMIT = timedelta(seconds=2)  # 2 seconds between requests
    MAX_RETRIES = 3
    
    def __init__(self, api_key: Optional[str] = None) -> None:
        """
        Initialize Gemini manager
        
        Args:
            api_key: Optional Google API key. Defaults to GOOGLE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model: Optional[genai.GenerativeModel] = None
        self.initialized = False
        self._last_request_time: Optional[datetime] = None
        self._lock = asyncio.Lock()
        
        if self.api_key:
            self.initialize()

    def initialize(self) -> bool:
        """Initialize the Gemini model with configuration"""
        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(
                model_name=GEMINI_MODEL_NAME,
                safety_settings=SAFETY_SETTINGS,
                generation_config=GENERATION_CONFIG
            )
            self.initialized = True
            logger.info(f"Initialized Gemini model: {GEMINI_MODEL_NAME}")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}", exc_info=True)
            self.model = None
            self.initialized = False
            raise AIError("Failed to initialize AI model") from e

    def is_available(self) -> bool:
        """Check if the AI model is ready for use"""
        return self.initialized and self.model is not None

    async def _enforce_rate_limit(self) -> None:
        """Enforce rate limiting between requests"""
        async with self._lock:
            now = datetime.utcnow()
            if self._last_request_time:
                elapsed = now - self._last_request_time
                if elapsed < self.RATE_LIMIT:
                    wait_time = (self.RATE_LIMIT - elapsed).total_seconds()
                    await asyncio.sleep(wait_time)
            self._last_request_time = datetime.utcnow()

    async def generate_response(
        self,
        message_content: str,
        history: Optional[List[Dict[str, Any]]] = None,
        retry_count: int = 0
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a response using Gemini AI with rate limiting and error handling
        
        Args:
            message_content: User message to respond to
            history: Conversation history context
            retry_count: Current retry attempt
            
        Returns:
            Tuple of (response_text, error_message)
        """
        if not self.is_available():
            return None, "AI service unavailable"

        try:
            await self._enforce_rate_limit()
            
            chat_session = self.model.start_chat(history=history or [])
            response = await chat_session.send_message_async(message_content)
            
            # Validate response
            if not response.candidates:
                if response.prompt_feedback and response.prompt_feedback.block_reason:
                    raise ContentBlocked(
                        f"Prompt blocked: {response.prompt_feedback.block_reason.name}"
                    )
                return None, "Empty response from AI model"
                
            if not response.candidates[0].content.parts:
                return None, "Empty response content"
                
            return response.text, None
            
        except ContentBlocked as e:
            logger.warning(f"Content blocked: {e}")
            return None, str(e)
        except google_exceptions.ResourceExhausted:
            if retry_count < self.MAX_RETRIES:
                wait_time = 2 ** retry_count  # Exponential backoff
                await asyncio.sleep(wait_time)
                return await self.generate_response(
                    message_content, history, retry_count + 1
                )
            raise RateLimitExceeded("API rate limit exceeded")
        except google_exceptions.GoogleAPIError as e:
            logger.error(f"Google API error: {e}", exc_info=True)
            return None, f"API error: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error generating response: {e}", exc_info=True)
            return None, f"Error generating response: {str(e)}"

    async def generate_persona_response(
        self,
        message_content: str,
        system_context: str,
        history: Optional[List[Dict[str, Any]]] = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a response in persona with system context
        
        Args:
            message_content: User message
            system_context: Persona instructions
            history: Conversation history
            
        Returns:
            Tuple of (response_text, error_message)
        """
        if not self.is_available():
            return None, "AI service unavailable"
            
        try:
            # Combine system context with message
            full_prompt = f"{system_context}\n\nUser: {message_content}"
            
            response, error = await self.generate_response(full_prompt, history)
            if error:
                return None, error
                
            # Ensure response stays in character
            if not response or len(response) > 2000:  # Discord message limit
                return None, "Invalid response length"
                
            return response, None
            
        except Exception as e:
            logger.error(f"Error generating persona response: {e}", exc_info=True)
            return None, f"Error generating response: {str(e)}"