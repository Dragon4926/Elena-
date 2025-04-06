const { SlashCommandBuilder } = require('discord.js');
const logger = require('../lib/logger');
const db = require('../lib/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('persona_status')
    .setDescription('Check the status of the persona bot'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Create status embed
      const embed = new EmbedBuilder()
        .setTitle('Persona Bot Status')
        .setDescription('Current status of AI persona services')
        .setColor(0x0099FF);

      // Add fields
      embed.addFields(
        { 
          name: '🦇 AI Service', 
          value: '✅ Online', 
          inline: true 
        },
        { 
          name: '🧛‍♂️ Database', 
          value: (await db.isConnected()) ? '✅ Online' : '❌ Offline', 
          inline: true 
        }
      );

      // Add active threads count if available
      try {
        const activeCount = await db.getActiveThreadCount();
        embed.addFields({
          name: '🩸 Active Personas',
          value: activeCount.toString(),
          inline: true
        });
      } catch (error) {
        logger.error('Error getting thread count:', error);
        embed.addFields({
          name: '🩸 Active Personas',
          value: 'Unknown',
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error executing persona_status:', error);
      await interaction.editReply('❌ An error occurred while checking status');
    }
  }
};