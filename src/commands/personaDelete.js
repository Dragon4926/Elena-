const { SlashCommandBuilder } = require('discord.js');
const logger = require('../lib/logger');
const db = require('../lib/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('persona_delete')
    .setDescription('Delete one of your persona threads')
    .addStringOption(option =>
      option.setName('thread_id')
        .setDescription('The ID of the thread to delete')
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const threadId = interaction.options.getString('thread_id');
      const userId = interaction.user.id;

      // Verify thread exists and belongs to user
      const threadData = await db.getThreadData(threadId);
      if (!threadData) {
        return interaction.editReply('❌ Thread not found');
      }

      if (threadData.created_by !== userId) {
        return interaction.editReply('❌ You can only delete your own personas');
      }

      // Delete from database
      await db.deleteThread(threadId);

      // Archive thread
      const thread = await interaction.guild.channels.fetch(threadId);
      if (thread) {
        await thread.setArchived(true);
      }

      await interaction.editReply('✅ Persona deleted successfully');
    } catch (error) {
      logger.error('Error deleting persona thread:', error);
      await interaction.editReply(
        '❌ An error occurred while deleting the persona'
      );
    }
  }
};