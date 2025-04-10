const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger'); // Import the logger module
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
    // Use a try-catch block to handle any errors during the command execution
    try {
      // Defer the reply to give the bot time to process the command
      await interaction.deferReply({ ephemeral: true });

      // Extract the subcommand and channel ID from the interaction
      const subcommand = interaction.options.getSubcommand();
      const channelId = interaction.channel.id;

      // Use a switch statement to handle each subcommand
      switch (subcommand) {
        // Handle the 'start' subcommand
        case 'start':
          // Extract the level and hours from the interaction options
          const level = interaction.options.getInteger('level');
          const hours = interaction.options.getInteger('hours') || 12; // Default 12 hours
          
          // Calculate the end time by adding the specified hours to the current time
          const endTime = new Date();
          endTime.setHours(endTime.getHours() + hours);
          
          // Try to save the timer data to the database
          try {
            await db.saveTimerData({
              id: 'vrising_timer',
              end_time: endTime.toISOString(),
              channel_id: channelId,
              castle_level: level
            });
            // Reply to the user with a success message
            await interaction.editReply({
              content: `✅ Started blood timer for level ${level} castle (${hours} hours)`
            });
          } catch (dbError) {
            // Log any errors that occur during database operations
            logger.error('Error saving timer data:', dbError);
            await interaction.editReply('❌ An error occurred while saving the timer data');
          }
          break;

        // Handle the 'status' subcommand
        case 'status':
          // Try to get the timer data from the database
          try {
            const timerData = await db.getTimerData();
            // If no timer data is found, reply to the user
            if (!timerData) {
              return interaction.editReply('❌ No active blood timer');
            }

            // Calculate the remaining time
            const remaining = new Date(timerData.end_time) - new Date();
            const hoursLeft = Math.floor(remaining / (1000 * 60 * 60));
            const minutesLeft = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            // Create an embed with the timer information
            const embed = new EmbedBuilder()
              .setTitle('Blood Essence Timer')
              .setDescription(`Level ${timerData.castle_level} castle`)
              .addFields(
                { name: 'Time Remaining', value: `${hoursLeft}h ${minutesLeft}m` },
                { name: 'Expires At', value: new Date(timerData.end_time).toLocaleString() }
              )
              .setColor(0x0099FF);

            // Reply to the user with the embed
            await interaction.editReply({ embeds: [embed] });
          } catch (dbError) {
            // Log any errors that occur during database operations
            logger.error('Error getting timer data:', dbError);
            await interaction.editReply('❌ An error occurred while getting the timer data');
          }
          break;

        // Handle the 'stop' subcommand
        case 'stop':
          // Try to delete the timer data from the database
          try {
            const deleteSuccess = await db.deleteTimerData();
            if(deleteSuccess) {
              await interaction.editReply('✅ Blood timer stopped');
            } else {
              await interaction.editReply('❌ No active timer to stop');
            }
          } catch (dbError) {
            // Log any errors that occur during database operations
            logger.error('Error deleting timer data:', dbError);
            await interaction.editReply('❌ An error occurred while deleting the timer data');
          }
          break;
      }
    } catch (error) {
      // Log any errors that occur during the command execution
      logger.error('Error executing blood_timer command:', error);
      // Reply to the user with an error message
      await interaction.editReply('❌ An error occurred while processing the command');
    }
  }
};