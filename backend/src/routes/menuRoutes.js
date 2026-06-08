const express = require('express')
const { MENU } = require('../services/menu')

const router = express.Router()

// Mounted at /api/menu in routes/index.js
router.get('/', async (req, res) => {
  res.json({ categories: MENU })
})


module.exports = router

