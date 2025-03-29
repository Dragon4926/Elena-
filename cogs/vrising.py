import discord
import logging
from discord.ext import tasks, commands
from discord import app_commands
import datetime

logger = logging.getLogger(__name__)

class VRising(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.reminder.start()
        self.castle_durations = {5: 13, 4: 11, 3: 8, 2: 5, 1: 3}  # level: days
    
    @tasks.loop(hours=12)
    async def reminder(self):
        try:
            if not hasattr(self.bot, 'db_manager') or self.bot.db_manager is None:
                logger.warning("Database manager not available - skipping reminder check")
                return
                
            timer_data = await self.bot.db_manager.get_timer_data()
            if not timer_data:
                return
                
            end_time, channel_id, castle_level = timer_data
            remaining = (end_time - datetime.datetime.now()).days
            
            if castle_level == 1 and remaining == 0:
                message = "⚠️ @vrising Castle blood timer has expired!"
            elif castle_level == 2 and remaining == 1:
                message = "⏰ @vrising Castle blood timer expires in 1 day!"
            elif castle_level >= 3 and remaining == 2:
                message = "⏰ @vrising Castle blood timer expires in 2 days!"
            else:
                return
                
            channel = self.bot.get_channel(channel_id)
            if channel:
                await channel.send(message)

        except Exception as e:
            logger.error(f"Error in reminder task: {e}", exc_info=True)

    @app_commands.command(name="blood-timer", description="Set castle blood timer based on castle level")
    @app_commands.describe(castle_level="Your castle's current level (1-5)")
    async def blood_timer(self, interaction: discord.Interaction, castle_level: int):
        """Set/reset the castle blood timer"""
        try:
            if not hasattr(self.bot, 'db_manager') or self.bot.db_manager is None:
                logger.error("Database unavailable - cannot set blood timer")
                await interaction.response.send_message(
                    "⚠️ Database unavailable - cannot set timer. Please try again later.",
                    ephemeral=False
                )
                return
                
            duration = self.castle_durations.get(castle_level, 13)  # default 13 days
            end_time = datetime.datetime.now() + datetime.timedelta(days=duration)
            
            await self.bot.db_manager.save_timer_data(
                (end_time, interaction.channel.id, castle_level)
            )
            
            await interaction.response.send_message(
                f"🩸 Blood timer set for {duration} days! I'll remind @vrising 2 days before expiration.",
                ephemeral=False
            )
        except Exception as e:
            logger.error(f"Error setting blood timer: {e}", exc_info=True)
            await interaction.response.send_message(
                "⚠️ Failed to set blood timer. Please try again later.",
                ephemeral=False
            )

    async def cog_unload(self):
        self.reminder.cancel()

    @commands.Cog.listener()
    async def on_ready(self):
        try:
            synced = await self.bot.tree.sync()
            print(f"Synced {len(synced)} command(s)")
        except Exception as e:
            print(f"Error syncing commands: {e}")

async def setup(bot):
    await bot.add_cog(VRising(bot))