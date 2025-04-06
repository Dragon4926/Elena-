const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger');
const db = require('../lib/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blood_timer')
    .setDescription('Manage V Rising blood essence timers')
    .addSubcommand(subcommand =>
      subcommand.setName('start')
        .setDescription('Start a new blood essence timer')
        .addIntegerOption(option =>
          option.setName('level')
            .setDescription('Castle blood level (1-5)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5))
        .addIntegerOption(option =>
          option.setName('hours')
            .setDescription('Duration in hours')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand.setName('status')
        .setDescription('Check current blood timer status'))
    .addSubcommand(subcommand =>
      subcommand.setName('stop')
        .setDescription('Stop the active blood timer')),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();
      const channelId = interaction.channel.id;

      switch (subcommand) {
        case 'start':
          const level = interaction.options.getInteger('level');
          const hours = interaction.options.getInteger('hours') || 12; // Default 12 hours
          
          // Calculate end time
          const endTime = new Date();
          endTime.setHours(endTime.getHours() + hours);
          
          // Save timer data
          await db.saveTimerData({
            id: 'vrising_timer',
            end_time: endTime.toISOString(),
            channel_id: channelId,
            castle_level: level
          });

          await interaction.editReply({
            content: `✅ Started blood timer for level ${level} castle (${hours} hours)`
          });
          break;

        case 'status':
          const timerData = await db.getTimerData();
          if (!timerData) {
            return interaction.editReply('❌ No active blood timer');
          }

          const remaining = new Date(timerData.end_time) - new Date();
          const hoursLeft = Math.floor(remaining / (1000 * 60 * 60));
          const minutesLeft = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

          const embed = new EmbedBuilder()
            .setTitle('Blood Essence Timer')
            .setDescription(`Level ${timerData.castle_level} castle`)
            .addFields(
              { name: 'Time Remaining', value: `${hoursLeft}h ${minutesLeft}m` },
              { name: 'Expires At', value: new Date(timerData.end_time).toLocaleString() }
            )
            .setColor(0x0099FF);

          await interaction.editReply({ embeds: [embed] });
          break;

        case 'stop':
          // TODO: Implement stop functionality
          await interaction.editReply('❌ Stop command not yet implemented');
          break;
      }
    } catch (error) {
      logger.error('Error executing blood_timer command:', error);
      await interaction.editReply('❌ An error occurred while processing the command');
    }
  }
};