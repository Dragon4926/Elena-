import discord
from discord import app_commands
from discord.ext import commands
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import logging
from .db_manager import DatabaseManager
from .ai_manager import GeminiManager

logger = logging.getLogger("PersonaBot.Commands")

DEFAULT_PERSONA = "You are a helpful and friendly AI assistant with a unique personality. You're knowledgeable, creative, and enjoy engaging in meaningful conversations."

class PersonaCommandError(Exception):
    """Base exception for persona command errors"""
    pass

class RateLimitExceeded(PersonaCommandError):
    """Raised when user exceeds rate limits"""
    pass

class InvalidPersonaParameters(PersonaCommandError):
    """Raised when invalid persona parameters are provided"""
    pass

class PersonaCog(commands.Cog):
    """Cog for managing AI persona interactions in Discord threads"""
    
    RATE_LIMIT = timedelta(minutes=5)  # 5 minutes cooldown
    MAX_THREADS_PER_USER = 3  # Maximum threads a user can create
    
    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        self.db_manager = DatabaseManager()
        self.ai_manager = GeminiManager()
        self.user_cooldowns: Dict[int, datetime] = {}  # {user_id: last_thread_creation}
        self.user_thread_counts: Dict[int, int] = {}  # {user_id: thread_count}
        self._ready = asyncio.Event()

    async def cog_load(self) -> None:
        """Async setup that runs when the cog is loaded"""
        if not await self.db_manager.is_connected():
            logger.warning("Database connection not available. Persona persistence will be limited.")

        if not self.ai_manager.is_available():
            logger.warning("Gemini AI model not available. Persona features will be limited.")
            
        self._ready.set()

    async def check_rate_limit(self, user_id: int) -> None:
        """Check if user is rate limited"""
        now = discord.utils.utcnow()
        if user_id in self.user_cooldowns:
            last_creation = self.user_cooldowns[user_id]
            if now - last_creation < self.RATE_LIMIT:
                raise RateLimitExceeded(
                    f"You're creating threads too fast. Please wait {self.RATE_LIMIT.seconds//60} minutes."
                )

        # Update or initialize thread count
        thread_count = await self.db_manager.get_user_thread_count(user_id)
        self.user_thread_counts[user_id] = thread_count or 0
        
        if self.user_thread_counts.get(user_id, 0) >= self.MAX_THREADS_PER_USER:
            raise RateLimitExceeded(
                f"You've reached the maximum of {self.MAX_THREADS_PER_USER} active personas. "
                "Please delete some before creating new ones."
            )

    @app_commands.command(name="persona_status", description="Check the status of the persona bot")
    async def persona_status(self, interaction: discord.Interaction) -> None:
        """Provides detailed status information about the bot"""
        from utils.embed_builder import EmbedBuilder
        
        embed = EmbedBuilder.create_embed(
            embed_type="status",
            title="Persona Bot Status",
            description="Current status of AI persona services"
        )
        
        # Uptime
        if hasattr(self.bot, 'startup_time') and self.bot.startup_time:
            uptime = discord.utils.utcnow() - self.bot.startup_time
            uptime_str = f"{uptime.days}d {uptime.seconds//3600}h {(uptime.seconds//60)%60}m"
        
        # Services status
        fields = {
            "⏱️ Uptime": uptime_str if hasattr(self.bot, 'startup_time') else "Unknown",
            "🦇 AI Service": "✅ Online" if self.ai_manager.is_available() else "❌ Offline",
            "🧛‍♂️ Database": "✅ Online" if self.db_manager.is_connected() else "❌ Offline"
        }

        # Thread statistics
        try:
            active_count = await self.db_manager.get_active_thread_count()
            fields["🩸 Active Personas"] = str(active_count)
        except Exception as e:
            logger.error(f"Error getting thread count: {e}")
            fields["🩸 Active Personas"] = "Unknown"

        fields["📜 Version"] = f"Discord.py {discord.__version__}"

        EmbedBuilder.add_fields(embed, fields, inline=True)
        await interaction.response.send_message(embed=embed, ephemeral=True)

    @app_commands.command(name="persona_private", description="Create a private roleplaying thread")
    @app_commands.describe(
        name="The display name for your persona (2-32 chars)",
        avatar="An image for your persona (JPG/PNG/GIF)",
        persona="Personality instructions (optional)"
    )
    async def persona_private(
        self,
        interaction: discord.Interaction,
        name: str,
        avatar: discord.Attachment,
        persona: Optional[str] = None
    ) -> None:
        """Create a private persona thread"""
        await self._create_persona_thread(interaction, name, avatar, persona, private=True)

    @app_commands.command(name="persona_public", description="Create a public roleplaying thread")
    @app_commands.describe(
        name="The display name for your persona (2-32 chars)",
        avatar="An image for your persona (JPG/PNG/GIF)",
        persona="Personality instructions (optional)"
    )
    async def persona_public(
        self,
        interaction: discord.Interaction,
        name: str,
        avatar: discord.Attachment,
        persona: Optional[str] = None
    ) -> None:
        """Create a public persona thread"""
        await self._create_persona_thread(interaction, name, avatar, persona, private=False)

    @app_commands.command(name="persona_help", description="Learn how to use persona features")
    async def persona_help(self, interaction: discord.Interaction) -> None:
        """Show help information about persona commands"""
        from utils.embed_builder import EmbedBuilder
        
        embed = EmbedBuilder.create_embed(
            embed_type="help",
            title="Persona Bot Help",
            description="Create and interact with AI personas in dedicated threads"
        )
        embed.set_thumbnail(url="https://i.imgur.com/J5q7X3P.png")

        # Main help sections
        sections = {
            "📝 Creating Personas": (
                "Use `/persona_public` or `/persona_private` to create a thread with a custom AI persona.\n"
                "• **Public threads**: Visible to all channel members\n"
                "• **Private threads**: Only visible to you and invited members"
            ),
            "⚙️ Requirements": (
                "• **Name**: 2-32 characters\n"
                "• **Avatar**: JPG, PNG or GIF image\n"
                "• **Persona**: (Optional) Detailed personality instructions"
            ),
            "📊 Limits": (
                f"• Max {self.MAX_THREADS_PER_USER} active personas per user\n"
                f"• {self.RATE_LIMIT.seconds//60} minute cooldown between creations"
            )
        }

        EmbedBuilder.add_fields(embed, sections)

        # Create buttons
        buttons = [
            discord.ui.Button(
                style=discord.ButtonStyle.link,
                label="Documentation",
                url="https://example.com/docs",
                emoji="📚"
            ),
            discord.ui.Button(
                style=discord.ButtonStyle.link,
                label="Support Server",
                url="https://discord.gg/example",
                emoji="🛠️"
            )
        ]

        view = discord.ui.View()
        for button in buttons:
            view.add_item(button)

        embed.set_footer(text="Use /persona_status to check bot health and statistics")
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

    async def _create_persona_thread(
        self,
        interaction: discord.Interaction,
        name: str,
        avatar: discord.Attachment,
        persona: Optional[str],
        private: bool
    ) -> None:
        """Core logic for creating persona threads with validation and error handling"""
        await interaction.response.defer(ephemeral=True, thinking=True)
        
        try:
            # Validate services
            if not self.ai_manager.is_available():
                raise PersonaCommandError("AI service is currently unavailable")
                
            if not self.db_manager.is_connected():
                raise PersonaCommandError("Database service is currently unavailable")

            # Validate user rate limits
            await self.check_rate_limit(interaction.user.id)

            # Validate parameters
            if len(name) < 2 or len(name) > 32:
                raise InvalidPersonaParameters("Name must be 2-32 characters")
                
            if not avatar.content_type or not avatar.content_type.startswith('image/'):
                raise InvalidPersonaParameters("Avatar must be an image (JPG/PNG/GIF)")

            # Create thread
            thread = await self._create_thread(interaction, name, private)
            
            # Initialize persona
            await self._initialize_persona(thread, interaction, name, avatar, persona)
            
            # Update rate limits
            self.user_cooldowns[interaction.user.id] = discord.utils.utcnow()
            self.user_thread_counts[interaction.user.id] = self.user_thread_counts.get(interaction.user.id, 0) + 1
            
            # Send success message
            await interaction.followup.send(
                f"✅ Created {'private' if private else 'public'} persona thread: {thread.mention}",
                ephemeral=True
            )
            
        except PersonaCommandError as e:
            await interaction.followup.send(f"❌ {str(e)}", ephemeral=True)
        except Exception as e:
            logger.error(f"Error creating persona thread: {e}", exc_info=True)
            await interaction.followup.send(
                "❌ An unexpected error occurred. Please try again later.",
                ephemeral=True
            )

    async def _create_thread(
        self,
        interaction: discord.Interaction,
        name: str,
        private: bool
    ) -> discord.Thread:
        """Create the actual Discord thread with error handling"""
        if not interaction.channel or not isinstance(interaction.channel, discord.TextChannel):
            raise InvalidPersonaParameters("Command only works in server text channels")

        thread_type = discord.ChannelType.private_thread if private else discord.ChannelType.public_thread
        
        try:
            thread = await interaction.channel.create_thread(
                name=f"{name} RP",
                type=thread_type,
                auto_archive_duration=1440
            )
            logger.info(f"Created {'private' if private else 'public'} thread {thread.id}")
            return thread
        except discord.Forbidden:
            raise PersonaCommandError("Missing permissions to create threads")
        except discord.HTTPException as e:
            raise PersonaCommandError(f"Failed to create thread: {str(e)}")

    async def _initialize_persona(
        self,
        thread: discord.Thread,
        interaction: discord.Interaction,
        name: str,
        avatar: discord.Attachment,
        persona: Optional[str]
    ) -> None:
        """Initialize persona data and send welcome message"""
        final_persona = persona or DEFAULT_PERSONA
        
        # Create context and history
        context = (
            f"You are {name}. You are participating in a roleplay conversation. "
            f"Character instructions: {final_persona}\n\n"
            "Stay in character at all times. Keep responses conversational and engaging. "
            "Respond as the character, not as an AI."
        )
        
        history = [
            {"role": "user", "parts": [{"text": f"Roleplay details: {final_persona}"}]},
            {"role": "model", "parts": [{"text": f"I'll roleplay as {name}"}]}
        ]

        # Store thread data
        thread_data = {
            "_id": thread.id,
            "name": name,
            "persona": final_persona,
            "history": history,
            "system_context": context,
            "channel_id": interaction.channel.id,
            "guild_id": interaction.guild.id if interaction.guild else None,
            "created_by": interaction.user.id,
            "created_at": discord.utils.utcnow().isoformat(),
            "avatar_url": avatar.url
        }

        if not await self.db_manager.create_thread_document(thread.id, thread_data):
            await thread.delete()
            raise PersonaCommandError("Failed to save persona data")

        # Send welcome message
        from utils.embed_builder import EmbedBuilder
        
        embed = EmbedBuilder.create_embed(
            embed_type="welcome",
            title=f"Welcome to {name}'s Thread!",
            description="Start chatting to interact with your AI persona.",
            thumbnail=avatar.url
        )
        
        personality = final_persona[:1000] + ("..." if len(final_persona) > 1000 else "")
        EmbedBuilder.add_fields(embed, {"🧛‍♂️ Personality": personality})
        
        embed.set_footer(text=f"Created by {interaction.user.display_name}")
        await thread.send(embed=embed)

async def setup(bot: commands.Bot) -> None:
    """Setup function for loading the cog"""
    await bot.add_cog(PersonaCog(bot))