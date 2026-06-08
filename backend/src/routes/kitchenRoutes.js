const express = require('express')
const { Order } = require('../models/Order')

const router = express.Router()

router.post('/kitchen/send', async (req, res) => {
  const { orderId } = req.body || {}
  if (!orderId) return res.status(400).json({ error: 'orderId required' })

  const order = await Order.findById(orderId)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  if (order.status === 'sent_to_kitchen' || order.status === 'preparing' || order.status === 'ready' || order.status === 'paid' || order.status === 'closed') {
    return res.json({ ok: true, status: order.status })
  }

  order.status = 'sent_to_kitchen'
  order.events.push({ type: 'sent_to_kitchen', at: new Date(), detail: 'Sent to kitchen' })

  await order.save()
  res.json({ ok: true, status: order.status })
})

router.get('/kitchen/orders', async (req, res) => {
  const orders = await Order.find({ status: { $in: ['sent_to_kitchen', 'preparing', 'ready'] } })
    .sort({ createdAt: -1 })
    .limit(50)

  res.json({ orders: orders.map((o) => ({
    orderId: o._id.toString(),
    status: o.status,
    table: o.table,
    items: o.items,
    billing: o.billing,
    language: o.language,
    mode: o.mode,
    events: o.events,
  })) })
})

module.exports = router

