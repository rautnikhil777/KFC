const mongoose = require('mongoose')

const CartItemSchema = new mongoose.Schema({
  menuItemId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  notes: { type: String, default: '' },
}, { _id: false })

const CartSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
  items: { type: [CartItemSchema], default: [] },
}, { timestamps: true })

const Cart = mongoose.model('Cart', CartSchema)

module.exports = { Cart }

