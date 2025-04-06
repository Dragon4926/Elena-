const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('persona_help')
    .setDescription('Learn how to use persona features'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Create help embed
      const embed = new EmbedBuilder()
        .setTitle('Persona Bot Help')
        .setDescription('Create and interact with AI personas in dedicated threads')
        .setColor(0x0099FF)
        .setThumbnail('https://i.imgur.com/J5q7X3P.png');

      // Add help sections
      embed.addFields(
        {
          name: '📝 Creating Personas',
          value: 'Use `/persona_public` or `/persona_private` to create a thread with a custom AI persona.\n' +
                 '• **Public threads**: Visible to all channel members\n' +
                 '• **Private threads**: Only visible to you and invited members'
        },
        {
          name: '⚙️ Requirements',
          value: '• **Name**: 2-32 characters\n' +
                 '• **Avatar**: JPG, PNG or GIF image\n' +
                 '• **Persona**: (Optional) Detailed personality instructions'
        },
        {
          name: '📊 Limits',
          value: '• Max 3 active personas per user\n' +
                 '• 5 minute cooldown between creations'
        }
      );

      // Create buttons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Documentation')
          .setURL('https://example.com/docs')
          .setStyle(ButtonStyle.Link)
          .setEmoji('📚'),
        new ButtonBuilder()
          .setLabel('Support Server')
          .setURL('https://discord.gg/example')
          .setStyle(ButtonStyle.Link)
          .setEmoji('🛠️')
      );

      embed.setFooter({ text: 'Use /persona_status to check bot health and statistics' });

      await interaction.editReply({ 
        embeds: [embed], 
        components: [buttons] 
      });
    } catch (error) {
      logger.error('Error executing persona_help:', error);
      await interaction.editReply('❌ An error occurred while showing help');
    }
  }
};