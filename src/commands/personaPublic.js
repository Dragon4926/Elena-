// Import necessary modules from discord.js and custom libraries
const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger');
const db = require('../lib/database');

// Export the command module
module.exports = {
  // Define the command data using SlashCommandBuilder
  data: new SlashCommandBuilder()
    .setName('persona_public') // Set the name of the command
    .setDescription('Create a public roleplaying thread with detailed character info')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The display name for your persona (2-32 chars)')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('avatar')
        .setDescription('An image for your persona (JPG/PNG/GIF)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Character description (max 1024 chars)')
        .setMaxLength(1024)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('personality')
        .setDescription('Personality traits, quirks, habits (max 1024 chars)')
        .setMaxLength(1024)
        .setRequired(true))
     .addStringOption(option =>
      option.setName('first_message')
        .setDescription("The character's opening message (max 500 chars)")
        .setMaxLength(500)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('scenario')
        .setDescription('Optional scenario or setting (max 500 chars)')
        .setMaxLength(500)
        .setRequired(false)), // Optional field

  /**
   * @async
   * @function execute
   * @description Executes the persona_public command to create a new public roleplaying thread with a persona.
   * @param {object} interaction - The interaction object provided by Discord.js.
   */
  async execute(interaction) {
    // Use a try-catch block to handle any errors during the command execution
    try {
      // Defer the reply to give the bot time to process the command
      await interaction.deferReply({ ephemeral: true });

      // Extract options from the interaction
      const name = interaction.options.getString('name');
      const avatar = interaction.options.getAttachment('avatar');
      const description = interaction.options.getString('description');
      const personality = interaction.options.getString('personality');
      const firstMessage = interaction.options.getString('first_message');
      const scenario = interaction.options.getString('scenario'); // Optional
      
      // Validate inputs to ensure they meet the required criteria
      if (name.length < 2 || name.length > 32) {
        return interaction.editReply('❌ Name must be 2-32 characters'); // Reply with an error if the name is not within the allowed length
      }
      if (!avatar.contentType?.startsWith('image/')) {
        return interaction.editReply('❌ Avatar must be an image (JPG/PNG/GIF)'); // Reply with an error if the avatar is not an image
      }

      // Check rate limits to ensure the user hasn't exceeded the maximum number of active personas
      const threadCount = await db.getUserThreadCount(interaction.user.id);
      if (threadCount >= 3) { // Assuming the limit is still 3
        return interaction.editReply(
          `❌ You've reached the maximum of 3 active personas. ` +
          `Please delete some before creating new ones.`
        ); // Reply with an error if the user has reached the maximum number of active personas
      }

      // Create a new public thread in the channel
      const thread = await interaction.channel.threads.create({
        name: `${name} RP`,
        type: ChannelType.PublicThread,
        autoArchiveDuration: 1440 // 24 hours
      });

      // Log the creation of the thread
      logger.info(`Created public thread ${thread.id} for persona ${name}`);

      // Construct detailed system context for the AI
      // Define the base context for the system, this will be used to guide the AI
      // This sets the stage for how the AI should act and respond
      // You define the persona's role.
      // Description of the persona, this is a more detailed overview of the character.
      // Personality traits and quirks of the persona.
      // Optional: if a scenario is provided it will be included.
      // Instructions: specific instructions for the AI to follow.




      // Construct detailed system context for the AI persona
      let systemContext = `You are roleplaying as ${name}.

` +
                          `Character Description: ${description}

` +
                          `Personality: ${personality}

`;
      if (scenario) {
          systemContext += `Scenario: ${scenario}

`;
      }
      systemContext += `Stay in character as ${name} at all times. Your responses should be based on the character's personality, description, and the ongoing conversation. Do not break character or mention you are an AI. Engage naturally with the user.`;
      
      // Prepare the thread data to be stored in the database
      // Store thread data
      const threadData = {
        name,
        description, // New field
        personality, // New field
        first_message: firstMessage, // New field
        scenario, // New field
        history: [], // Initialize history - prompt is now in system_context
        system_context: systemContext, // Use the detailed context
        channel_id: interaction.channel.id,
        guild_id: interaction.guild?.id,
        created_by: interaction.user.id,
        created_at: new Date().toISOString(),
        avatar_url: avatar.url
      };

      // Store in database (assuming db function can handle the new fields)
      // Try to create the thread document in the database
      try {
          await db.createThreadDocument(thread.id, threadData); // Attempt to save the thread data to the database
      } catch (dbError) {
          logger.error(`Database error saving thread ${thread.id}:`, dbError); // Log the error if the database save fails
          // Attempt to delete the created thread if database save fails
          try {
              await thread.delete('Database save failed'); // Attempt to delete the thread
          } catch (threadDeleteError) {
              logger.error(`Failed to delete thread ${thread.id} after DB error:`, threadDeleteError); // Log the error if the thread deletion fails
          }
          return interaction.editReply('❌ Failed to save persona data. Thread creation cancelled.'); // Reply with an error if the database save fails
      }


      // Send welcome message embed to the thread
      // Construct an embed to welcome users to the new thread
      const embed = new EmbedBuilder()
        .setTitle(`${name} is ready for RP!`)
        .setDescription(`Start chatting in this thread to interact with ${name}.`)
        .setThumbnail(avatar.url)
        .addFields( // Add fields for the persona's description and personality
          { name: '👤 Description', value: description },
          { name: '✨ Personality', value: personality }
        )
        .setFooter({ text: `Created by ${interaction.user.displayName}` }); // Add a footer with the creator's name

      if (scenario) {
        embed.addFields({ name: '🗺️ Scenario', value: scenario }); // Add a field for the scenario if it exists
      }

      await thread.send({ embeds: [embed] }); // Send the embed to the thread

      // Send the character's first message to start the roleplay
      await thread.send(firstMessage); // Send the first message to the thread
      
      // Reply to the user that the thread has been created
      await interaction.editReply(
        `✅ Created public persona thread: ${thread.toString()}`
      ); // Reply to the user indicating that the thread has been successfully created

    } catch (error) {
      // Log any errors that occur during the command execution
      logger.error('Error creating public persona thread:', error);
      // Check if interaction is still editable, if interaction is deferred or replied.
       if (interaction.deferred || interaction.replied) {
         await interaction.editReply(
            '❌ An unexpected error occurred while creating the persona thread. Please try again later.'
          ).catch(e => logger.error("Failed to edit reply on error:", e)); // Try to edit the reply to inform the user about the error, Catch potential error if interaction is lost.
       } else {
          await interaction.reply({ // Fallback if defer failed somehow
            content: '❌ An unexpected error occurred. Please try again later.',
            ephemeral: true
          }).catch(e => logger.error("Failed to send error reply:", e)); // As a fallback, if the defer failed send a reply to the user, Catch potential error if interaction is lost.
       }
    }
  }
};