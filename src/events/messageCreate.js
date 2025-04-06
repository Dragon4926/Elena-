const logger = require('../lib/logger');
const db = require('../lib/database');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignore messages from bots or non-thread channels
    if (message.author.bot || !message.channel.isThread()) return;

    try {
      // Get thread data
      const threadData = await db.getThreadData(message.channel.id);
      if (!threadData) return;

      // Ignore messages from non-owners in private threads
      if (message.channel.type === 'privateThread' && 
          message.author.id !== threadData.created_by) {
        return;
      }

      // Process user message
      const userMessage = message.content;
      if (!userMessage.trim()) return;

      // Generate AI response (placeholder - will integrate AI later)
      const aiResponse = `This is a placeholder response for: "${userMessage}"`;

      // Update conversation history
      await db.updateThreadHistory(
        message.channel.id, 
        userMessage, 
        aiResponse
      );

      // Send response
      await message.channel.send(aiResponse);

    } catch (error) {
      logger.error('Error processing thread message:', error);
    }
  }
};