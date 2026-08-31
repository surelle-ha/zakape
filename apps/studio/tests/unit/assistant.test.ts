import { describe, expect, it } from 'vitest'
import { validateProposal } from '~/composables/useAiAssistant'

describe('assistant proposal validation', () => {
  it('accepts the bounded edit language', () => {
    const proposal = validateProposal(
      {
        summary: 'Add a small highlight.',
        operations: [
          { type: 'set_pixels', pixels: [{ x: 2, y: 3, color: '#FFD36A' }] },
          { type: 'outline_rect', x: 4, y: 4, width: 3, height: 3, color: '#ff875f' },
        ],
      },
      16,
      16,
    )

    expect(proposal.operations).toHaveLength(2)
    expect(proposal.operations[0]).toMatchObject({
      type: 'set_pixels',
      pixels: [{ x: 2, y: 3, color: '#ffd36a' }],
    })
  })

  it('rejects out-of-bounds edits', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Escape the canvas.',
          operations: [{ type: 'set_pixels', pixels: [{ x: 32, y: 1, color: '#fff' }] }],
        },
        16,
        16,
      ),
    ).toThrow(/out-of-bounds/)
  })

  it('rejects unknown operations', () => {
    expect(() =>
      validateProposal(
        { summary: 'Run code.', operations: [{ type: 'shell', command: 'whoami' }] },
        16,
        16,
      ),
    ).toThrow(/Unsupported/)
  })
})
