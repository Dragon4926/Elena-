const { SlashCommandBuilder } = require('discord.js');
const logger = require('../lib/logger');
const db = require('../lib/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('persona_public')
    .setDescription('Create a public roleplaying thread')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The display name for your persona (2-32 chars)')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('avatar')
        .setDescription('An image for your persona (JPG/PNG/GIF)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('persona')
        .setDescription('Personality instructions (optional)')),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Get options
      const name = interaction.options.getString('name');
      const avatar = interaction.options.getAttachment('avatar');
      const persona = interaction.options.getString('persona') || 
        "You are a helpful and friendly AI assistant with a unique personality. You're knowledgeable, creative, and enjoy engaging in meaningful conversations.";

      // Validate inputs
      if (name.length < 2 || name.length > 32) {
        return interaction.editReply('❌ Name must be 2-32 characters');
      }

      if (!avatar.contentType?.startsWith('image/')) {
        return interaction.editReply('❌ Avatar must be an image (JPG/PNG/GIF)');
      }

      // Check rate limits
      const threadCount = await db.getUserThreadCount(interaction.user.id);
      if (threadCount >= 3) {
        return interaction.editReply(
          `❌ You've reached the maximum of 3 active personas. ` +
          `Please delete some before creating new ones.`
        );
      }

      // Create thread
      const thread = await interaction.channel.threads.create({
        name: `${name} RP`,
        type: 'PUBLIC_THREAD',
        autoArchiveDuration: 1440
      });

      logger.info(`Created public thread ${thread.id}`);

      // Store thread data
      const threadData = {
        name,
        persona,
        history: [
          { role: 'user', parts: [{ text: `Roleplay details: ${persona}` }] },
          { role: 'model', parts: [{ text: `I'll roleplay as ${name}` }] }
        ],
        system_context: `You are ${name}. You are participating in a roleplay conversation. ` +
                       `Character instructions: ${persona}\n\n` +
                       `Stay in character at all times. Keep responses conversational and engaging. ` +
                       `Respond as the character, not as an AI.`,
        channel_id: interaction.channel.id,
        guild_id: interaction.guild?.id,
        created_by: interaction.user.id,
        created_at: new Date().toISOString(),
        avatar_url: avatar.url
      };

      await db.createThreadDocument(thread.id, threadData);

      // Send welcome message
      const embed = new EmbedBuilder()
        .setTitle(`Welcome to ${name}'s Thread!`)
        .setDescription("Start chatting to interact with your AI persona.")
        .setThumbnail(avatar.url)
        .addFields({
          name: '🧛‍♂️ Personality',
          value: persona.length > 1000 ? `${persona.substring(0, 1000)}...` : persona
        })
        .setFooter({ text: `Created by ${interaction.user.displayName}` });

      await thread.send({ embeds: [embed] });
      await interaction.editReply(
        `✅ Created public persona thread: ${thread.toString()}`
      );

    } catch (error) {
      logger.error('Error creating public persona thread:', error);
      await interaction.editReply(
        '❌ An unexpected error occurred. Please try again later.'
      );
    }
  }
};