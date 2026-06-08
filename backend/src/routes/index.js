const express = require('express')

const sessionRoutes = require('./sessionRoutes')
const menuRoutes = require('./menuRoutes')
const cartRoutes = require('./cartRoutes')
const orderRoutes = require('./orderRoutes')
const kitchenRoutes = require('./kitchenRoutes')
const paymentRoutes = require('./paymentRoutes')

const router = express.Router()

// Frontend contract (mounted at /api in server.js)
router.use('/session', sessionRoutes)   // /api/session/*
router.use('/menu', menuRoutes)         // /api/menu
router.use('/cart', cartRoutes)         // (if used)
router.use('/order', orderRoutes)       // /api/order/confirm
router.use('/kitchen', kitchenRoutes)   // /api/kitchen/send, /api/kitchen/orders
router.use('/payment', paymentRoutes)    // /api/payment/*

module.exports = { router }

