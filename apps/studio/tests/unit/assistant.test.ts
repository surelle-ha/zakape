import { describe, expect, it } from 'vitest'
import {
  createAssistantMessages,
  createOllamaChatBody,
  mapOllamaError,
  normalizeCompatibleModels,
  normalizeOllamaBaseUrl,
  normalizeOllamaModels,
  readCompatibleChatContent,
  readOllamaChatContent,
  validateProposal,
} from '~/composables/useAiAssistant'
import { createDemoProject } from '~/utils/project'

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

describe('Ollama provider adapter', () => {
  it('accepts loopback URLs and rejects remote hosts or arbitrary paths', () => {
    expect(normalizeOllamaBaseUrl('http://localhost:11434/')).toBe('http://localhost:11434')
    expect(normalizeOllamaBaseUrl('http://[::1]:11434')).toBe('http://[::1]:11434')
    expect(() => normalizeOllamaBaseUrl('http://192.168.1.20:11434')).toThrow(/loopback/)
    expect(() => normalizeOllamaBaseUrl('https://models.example.com')).toThrow(/loopback/)
    expect(() => normalizeOllamaBaseUrl('http://127.0.0.1:11434/v1')).toThrow(/loopback/)
  })

  it('normalizes installed Ollama models and compatible model lists', () => {
    expect(
      normalizeOllamaModels({
        models: [
          { name: 'zeta:latest', size: 42 },
          { model: 'alpha:7b', modified_at: '2026-08-31T10:00:00Z' },
          { name: '' },
        ],
      }),
    ).toEqual([
      { id: 'alpha:7b', modifiedAt: '2026-08-31T10:00:00Z' },
      { id: 'zeta:latest', size: 42 },
    ])
    expect(normalizeCompatibleModels({ data: [{ id: 'provider/model' }] })).toEqual([
      { id: 'provider/model' },
    ])
  })

  it('builds a non-streaming JSON chat request and reads provider responses', () => {
    const project = createDemoProject()
    const messages = createAssistantMessages(
      'Add one highlight.',
      project,
      project.frames[0]!.id,
      project.layers[0]!.name,
    )
    const body = createOllamaChatBody('qwen2.5-coder:7b', messages)

    expect(body).toMatchObject({
      model: 'qwen2.5-coder:7b',
      stream: false,
      format: 'json',
      options: { temperature: 0.2 },
    })
    expect(messages[1]!.content).toContain('Add one highlight.')
    expect(readOllamaChatContent({ message: { content: '{"operations":[]}' } })).toBe(
      '{"operations":[]}',
    )
    expect(
      readCompatibleChatContent({ choices: [{ message: { content: '{"summary":"ok"}' } }] }),
    ).toBe('{"summary":"ok"}')
  })

  it('turns local runtime failures into actionable guidance', () => {
    expect(mapOllamaError(new TypeError('Failed to fetch'), 'http://127.0.0.1:11434')).toBe(
      'Ollama is not running at http://127.0.0.1:11434. Start Ollama, then try again.',
    )
    expect(mapOllamaError(new Error('request timeout'), 'http://127.0.0.1:11434')).toMatch(
      /did not respond in time/,
    )
    expect(
      mapOllamaError(new Error('model not found'), 'http://127.0.0.1:11434', 'tinyllama'),
    ).toMatch(/tinyllama is not installed/)
  })
})
