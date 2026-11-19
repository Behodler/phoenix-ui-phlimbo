import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Cuer } from 'cuer'
import { create } from 'cuer/QrCode'

/**
 * Regression test for the WalletConnect QR crash (story 101).
 *
 * RainbowKit renders the WalletConnect QR with `<Cuer.Root value={uri}>` from
 * `cuer@0.0.3`, which calls `encodeQR(value, 'raw', { border: 0, ... })` from
 * `qr`. `qr@0.6.0` and later throw `invalid border=0`, which crashed the
 * connect modal. package.json pins `cuer/qr` to a version that accepts a zero
 * border. This test drives the real cuer → qr path (no mocks), so it fails if
 * the pin is removed while RainbowKit still ships cuer@0.0.3.
 */
const WALLETCONNECT_URI =
  'wc:7f6e504bfad60b485450578e05678ed3e8e8c4751d3c6160be17160d63ec90f9@2' +
  '?relay-protocol=irn' +
  '&symKey=587d5484ce2a2a6ee3ba1962fdd7e8588e06200c46823bd18fbd67def96ad303' +
  '&expiryTimestamp=1732000000'

describe('WalletConnect QR code (cuer → qr)', () => {
  it('encodes a WalletConnect URI without throwing', () => {
    const qr = create(WALLETCONNECT_URI)
    expect(qr.edgeLength).toBeGreaterThan(0)
    expect(qr.grid).toHaveLength(qr.edgeLength)
    expect(qr.grid[0]).toHaveLength(qr.edgeLength)
  })

  it('renders Cuer.Root the way RainbowKit does', () => {
    const { container } = render(
      <Cuer.Root value={WALLETCONNECT_URI} size={200} errorCorrection="medium">
        <Cuer.Finder />
        <Cuer.Cells />
      </Cuer.Root>,
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/)
    expect(container.querySelectorAll('path, rect').length).toBeGreaterThan(0)
  })
})
