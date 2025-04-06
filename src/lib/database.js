const { createConnection } = require('typeorm');
const logger = require('./logger');
const PersonaThread = require('../models/PersonaThread');
const VRisingTimer = require('../models/VRisingTimer');

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

  async disconnect() {
    if (this.connection && this.connection.isConnected) {
      await this.connection.close();
      logger.info('Database connection closed');
    }
  }

  async isConnected() {
    return this.connection?.isConnected;
  }

  async getThreadData(threadId) {
    const repo = this.connection.getRepository(PersonaThread);
    return repo.findOne({ where: { id: threadId } });
  }

  async createThreadDocument(threadId, data) {
    const repo = this.connection.getRepository(PersonaThread);
    await repo.insert({ id: threadId, ...data });
    return true;
  }

  async updateThreadHistory(threadId, userMessage, aiResponse) {
    const repo = this.connection.getRepository(PersonaThread);
    const thread = await repo.findOne({ where: { id: threadId } });
    
    if (!thread) return false;
    
    const history = thread.history;
    history.push(
      { role: 'user', parts: [{ text: userMessage }] },
      { role: 'model', parts: [{ text: aiResponse }] }
    );
    
    // Keep last 12 message pairs (24 entries)
    thread.history = history.slice(-24);
    await repo.save(thread);
    return true;
  }

  async getActiveThreadCount() {
    const repo = this.connection.getRepository(PersonaThread);
    return repo.count();
  }

  async getUserThreadCount(userId) {
    const repo = this.connection.getRepository(PersonaThread);
    return repo.count({ where: { created_by: userId } });
  }

  async deleteThread(threadId) {
    const repo = this.connection.getRepository(PersonaThread);
    await repo.delete({ id: threadId });
    logger.info(`Deleted thread data for ID: ${threadId}`);
    return true;
  }

  // VRising timer methods
  async saveTimerData(timerData) {
    const repo = this.connection.getRepository(VRisingTimer);
    await repo.upsert(timerData, ['id']);
    return true;
  }

  async getTimerData() {
    const repo = this.connection.getRepository(VRisingTimer);
    return repo.findOne({ where: { id: 'vrising_timer' } });
  }
}

module.exports = new DatabaseService();