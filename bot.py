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
            command_prefix="!",
            intents=intents,
            help_command=None
        )

    async def setup_hook(self) -> None:
        """Setup extensions and sync commands"""
        await self.load_extension("cogs.persona")
        await self.load_extension("cogs.persona_commands")
        await self.load_extension("cogs.persona_events")
        
        # Sync commands to test guild if in development
        if os.getenv("ENV") == "dev":
            test_guild = discord.Object(id=123456789012345678)  # Replace with your guild ID
            self.tree.copy_global_to(guild=test_guild)
            await self.tree.sync(guild=test_guild)
            logger.info("Commands synced to test guild")
        else:
            await self.tree.sync()
            logger.info("Commands synced globally")

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