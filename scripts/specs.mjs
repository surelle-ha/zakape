#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SYSTEM = {
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
}
const SUFFIX_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
const SECTION_NAMES = {
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
const TRANSITIONS = {
  clarifying: ['specified', 'cancelled'],
  specified: ['planning', 'cancelled'],
  planning: ['planned', 'blocked', 'cancelled'],
  planned: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['completed', 'blocked', 'cancelled'],
  blocked: ['planning', 'planned', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
}

export function createContext(rootOverride = process.env.ZAKAPE_SPEC_ROOT) {
  const root = resolve(rootOverride || join(dirname(fileURLToPath(import.meta.url)), '..'))
  const systemPath = join(root, 'docs', 'specs', 'system.json')
  const system = existsSync(systemPath)
    ? JSON.parse(readFileSync(systemPath, 'utf8'))
    : DEFAULT_SYSTEM
  return {
    root,
    system,
    specsRoot: join(root, 'docs', 'specs'),
    recordsRoot: join(root, ...system.recordsDirectory.split('/')),
  }
}

function parseArgs(argv) {
  const positionals = []
  const flags = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) {
      positionals.push(value)
      continue
    }
    const key = value.slice(2)
    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      index += 1
    } else {
      flags[key] = true
    }
  }
  return { positionals, flags }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function specPath(context, id, filename = 'spec.json') {
  return join(context.recordsRoot, id, filename)
}

export function discoverSpecs(context) {
  if (!existsSync(context.recordsRoot)) return []
  return readdirSync(context.recordsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(context.recordsRoot, entry.name, 'spec.json')),
    )
    .map((entry) => readJson(join(context.recordsRoot, entry.name, 'spec.json')))
    .sort((a, b) => a.id.localeCompare(b.id))
}

function loadSpec(context, id) {
  if (!id) throw new Error('A spec ID is required.')
  const path = specPath(context, id.toUpperCase())
  if (!existsSync(path)) throw new Error(`Unknown spec: ${id}`)
  return readJson(path)
}

function saveSpec(context, spec) {
  spec.updatedAt = new Date().toISOString()
  writeJson(specPath(context, spec.id), spec)
}

function currentCommit(context) {
  const gitHead = join(context.root, '.git', 'HEAD')
  if (!existsSync(gitHead)) return null
  const head = readFileSync(gitHead, 'utf8').trim()
  if (!head.startsWith('ref: ')) return head.slice(0, 12)
  const ref = join(context.root, '.git', ...head.slice(5).split('/'))
  return existsSync(ref) ? readFileSync(ref, 'utf8').trim().slice(0, 12) : null
}

function appendHistory(context, specId, event, from, to, note) {
  const record = {
    at: new Date().toISOString(),
    specId,
    event,
    from,
    to,
    note: note || null,
    commit: currentCommit(context),
  }
  appendFileSync(specPath(context, specId, 'history.ndjson'), `${JSON.stringify(record)}\n`)
}

function transition(context, spec, next, event, note) {
  if (!TRANSITIONS[spec.status]?.includes(next))
    throw new Error(`Invalid transition: ${spec.status} -> ${next}`)
  const previous = spec.status
  spec.status = next
  saveSpec(context, spec)
  appendHistory(context, spec.id, event, previous, next, note)
}

function generateId(context, area) {
  const normalized = String(area || '')
    .trim()
    .toUpperCase()
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(normalized)) {
    throw new Error(
      'Area must contain 2-8 uppercase letters or digits and begin with a letter (for example AUTH or UI).',
    )
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const bytes = randomBytes(4)
    const suffix = [...bytes].map((byte) => SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length]).join('')
    const id = `${normalized}-${suffix}`
    if (!existsSync(specPath(context, id))) return id
  }
  throw new Error('Could not generate a unique spec ID.')
}

function template(context, name, replacements) {
  const templatePath = join(context.specsRoot, '_templates', name)
  const fallback =
    name === 'spec.md' ? '# {{ID}} — {{TITLE}}\n' : `# {{ID}} ${name.replace('.md', '')}\n`
  let content = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : fallback
  for (const [key, value] of Object.entries(replacements))
    content = content.replaceAll(`{{${key}}}`, value)
  return content
}

function missingSections(content, names, allowNone = []) {
  return names.filter((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = `${content}\n## __END__`.match(
      new RegExp(`^## ${escaped}\\s*$([\\s\\S]*?)(?=^## )`, 'm'),
    )
    if (!match) return true
    const body = match[1].replace(/<!--[\s\S]*?-->/g, '').trim()
    return body.length === 0 || (!allowNone.includes(name) && /^none[.!]?$/i.test(body))
  })
}

function validateRecordShape(context, spec, directoryId) {
  const errors = []
  const pattern = new RegExp(context.system.idPattern)
  const allowedFields = new Set([
    'schemaVersion',
    'id',
    'title',
    'area',
    'status',
    'summary',
    'createdAt',
    'updatedAt',
    'clarification',
    'dependencies',
    'affectedFiles',
    'risks',
    'validation',
    'validationEvidence',
    'overrides',
    'imported',
  ])
  for (const field of Object.keys(spec)) {
    if (!allowedFields.has(field)) errors.push(`${directoryId}: unknown field ${field}`)
  }
  if (spec.schemaVersion !== 1) errors.push(`${directoryId}: unsupported schemaVersion`)
  if (!pattern.test(spec.id || '')) errors.push(`${directoryId}: malformed spec ID`)
  if (spec.id !== directoryId) errors.push(`${directoryId}: directory and spec ID differ`)
  for (const field of ['title', 'area', 'status', 'summary', 'createdAt', 'updatedAt']) {
    if (!spec[field]) errors.push(`${directoryId}: missing ${field}`)
  }
  if (!context.system.statuses.includes(spec.status))
    errors.push(`${directoryId}: invalid status ${spec.status}`)
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(spec.area || '')) errors.push(`${directoryId}: malformed area`)
  if (spec.id?.split('-')[0] !== spec.area) errors.push(`${directoryId}: ID and area differ`)
  if (typeof spec.title !== 'string' || spec.title.length < 4 || spec.title.length > 120)
    errors.push(`${directoryId}: title must contain 4-120 characters`)
  if (typeof spec.summary !== 'string' || spec.summary.length < 10 || spec.summary.length > 500)
    errors.push(`${directoryId}: summary must contain 10-500 characters`)
  for (const field of ['createdAt', 'updatedAt']) {
    if (typeof spec[field] !== 'string' || Number.isNaN(Date.parse(spec[field])))
      errors.push(`${directoryId}: ${field} must be an ISO date-time`)
  }
  for (const field of [
    'dependencies',
    'affectedFiles',
    'risks',
    'validation',
    'validationEvidence',
    'overrides',
  ]) {
    if (!Array.isArray(spec[field])) errors.push(`${directoryId}: ${field} must be an array`)
  }
  if (
    !spec.clarification ||
    !Array.isArray(spec.clarification.questions) ||
    !Array.isArray(spec.clarification.openQuestions)
  ) {
    errors.push(`${directoryId}: invalid clarification record`)
  } else {
    for (const [index, item] of spec.clarification.questions.entries()) {
      if (
        !item ||
        typeof item.question !== 'string' ||
        item.question.length < 5 ||
        typeof item.answer !== 'string' ||
        !item.answer.trim() ||
        typeof item.decision !== 'string' ||
        !item.decision.trim()
      ) {
        errors.push(`${directoryId}: invalid clarification question ${index + 1}`)
      }
    }
  }
  for (const filename of ['spec.md', 'plan.md', 'tasks.md', 'history.ndjson']) {
    if (!existsSync(specPath(context, directoryId, filename)))
      errors.push(`${directoryId}: missing ${filename}`)
  }
  const historyPath = specPath(context, directoryId, 'history.ndjson')
  if (existsSync(historyPath)) {
    for (const [index, line] of readFileSync(historyPath, 'utf8').split('\n').entries()) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        if (event.specId !== directoryId || !event.at || !event.event)
          errors.push(`${directoryId}: invalid history event on line ${index + 1}`)
      } catch {
        errors.push(`${directoryId}: malformed history JSON on line ${index + 1}`)
      }
    }
  }
  return errors
}

export function validateAll(context, targetId) {
  const specs = discoverSpecs(context)
  const selected = targetId ? specs.filter((spec) => spec.id === targetId.toUpperCase()) : specs
  const errors = []
  const warnings = []
  if (targetId && selected.length === 0) errors.push(`Unknown spec: ${targetId}`)
  const byId = new Map(specs.map((spec) => [spec.id, spec]))
  for (const spec of selected) {
    errors.push(...validateRecordShape(context, spec, spec.id))
    const seen = new Set()
    for (const dependency of spec.dependencies || []) {
      if (dependency.id === spec.id) errors.push(`${spec.id}: cannot depend on itself`)
      if (seen.has(dependency.id)) errors.push(`${spec.id}: duplicate dependency ${dependency.id}`)
      seen.add(dependency.id)
      if (!byId.has(dependency.id)) errors.push(`${spec.id}: missing dependency ${dependency.id}`)
      if (!context.system.dependencyTypes.includes(dependency.type))
        errors.push(`${spec.id}: invalid dependency type ${dependency.type}`)
      if (!new RegExp(context.system.idPattern).test(dependency.id || ''))
        errors.push(`${spec.id}: malformed dependency ID ${dependency.id}`)
      if (!dependency.reason?.trim())
        errors.push(`${spec.id}: dependency ${dependency.id} lacks a reason`)
    }
    if (
      ['specified', 'planning', 'planned', 'in_progress', 'blocked', 'completed'].includes(
        spec.status,
      )
    ) {
      const content = existsSync(specPath(context, spec.id, 'spec.md'))
        ? readFileSync(specPath(context, spec.id, 'spec.md'), 'utf8')
        : ''
      const missing = missingSections(content, SECTION_NAMES.spec, [
        'Out of scope',
        'Dependencies',
        'Open questions',
      ])
      if (missing.length)
        errors.push(`${spec.id}: incomplete specification sections: ${missing.join(', ')}`)
      if (spec.clarification?.openQuestions?.length)
        errors.push(`${spec.id}: finalized spec has open questions`)
    }
    if (['planned', 'in_progress', 'blocked', 'completed'].includes(spec.status)) {
      const content = existsSync(specPath(context, spec.id, 'plan.md'))
        ? readFileSync(specPath(context, spec.id, 'plan.md'), 'utf8')
        : ''
      const missing = missingSections(content, SECTION_NAMES.plan, [
        'Contracts and migrations',
        'Dependencies and sequence',
        'Rollout and recovery',
      ])
      if (missing.length) errors.push(`${spec.id}: incomplete plan sections: ${missing.join(', ')}`)
      if (!(spec.affectedFiles || []).length)
        errors.push(`${spec.id}: planned spec has no affected files`)
      if (!(spec.risks || []).length) errors.push(`${spec.id}: planned spec has no risks`)
      if (!(spec.validation || []).length)
        errors.push(`${spec.id}: planned spec has no validation strategy`)
      const tasks = existsSync(specPath(context, spec.id, 'tasks.md'))
        ? readFileSync(specPath(context, spec.id, 'tasks.md'), 'utf8')
        : ''
      if (!/^- \[[ xX]\] T\d+/m.test(tasks)) errors.push(`${spec.id}: no actionable tasks found`)
    }
    if (spec.status === 'completed' && !(spec.validationEvidence || []).length)
      errors.push(`${spec.id}: completed without validation evidence`)
  }
  const visiting = new Set()
  const visited = new Set()
  const walk = (id, chain) => {
    if (visiting.has(id)) {
      errors.push(`Dependency cycle: ${[...chain, id].join(' -> ')}`)
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of byId.get(id)?.dependencies || [])
      if (byId.has(dependency.id)) walk(dependency.id, [...chain, id])
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of byId.keys()) walk(id, [])
  if (specs.length === 0) warnings.push('No specification records found.')
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], count: selected.length }
}

function dependencyState(context, spec) {
  const byId = new Map(discoverSpecs(context).map((item) => [item.id, item]))
  return (spec.dependencies || []).map((dependency) => ({
    ...dependency,
    status: byId.get(dependency.id)?.status || 'missing',
    finished: byId.get(dependency.id)?.status === 'completed',
  }))
}

function commandSpecify(context, args) {
  const { positionals, flags } = parseArgs(args)
  if (positionals[0]) {
    const spec = loadSpec(context, positionals[0])
    if (!flags.finalize)
      throw new Error('Use --finalize after resolving the challenge record and all open questions.')
    if (spec.status !== 'clarifying')
      throw new Error(`${spec.id} is ${spec.status}, not clarifying.`)
    const report = validateAll(context, spec.id)
    const content = readFileSync(specPath(context, spec.id, 'spec.md'), 'utf8')
    const missing = missingSections(content, SECTION_NAMES.spec, [
      'Out of scope',
      'Dependencies',
      'Open questions',
    ])
    if (
      missing.length ||
      spec.clarification.openQuestions.length ||
      spec.clarification.questions.length === 0
    ) {
      throw new Error(
        `Specification is not ready: ${missing.length ? `complete ${missing.join(', ')}; ` : ''}${spec.clarification.openQuestions.length ? 'resolve open questions; ' : ''}${spec.clarification.questions.length === 0 ? 'record challenged questions and decisions' : ''}`,
      )
    }
    const structural = report.errors.filter((error) => !error.includes('incomplete specification'))
    if (structural.length) throw new Error(structural.join('\n'))
    transition(context, spec, 'specified', 'specification_finalized', flags.note)
    console.log(`${spec.id} is specified and ready to plan.`)
    return
  }
  if (!flags.area || !flags.title || !flags.summary)
    throw new Error('Usage: specify --area AREA --title "Title" --summary "Summary"')
  if (String(flags.title).trim().length < 4 || String(flags.summary).trim().length < 10)
    throw new Error('Title must be at least 4 characters and summary at least 10 characters.')
  const id = generateId(context, flags.area)
  const now = new Date().toISOString()
  const spec = {
    schemaVersion: 1,
    id,
    title: String(flags.title).trim(),
    area: String(flags.area).trim().toUpperCase(),
    status: 'clarifying',
    summary: String(flags.summary).trim(),
    createdAt: now,
    updatedAt: now,
    clarification: {
      questions: [],
      openQuestions: [
        'Challenge the request and resolve all material questions before finalizing.',
      ],
    },
    dependencies: [],
    affectedFiles: [],
    risks: [],
    validation: [],
    validationEvidence: [],
    overrides: [],
  }
  mkdirSync(dirname(specPath(context, id)), { recursive: true })
  writeJson(specPath(context, id), spec)
  const replacements = { ID: id, TITLE: spec.title }
  for (const filename of ['spec.md', 'plan.md', 'tasks.md'])
    writeFileSync(specPath(context, id, filename), template(context, filename, replacements))
  writeFileSync(specPath(context, id, 'history.ndjson'), '')
  appendHistory(context, id, 'created', null, 'clarifying', spec.summary)
  console.log(`Created ${id} in clarifying state.`)
  console.log(
    `Challenge the request, edit ${relative(context.root, specPath(context, id, 'spec.md'))}, and record decisions in spec.json.`,
  )
}

function commandPlan(context, args) {
  const { positionals, flags } = parseArgs(args)
  const spec = loadSpec(context, positionals[0])
  if (flags.finalize) {
    if (spec.status !== 'planning') throw new Error(`${spec.id} is ${spec.status}, not planning.`)
    const content = readFileSync(specPath(context, spec.id, 'plan.md'), 'utf8')
    const missing = missingSections(content, SECTION_NAMES.plan, [
      'Contracts and migrations',
      'Dependencies and sequence',
      'Rollout and recovery',
    ])
    const tasks = readFileSync(specPath(context, spec.id, 'tasks.md'), 'utf8')
    const problems = []
    if (missing.length) problems.push(`complete ${missing.join(', ')}`)
    if (!/^- \[ \] T\d+/m.test(tasks)) problems.push('add unchecked actionable tasks')
    if (!spec.affectedFiles.length) problems.push('record affectedFiles')
    if (!spec.risks.length) problems.push('record risks')
    if (!spec.validation.length) problems.push('record validation strategy')
    if (problems.length) throw new Error(`Plan is not ready: ${problems.join('; ')}`)
    transition(context, spec, 'planned', 'plan_finalized', flags.note)
    console.log(`${spec.id} is planned and ready for dependency-gated implementation.`)
    return
  }
  if (spec.status !== 'specified' && spec.status !== 'blocked')
    throw new Error(
      `${spec.id} must be specified before planning; current status is ${spec.status}.`,
    )
  transition(context, spec, 'planning', 'planning_started', flags.note)
  console.log(
    `${spec.id} is now planning. Analyze code and history, then complete plan.md, tasks.md, and spec.json planning fields.`,
  )
}

function commandImplement(context, args) {
  const { positionals, flags } = parseArgs(args)
  const spec = loadSpec(context, positionals[0])
  if (flags.complete) {
    if (spec.status !== 'in_progress')
      throw new Error(`${spec.id} is ${spec.status}, not in_progress.`)
    const tasks = readFileSync(specPath(context, spec.id, 'tasks.md'), 'utf8')
    if (/^- \[ \] T\d+/m.test(tasks)) throw new Error('Cannot complete: unchecked tasks remain.')
    if (!spec.validationEvidence.length)
      throw new Error(
        'Cannot complete: record validation evidence with `pnpm spec evidence ID --note "..."`.',
      )
    transition(context, spec, 'completed', 'implementation_completed', flags.note)
    console.log(`${spec.id} completed.`)
    return
  }
  if (spec.status !== 'planned' && spec.status !== 'blocked')
    throw new Error(
      `${spec.id} must be planned before implementation; current status is ${spec.status}.`,
    )
  const dependencies = dependencyState(context, spec)
  const unfinished = dependencies.filter((dependency) => !dependency.finished)
  const critical = unfinished.filter((dependency) => dependency.type === 'critical')
  const advisory = unfinished.filter((dependency) => dependency.type === 'advisory')
  for (const dependency of advisory)
    console.warn(
      `Warning: advisory dependency ${dependency.id} is ${dependency.status}: ${dependency.reason}`,
    )
  if (critical.length && !flags.override) {
    throw new Error(
      `Blocked by critical dependencies: ${critical.map((dependency) => `${dependency.id} (${dependency.status})`).join(', ')}. Complete them first, or use --override --reason "..." deliberately.`,
    )
  }
  if (critical.length) {
    if (!flags.reason || String(flags.reason).trim().length < 10)
      throw new Error(
        'A critical dependency override requires --reason with at least 10 characters.',
      )
    const override = {
      at: new Date().toISOString(),
      dependencies: critical.map(({ id }) => id),
      reason: String(flags.reason).trim(),
    }
    spec.overrides.push(override)
    saveSpec(context, spec)
    appendHistory(
      context,
      spec.id,
      'dependency_override',
      spec.status,
      spec.status,
      override.reason,
    )
  }
  transition(context, spec, 'in_progress', 'implementation_started', flags.note)
  console.log(
    `${spec.id} implementation started${critical.length ? ' with a logged dependency override' : ''}.`,
  )
}

function commandDependency(context, args) {
  const { positionals, flags } = parseArgs(args)
  const spec = loadSpec(context, positionals[0])
  if (!flags.add)
    throw new Error('Usage: dependency ID --add OTHER-ID --type critical|advisory --reason "..."')
  const target = loadSpec(context, flags.add)
  if (target.id === spec.id) throw new Error('A spec cannot depend on itself.')
  if (!context.system.dependencyTypes.includes(flags.type))
    throw new Error('--type must be critical or advisory.')
  if (!flags.reason || String(flags.reason).trim().length < 5)
    throw new Error('--reason must explain the dependency.')
  if (spec.dependencies.some((item) => item.id === target.id))
    throw new Error(`${target.id} is already a dependency.`)
  spec.dependencies.push({ id: target.id, type: flags.type, reason: String(flags.reason).trim() })
  saveSpec(context, spec)
  const report = validateAll(context)
  if (report.errors.some((error) => error.startsWith('Dependency cycle:'))) {
    spec.dependencies = spec.dependencies.filter((item) => item.id !== target.id)
    saveSpec(context, spec)
    throw new Error('Dependency rejected because it creates a cycle.')
  }
  appendHistory(
    context,
    spec.id,
    'dependency_added',
    spec.status,
    spec.status,
    `${target.id} (${flags.type}): ${flags.reason}`,
  )
  console.log(`Added ${flags.type} dependency ${target.id} to ${spec.id}.`)
}

function commandEvidence(context, args) {
  const { positionals, flags } = parseArgs(args)
  const spec = loadSpec(context, positionals[0])
  if (!flags.note || String(flags.note).trim().length < 3)
    throw new Error('Usage: evidence ID --note "Validation result"')
  spec.validationEvidence.push(String(flags.note).trim())
  saveSpec(context, spec)
  appendHistory(context, spec.id, 'validation_evidence_added', spec.status, spec.status, flags.note)
  console.log(`Recorded validation evidence for ${spec.id}.`)
}

function printStatus(spec) {
  console.log(`${spec.id}  ${spec.status.padEnd(11)}  ${spec.title}`)
}

function commandStatus(context, args) {
  const { positionals, flags } = parseArgs(args)
  if (!positionals[0]) {
    const specs = discoverSpecs(context)
    if (!specs.length) return console.log('No specs found.')
    for (const spec of specs) printStatus(spec)
    return
  }
  const spec = loadSpec(context, positionals[0])
  if (flags.set) {
    if (!['blocked', 'cancelled'].includes(flags.set))
      throw new Error('Manual status may only be set to blocked or cancelled.')
    transition(context, spec, flags.set, `status_${flags.set}`, flags.note)
  }
  printStatus(spec)
}

function commandDependencies(context, args) {
  const { positionals } = parseArgs(args)
  const root = loadSpec(context, positionals[0])
  const byId = new Map(discoverSpecs(context).map((spec) => [spec.id, spec]))
  const seen = new Set()
  const walk = (spec, depth) => {
    for (const dependency of spec.dependencies || []) {
      const target = byId.get(dependency.id)
      console.log(
        `${'  '.repeat(depth)}- ${dependency.id} [${dependency.type}] ${target?.status || 'missing'} — ${dependency.reason}`,
      )
      if (target && !seen.has(target.id)) {
        seen.add(target.id)
        walk(target, depth + 1)
      }
    }
  }
  console.log(`${root.id} dependencies:`)
  if (!root.dependencies.length) console.log('- none')
  walk(root, 0)
  const critical = dependencyState(context, root).filter(
    (item) => item.type === 'critical' && !item.finished,
  )
  console.log(
    critical.length
      ? `Readiness: blocked by ${critical.map(({ id }) => id).join(', ')}`
      : 'Readiness: no unfinished critical dependencies',
  )
}

function commandInspect(context, args) {
  const { positionals } = parseArgs(args)
  const spec = loadSpec(context, positionals[0])
  printStatus(spec)
  console.log(`Summary: ${spec.summary}`)
  console.log(`Created: ${spec.createdAt}`)
  console.log(
    `Dependencies: ${spec.dependencies.length}; affected files: ${spec.affectedFiles.length}; risks: ${spec.risks.length}`,
  )
  console.log(`Record: ${relative(context.root, dirname(specPath(context, spec.id)))}`)
}

function commandResume(context, args) {
  const { positionals } = parseArgs(args)
  if (positionals[0]) {
    commandInspect(context, [positionals[0]])
    commandDependencies(context, [positionals[0]])
    return
  }
  const specs = discoverSpecs(context).filter(
    (spec) => !['completed', 'cancelled'].includes(spec.status),
  )
  if (!specs.length) return console.log('No pending specs. Create one with `pnpm spec specify`.')
  console.log('Pending specs (independent; choose by ID):')
  for (const spec of specs) {
    const blockers = dependencyState(context, spec).filter(
      (item) => item.type === 'critical' && !item.finished,
    )
    console.log(
      `- ${spec.id} [${spec.status}] ${spec.title}${blockers.length ? ` — blocked by ${blockers.map(({ id }) => id).join(', ')}` : ' — viable'}`,
    )
  }
}

function commandValidate(context, args) {
  const { positionals } = parseArgs(args)
  const report = validateAll(context, positionals[0])
  for (const warning of report.warnings) console.warn(`Warning: ${warning}`)
  for (const error of report.errors) console.error(`Error: ${error}`)
  if (report.errors.length)
    throw new Error(`Validation failed with ${report.errors.length} error(s).`)
  console.log(`Validated ${report.count} spec record(s).`)
}

function commandHistory(context, args) {
  const { positionals } = parseArgs(args)
  if (positionals[0]) {
    const spec = loadSpec(context, positionals[0])
    process.stdout.write(
      readFileSync(specPath(context, spec.id, 'history.ndjson'), 'utf8') || 'No history.\n',
    )
    return
  }
  for (const spec of discoverSpecs(context)) {
    const lines = readFileSync(specPath(context, spec.id, 'history.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
    if (lines.length) console.log(lines.at(-1))
  }
}

function commandEvent(context, args) {
  const { positionals, flags } = parseArgs(args)
  const spec = loadSpec(context, positionals[0])
  if (!flags.note) throw new Error('Usage: event ID --note "Important implementation note"')
  appendHistory(context, spec.id, 'note', spec.status, spec.status, flags.note)
  console.log(`Recorded history note for ${spec.id}.`)
}

function help() {
  console.log(`Zakape dependency-aware specification CLI

  specify --area AREA --title "..." --summary "..."  Create a clarifying spec
  specify ID --finalize                              Finalize clarified requirements
  plan ID | plan ID --finalize                       Start/finalize plan and tasks
  implement ID [--override --reason "..."]           Start dependency-gated work
  implement ID --complete                           Complete checked, validated work
  status [ID]                                        Show discovered state
  specs                                              List all specs
  dependencies ID                                    Show transitive dependencies
  inspect ID                                         Show record details
  resume [ID]                                        Discover viable pending work
  validate [ID]                                      Validate records and graph
  history [ID]                                       Show append-only history
  dependency ID --add OTHER --type TYPE --reason "..."
  evidence ID --note "..."                           Record validation evidence
  event ID --note "..."                              Record an important event
  status ID --set blocked|cancelled --note "..."`)
}

export function run(argv, context = createContext()) {
  const [command = 'help', ...args] = argv
  const commands = {
    specify: commandSpecify,
    plan: commandPlan,
    implement: commandImplement,
    status: commandStatus,
    specs: commandStatus,
    dependencies: commandDependencies,
    inspect: commandInspect,
    resume: commandResume,
    validate: commandValidate,
    history: commandHistory,
    dependency: commandDependency,
    evidence: commandEvidence,
    event: commandEvent,
  }
  if (command === 'help' || flagsHelp(args)) return help()
  if (!commands[command]) throw new Error(`Unknown command: ${command}. Run \`pnpm spec help\`.`)
  return commands[command](context, args)
}

function flagsHelp(args) {
  return args.includes('--help') || args.includes('-h')
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
