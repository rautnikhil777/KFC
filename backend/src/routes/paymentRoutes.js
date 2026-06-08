const express = require('express')
const { Order } = require('../models/Order')

const router = express.Router()

router.post('/payment/dummy', async (req, res) => {
  const { orderId } = req.body || {}
  if (!orderId) return res.status(400).json({ error: 'orderId required' })

  const order = await Order.findById(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  order.status = 'paid'
  order.events.push({ type: 'paid', at: new Date(), detail: 'Dummy QR payment confirmed' })

  // Optional auto-close
  order.events.push({ type: 'closed', at: new Date(), detail: 'Session closed' })
  order.status = 'closed'

  await order.save()

  res.json({ ok: true, status: order.status, bill: order.billing })
})

module.exports = router

