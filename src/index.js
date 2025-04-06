require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./lib/logger');
const db = require('./lib/database');
const fs = require('fs');
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

async function startBot() {
  if (!await db.connect()) {
    logger.error('Failed to connect to database - exiting');
    process.exit(1);
  }

  // Load commands and events
  await loadCommands();
  await loadEvents();

  // Login to Discord
  await client.login(process.env.DISCORD_TOKEN);
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

startBot().catch(error => {
  logger.error('Bot startup failed:', error);
  process.exit(1);
});

module.exports = client;