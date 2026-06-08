const mongoose = require('mongoose')

const OrderItemSchema = new mongoose.Schema({
  menuItemId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  notes: { type: String, default: '' },
}, { _id: false })

const OrderSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  table: {
    label: { type: String, default: null },
    source: { type: String, default: null },
  },
  mode: { type: String, enum: ['voice', 'touch'], default: null },
  language: { type: String, default: 'en' },

  items: { type: [OrderItemSchema], default: [] },

  status: {
    type: String,
    enum: ['confirmed', 'sent_to_kitchen', 'preparing', 'ready', 'paid', 'closed'],
    default: 'confirmed',
    index: true,
  },

  billing: {
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },

  events: {
    type: [
      {
        type: { type: String, required: true },
        at: { type: Date, default: Date.now },
        detail: { type: String, default: '' },
      },
    ],
    default: [],
  },
}, { timestamps: true })

const Order = mongoose.model('Order', OrderSchema)

module.exports = { Order }

