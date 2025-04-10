// Import necessary modules from custom libraries and logger
const logger = require('../lib/logger'); // Import the logger module
const db = require('../lib/database'); // Import the database module
const aiService = require('../lib/aiService'); // Import the AI service module

// Export the messageCreate event module
module.exports = {
  // Set the name of the event
  name: 'messageCreate',
  /**
   * @async
   * @function execute
   * @description Executes when a message is created in a channel. This function handles messages in threads, interacts with the AI, and updates the conversation history.
   * @param {object} message - The message object provided by Discord.js.
   */
  async execute(message) {
    // Ignore messages from bots or messages that are not in threads
    if (message.author.bot || !message.channel.isThread()) return;

    // Use a try-catch block to handle any errors during the message processing
    try {
      // Try to get the thread data from the database
      const threadData = await db.getThreadData(message.channel.id);
      // If no thread data is found, return
      if (!threadData) return;

      // Get the user message content
      const userMessage = message.content;
      // If the message is empty, return
      if (!userMessage.trim()) return;

      // Send a typing indicator to the channel
      await message.channel.sendTyping();

      // AI Integration
      // Get the system context and history from the thread data
      const systemContext = threadData.system_context;
      const history = threadData.history;
      let aiResponse;

      // Use a try-catch block to handle any errors during the AI integration
      try {
        // Call the AI service to generate a response
        aiResponse = await aiService.generateResponse(systemContext, history, userMessage);

        // Check if the response is meaningful
        if (!aiResponse || typeof aiResponse !== 'string' || !aiResponse.trim()) {
          // Log a warning if the response is empty or invalid
          logger.warn(`AI service returned an empty or invalid response for thread ${message.channel.id}`);
          // Use a generic fallback message
          aiResponse = "(I'm having trouble forming a response right now.)";
          // Send the fallback message to the channel
          await message.channel.send(aiResponse);
          return; // Stop processing this message
        }

      } catch (aiError) {
        // Log an error if the AI generation fails
        logger.error(`AI generation failed for thread ${message.channel.id}:`, aiError);
        // Notify the user that the AI call failed
        await message.reply("😵‍💫 My circuits are a bit scrambled. I couldn't come up with a response right now. Please try again later.").catch(e => logger.error("Failed to send AI error reply:", e));
        return; // Stop processing if the AI fails
      }
      // End AI Integration
      
      // Update History
      // Use a try-catch block to handle any errors during the history update
      try {
        // Try to update the thread history in the database
        await db.updateThreadHistory(
          message.channel.id,
          userMessage,
          aiResponse
        );
      } catch (dbError) {
        // Log an error if the history update fails
        logger.error(`Failed to update history for thread ${message.channel.id}:`, dbError);
        // Notify the user that the history update failed, but still send the response
        await message.reply("⚠️ I got your message and generated a response, but had trouble remembering our conversation for next time.").catch(e => logger.error("Failed to send DB error reply:", e));
      }
      // End Update History

      // Send the AI's response to the channel
      // Check if the response exceeds Discord's character limit (2000 characters)
      if (aiResponse.length > 2000) {
        // Log a warning if the response exceeds the limit
         logger.warn(`AI response exceeded 2000 characters for thread ${message.channel.id}. Truncating.`);
         // Truncate the response to fit within the limit
         aiResponse = aiResponse.substring(0, 1997) + "...";
      }
      // Send the response to the channel
      await message.channel.send(aiResponse);

    } catch (error) {
      // Log any unhandled errors that occur during the message processing
      logger.error(`Unhandled error processing message in thread ${message.channel.id}:`, error);
      // Check if the message channel context is lost
      if (!message.channel) {
        // Log an error if the message channel context is lost
        logger.error("Message channel context lost, cannot send error reply.");
        return;
      }
      // Use a try-catch block to handle any errors during the error reply
      try {
        // Avoid replying if the message was deleted
        if (!message.deleted) {
            // Try to reply to the message with an error message
            await message.reply("❌ An unexpected internal error occurred while processing your message.").catch(e => logger.error("Failed to send final error reply:", e));
        }
      } catch (replyError) {
        // Log an error if the error reply fails
        logger.error(`Failed to send final error reply to channel ${message.channel.id}:`, replyError);
      }
    }
  }
};