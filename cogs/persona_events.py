import discord
from discord.ext import commands
from typing import Optional, Dict, Any, List
import logging
import asyncio
from datetime import datetime, timedelta

from .db_manager import DatabaseManager
from .ai_manager import GeminiManager, AIError, RateLimitExceeded, ContentBlocked

logger = logging.getLogger("PersonaBot.Events")

class EventError(Exception):
    """Base exception for event handling errors"""
    pass

class MessageProcessingError(EventError):
    """Raised when message processing fails"""
    pass

class PersonaEvents(commands.Cog):
    """Handles events and message processing for persona threads"""
    
    RATE_LIMIT = timedelta(seconds=1)  # 1 second between responses
    MAX_MESSAGE_LENGTH = 2000  # Discord message limit
    
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self._db_manager: Optional[DatabaseManager] = None
        self._ai_manager: Optional[GeminiManager] = None
        self._last_response_times: Dict[int, datetime] = {}  # {thread_id: last_response_time}
        self._thread_cache: Dict[int, Dict[str, Any]] = {}  # {thread_id: thread_data}
        self._cache_lock = asyncio.Lock()
        self._lock = asyncio.Lock()
        
    @property
    def db_manager(self) -> DatabaseManager:
        """Lazy-loaded database manager"""
        if self._db_manager is None:
            self._db_manager = DatabaseManager()
        return self._db_manager
        
    @property
    def ai_manager(self) -> Optional[GeminiManager]:
        """Lazy-loaded AI manager"""
        if self._ai_manager is None:
            self._ai_manager = GeminiManager()
        return self._ai_manager

    async def _enforce_rate_limit(self, thread_id: int) -> None:
        """Enforce rate limiting between responses in a thread"""
        async with self._lock:
            now = datetime.utcnow()
            if thread_id in self._last_response_times:
                elapsed = now - self._last_response_times[thread_id]
                if elapsed < self.RATE_LIMIT:
                    wait_time = (self.RATE_LIMIT - elapsed).total_seconds()
                    await asyncio.sleep(wait_time)
            self._last_response_times[thread_id] = datetime.utcnow()

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        """
        Handle messages in persona threads and generate responses
        
        Args:
            message: The incoming Discord message
        """
        # Ignore messages from bots
        if message.author.bot:
            return
            
        # Check if message is in a managed thread
        if not isinstance(message.channel, discord.Thread):
            return
            
        try:
            # Get thread data
            thread_data = await self._get_thread_data(message.channel.id)
            if not thread_data:
                return
                
            # Process message
            await self._process_persona_message(message, thread_data)
            
        except RateLimitExceeded:
            logger.warning(f"Rate limit exceeded in thread {message.channel.id}")
            await message.channel.send("(I'm responding too fast - please wait a moment)")
        except ContentBlocked as e:
            logger.warning(f"Content blocked in thread {message.channel.id}: {e}")
            await message.channel.send(f"(My response was blocked: {str(e)})")
        except AIError as e:
            logger.error(f"AI error in thread {message.channel.id}: {e}")
            await message.channel.send("(I'm having trouble generating a response right now)")
        except Exception as e:
            logger.error(f"Unexpected error in thread {message.channel.id}: {e}", exc_info=True)
            await message.channel.send("(An unexpected error occurred)")

    async def _get_thread_data(self, thread_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve thread data with validation, using caching where possible
        
        Args:
            thread_id: The Discord thread ID
            
        Returns:
            Thread data if valid, None otherwise
        """
        # Check cache first
        async with self._cache_lock:
            if thread_id in self._thread_cache:
                logger.debug(f"Retrieved thread {thread_id} from cache")
                return self._thread_cache[thread_id]
                
        if not self.db_manager.is_connected():
            logger.warning(f"Database unavailable when processing thread {thread_id}")
            return None
            
        # Get from database
        thread_data = await self.db_manager.get_thread_data(thread_id)
        if not thread_data:
            return None
            
        # Validate required fields
        required_fields = ["name", "history", "system_context"]
        if not all(field in thread_data for field in required_fields):
            logger.error(f"Invalid thread data for {thread_id}")
            return None
            
        # Update cache
        async with self._cache_lock:
            self._thread_cache[thread_id] = thread_data
            logger.debug(f"Cached thread {thread_id} data")
            
        return thread_data

    async def _process_persona_message(
        self,
        message: discord.Message,
        thread_data: Dict[str, Any]
    ) -> None:
        """
        Process a message in a persona thread and generate response
        
        Args:
            message: The incoming message
            thread_data: The thread configuration data
        """
        # Enforce rate limiting
        await self._enforce_rate_limit(message.channel.id)
        
        # Show typing indicator
        async with message.channel.typing():
            # Generate AI response
            response = await self._generate_ai_response(
                message.content,
                thread_data["system_context"],
                thread_data["history"]
            )
            
            if not response:
                return
                
            # Send response
            sent_message = await message.channel.send(response)
            
            # Update history
            await self._update_thread_history(
                message.channel.id,
                message.content,
                response
            )

    async def _generate_ai_response(
        self,
        user_message: str,
        system_context: str,
        history: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Generate an AI response with validation
        
        Args:
            user_message: The user's message
            system_context: The persona's system context
            history: Conversation history
            
        Returns:
            The generated response or None if failed
        """
        if not self.ai_manager or not self.ai_manager.is_available():
            logger.warning("AI manager unavailable when generating response")
            return None
            
        try:
            response, error = await self.ai_manager.generate_persona_response(
                user_message,
                system_context,
                history
            )
            
            if error or not response:
                logger.warning(f"Failed to generate response: {error}")
                return None
                
            # Validate response length
            if len(response) > self.MAX_MESSAGE_LENGTH:
                response = response[:self.MAX_MESSAGE_LENGTH-3] + "..."
                
            return response
            
        except Exception as e:
            logger.error(f"Error generating AI response: {e}", exc_info=True)
            raise MessageProcessingError("Failed to generate response") from e

    async def _update_thread_history(
        self,
        thread_id: int,
        user_message: str,
        ai_response: str
    ) -> bool:
        """
        Update thread conversation history
        
        Args:
            thread_id: The thread ID
            user_message: User message to add
            ai_response: AI response to add
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.db_manager.is_connected():
                logger.warning(f"Database unavailable when updating thread {thread_id}")
                return False
                
            return await self.db_manager.update_thread_history(
                thread_id,
                user_message,
                ai_response
            )
        except Exception as e:
            logger.error(f"Error updating history for thread {thread_id}: {e}")
            return False

async def setup(bot: commands.Bot) -> None:
    """Setup function for loading the cog"""
    await bot.add_cog(PersonaEvents(bot))