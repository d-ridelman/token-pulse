const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TokenMonitor } = require('./monitor.cjs');
const { formatShare } = require('./share.cjs');

test('reads appended counters even when file modification time does not change', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-pulse-test-'));
  try {
    const file = path.join(root, 'session.jsonl');
    const start = Date.parse('2026-10-06T12:00:00Z');
    const meta = { type: 'session_meta', payload: { id: 'test-session', source: 'vscode', cwd: 'D:\\Work\\Project' } };
    const token = (seconds, output) => JSON.stringify({ timestamp: new Date(start + seconds * 1000).toISOString(), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { output_tokens: output, input_tokens: 1200, cached_input_tokens: 1000 } } } }) + '\n';
    fs.writeFileSync(file, JSON.stringify(meta) + '\n' + token(0, 100));
    const old = new Date(start);
    fs.utimesSync(file, old, old);
    const monitor = new TokenMonitor(root);
    monitor.scan();
    assert.equal(monitor.snapshot(start + 1000).sessions[0].rate, null);
    fs.appendFileSync(file, token(10, 350));
    fs.utimesSync(file, old, old);
    monitor.scan();
    const current = monitor.snapshot(start + 11_000).sessions[0];
    assert.equal(current.rate, 25);
    assert.equal(current.project, 'Project');
    assert.equal(current.source, 'vscode');
    assert.equal(monitor.snapshot(start + 200_000).sessions[0].fresh, false);
  } finally {
    if (root.startsWith(os.tmpdir() + path.sep)) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uses response usage and model, ignoring a later duplicate token event', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-pulse-test-'));
  try {
    const file = path.join(root, 'session.jsonl');
    const start = Date.parse('2026-10-06T12:00:00Z');
    const line = (seconds, type, payload) => JSON.stringify({
      timestamp: new Date(start + seconds * 1000).toISOString(), type, payload,
    }) + '\n';
    fs.writeFileSync(file,
      line(0, 'session_meta', { id: 'test-session', source: 'vscode', cwd: 'D:\\Work\\Project' })
      + line(0, 'turn_context', { model: 'gpt-test-model' })
      + line(10, 'token_usage_record', {
        usage: { output_tokens: 250 },
        thread_token_usage: { output_tokens: 250, input_tokens: 1000 },
      })
      + line(12, 'response_item', { type: 'custom_tool_call_output', output: 'done' })
      + line(12.01, 'event_msg', { type: 'token_count', info: {
        total_token_usage: { output_tokens: 250, input_tokens: 1000 },
        last_token_usage: { output_tokens: 250 },
      } })
      + line(20, 'token_usage_record', {
        usage: { output_tokens: 160 },
        thread_token_usage: { output_tokens: 410, input_tokens: 2000 },
      }));
    const monitor = new TokenMonitor(root);
    monitor.scan();
    const result = monitor.snapshot(start + 21_000).sessions[0];
    assert.equal(result.model, 'gpt-test-model');
    assert.equal(result.rate, 20);
    assert.equal(result.duration, 8);
    assert.equal(result.responseTokens, 160);
    assert.equal(result.method, 'response');
    assert.equal(monitor.files.get(file).samples.length, 2);
    const shared = formatShare(result, 'en');
    assert.match(shared, /Model: gpt-test-model/);
    assert.match(shared, /20 tokens\/s/);
    assert.doesNotMatch(shared, /Project|test-session|D:\\/);
  } finally {
    if (root.startsWith(os.tmpdir() + path.sep)) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('uses the first completed assistant item as an output-start boundary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-pulse-test-'));
  try {
    const file = path.join(root, 'session.jsonl');
    const start = Date.parse('2026-10-06T12:00:00Z');
    const line = (seconds, type, payload) => JSON.stringify({
      timestamp: new Date(start + seconds * 1000).toISOString(), type, payload,
    }) + '\n';
    const item = (seconds, kind, started, completed) => line(seconds, 'event_msg', {
      type: 'item_completed', item: { type: kind },
      started_at_ms: start + started * 1000, completed_at_ms: start + completed * 1000,
    });
    const usage = (seconds, output, total) => line(seconds, 'token_usage_record', {
      usage: { output_tokens: output }, thread_token_usage: { output_tokens: total },
    });
    fs.writeFileSync(file, line(0, 'turn_context', { model: 'gpt-test' })
      + item(1, 'UserMessage', 0, 0.5)
      + item(5, 'Reasoning', 2, 4.9)
      + usage(10, 200, 200)
      + line(12, 'response_item', { type: 'function_call_output' })
      + item(15, 'Reasoning', 14, 14.8)
      + usage(20, 120, 320)
      + line(22, 'response_item', { type: 'custom_tool_call_output' })
      + item(24, 'Reasoning', 11, 23) // stale start before the tool result
      + usage(30, 80, 400));
    const monitor = new TokenMonitor(root);
    monitor.scan();
    const samples = monitor.files.get(file).samples;
    assert.equal(samples[0].method, 'output_start');
    assert.equal(samples[0].duration, 8);
    assert.equal(samples[0].rate, 25);
    assert.match(formatShare(samples[0], 'en'), /first response item to usage record/);
    assert.equal(samples[1].method, 'output_start');
    assert.equal(samples[1].duration, 6);
    assert.equal(samples[1].rate, 20);
    assert.equal(samples[2].method, 'response');
    assert.equal(samples[2].duration, 8);
    assert.equal(samples[2].rate, 10);
    assert.match(formatShare(monitor.snapshot(start + 31_000).sessions[0], 'en'),
      /completed model response/);
  } finally {
    if (root.startsWith(os.tmpdir() + path.sep)) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('project scope excludes other sessions and reports model effort', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-pulse-test-'));
  try {
    const project = path.join(root, 'Token_Pulse');
    fs.mkdirSync(project);
    const writeSession = (name, cwd) => {
      const file = path.join(root, name + '.jsonl');
      const at = '2026-10-06T12:00:00Z';
      fs.writeFileSync(file, [
        { timestamp: at, type: 'session_meta', payload: { id: name, cwd, source: 'cli' } },
        { timestamp: at, type: 'turn_context', payload: { model: 'gpt-6.1-sol', effort: 'max' } },
        { timestamp: '2026-10-06T12:00:10Z', type: 'token_usage_record', payload: {
          usage: { output_tokens: 400 },
          thread_token_usage: { output_tokens: 400, input_tokens: 1000 },
        } },
      ].map(item => JSON.stringify(item)).join('\n') + '\n');
    };
    writeSession('wanted', project);
    writeSession('other', path.join(root, 'Other_Project'));
    const monitor = new TokenMonitor(root, project);
    monitor.scan();
    const snapshot = monitor.snapshot(Date.parse('2026-10-06T12:00:11Z'));
    assert.equal(snapshot.scope, 'Token_Pulse');
    assert.deepEqual(snapshot.sessions.map(session => session.id), ['wanted']);
    assert.equal(snapshot.sessions[0].model, 'gpt-6.1-sol');
    assert.equal(snapshot.sessions[0].effort, 'max');
    assert.match(formatShare(snapshot.sessions[0], 'en'), /gpt-6\.1-sol · MAX/);
    assert.equal(JSON.stringify(snapshot).includes(root), false);
  } finally {
    if (root.startsWith(os.tmpdir() + path.sep)) fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reports active turn phases before a token measurement exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'token-pulse-test-'));
  try {
    const file = path.join(root, 'active.jsonl');
    const start = Date.parse('2026-10-06T12:00:00Z');
    const line = (seconds, type, payload) => JSON.stringify({
      timestamp: new Date(start + seconds * 1000).toISOString(), type, payload,
    }) + '\n';
    fs.writeFileSync(file, line(0, 'session_meta', { id: 'active', cwd: root })
      + line(1, 'event_msg', { type: 'task_started' })
      + line(2, 'turn_context', { model: 'gpt-6.1-sol', effort: 'max' }));
    const monitor = new TokenMonitor(root, root);
    monitor.scan();
    let session = monitor.snapshot(start + 3000).sessions[0];
    assert.equal(session.rate, null);
    assert.equal(session.turnActive, true);
    assert.equal(session.turnStartedAt, start + 1000);
    assert.equal(session.phase, 'working');
    fs.appendFileSync(file, line(8, 'response_item', { type: 'reasoning' }));
    assert.equal(monitor.pollHot(start + 9000), true);
    session = monitor.snapshot(start + 9000).sessions[0];
    assert.equal(session.phase, 'reasoning');
    assert.equal(session.activityCount, 3);
    fs.appendFileSync(file, line(12, 'event_msg', { type: 'task_complete' }));
    monitor.pollHot(start + 13_000);
    session = monitor.snapshot(start + 13_000).sessions[0];
    assert.equal(session.turnActive, false);
    assert.equal(session.phase, 'done');
  } finally {
    if (root.startsWith(os.tmpdir() + path.sep)) fs.rmSync(root, { recursive: true, force: true });
  }
});
