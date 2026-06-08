const mongoose = require('mongoose')

const SessionSchema = new mongoose.Schema({
  language: { type: String, default: 'en' },
  mode: { type: String, enum: ['voice', 'touch'], required: true },
  table: {
    label: { type: String, default: null },
    source: { type: String, default: null },
  },
}, { timestamps: true })

const Session = mongoose.model('Session', SessionSchema)

module.exports = { Session }

