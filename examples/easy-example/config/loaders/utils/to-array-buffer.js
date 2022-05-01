'use strict'

module.exports = function (base64Data) {
  const isBrowser = typeof window !== 'undefined' && typeof window.atob === 'function'
  const binary = isBrowser ? window.atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; ++i) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}
