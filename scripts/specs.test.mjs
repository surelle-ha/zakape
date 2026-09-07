import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const cli = resolve('scripts/specs.mjs')
const idPattern = /^[A-Z][A-Z0-9]{1,7}-[A-HJKMNP-TV-Z2-9]{4}$/
const headings = {
  spec: [
    'Problem and evidence',
    'Desired outcome',
    'User journeys',
    'Functional requirements',
    'Acceptance criteria',
    'Edge cases and failure behavior',
    'Constraints',
    'Assumptions',
    'Out of scope',
    'Clarification record',
    'Dependencies',
    'Open questions',
  ],
  plan: [
    'Codebase and history evidence',
    'Proposed approach',
    'Architecture and data flow',
    'Affected files',
    'Contracts and migrations',
    'Dependencies and sequence',
    'Risks and mitigations',
    'Validation strategy',
    'Rollout and recovery',
  ],
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'zakape-specs-'))
  const specsRoot = join(root, 'docs', 'specs')
  mkdirSync(join(specsRoot, 'records'), { recursive: true })
  mkdirSync(join(specsRoot, '_templates'), { recursive: true })
  writeFileSync(
    join(specsRoot, 'system.json'),
    JSON.stringify({
      schemaVersion: 1,
      idPattern: '^[A-Z][A-Z0-9]{1,7}-[A-HJKMNP-TV-Z2-9]{4}$',
      statuses: [
        'clarifying',
        'specified',
        'planning',
        'planned',
        'in_progress',
        'blocked',
        'completed',
        'cancelled',
      ],
      dependencyTypes: ['critical', 'advisory'],
      recordsDirectory: 'docs/specs/records',
      memoryDirectory: 'docs/project-memory',
    }),
  )
  for (const [name, list] of Object.entries(headings)) {
    const filename = name === 'spec' ? 'spec.md' : 'plan.md'
    writeFileSync(
      join(specsRoot, '_templates', filename),
      `# {{ID}} — {{TITLE}}\n\n${list.map((item) => `## ${item}\n\n<!-- fill -->`).join('\n\n')}\n`,
    )
  }
  writeFileSync(
    join(specsRoot, '_templates', 'tasks.md'),
    '# {{ID}} tasks\n\n- [ ] T01 — Implement behavior. (AC-1)\n',
  )
  return root
}

function invoke(root, ...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: resolve('.'),
    env: { ...process.env, ZAKAPE_SPEC_ROOT: root },
    encoding: 'utf8',
  })
}

function completeMarkdown(id, title) {
  const spec = `# ${id} — ${title}\n\n${headings.spec.map((heading) => `## ${heading}\n\n${heading === 'Open questions' ? 'None.' : 'Concrete project evidence and an observable decision.'}`).join('\n\n')}\n`
  const plan = `# ${id} implementation plan\n\n${headings.plan.map((heading) => `## ${heading}\n\n${['Contracts and migrations', 'Dependencies and sequence', 'Rollout and recovery'].includes(heading) ? 'None.' : 'Concrete implementation evidence and planned behavior.'}`).join('\n\n')}\n`
  return { spec, plan }
}

function addRecord(root, id, options = {}) {
  const directory = join(root, 'docs', 'specs', 'records', id)
  mkdirSync(directory, { recursive: true })
  const now = new Date().toISOString()
  const title = options.title || `Feature ${id}`
  const record = {
    schemaVersion: 1,
    id,
    title,
    area: id.split('-')[0],
    status: options.status || 'planned',
    summary: 'A sufficiently detailed feature summary.',
    createdAt: now,
    updatedAt: now,
    clarification: {
      questions: [
        {
          question: 'What outcome is required?',
          answer: 'Observable behavior.',
          decision: 'Test it.',
        },
      ],
      openQuestions: [],
    },
    dependencies: options.dependencies || [],
    affectedFiles: ['src/feature.ts'],
    risks: ['Regression risk'],
    validation: ['Run focused tests'],
    validationEvidence: options.evidence || [],
    overrides: [],
  }
  const markdown = completeMarkdown(id, title)
  writeFileSync(join(directory, 'spec.json'), `${JSON.stringify(record, null, 2)}\n`)
  writeFileSync(join(directory, 'spec.md'), markdown.spec)
  writeFileSync(join(directory, 'plan.md'), markdown.plan)
  writeFileSync(
    join(directory, 'tasks.md'),
    options.checked
      ? '# tasks\n\n- [x] T01 — Implement behavior. (AC-1)\n'
      : '# tasks\n\n- [ ] T01 — Implement behavior. (AC-1)\n',
  )
  writeFileSync(join(directory, 'history.ndjson'), '')
  return record
}

function readRecord(root, id) {
  return JSON.parse(readFileSync(join(root, 'docs', 'specs', 'records', id, 'spec.json'), 'utf8'))
}

test('specify generates unique nonsequential IDs and discovery needs no current pointer', () => {
  const root = fixture()
  const first = invoke(
    root,
    'specify',
    '--area',
    'AUTH',
    '--title',
    'First session',
    '--summary',
    'Define the first independent session behavior.',
  )
  const second = invoke(
    root,
    'specify',
    '--area',
    'AUTH',
    '--title',
    'Second session',
    '--summary',
    'Define another independent session behavior.',
  )
  assert.equal(first.status, 0, first.stderr)
  assert.equal(second.status, 0, second.stderr)
  const ids = readdirSync(join(root, 'docs', 'specs', 'records'))
  assert.equal(ids.length, 2)
  assert.ok(ids.every((id) => idPattern.test(id)))
  assert.notEqual(ids[0], ids[1])
  assert.equal(new Set(ids.map((id) => id.slice(-4))).size, 2)
  const status = invoke(root, 'status')
  assert.equal(status.status, 0)
  assert.ok(ids.every((id) => status.stdout.includes(id)))
})

test('specification and planning finalize only after their combined artifacts are complete', () => {
  const root = fixture()
  assert.equal(
    invoke(
      root,
      'specify',
      '--area',
      'UI',
      '--title',
      'Focused workspace',
      '--summary',
      'Define a focused workspace with recoverable behavior.',
    ).status,
    0,
  )
  const [id] = readdirSync(join(root, 'docs', 'specs', 'records'))
  const premature = invoke(root, 'specify', id, '--finalize')
  assert.notEqual(premature.status, 0)
  assert.match(premature.stderr, /Specification is not ready/)

  const directory = join(root, 'docs', 'specs', 'records', id)
  const record = readRecord(root, id)
  record.clarification = {
    questions: [
      {
        question: 'How should interrupted work recover?',
        answer: 'Restore the last durable state.',
        decision: 'Test restart recovery.',
      },
    ],
    openQuestions: [],
  }
  writeFileSync(join(directory, 'spec.json'), `${JSON.stringify(record, null, 2)}\n`)
  writeFileSync(join(directory, 'spec.md'), completeMarkdown(id, record.title).spec)
  assert.equal(invoke(root, 'specify', id, '--finalize').status, 0)
  assert.equal(readRecord(root, id).status, 'specified')

  assert.equal(invoke(root, 'plan', id).status, 0)
  const unplanned = invoke(root, 'plan', id, '--finalize')
  assert.notEqual(unplanned.status, 0)
  assert.match(unplanned.stderr, /Plan is not ready/)

  const planning = readRecord(root, id)
  planning.affectedFiles = ['src/workspace.ts']
  planning.risks = ['Restart regression']
  planning.validation = ['Run restart recovery tests']
  writeFileSync(join(directory, 'spec.json'), `${JSON.stringify(planning, null, 2)}\n`)
  writeFileSync(join(directory, 'plan.md'), completeMarkdown(id, record.title).plan)
  assert.equal(invoke(root, 'plan', id, '--finalize').status, 0)
  assert.equal(readRecord(root, id).status, 'planned')
})

test('critical dependencies block implementation by default', () => {
  const root = fixture()
  addRecord(root, 'CORE-K7M2')
  addRecord(root, 'AUTH-P9TX', {
    dependencies: [
      { id: 'CORE-K7M2', type: 'critical', reason: 'Requires the unfinished core contract.' },
    ],
  })
  const result = invoke(root, 'implement', 'AUTH-P9TX')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Blocked by critical dependencies/)
  assert.equal(readRecord(root, 'AUTH-P9TX').status, 'planned')
})

test('advisory dependencies warn without blocking', () => {
  const root = fixture()
  addRecord(root, 'CORE-K7M2')
  addRecord(root, 'UI-P9TX', {
    dependencies: [
      {
        id: 'CORE-K7M2',
        type: 'advisory',
        reason: 'Shared visual conventions are still evolving.',
      },
    ],
  })
  const result = invoke(root, 'implement', 'UI-P9TX')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /advisory dependency/)
  assert.equal(readRecord(root, 'UI-P9TX').status, 'in_progress')
})

test('critical override requires and records a reason', () => {
  const root = fixture()
  addRecord(root, 'CORE-K7M2')
  addRecord(root, 'AUTH-P9TX', {
    dependencies: [
      { id: 'CORE-K7M2', type: 'critical', reason: 'Requires the unfinished core contract.' },
    ],
  })
  const result = invoke(
    root,
    'implement',
    'AUTH-P9TX',
    '--override',
    '--reason',
    'A compatible local adapter safely isolates the unfinished contract.',
  )
  assert.equal(result.status, 0, result.stderr)
  const record = readRecord(root, 'AUTH-P9TX')
  assert.equal(record.status, 'in_progress')
  assert.equal(record.overrides.length, 1)
  assert.deepEqual(record.overrides[0].dependencies, ['CORE-K7M2'])
  assert.match(
    readFileSync(join(root, 'docs', 'specs', 'records', 'AUTH-P9TX', 'history.ndjson'), 'utf8'),
    /dependency_override/,
  )
})

test('validation detects missing dependencies and graph cycles', () => {
  const missingRoot = fixture()
  addRecord(missingRoot, 'UI-K7M2', {
    dependencies: [
      { id: 'CORE-P9TX', type: 'critical', reason: 'The missing contract is required.' },
    ],
  })
  const missing = invoke(missingRoot, 'validate')
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /missing dependency CORE-P9TX/)

  const cycleRoot = fixture()
  addRecord(cycleRoot, 'UI-K7M2', {
    dependencies: [
      { id: 'CORE-P9TX', type: 'critical', reason: 'Core behavior is required first.' },
    ],
  })
  addRecord(cycleRoot, 'CORE-P9TX', {
    dependencies: [
      { id: 'UI-K7M2', type: 'advisory', reason: 'UI feedback informs the core behavior.' },
    ],
  })
  const cycle = invoke(cycleRoot, 'validate')
  assert.notEqual(cycle.status, 0)
  assert.match(cycle.stderr, /Dependency cycle/)
})

test('completion requires checked tasks and validation evidence', () => {
  const root = fixture()
  addRecord(root, 'UI-K7M2', { status: 'in_progress' })
  const unchecked = invoke(root, 'implement', 'UI-K7M2', '--complete')
  assert.notEqual(unchecked.status, 0)
  assert.match(unchecked.stderr, /unchecked tasks remain/)

  writeFileSync(
    join(root, 'docs', 'specs', 'records', 'UI-K7M2', 'tasks.md'),
    '# tasks\n\n- [x] T01 — Implement behavior. (AC-1)\n',
  )
  const noEvidence = invoke(root, 'implement', 'UI-K7M2', '--complete')
  assert.notEqual(noEvidence.status, 0)
  assert.match(noEvidence.stderr, /record validation evidence/)

  assert.equal(
    invoke(root, 'evidence', 'UI-K7M2', '--note', 'Focused unit tests passed.').status,
    0,
  )
  const completed = invoke(root, 'implement', 'UI-K7M2', '--complete')
  assert.equal(completed.status, 0, completed.stderr)
  assert.equal(readRecord(root, 'UI-K7M2').status, 'completed')
})

test('resume reports each pending spec independently and identifies blockers', () => {
  const root = fixture()
  addRecord(root, 'CORE-K7M2')
  addRecord(root, 'UI-P9TX')
  addRecord(root, 'AUTH-W4RD', {
    dependencies: [
      { id: 'CORE-K7M2', type: 'critical', reason: 'Core session behavior is required.' },
    ],
  })
  const result = invoke(root, 'resume')
  assert.equal(result.status, 0)
  assert.match(result.stdout, /UI-P9TX.*viable/)
  assert.match(result.stdout, /AUTH-W4RD.*blocked by CORE-K7M2/)
})
