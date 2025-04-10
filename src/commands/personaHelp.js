// Import necessary modules from discord.js and the logger utility
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger');

// Export the command module
module.exports = {
  // Define the command data using SlashCommandBuilder
  data: new SlashCommandBuilder()
    .setName('persona_help')
    .setDescription('Learn how to use persona features'),

  /**
   * @async
   * @function execute
   * @description Executes the persona_help command, providing information about how to use the bot's persona features.
   * @param {object} interaction - The interaction object provided by Discord.js.
   */
  async execute(interaction) {
    // Use a try-catch block to handle any errors during the command execution
    try {
      // Defer the reply to give the bot time to process the command
      await interaction.deferReply({ ephemeral: true });

      // Create a new embed for the help message
      const embed = new EmbedBuilder()
        .setTitle('Persona Bot Help')
        .setDescription('Create and interact with AI personas in dedicated threads')
        .setColor(0x0099FF)
        .setThumbnail('https://i.imgur.com/J5q7X3P.png');

      // Add fields to the embed to explain different aspects of the bot's persona features
      // Section for creating personas
      embed.addFields(
        {
          name: '📝 Creating Personas',
          value: 'Use `/persona_public` or `/persona_private` to create a thread with a custom AI persona.\n' +
                 '• **Public threads**: Visible to all channel members\n' +
                 '• **Private threads**: Only visible to you and invited members'
        }, // Section for persona requirements
        {
          name: '⚙️ Requirements',
          value: '• **Name**: 2-32 characters\n' +
                 '• **Avatar**: JPG, PNG or GIF image\n' +
                 '• **Persona**: (Optional) Detailed personality instructions'
        }, // Section for usage limits
        {
          name: '📊 Limits',
          value: '• Max 3 active personas per user\n' +
                 '• 5 minute cooldown between creations'
        }
      );
      // Create buttons for documentation and support server
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Documentation')
          .setURL('https://example.com/docs')
          .setStyle(ButtonStyle.Link)
          .setEmoji('📚'),
        // Button for support server
        new ButtonBuilder()
          .setLabel('Support Server')
          .setURL('https://discord.gg/example')
          .setStyle(ButtonStyle.Link)
          .setEmoji('🛠️')
      );
      // Set a footer to the embed with additional information
      embed.setFooter({ text: 'Use /persona_status to check bot health and statistics' });

      // Send the embed and buttons as a reply to the interaction
      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttons] 
      });
    } catch (error) {
      // Log any errors that occur during the command execution
      logger.error('Error executing persona_help:', error);
      // Reply to the user with an error message
      await interaction.editReply('❌ An error occurred while showing help');
    }
  }
};