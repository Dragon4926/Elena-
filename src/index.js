// Load environment variables from .env file
require('dotenv').config();
// Import necessary modules from discord.js, express, fs, path, and custom modules (logger and db)
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const logger = require('./lib/logger');
const db = require('./lib/database');
const fs = require('fs');
const path = require('path');

// Create an instance of express
const app = express();

// Define a health check endpoint for the server
app.get('/health', (req, res) => {
  // Respond with a JSON object containing status 'ok' and server uptime
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// Initialize the Discord client with specific gateway intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});// Create a collection to store commands
client.commands = new Collection();

// Event handler for when the client is ready
client.on('ready', () => {
  // Log a message indicating the bot is logged in
  logger.info(`Logged in as ${client.user.tag}`);
});

// Event handler for client errors
client.on('error', error => {
  // Log any errors that occur with the Discord client
  logger.error('Discord client error:', error);
});

/**
 * @async
 * @function loadCommands
 * @description Loads all command files from the 'commands' directory and adds them to the client's command collection.
 */
async function loadCommands() {
  // Define the path to the commands directory
  const commandsPath = path.join(__dirname, 'commands');// Try to read the commands directory
  try {
    // Read all files in the commands directory and filter for .js files
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Loop through each command file
    for (const file of commandFiles) {
      // Define the file path
      const filePath = path.join(commandsPath, file);
      // Try to load the command file
      try {
        // Import the command
        const command = require(filePath);
        // Set the command in the client's command collection
        client.commands.set(command.data.name, command);
      } catch (error) {
        // Log an error if the command file could not be loaded
        logger.error(`Failed to load command from ${file}:`, error);
        // Exit the process if a command cannot be loaded
        process.exit(1);
      }
    }
  } catch (error) {
    logger.error('Failed to load commands:', error);
    process.exit(1);
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));
  try {
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      try {
        const event = require(filePath);
        // Check if the event should be executed only once
        if (event.once) {
          // Register the event to be executed once
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          // Register the event to be executed multiple times
          client.on(event.name, (...args) => event.execute(...args));
        }
      } catch (error) {
        // Log an error if the event file could not be loaded
        logger.error(`Failed to load event from ${file}:`, error);
        // Exit the process if an event cannot be loaded
        process.exit(1);
      }
    }
  } catch (error) {
    // Log an error if the events could not be loaded
    logger.error('Failed to load events:', error);
    // Exit the process if the events cannot be loaded
    process.exit(1);
  }
}


let server;
/**
 * @async
 * @function startBot
 * @description Initializes and starts the Discord bot, including database connection, command and event loading, and logging into Discord.
 */
async function startBot() {
  try {
    // Connect to the database
    if (!await db.connect()) {
      throw new Error('Failed to connect to database');
    }

    // Load commands
    await loadCommands();
    // Load events
    await loadEvents();

    // Log in to Discord
    await client.login(process.env.DISCORD_TOKEN);

    // Start the HTTP server if the bot is running in a Vercel environment
    if (process.env.VERCEL) {
      const port = process.env.PORT || 3000;
      server = app.listen(port, () => {
        logger.info(`HTTP server listening on port ${port}`);
      });
    }
    // Handle graceful shutdown on SIGTERM
    process.on('SIGTERM', gracefulShutdown);
    // Handle graceful shutdown on SIGINT
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    // Log an error if the bot fails to start
    logger.error('Bot startup failed:', error);
    // Exit the process if the bot fails to start
    process.exit(1);
  }
}

/**
 * @async
 * @function gracefulShutdown
 * @description Handles the graceful shutdown of the bot, including closing the HTTP server, disconnecting from Discord, and closing the database connection.
 */
async function gracefulShutdown() {
  // Log a message indicating the start of the graceful shutdown process
  logger.info('Shutting down gracefully...');
  try {
    // Close the HTTP server if it's running
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    // Destroy the Discord client
    client.destroy();
    // Disconnect from the database
    await db.disconnect();
    // Log a message indicating the shutdown is complete
    logger.info('Shutdown complete');
    // Exit the process successfully
    process.exit(0);
  } catch (error) {
    // Log an error if the shutdown process fails
    logger.error('Error during shutdown:', error);
    // Exit the process with an error code
    process.exit(1);
  }
}

// Handle command interactions when an interaction is created
client.on('interactionCreate', async interaction => {
  // Check if the interaction is a command
  if (!interaction.isCommand()) return;
  // Get the command from the client's command collection
  const command = client.commands.get(interaction.commandName);
  // Check if the command exists
  if (!command) return;
  // Try to execute the command
  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing ${interaction.commandName}:`, error);
    await interaction.reply({
      content: 'There was an error while executing this command!',
      ephemeral: true
    });
  }
});
// Start the bot
startBot();

// Export for Vercel
module.exports = app;