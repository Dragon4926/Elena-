import os
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from pymongo import MongoClient, errors
from pymongo.server_api import ServerApi
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

logger = logging.getLogger("PersonaBot.DBManager")

class DatabaseError(Exception):
    """Base exception for database errors"""
    pass

class ConnectionError(DatabaseError):
    """Raised when database connection fails"""
    pass

class QueryError(DatabaseError):
    """Raised when database query fails"""
    pass

class DatabaseManager:
    """Async MongoDB manager for persona bot with connection pooling and error handling"""
    
    def __init__(self, mongo_uri: Optional[str] = None) -> None:
        """
        Initialize database manager
        
        Args:
            mongo_uri: Optional MongoDB connection URI. Defaults to MONGO_URI env var.
        """
        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.threads_collection = None
        self._ensure_indexes = True  # Flag to create indexes on first connect

    async def connect(self) -> bool:
        """Establish async connection to MongoDB with retry logic"""
        try:
            self.client = AsyncIOMotorClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=5000,
                server_api=ServerApi('1'),
                maxPoolSize=100,
                minPoolSize=10
            )
            
            # Test connection
            await self.client.admin.command('ping')
            
            self.db = self.client['persona_bot']
            self.threads_collection = self.db['persona_threads']
            
            # Create indexes on first connection
            if self._ensure_indexes:
                await self._create_indexes()
                self._ensure_indexes = False
                
            logger.info("Successfully connected to MongoDB")
            return True
            
        except errors.ServerSelectionTimeoutError as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise ConnectionError("Database connection timeout") from e
        except errors.ConnectionFailure as e:
            logger.error(f"Database connection failed: {e}")
            raise ConnectionError("Database connection failed") from e
        except Exception as e:
            logger.error(f"Unexpected database connection error: {e}", exc_info=True)
            raise ConnectionError("Unexpected database error") from e

    async def _create_indexes(self) -> None:
        """Create necessary indexes for optimal performance"""
        try:
            await self.threads_collection.create_index("_id")
            await self.threads_collection.create_index("created_by")
            await self.threads_collection.create_index("guild_id")
            await self.threads_collection.create_index("channel_id")
            await self.threads_collection.create_index([("created_at", -1)])
            logger.info("Created database indexes")
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")

    async def is_connected(self) -> bool:
        """Check if database connection is active with ping"""
        if not self.client:
            return False
            
        try:
            await self.client.admin.command('ping')
            return True
        except Exception:
            logger.warning("Database connection lost, attempting reconnect...")
            try:
                return await self.connect()
            except ConnectionError:
                return False

    async def get_thread_data(self, thread_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieve thread data by ID
        
        Args:
            thread_id: Discord thread ID
            
        Returns:
            Thread document or None if not found
        """
        try:
            if not await self.is_connected():
                raise ConnectionError("Database unavailable")
                
            return await self.threads_collection.find_one({"_id": thread_id})
        except Exception as e:
            logger.error(f"Error fetching thread {thread_id}: {e}", exc_info=True)
            raise QueryError(f"Failed to fetch thread {thread_id}") from e

    async def create_thread_document(self, thread_id: int, data: Dict[str, Any]) -> bool:
        """
        Create a new thread document
        
        Args:
            thread_id: Discord thread ID
            data: Thread data to insert
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not await self.is_connected():
                raise ConnectionError("Database unavailable")
                
            result = await self.threads_collection.insert_one(data)
            return result.acknowledged
        except errors.DuplicateKeyError:
            logger.warning(f"Thread {thread_id} already exists in database")
            return True
        except Exception as e:
            logger.error(f"Error creating thread {thread_id}: {e}", exc_info=True)
            raise QueryError(f"Failed to create thread {thread_id}") from e

    async def update_thread_history(
        self, 
        thread_id: int, 
        user_message: str, 
        ai_response: str
    ) -> bool:
        """
        Update thread conversation history
        
        Args:
            thread_id: Discord thread ID
            user_message: User message to add
            ai_response: AI response to add
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not await self.is_connected():
                raise ConnectionError("Database unavailable")
                
            new_history = [
                {"role": "user", "parts": [{"text": user_message}]},
                {"role": "model", "parts": [{"text": ai_response}]}
            ]
            
            result = await self.threads_collection.update_one(
                {"_id": thread_id},
                {
                    "$push": {
                        "history": {
                            "$each": new_history,
                            "$slice": -24  # Keep last 12 message pairs
                        }
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating history for thread {thread_id}: {e}", exc_info=True)
            raise QueryError(f"Failed to update thread {thread_id} history") from e

    async def delete_thread(self, thread_id: int) -> bool:
        """
        Delete a thread document
        
        Args:
            thread_id: Discord thread ID
            
        Returns:
            True if deleted, False otherwise
        """
        try:
            if not await self.is_connected():
                raise ConnectionError("Database unavailable")
                
            result = await self.threads_collection.delete_one({"_id": thread_id})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting thread {thread_id}: {e}", exc_info=True)
            raise QueryError(f"Failed to delete thread {thread_id}") from e

    async def get_user_thread_count(self, user_id: int) -> int:
        """
        Get count of active threads for a user
        
        Args:
            user_id: Discord user ID
            
        Returns:
            Number of active threads
        """
        try:
            if not await self.is_connected():
                raise ConnectionError("Database unavailable")
                
            return await self.threads_collection.count_documents({"created_by": user_id})
        except Exception as e:
            logger.error(f"Error counting threads for user {user_id}: {e}", exc_info=True)
            raise QueryError(f"Failed to count threads for user {user_id}") from e

    async def get_active_thread_count(self) -> int:
        """
        Get total count of active threads
        
        Returns:
            Number of active threads
        """
        try:
            if not await self.is_connected():
                raise ConnectionError("Database unavailable")
                
            return await self.threads_collection.estimated_document_count()
        except Exception as e:
            logger.error(f"Error counting active threads: {e}", exc_info=True)
            raise QueryError("Failed to count active threads") from e

    async def close(self) -> None:
        """Cleanly close database connection"""
        if self.client:
            self.client.close()
            self.client = None
            self.db = None
            self.threads_collection = None
            logger.info("Closed database connection")