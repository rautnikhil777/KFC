const express = require('express')
const { MENU } = require('../services/menu')

const router = express.Router()

router.get('/menu', async (req, res) => {
  res.json({ categories: MENU })
})

module.exports = router

