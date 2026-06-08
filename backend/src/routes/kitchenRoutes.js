const express = require('express')
const router = express.Router()

const { Order } = require('../models/Order')

/**
 * SEND ORDER TO KITCHEN
 * POST /api/kitchen/send
 */
router.post('/send', async (req, res) => {
  try {
    const { orderId } = req.body || {}

    if (!orderId) {
      return res.status(400).json({ error: 'orderId required' })
    }

    console.log('[KITCHEN SEND] orderId=', orderId)

    const order = await Order.findById(orderId)

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // already processed
    if (['sent_to_kitchen', 'preparing', 'ready', 'paid', 'closed'].includes(order.status)) {
      return res.json({ ok: true, status: order.status })
    }

    order.status = 'sent_to_kitchen'

    order.events = order.events || []
    order.events.push({
      type: 'sent_to_kitchen',
      at: new Date(),
      detail: 'Sent to kitchen'
    })

    await order.save()

    console.log('[KITCHEN SEND] updated orderId=', order._id.toString(), 'status=', order.status)

    return res.json({
      ok: true,
      status: order.status,
      orderId: order._id.toString()
    })

  } catch (err) {
    console.error('[KITCHEN SEND ERROR]', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

/**
 * GET KITCHEN ORDERS
 * GET /api/kitchen/orders
 */
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({
      status: { $in: ['sent_to_kitchen', 'preparing', 'ready', 'confirmed'] }
    }).sort({ createdAt: -1 })

    console.log('[KITCHEN FETCH] returning orders count=', orders.length)

    return res.json({
      success: true,
      orders: orders.map(o => ({
        orderId: o._id.toString(),
        status: o.status,
        table: o.table,
        items: o.items,
        billing: o.billing,
        language: o.language,
        mode: o.mode,
        events: o.events
      }))
    })

  } catch (err) {
    console.error('[KITCHEN FETCH ERROR]', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router