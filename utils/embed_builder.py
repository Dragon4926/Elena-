import discord
from typing import Optional, Dict, Any

class EmbedBuilder:
    """Utility class for creating vampiric-themed embeds"""
    
    # Color scheme
    BASE = 0x121212  # Midnight black
    PRIMARY = 0x8B0000  # Blood red
    SECONDARY = 0x4B0082  # Royal purple
    ACCENT = 0xFFD700  # Gold
    ERROR = 0x8B0000  # Dark crimson
    WARNING = 0xFF4500  # Orange-red
    
    @classmethod
    def create_embed(
        cls,
        embed_type: str,
        title: str,
        description: str,
        **kwargs
    ) -> discord.Embed:
        """Create a styled embed based on type"""
        color_map = {
            "status": cls.PRIMARY,
            "help": cls.SECONDARY,
            "welcome": cls.ACCENT,
            "error": cls.ERROR,
            "warning": cls.WARNING,
            "info": cls.SECONDARY
        }
        
        embed = discord.Embed(
            title=cls._format_title(embed_type, title),
            description=description,
            color=color_map.get(embed_type, cls.BASE)
        )
        
        # Add vampiric styling
        if embed_type == "status":
            embed.set_author(name="🦇 Vampiric Persona Status")
        elif embed_type == "welcome":
            embed.set_thumbnail(url=kwargs.get("thumbnail"))
            
        return embed
    
    @staticmethod
    def _format_title(embed_type: str, title: str) -> str:
        """Add emoji decor to titles based on type"""
        emoji_map = {
            "status": "🦇",
            "help": "🧛‍♂️",
            "welcome": "🩸",
            "error": "💀",
            "warning": "🔥",
            "info": "📜"
        }
        return f"{emoji_map.get(embed_type, '')} {title}"
    
    @classmethod
    def add_fields(
        cls,
        embed: discord.Embed,
        fields: Dict[str, Any],
        inline: bool = False
    ) -> None:
        """Add multiple fields to an embed with consistent styling"""
        for name, value in fields.items():
            embed.add_field(
                name=name,
                value=value,
                inline=inline
            )