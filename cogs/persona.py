import discord
from discord.ext import commands
from typing import Optional, Any
import logging
import asyncio
import os
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger("PersonaBot")

@dataclass
class BotConfig:
    """Configuration for the PersonaBot"""
    discord_token: str
    google_api_key: Optional[str] = None
    mongo_uri: Optional[str] = None
    command_prefix: str = "!"
    max_history_length: int = 12
    default_persona: str = (
        "You are a helpful and friendly AI assistant with a unique personality. "
        "You're knowledgeable, creative, and enjoy engaging in meaningful conversations."
    )

class PersonaBot(commands.Cog):
    """Main cog for persona management"""
    
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.startup_time: Optional[datetime] = None
        self.ready_event = asyncio.Event()

    @commands.Cog.listener()
    async def on_ready(self) -> None:
        """Called when the bot is fully ready"""
        self.startup_time = discord.utils.utcnow()
        app_info = await self.bot.application_info()
        
        logger.info(f"Logged in as {self.bot.user} (ID: {self.bot.user.id})")
        logger.info(f"Owner: {app_info.owner}")
        logger.info(f"Discord.py version: {discord.__version__}")
        
        await self.bot.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.listening,
                name="/persona_help"
            )
        )
        
        self.ready_event.set()
        logger.info("Bot is fully operational")

    @commands.Cog.listener()
    async def on_error(self, event_method: str, *args: Any, **kwargs: Any) -> None:
        """Global error handler for events"""
        logger.error(f"Error in event {event_method}", exc_info=True)

    @commands.Cog.listener()
    async def on_command_error(self, ctx: commands.Context, error: Exception) -> None:
        """Global error handler for command errors"""
        if isinstance(error, commands.CommandNotFound):
            return
            
        logger.error(f"Command error: {error}", exc_info=True)
        
        if ctx.interaction:
            embed = discord.Embed(
                title="❌ Error",
                description=str(error),
                color=0xE74C3C
            )
            embed.set_footer(text="Please try again or contact support")
            
            if not ctx.interaction.response.is_done():
                await ctx.interaction.response.send_message(
                    embed=embed,
                    ephemeral=True
                )
            else:
                await ctx.interaction.followup.send(
                    embed=embed,
                    ephemeral=True
                )

async def setup(bot: commands.Bot) -> None:
    """Setup function for loading the cog"""
    await bot.add_cog(PersonaBot(bot))