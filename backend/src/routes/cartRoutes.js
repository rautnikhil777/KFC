const express = require('express')
const { Cart } = require('../models/Cart')

const router = express.Router()

router.post('/cart/add', async (req, res) => {
  const { sessionId, item } = req.body || {}
  if (!sessionId || !item || !item.menuItemId) return res.status(400).json({ error: 'sessionId and item(menuItemId) required' })

  let cart = await Cart.findOne({ sessionId })
  if (!cart) cart = new Cart({ sessionId, items: [] })

  const existing = cart.items.find((x) => x.menuItemId === item.menuItemId && x.name === item.name)
  if (existing) existing.quantity += Number(item.quantity || 1)
  else cart.items.push({
    menuItemId: item.menuItemId,
    name: item.name,
    price: Number(item.price || 0),
    category: item.category,
    quantity: Number(item.quantity || 1),
    notes: item.notes || '',
  })

  await cart.save()
  res.json({ items: cart.items })
})

router.post('/cart/remove', async (req, res) => {
  const { sessionId, menuItemId, name } = req.body || {}
  if (!sessionId || !menuItemId || !name) return res.status(400).json({ error: 'sessionId, menuItemId and name required' })
  const cart = await Cart.findOne({ sessionId })
  if (!cart) return res.json({ items: [] })

  cart.items = cart.items.filter((x) => !(x.menuItemId === menuItemId && x.name === name))
  await cart.save()
  res.json({ items: cart.items })
})

router.post('/cart/set', async (req, res) => {
  const { sessionId, items } = req.body || {}
  if (!sessionId || !Array.isArray(items)) return res.status(400).json({ error: 'sessionId and items[] required' })
  const cart = await Cart.findOneAndUpdate({ sessionId }, { items }, { upsert: true, new: true })
  res.json({ items: cart.items })
})

router.get('/cart/:sessionId', async (req, res) => {
  const { sessionId } = req.params
  const cart = await Cart.findOne({ sessionId })
  res.json({ items: cart ? cart.items : [] })
})

module.exports = router

