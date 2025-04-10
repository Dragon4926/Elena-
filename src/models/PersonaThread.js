const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'PersonaThread',
  tableName: 'persona_threads',
  columns: {
    id: {
      primary: true,
      type: 'integer' // Using integer assuming Discord IDs fit, adjust if using snowflakes directly might need 'bigint' or 'text'
    },
    name: {
      type: 'text',
      nullable: false
    },
    // Removed 'persona' column
    description: { // New field
      type: 'text',
      nullable: false
    },
    personality: { // New field
      type: 'text',
      nullable: false
    },
     first_message: { // New field
      type: 'text',
      nullable: false
    },
    scenario: { // New field
      type: 'text',
      nullable: true // Optional field
    },
    history: {
      type: 'text', // Storing as JSON string
      nullable: false,
      transformer: {
        to: (value) => JSON.stringify(value),
        from: (value) => JSON.parse(value)
      }
    },
    system_context: {
      type: 'text',
      nullable: false
    },
    channel_id: {
      type: 'integer', // Consider 'text' or 'bigint' if IDs exceed integer limits
      nullable: false
    },
    guild_id: {
      type: 'integer', // Consider 'text' or 'bigint'
      nullable: true
    },
    created_by: {
      type: 'integer', // Consider 'text' or 'bigint'
      nullable: false
    },
    created_at: {
      type: 'text', // Consider 'datetime' or 'timestamp' depending on DB and TypeORM config
      nullable: false
    },
    avatar_url: {
      type: 'text',
      nullable: false
    }
  },
  indices: [
    { columns: ['created_by'] },
    { columns: ['guild_id'] },
    { columns: ['channel_id'] },
    { columns: ['created_at'] }
  ]
});