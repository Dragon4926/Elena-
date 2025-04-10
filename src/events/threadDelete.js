// Import necessary modules from custom libraries and logger
const logger = require('../lib/logger');
const db = require('../lib/database');

// Export the threadDelete event module
module.exports = {
  // Set the name of the event
  name: 'threadDelete',
  /**
   * @async
   * @function execute
   * @description Executes when a thread is deleted. This function attempts to clean up any associated thread data from the database.
   * @param {object} thread - The thread object provided by Discord.js.
   */
  async execute(thread) {
    // Use a try-catch block to handle any errors during the thread deletion process
    try {
      // Try to get the thread data from the database
      const threadData = await db.getThreadData(thread.id);
      // If no thread data is found, return (not a persona thread)
      if (!threadData) return;

      // Log the deletion of the thread
      logger.info(`Cleaning up deleted persona thread: ${thread.id}`);
      
      // Try to delete the thread from the database
      try {
        await db.deleteThread(thread.id);
      } catch (dbError) {
        // Log an error if the thread could not be deleted from the database
        logger.error(`Failed to delete thread ${thread.id} from database:`, dbError);
      }

    } catch (error) {
      // Log any errors that occur during the thread deletion process
      logger.error('Error cleaning up deleted thread:', error);
    }
  }
};