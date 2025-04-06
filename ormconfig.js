module.exports = {
  entities: ['src/models/*.js'],
  migrations: ['src/migrations/*.js'],
  cli: {
    entitiesDir: 'src/models',
    migrationsDir: 'src/migrations'
  },
  synchronize: false
};