// Table resolution logic.
// Phase 1 uses configurable session/config.
// Future-ready: QR-based linking structure is present and can be enabled later.

const DEFAULT_TABLE = process.env.DEFAULT_TABLE_LABEL || 'T-1'
const QR_SOURCE = 'qr'

async function resolveTableForSession({ session }) {
  const qrLinkingEnabled = String(process.env.QR_LINKING_ENABLED || 'false') === 'true'

  // Future-ready placeholder implementation: if QR is enabled, you would resolve
  // based on QR payload stored on session (not implemented in Phase 1).
  // For now: always resolve from config.

  const resolved = {
    table: {
      label: DEFAULT_TABLE,
      source: qrLinkingEnabled ? QR_SOURCE : 'config',
    },
  }

  return resolved
}

module.exports = { resolveTableForSession }

