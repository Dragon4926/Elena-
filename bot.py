import discord
import os
import logging
import asyncio
from discord.ext import commands
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s:%(levelname)s:%(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('bot.log')
    ]
)
logger = logging.getLogger(__name__)

class Bot(commands.Bot):
    """Main bot class"""
    
    def __init__(self) -> None:
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        
        super().__init__(
            command_prefix=None,
            intents=intents,
            help_command=None
        )

    async def setup_hook(self) -> None:
        """Setup extensions and sync commands"""
        from cogs.db_manager import DatabaseManager
        
        # Initialize database manager
        self.db_manager = DatabaseManager()
        try:
            await self.db_manager.connect()
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self.db_manager = None
            
        await self.load_extension("cogs.persona")
        await self.load_extension("cogs.persona_commands")
        await self.load_extension("cogs.persona_events")
        await self.load_extension("cogs.vrising")
        
        # Sync commands globally
        await self.tree.sync()
        logger.info("Commands synced")

async def main() -> None:
    """Main entry point"""
    if not DISCORD_TOKEN:
        logger.critical("DISCORD_TOKEN environment variable is required!")
        return
        
    bot = Bot()
    
    try:
        async with bot:
            await bot.start(DISCORD_TOKEN)
    except discord.LoginFailure:
        logger.critical("Invalid Discord token provided!")
    except Exception as e:
        logger.critical(f"Failed to start bot: {e}", exc_info=True)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot shutdown by user")
    except Exception as e:
        logger.critical(f"Fatal error: {e}", exc_info=True)