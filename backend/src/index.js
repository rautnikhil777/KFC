const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const morgan = require('morgan')

dotenv.config()

const { buildApp } = require('./server')

async function main() {
  const app = express()

  // Middleware
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(morgan('dev'))

  // Connect DB (optional)
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    console.warn('[backend] MONGODB_URI not set; continuing in fallback mode (dummy data)')
  } else {
    try {
      await mongoose.connect(mongoUri)
      console.log('[backend] Connected to MongoDB')
    } catch (e) {
      console.warn('[backend] MongoDB connection failed; continuing in fallback mode:', e.message)
    }
  }

  buildApp(app)

  const port = process.env.PORT || 10000
  app.listen(port, () => {
    console.log(`[backend] Listening on :${port}`)
  })
}

main().catch((e) => {
  console.error('[backend] Fatal startup error:', e)
  process.exit(1)
})


