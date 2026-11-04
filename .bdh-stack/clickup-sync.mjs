// Mirrors .bdh-stack/tasks.md into the ClickUp space "mr-burritos".
// One list per sprint plus Backlog. Ids are kept in .bdh-stack/clickup.json so a
// re-run updates tasks instead of creating duplicates.
// Token: CLICKUP_JETON in the repo's .env, read here and never printed.
//
//   node .bdh-stack/clickup-sync.mjs --dry   show what would change
//   node .bdh-stack/clickup-sync.mjs         apply
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BOARD = join(HERE, 'tasks.md')
const STATE = join(HERE, 'clickup.json')
const ENV = join(HERE, '..', '.env')
const DRY = process.argv.includes('--dry')
const SPACE_NAME = 'mr-burritos'

function token() {
  const line = readFileSync(ENV, 'utf8').split(/\r?\n/).find((l) => l.startsWith('CLICKUP_JETON='))
  if (!line) throw new Error('CLICKUP_JETON missing from .env')
  return line.slice('CLICKUP_JETON='.length).trim().replace(/^["']|["']$/g, '')
}
const TOKEN = token()

async function cu(method, path, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
      method,
      headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000
      await new Promise((r) => setTimeout(r, Math.min(60000, Math.max(1000, reset ? reset - Date.now() : 5000))))
      continue
    }
    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 200) } }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data).slice(0, 300)}`)
    return data
  }
  throw new Error(`${method} ${path} -> still rate limited`)
}

// ---- board parsing ----

const ID_RE = /^([A-Z]\d+[a-z]?(?:[–+-][A-Z]?\d+[a-z]?)*)\s+/

function slug(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').split('-').filter(Boolean).slice(0, 8).join('-')
}

function parseBoard() {
  const sections = []
  let cur = null
  for (const raw of readFileSync(BOARD, 'utf8').split(/\r?\n/)) {
    const sprint = raw.match(/^## Sprint (\d+): (.+)$/)
    if (sprint) { cur = { kind: 'sprint', n: Number(sprint[1]), goal: sprint[2].trim(), notes: [], items: [] }; sections.push(cur); continue }
    if (/^## Backlog/.test(raw)) { cur = { kind: 'backlog', goal: 'Backlog', notes: [], items: [] }; sections.push(cur); continue }
    if (!cur) continue
    const item = raw.match(/^- \[( |x)\] (.+)$/)
    if (!item) { if (raw.trim()) cur.notes.push(raw.trim()); continue }
    const [head, ...rest] = item[2].split(' — ')
    const fields = {}
    for (const part of rest) {
      const m = part.match(/^(owner|evidence|blocked by): ?(.*)$/)
      if (m) fields[m[1]] = m[2].trim()
    }
    const id = head.match(ID_RE)?.[1] ?? null
    const prefix = cur.kind === 'sprint' ? `S${cur.n}` : 'BL'
    cur.items.push({
      key: `${prefix}:${id ?? slug(head)}`,
      id,
      title: head.trim(),
      done: item[1] === 'x',
      owner: fields.owner ?? '',
      evidence: fields.evidence ?? '',
      blockedBy: fields['blocked by'] ?? '',
    })
  }
  return sections
}

// ---- mapping to ClickUp ----

function listName(section) {
  if (section.kind === 'backlog') return 'Backlog'
  const goal = section.goal.length > 60 ? section.goal.slice(0, 57) + '…' : section.goal
  return `Sprint ${section.n} — ${goal}`
}

function taskName(item) {
  const text = item.title.replace(/`/g, '')
  return text.length > 140 ? text.slice(0, 137) + '…' : text
}

function description(item, section) {
  return [
    item.title,
    '',
    `Owner: ${item.owner || '—'}`,
    `Evidence: ${item.evidence || '—'}`,
    `Blocked by: ${item.blockedBy || '—'}`,
    '',
    `Source: .bdh-stack/tasks.md, ${section.kind === 'sprint' ? `Sprint ${section.n}` : 'Backlog'} (key ${item.key}). Synced by .bdh-stack/clickup-sync.mjs.`,
  ].join('\n')
}

function statusOf(item, section, state, latestSprint) {
  if (item.done) return 'closed'
  if (state.status?.[item.key]) return state.status[item.key]
  if (section.kind === 'sprint') return section.n === latestSprint ? 'current sprint' : 'open'
  return /owner|decision|choice/i.test(item.blockedBy) ? 'blocked' : 'open'
}

function tagsOf(item) {
  return item.owner.split(/[,/]| and /).map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z-]+$/.test(s))
}

// ---- sync ----

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { lists: {}, tasks: {}, status: {} }
state.lists ??= {}; state.tasks ??= {}; state.status ??= {}
const save = () => { if (!DRY) writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n') }

if (!state.spaceId) {
  const { teams } = await cu('GET', '/team')
  for (const t of teams) {
    const { spaces } = await cu('GET', `/team/${t.id}/space?archived=false`)
    const space = spaces.find((s) => s.name === SPACE_NAME)
    if (space) { state.teamId = t.id; state.spaceId = space.id; break }
  }
  if (!state.spaceId) throw new Error(`space "${SPACE_NAME}" not found`)
}

const sections = parseBoard()
const latestSprint = Math.max(...sections.filter((s) => s.kind === 'sprint').map((s) => s.n))
const counts = { created: 0, updated: 0, unchanged: 0, lists: 0 }

for (const section of sections) {
  const name = listName(section)
  const listKey = section.kind === 'sprint' ? `S${section.n}` : 'BL'
  if (!state.lists[listKey]) {
    if (DRY) { console.log(`+ list ${name}`); state.lists[listKey] = { id: 'dry' } }
    else {
      const content = section.notes.join('\n')
      const list = await cu('POST', `/space/${state.spaceId}/list`, { name, content })
      state.lists[listKey] = { id: list.id, name }
      save()
    }
    counts.lists++
  }
  const listId = state.lists[listKey].id

  for (const item of section.items) {
    const status = statusOf(item, section, state, latestSprint)
    const body = { name: taskName(item), description: description(item, section), status }
    const known = state.tasks[item.key]
    const fingerprint = JSON.stringify(body)
    if (known && known.fingerprint === fingerprint) { counts.unchanged++; continue }
    if (DRY) { console.log(`${known ? '~' : '+'} [${status}] ${item.key}  ${body.name.slice(0, 70)}`); continue }
    if (known) {
      await cu('PUT', `/task/${known.id}`, body)
      known.fingerprint = fingerprint
      counts.updated++
    } else {
      const task = await cu('POST', `/list/${listId}/task`, {
        ...body,
        tags: tagsOf(item),
        priority: section.kind === 'backlog' && /security/.test(item.owner) ? 2 : null,
      })
      state.tasks[item.key] = { id: task.id, url: task.url, list: listKey, fingerprint }
      counts.created++
    }
    save()
  }
}

console.log(`${DRY ? 'dry run: ' : ''}lists +${counts.lists}, tasks +${counts.created}, ~${counts.updated}, =${counts.unchanged}`)
