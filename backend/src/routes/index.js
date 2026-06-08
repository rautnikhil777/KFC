const express = require('express')

const sessionRoutes = require('./sessionRoutes')
const menuRoutes = require('./menuRoutes')
const cartRoutes = require('./cartRoutes')
const orderRoutes = require('./orderRoutes')
const kitchenRoutes = require('./kitchenRoutes')
const paymentRoutes = require('./paymentRoutes')

const router = express.Router()

router.use(sessionRoutes)
router.use(menuRoutes)
router.use(cartRoutes)
router.use(orderRoutes)
router.use(kitchenRoutes)
router.use(paymentRoutes)

module.exports = { router }

