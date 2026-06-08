const express = require('express')
const router = express.Router()

const { Order } = require('../models/Order')
const { Cart } = require('../models/Cart')
const { Session } = require('../models/Session')

// ---- BILL CALCULATION ----
function computeTotals(items) {
  const subtotal = items.reduce((acc, x) => {
    return acc + Number(x.price || 0) * Number(x.quantity || 0)
  }, 0)

  const taxRate = Number(process.env.TAX_RATE || 0.05)
  const tax = subtotal * taxRate
  const total = subtotal + tax

  return { subtotal, tax, total }
}

/**
 * ✅ FIXED ROUTE:
 * POST /api/order/confirm
 */
router.post('/confirm', async (req, res) => {
  try {
    const { sessionId, cartItems } = req.body || {}

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' })
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'cartItems required' })
    }

    // Get session
    const session = await Session.findById(sessionId)

    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const totals = computeTotals(cartItems)

    console.log('[ORDER CONFIRM] sessionId=', sessionId, 'cartItems=', cartItems)

    // Create order
    const order = await Order.create({
      sessionId,
      table: session.table,
      mode: session.mode,
      language: session.language,
      items: cartItems,
      status: 'confirmed',
      billing: totals,
      events: [
        {
          type: 'confirmed',
          at: new Date(),
          detail: 'Order confirmed'
        }
      ]
    })

    // Clear cart safely AFTER order success
    await Cart.findOneAndUpdate(
      { sessionId },
      { items: [] },
      { upsert: true }
    )

    console.log('[ORDER CONFIRM] created orderId=', order._id.toString(), 'status=', order.status, 'table=', order.table)

    return res.json({
      success: true,
      orderId: order._id.toString(),
      table: order.table,
      total: totals.total
    })

  } catch (err) {
    console.error('[ORDER CONFIRM ERROR]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET ORDER STATUS
 * /api/order/:orderId
 */
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    return res.json({
      orderId: order._id.toString(),
      status: order.status,
      items: order.items,
      table: order.table,
      mode: order.mode,
      language: order.language,
      billing: order.billing,
      events: order.events
    })

  } catch (err) {
    console.error('[ORDER GET ERROR]', err)
    return res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router