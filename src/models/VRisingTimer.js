const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'VRisingTimer',
  tableName: 'vrising_timers',
  columns: {
    id: {
      primary: true,
      type: 'text'
    },
    end_time: {
      type: 'text',
      nullable: false
    },
    channel_id: {
      type: 'integer',
      nullable: false
    },
    castle_level: {
      type: 'integer',
      nullable: false
    }
  }
});