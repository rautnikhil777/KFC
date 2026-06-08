const express = require('express')
const { Session } = require('../models/Session')
const { resolveTableForSession } = require('../services/tableResolver')

const router = express.Router()

// Frontend contract:
// POST /api/session/createOrResume
router.post('/createOrResume', async (req, res) => {

  const { language, mode } = req.body || {}
  if (!mode || !['voice', 'touch'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be voice or touch' })
  }

  // Session is created fresh for Phase 1
  const session = new Session({
    language: language || 'en',
    mode,
    table: { label: null, source: null },
  })

  await session.save()

  // Resolve table via session/config (future QR linking-ready)
  const resolved = await resolveTableForSession({ session })
  session.table = resolved.table
  await session.save()

  return res.json({ sessionId: session._id.toString(), table: session.table, language: session.language, mode: session.mode })
})

router.post('/session/resume', async (req, res) => {
  const { sessionId } = req.body || {}
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const session = await Session.findById(sessionId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  return res.json({ sessionId: session._id.toString(), table: session.table, language: session.language, mode: session.mode })
})

module.exports = router

