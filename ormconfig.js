module.exports = {
  type: 'better-sqlite3', // Change this if switching DB
  database: 'persona_bot.db', // Change this if switching DB
  entities: ['src/models/*.js'],
  migrations: ['src/migrations/*.js'],
  cli: {
    entitiesDir: 'src/models',
    migrationsDir: 'src/migrations'
  },
  synchronize: false,
  logging: true, // Logs to console by default if logger is not specified
  // logger: 'file' // Remove this for Vercel
};