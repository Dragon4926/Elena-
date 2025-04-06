const logger = require('../lib/logger');
const db = require('../lib/database');

module.exports = {
  name: 'threadDelete',
  async execute(thread) {
    try {
      // Check if this was a persona thread
      const threadData = await db.getThreadData(thread.id);
      if (!threadData) return;

      logger.info(`Cleaning up deleted persona thread: ${thread.id}`);
      
      // Delete from database
      await db.deleteThread(thread.id);
    } catch (error) {
      logger.error('Error cleaning up deleted thread:', error);
    }
  }
};