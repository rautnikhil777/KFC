const express = require('express')

const { router: apiRouter } = require('./routes')

function buildApp(app) {
  // Middleware
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  /* ================= HEALTH ================= */
  app.get('/health', (req, res) => {
    res.json({ ok: true, message: 'Server running fine' })
  })

  /* ================= API ================= */
  app.use('/api', apiRouter)

  /* ================= 404 ================= */
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' })
  })

  return app
}

module.exports = { buildApp }


