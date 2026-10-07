const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FRESH_MS = 75_000;
const VISIBLE_MS = 20 * 60_000;
const TAIL_BYTES = 512 * 1024;

function listRollouts(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const dirs = [root];
  while (dirs.length) {
    const dir = dirs.pop();
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) dirs.push(full);
      else if (item.isFile() && item.name.endsWith('.jsonl')) files.push(full);
    }
  }
  return files;
}

function readBytes(file, start, count) {
  if (count <= 0) return '';
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(count);
    const bytes = fs.readSync(handle, buffer, 0, count, start);
    return buffer.subarray(0, bytes).toString('utf8');
  } finally {
    fs.closeSync(handle);
  }
}

function readMeta(file, size) {
  try {
    const firstLine = readBytes(file, 0, Math.min(size, 1024 * 1024)).split('\n')[0];
    const item = JSON.parse(firstLine);
    if (item.type !== 'session_meta') return {};
    return {
      id: typeof item.payload?.id === 'string' ? item.payload.id : undefined,
      source: typeof item.payload?.source === 'string' ? item.payload.source : 'codex',
      cwd: typeof item.payload?.cwd === 'string' ? item.payload.cwd : undefined,
      project: item.payload?.cwd ? path.win32.basename(item.payload.cwd) : undefined,
    };
  } catch {
    return {};
  }
}

function isWithinProject(cwd, projectDir) {
  if (!cwd) return false;
  const paths = process.platform === 'win32' ? path.win32 : path;
  const relative = paths.relative(paths.resolve(projectDir), paths.resolve(cwd));
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + paths.sep)
    && !paths.isAbsolute(relative));
}

function findLastTurnSettings(file, size) {
  let end = size;
  const limit = Math.max(0, size - 64 * 1024 * 1024);
  while (end > limit) {
    const start = Math.max(limit, end - 1024 * 1024);
    const text = readBytes(file, start, Math.min(size, end + 16 * 1024) - start);
    const marker = text.lastIndexOf('"type":"turn_context"');
    if (marker >= 0) {
      const before = text.lastIndexOf('\n', marker);
      const after = text.indexOf('\n', marker);
      if ((before >= 0 || start === 0) && after > marker) {
        try {
          const item = JSON.parse(text.slice(before + 1, after));
          if (item.type === 'turn_context') return {
            model: typeof item.payload?.model === 'string' ? item.payload.model : null,
            effort: typeof item.payload?.effort === 'string' ? item.payload.effort : null,
          };
        } catch { /* keep searching */ }
      }
    }
    if (start === limit) break;
    end = start + 16 * 1024;
  }
  return {};
}

function addSample(state, sample) {
  const previous = state.samples.at(-1);
  if (previous && (sample.at < previous.at || sample.output <= previous.output)) return false;
  state.samples.push(sample);
  if (state.samples.length > 24) state.samples.shift();
  return true;
}

function makeSample(state, at, total, responseTokens, origin) {
  if (!Number.isFinite(at) || !Number.isFinite(total?.output_tokens)) return false;
  const previous = state.samples.at(-1);
  let duration = state.lastInputAt ? (at - state.lastInputAt) / 1000 : null;
  let method = 'response';
  // Codex records the start of an assistant item, not the first streamed token.
  // This boundary removes observed pre-output latency without claiming exact decode time.
  const outputDuration = state.firstOutputAt != null && state.lastInputAt != null
    && state.firstOutputAt >= state.lastInputAt ? (at - state.firstOutputAt) / 1000 : null;
  if (Number.isFinite(responseTokens) && Number.isFinite(outputDuration)
      && outputDuration >= 0.2 && outputDuration <= 600) {
    duration = outputDuration;
    method = 'output_start';
  }
  if (!Number.isFinite(duration) || duration < (method === 'output_start' ? 0.2 : 0.5)
      || duration > 600 || !Number.isFinite(responseTokens)) {
    duration = previous ? (at - previous.at) / 1000 : null;
    responseTokens = previous ? total.output_tokens - previous.output : null;
    method = 'interval';
  }
  const valid = Number.isFinite(duration) && duration >= 0.2
    && duration <= (method === 'interval' ? 120 : 600)
    && Number.isFinite(responseTokens) && responseTokens >= 0;
  return addSample(state, {
    at,
    output: total.output_tokens,
    input: Number(total.input_tokens) || 0,
    cached: Number(total.cached_input_tokens) || 0,
    reasoning: Number(total.reasoning_output_tokens) || 0,
    responseTokens: valid ? responseTokens : null,
    duration: valid ? duration : null,
    rate: valid ? responseTokens / duration : null,
    method: valid ? method : null,
    origin,
    model: state.model || null,
    effort: state.effort || null,
  });
}

function markActivity(state, at, phase) {
  state.activityAt = at;
  state.activityCount++;
  if (phase) state.phase = phase;
  return true;
}

function addLine(state, line) {
  if (!line.includes('token_usage_record') && !line.includes('token_count')
      && !line.includes('turn_context') && !line.includes('custom_tool_call_output')
      && !line.includes('function_call_output')
      && !line.includes('custom_tool_call') && !line.includes('reasoning')
      && !line.includes('item_completed')
      && !line.includes('task_started') && !line.includes('task_complete')
      && !line.includes('turn_aborted') && !line.includes('"type":"message"')) return false;
  let item;
  try { item = JSON.parse(line); } catch { return false; }
  const at = Date.parse(item.timestamp);
  if (!Number.isFinite(at)) return false;
  if (item.type === 'turn_context') {
    if (typeof item.payload?.model === 'string') state.model = item.payload.model;
    if (typeof item.payload?.effort === 'string') state.effort = item.payload.effort;
    state.lastInputAt = at;
    state.firstOutputAt = null;
    if (!state.turnActive) state.turnStartedAt = at;
    state.turnActive = true;
    return markActivity(state, at, 'working');
  }
  if (item.type === 'response_item' && (item.payload?.type === 'custom_tool_call_output'
      || item.payload?.type === 'function_call_output')) {
    state.lastInputAt = at;
    state.firstOutputAt = null;
    return markActivity(state, at, 'working');
  }
  if (item.type === 'event_msg' && item.payload?.type === 'item_completed') {
    const kind = item.payload.item?.type;
    const started = item.payload.started_at_ms;
    const completed = item.payload.completed_at_ms;
    if ((kind === 'Reasoning' || kind === 'AgentMessage')
        && Number.isFinite(started) && Number.isFinite(completed)
        && state.lastInputAt != null && started >= state.lastInputAt
        && started <= completed && completed <= at) {
      state.firstOutputAt = Math.min(state.firstOutputAt ?? started, started);
    }
    return false;
  }
  if (item.type === 'response_item' && item.payload?.type === 'custom_tool_call') {
    return markActivity(state, at, 'tool');
  }
  if (item.type === 'response_item' && item.payload?.type === 'reasoning') {
    return markActivity(state, at, 'reasoning');
  }
  if (item.type === 'response_item' && item.payload?.type === 'message') {
    return markActivity(state, at, 'writing');
  }
  if (item.type === 'event_msg' && item.payload?.type === 'task_started') {
    state.lastInputAt = at;
    state.firstOutputAt = null;
    state.turnActive = true;
    state.turnStartedAt = at;
    return markActivity(state, at, 'working');
  }
  if (item.type === 'event_msg' &&
      (item.payload?.type === 'task_complete' || item.payload?.type === 'turn_aborted')) {
    state.turnActive = false;
    return markActivity(state, at, 'done');
  }
  if (item.type === 'token_usage_record') {
    const changed = makeSample(state, at, item.payload?.thread_token_usage,
      item.payload?.usage?.output_tokens, 'usage_record');
    state.lastInputAt = at;
    state.firstOutputAt = null;
    return markActivity(state, at) || changed;
  }
  if (item.type === 'event_msg' && item.payload?.type === 'token_count') {
    const changed = makeSample(state, at, item.payload.info?.total_token_usage,
      item.payload.info?.last_token_usage?.output_tokens, 'token_count');
    if (changed) {
      state.lastInputAt = at;
      state.firstOutputAt = null;
      return markActivity(state, at);
    }
    return false;
  }
  return false;
}

function appendText(state, text) {
  const lines = (state.partial + text).split('\n');
  state.partial = lines.pop();
  let changed = false;
  for (const line of lines) changed = addLine(state, line) || changed;
  return changed;
}

class TokenMonitor {
  constructor(root = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions'),
    projectDir = null) {
    this.root = root;
    this.projectDir = projectDir ? path.resolve(projectDir) : null;
    this.files = new Map();
    this.error = null;
  }

  checkFile(file) {
    const size = fs.statSync(file).size;
    let state = this.files.get(file);
    if (!state || size < state.offset) {
      state = { file, offset: 0, partial: '', samples: [], model: null, effort: null,
        lastInputAt: null, firstOutputAt: null, firstSeenAt: Date.now(), turnActive: false, turnStartedAt: null,
        activityAt: null, activityCount: 0, phase: 'idle', ...readMeta(file, size) };
      state.inScope = !this.projectDir || isWithinProject(state.cwd, this.projectDir);
      this.files.set(file, state);
      if (!state.inScope) {
        state.offset = size;
        return false;
      }
      const start = Math.max(0, size - TAIL_BYTES);
      let text = readBytes(file, start, size - start);
      if (start) text = text.slice(text.indexOf('\n') + 1);
      appendText(state, text);
      state.offset = size;
      const latest = state.samples.at(-1);
      if ((!state.model || !state.effort) && latest && Date.now() - latest.at < VISIBLE_MS) {
        const settings = findLastTurnSettings(file, size);
        state.model ||= settings.model;
        state.effort ||= settings.effort;
        for (const sample of state.samples) {
          sample.model ||= state.model;
          sample.effort ||= state.effort;
        }
      }
      return true;
    }
    if (size === state.offset) return false;
    if (!state.inScope) {
      state.offset = size;
      return false;
    }
    const start = size - state.offset > TAIL_BYTES ? size - TAIL_BYTES : state.offset;
    if (start !== state.offset) state.partial = '';
    let text = readBytes(file, start, size - start);
    if (start !== state.offset) text = text.slice(text.indexOf('\n') + 1);
    const changed = appendText(state, text);
    state.offset = size;
    return changed;
  }

  scan() {
    let changed = false;
    this.error = null;
    try {
      for (const file of listRollouts(this.root)) {
        try { changed = this.checkFile(file) || changed; }
        catch (error) { this.error ||= error.code || error.message; }
      }
    } catch (error) {
      this.error = error.code || error.message;
    }
    return changed;
  }

  pollHot(now = Date.now()) {
    let changed = false;
    for (const state of this.files.values()) {
      if (!state.inScope) continue;
      const at = Math.max(state.samples.at(-1)?.at || 0, state.activityAt || 0, state.firstSeenAt);
      if (now - at > VISIBLE_MS) continue;
      try { changed = this.checkFile(state.file) || changed; }
      catch (error) { this.error ||= error.code || error.message; }
    }
    return changed;
  }

  snapshot(now = Date.now()) {
    const sessions = [];
    for (const state of this.files.values()) {
      if (!state.inScope) continue;
      const latest = state.samples.at(-1);
      const lastAt = Math.max(latest?.at || 0, state.activityAt || 0);
      if (!lastAt || now - lastAt > VISIBLE_MS || lastAt > now + 60_000) continue;
      sessions.push({
        id: state.id || path.basename(state.file, '.jsonl'),
        project: state.project || null,
        source: state.source || 'codex',
        model: latest?.model || state.model,
        effort: latest?.effort || state.effort,
        at: latest?.at || lastAt,
        fresh: Boolean(latest && now - latest.at <= FRESH_MS),
        rate: latest?.rate ?? null,
        duration: latest?.duration ?? null,
        responseTokens: latest?.responseTokens ?? null,
        method: latest?.method ?? null,
        origin: latest?.origin ?? null,
        output: latest?.output ?? 0,
        input: latest?.input ?? 0,
        cached: latest?.cached ?? 0,
        reasoning: latest?.reasoning ?? 0,
        turnActive: state.turnActive,
        turnStartedAt: state.turnStartedAt,
        activityAt: state.activityAt,
        activityCount: state.activityCount,
        phase: state.phase,
      });
    }
    sessions.sort((a, b) => b.at - a.at);
    return { sessions, scope: this.projectDir ? path.basename(this.projectDir) : null,
      error: this.error, checkedAt: now };
  }
}

module.exports = { TokenMonitor };
