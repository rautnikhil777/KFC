const express = require('express')
const { Order } = require('../models/Order')
const { Cart } = require('../models/Cart')

const router = express.Router()

function computeTotals(items) {
  const subtotal = items.reduce((acc, x) => acc + Number(x.price || 0) * Number(x.quantity || 0), 0)
  const taxRate = Number(process.env.TAX_RATE || 0.05)
  const tax = subtotal * taxRate
  const total = subtotal + tax
  return { subtotal, tax, total }
}

router.post('/order/confirm', async (req, res) => {
  const { sessionId, cartItems } = req.body || {}
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const items = Array.isArray(cartItems) ? cartItems : null
  if (!items || items.length === 0) return res.status(400).json({ error: 'cartItems required' })

  // Ensure we ALWAYS include table info by resolving from session's stored table
  const order = new Order({
    sessionId,
    table: null,
    mode: null,
    language: null,
    items,
    status: 'confirmed',
    events: [],
  })

  // Fetch session to attach table info
  const { Session } = require('../models/Session')
  const session = await Session.findById(sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  order.table = session.table
  order.mode = session.mode
  order.language = session.language

  const totals = computeTotals(items)
  order.billing = totals

  order.events.push({ type: 'confirmed', at: new Date(), detail: 'Order confirmed' })

  await order.save()

  // Clear cart
  await Cart.findOneAndUpdate({ sessionId }, { items: [] }, { upsert: true })

  return res.json({ orderId: order._id.toString(), table: order.table, total: order.billing.total })
})

router.get('/order/:orderId', async (req, res) => {
  const { orderId } = req.params
  const order = await Order.findById(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  return res.json({
    orderId: order._id.toString(),
    status: order.status,
    items: order.items,
    table: order.table,
    mode: order.mode,
    language: order.language,
    billing: order.billing,
    events: order.events,
  })
})

module.exports = router

