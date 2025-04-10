const { SlashCommandBuilder, ChannelType } = require('discord.js'); // Import necessary modules from discord.js
const db = require('../lib/database'); // Import the database module
const logger = require('../lib/logger'); // Import the logger module

// Export the command module
module.exports = {
    // Define the command data using SlashCommandBuilder
    data: new SlashCommandBuilder()
        .setName('persona_private')
        .setDescription('Create a private AI persona thread.')
        // Add a string option for the persona's name
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of your persona.')
                .setRequired(true))
        // Add a string option for the persona's description
        .addStringOption(option =>
            option.setName('description')
                .setDescription('A description of your persona.')
                .setRequired(true))
        // Add a string option for the persona's avatar URL (optional)
        .addStringOption(option =>
            option.setName('avatar_url')
                .setDescription('The avatar URL for your persona.')
                .setRequired(false)),
    /**
     * @async
     * @function execute
     * @description Executes the persona_private command to create a new private AI persona thread.
     * @param {object} interaction - The interaction object provided by Discord.js.
     */
    async execute(interaction) {
        // Use a try-catch block to handle any errors during the command execution
        try {
            // Defer the reply to give the bot time to process the command
            await interaction.deferReply({ ephemeral: true });

            // Extract the name, description, and avatar URL from the interaction options
            const name = interaction.options.getString('name');
            const description = interaction.options.getString('description');
            const avatarURL = interaction.options.getString('avatar_url');
            // Get the user ID from the interaction
            const userId = interaction.user.id;
            // Get the guild from the interaction
            const guild = interaction.guild;

            // Create a new private thread
            const thread = await guild.channels.create({
                name: `${name}`,
                type: ChannelType.GuildPrivateThread,
                reason: 'Creating a new private AI persona thread',
            });
            // Add the user and the bot to the thread
            await thread.members.add(interaction.user.id);
            await thread.members.add(interaction.client.user.id);

            // Send a message to the thread to introduce the persona
            await thread.send({
                content: `Hello, I am ${name}, ${description} You can now start talking to me!`,
                // If an avatar URL is provided, set the username and avatar URL for the message
                ...(avatarURL ? { username: name, avatarURL: avatarURL } : {}),
            });
            // create the persona thread on the database
            const personaThread = await db.createThreadDocument({
                name,
                description,
                avatarURL,
                threadId: thread.id,
                userId,
                isPrivate: true,
            });

            // Reply to the user with a success message
            await interaction.editReply({ content: `Private persona thread created: ${thread}`, ephemeral: true });
        } catch (error) {
            // Log any errors that occur during the command execution
            logger.error('Error creating private thread:', error);
            // Reply to the user with an error message
            await interaction.editReply({ content: 'Failed to create private persona thread.', ephemeral: true });
        }
    },
};
            });

            await interaction.editReply({ content: `Private persona thread created: ${thread}`, ephemeral: true });
        } catch (error) {
            console.error('Error creating private thread:', error);
            await interaction.editReply({ content: 'Failed to create private persona thread.', ephemeral: true });
        }
    },
};