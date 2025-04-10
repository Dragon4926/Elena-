const { createConnection } = require('typeorm');
const logger = require('./logger');
const PersonaThread = require('../models/PersonaThread');
const VRisingTimer = require('../models/VRisingTimer');

/**
 * @class DatabaseService
 * @description This class manages the database connection and provides methods to interact with the database.
 */
class DatabaseService {
  constructor() {
    this.connection = null;
    this.config = {
      type: process.env.DB_TYPE || 'better-sqlite3',
      database: process.env.DB_NAME || 'persona_bot.db',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      synchronize: false,
      logging: true,
      entities: [PersonaThread, VRisingTimer],
      extra: {
        connectionLimit: process.env.DB_POOL_SIZE || 5,
        idleTimeoutMillis: 30000
      }
    };
  }

  /**
   * @async
   * @function connect
   * @description Establishes a connection to the database.
   */
  async connect() {
    try {
      this.connection = await createConnection(this.config);
      logger.info(`Database connection established (${this.config.type})`);
      return true;
    } catch (error) {
      logger.error('Database connection failed:', error);
      return false;
    }
  }

  /**
   * @async
   * @function disconnect
   * @description Closes the database connection if it's active.
   */
  async disconnect() {
    try {
      if (this.connection && this.connection.isConnected) {
        await this.connection.close();
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }

  /**
   * @async
   * @function isConnected
   * @description Checks if the database connection is currently active.
   * @returns {boolean} True if connected, false otherwise.
   */
  async isConnected() {
    return this.connection?.isConnected;
  }

  /**
   * @async
   * @function getThreadData
   * @description Retrieves thread data from the database by thread ID.
   * @param {string} threadId - The ID of the thread to retrieve.
   * @returns {Promise<PersonaThread|null>} The thread data or null if not found.
   */
  async getThreadData(threadId) {
    try {
      const repo = this.connection.getRepository(PersonaThread);
      return await repo.findOne({ where: { id: threadId } });
    } catch (error) {
      logger.error(`Error getting thread data for ID ${threadId}:`, error);
      return null;
    }
  }

  /**
   * @async
   * @function getUserThreads
   * @description Retrieves all threads created by a specific user.
   * @param {string} userId - The ID of the user whose threads to retrieve.
   * @returns {Promise<PersonaThread[]>} An array of threads created by the user.
   */
  async getUserThreads(userId) {
    try {
      const repo = this.connection.getRepository(PersonaThread);
      return await repo.find({
        where: { created_by: userId },
        select: ['id', 'name', 'created_at'],
        order: { created_at: 'DESC' }
      });
    } catch (error) {
      logger.error(`Error getting user threads for user ID ${userId}:`, error);
      return [];
    }
  }

  /**
   * @async
   * @function createThreadDocument
   * @description Creates a new thread document in the database.
   * @param {string} threadId - The ID of the thread.
   * @param {object} data - The data to store for the thread.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  async createThreadDocument(threadId, data) {
    try {
      const repo = this.connection.getRepository(PersonaThread);
      await repo.insert({ id: threadId, ...data });
      return true;
    } catch (error) {
      logger.error(`Error creating thread document for ID ${threadId}:`, error);
      return false;
    }
  }

 /**
 * @async
 * @function updateThreadHistory
 * @description Updates the history of a thread in the database.
 * @param {string} threadId - The ID of the thread to update.
 * @param {string} userMessage - The user's message.
 * @param {string} aiResponse - The AI's response.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
 async updateThreadHistory(threadId, userMessage, aiResponse) {
  try {
      const repo = this.connection.getRepository(PersonaThread);
      const thread = await repo.findOne({ where: { id: threadId } });

      if (!thread) return false;

      const history = thread.history;
      history.push(
          { role: 'user', parts: [{ text: userMessage }] },
          { role: 'model', parts: [{ text: aiResponse }] }
      );

      // Keep last 12 message pairs (24 entries)
      thread.history = thread.history.slice(-24);
      await repo.save(thread);
      return true;
  } catch (error) {
      logger.error(`Error updating thread history for ID ${threadId}:`, error);
      return false;
  }
  }

  /**
   * @async
   * @function getActiveThreadCount
   * @description Retrieves the count of active threads.
   * @returns {Promise<number>} The number of active threads.
   */
  async getActiveThreadCount() {
    try {
      const repo = this.connection.getRepository(PersonaThread);
      return await repo.count();
    } catch (error) {
      logger.error('Error getting active thread count:', error);
      return 0;
    }
  }

  /**
   * @async
   * @function getUserThreadCount
   * @description Retrieves the count of threads created by a specific user.
   * @param {string} userId - The ID of the user.
   * @returns {Promise<number>} The number of threads created by the user.
   */
  async getUserThreadCount(userId) {
    try {
      const repo = this.connection.getRepository(PersonaThread);
      return await repo.count({ where: { created_by: userId } });
    } catch (error) {
      logger.error(`Error getting thread count for user ID ${userId}:`, error);
      return 0;
    }
  }

  /**
   * @async
   * @function deleteThread
   * @description Deletes a thread from the database by thread ID.
   * @param {string} threadId - The ID of the thread to delete.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  async deleteThread(threadId) {
    try {
      const repo = this.connection.getRepository(PersonaThread);
      await repo.delete({ id: threadId });
      logger.info(`Deleted thread data for ID: ${threadId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting thread data for ID ${threadId}:`, error);
      return false;
    }
  }

  /**
   * @async
   * @function saveTimerData
   * @description Saves or updates VRising timer data.
   * @param {object} timerData - The timer data to save.
   * @returns {Promise<boolean>} True if successful, false otherwise.
   */
  async saveTimerData(timerData) {
    try {
      const repo = this.connection.getRepository(VRisingTimer);
      await repo.upsert(timerData, ['id']);
      return true;
    } catch (error) {
      logger.error('Error saving timer data:', error);
      return false;
    }
  }

  /**
   * @async
   * @function getTimerData
   * @description Retrieves VRising timer data.
   * @returns {Promise<VRisingTimer|null>} The timer data or null if not found.
   */
  async getTimerData() {
    try {
      const repo = this.connection.getRepository(VRisingTimer);
      return await repo.findOne({ where: { id: 'vrising_timer' } });
    } catch (error) {
      logger.error('Error getting timer data:', error);
      return null;
    }
  }
}

module.exports = new DatabaseService();