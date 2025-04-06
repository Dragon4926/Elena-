require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const logger = require('./lib/logger');
const db = require('./lib/database');
const fs = require('fs');
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime()
  });
});
const path = require('path');

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
client.commands = new Collection();

// Event handlers
client.on('ready', () => {
  logger.info(`Logged in as ${client.user.tag}`);
});

client.on('error', error => {
  logger.error('Discord client error:', error);
});

// Initialize database and then login
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
  }
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

let server;
async function startBot() {
  try {
    if (!await db.connect()) {
      throw new Error('Failed to connect to database');
    }

    // Load commands and events
    await loadCommands();
    await loadEvents();

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
    // Start HTTP server if in Vercel environment
    if (process.env.VERCEL) {
      const port = process.env.PORT || 3000;
      server = app.listen(port, () => {
        logger.info(`HTTP server listening on port ${port}`);
      });
    }

    // Graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    logger.error('Bot startup failed:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');
  try {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    client.destroy();
    await db.disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle command interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

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

startBot();

// Export for Vercel
module.exports = app;