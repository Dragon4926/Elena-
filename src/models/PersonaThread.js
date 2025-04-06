const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'PersonaThread',
  tableName: 'persona_threads',
  columns: {
    id: {
      primary: true,
      type: 'integer'
    },
    name: {
      type: 'text',
      nullable: false
    },
    persona: {
      type: 'text',
      nullable: false
    },
    history: {
      type: 'text',
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
      type: 'integer',
      nullable: false
    },
    guild_id: {
      type: 'integer',
      nullable: true
    },
    created_by: {
      type: 'integer',
      nullable: false
    },
    created_at: {
      type: 'text',
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