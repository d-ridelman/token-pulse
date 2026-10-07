const translations = {
  ru: {
    localTelemetry: 'ЛОКАЛЬНЫЕ ЗАМЕРЫ',
    localLogs: 'Журналы Codex',
    checkFrequency: 'проверка каждые 100 мс',
    heroLabel: 'Скорость свежих замеров',
    projectHeroLabel: 'Скорость проекта',
    selectedHeroLabel: 'Скорость выбранной сессии',
    unit: 'ток/с',
    heroCaption: 'Сумма скоростей последних ответов. Новый замер появляется после записи расхода токенов.',
    selectedCaption: 'Скорость последнего завершённого ответа. Стрелка плавно идёт к замеру; число показывает записанное значение.',
    gaugeCaption: 'СТРЕЛКА ИДЁТ К ПОСЛЕДНЕМУ ЗАМЕРУ',
    activityWorking: 'РАБОТАЕТ',
    activityReasoning: 'РАССУЖДАЕТ',
    activityTool: 'ИНСТРУМЕНТ',
    activityWriting: 'ПИШЕТ ОТВЕТ',
    activityDone: 'ЗАВЕРШЕНО',
    activityEvents: 'сигналов активности',
    activityLast: 'ПОСЛ.:',
    activityHelp: 'Последнее наблюдаемое событие и таймер хода. Скорость обновляется только после ответа.',
    awaitingResult: 'ОЖИДАНИЕ ЗАМЕРА',
    allScope: 'Все свежие сессии',
    projectScope: 'Папка',
    showAll: 'Все сессии',
    focus: 'На спидометр',
    focused: 'На спидометре',
    staleMeasure: 'прошлый замер',
    freshSessions: 'свежих замеров',
    freshWindow: 'Замер за последние 75 сек.',
    recent: 'СЕЙЧАС И НЕДАВНО',
    sessions: 'Сессии',
    waiting: 'Ожидание данных',
    emptyTitle: 'Пока нет свежих замеров',
    emptyBody: 'Запустите задачу в Codex. Ход появится сразу, а скорость — после первой записи токенов.',
    sourceNote: 'Источник: CODEX_HOME/sessions или ~/.codex/sessions',
    chatgptNote: 'Обычные веб-чаты ChatGPT здесь не измеряются',
    checked: 'Проверено',
    error: 'Ошибка чтения журналов',
    justNow: 'только что',
    secondsAgo: 'сек. назад',
    minutesAgo: 'мин. назад',
    projectUnknown: 'Без проекта',
    modelUnknown: 'Модель неизвестна',
    rateLabel: 'ПОСЛЕДНИЙ ОТВЕТ',
    responseTokens: 'Токенов ответа',
    duration: 'Длительность',
    outputTotal: 'Вывод всего',
    client: 'Клиент',
    vscode: 'Codex через VS Code',
    cli: 'Codex CLI',
    codex: 'Codex',
    clientHelp: 'Клиент, через который запущена сессия. Это не название модели.',
    outputStartMethod: 'Первый элемент ответа',
    responseMethod: 'По завершённому ответу',
    intervalMethod: 'По интервалу записей',
    noRate: 'Ожидание второго замера',
    copy: 'Скопировать результат',
    copied: 'Скопировано',
    copyFailed: 'Не удалось скопировать',
    seconds: 'с',
    scale: 'Шкала индикатора: 0–100 ток/с',
  },
  en: {
    localTelemetry: 'LOCAL MEASUREMENTS',
    localLogs: 'Codex logs',
    checkFrequency: 'checking every 100 ms',
    heroLabel: 'Recent measured speed',
    projectHeroLabel: 'Project speed',
    selectedHeroLabel: 'Selected session speed',
    unit: 'tok/s',
    heroCaption: 'Sum of the latest response speeds. A new result appears after Codex records token usage.',
    selectedCaption: 'Speed of the latest completed response. The needle eases to the measurement; the number shows the recorded value.',
    gaugeCaption: 'NEEDLE EASES TO THE LATEST MEASUREMENT',
    activityWorking: 'WORKING',
    activityReasoning: 'REASONING',
    activityTool: 'RUNNING TOOL',
    activityWriting: 'WRITING RESPONSE',
    activityDone: 'COMPLETED',
    activityEvents: 'activity signals',
    activityLast: 'LAST:',
    activityHelp: 'Latest observed event and turn timer. Speed updates only after a completed response.',
    awaitingResult: 'AWAITING MEASUREMENT',
    allScope: 'All recent sessions',
    projectScope: 'Folder',
    showAll: 'All sessions',
    focus: 'Show on speedometer',
    focused: 'On speedometer',
    staleMeasure: 'past measurement',
    freshSessions: 'recent measurements',
    freshWindow: 'Measurement in the last 75 s',
    recent: 'NOW AND RECENTLY',
    sessions: 'Sessions',
    waiting: 'Waiting for data',
    emptyTitle: 'No recent measurements yet',
    emptyBody: 'Start a Codex task. Its activity appears first; speed follows the first token usage record.',
    sourceNote: 'Source: CODEX_HOME/sessions or ~/.codex/sessions',
    chatgptNote: 'Regular ChatGPT web chats are not measured here',
    checked: 'Checked',
    error: 'Cannot read session logs',
    justNow: 'just now',
    secondsAgo: 's ago',
    minutesAgo: 'min ago',
    projectUnknown: 'No project',
    modelUnknown: 'Unknown model',
    rateLabel: 'LATEST RESPONSE',
    responseTokens: 'Output tokens',
    duration: 'Duration',
    outputTotal: 'Total output',
    client: 'Client',
    vscode: 'Codex via VS Code',
    cli: 'Codex CLI',
    codex: 'Codex',
    clientHelp: 'The client that started this session, not the model name.',
    outputStartMethod: 'First response item',
    responseMethod: 'Completed response',
    intervalMethod: 'Usage record interval',
    noRate: 'Waiting for another sample',
    copy: 'Copy result',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    seconds: 's',
    scale: 'Indicator scale: 0–100 tokens/s',
  },
};

const requestedLanguage = new URLSearchParams(location.search).get('lang');
let language = ['ru', 'en'].includes(requestedLanguage) ? requestedLanguage
  : localStorage.getItem('token-pulse-language') === 'en' ? 'en' : 'ru';
let lastData = null;
let lastSessionsKey = '';
let selectedSessionId = null;
let lastGaugeTarget = null;
let lastGaugeSample = null;
let lastGaugeScope = null;
let gaugeFrame = null;
const rateEl = document.getElementById('total-rate');
const countEl = document.getElementById('fresh-count');
const sessionsEl = document.getElementById('sessions');
const emptyEl = document.getElementById('empty');
const checkedEl = document.getElementById('checked');
const errorEl = document.getElementById('error');
const gaugePanel = document.querySelector('.gauge-panel');
const gaugeProgress = document.getElementById('gauge-progress');
const gaugeNeedle = document.getElementById('gauge-needle');
const gaugeLength = gaugeProgress.getTotalLength();
const gaugeMid = document.getElementById('gauge-mid');
const gaugeMax = document.getElementById('gauge-max');
const gaugeScope = document.getElementById('gauge-scope');
const showAll = document.getElementById('show-all');
const heroLabel = document.querySelector('.hero-heading .metric-label');
const heroCaption = document.querySelector('.hero-caption');
const freshLabel = document.querySelector('.fresh-info [data-i18n="freshSessions"]');
const activityLabel = document.querySelector('.activity-summary [data-i18n="activityEvents"]');
const activityPhase = document.getElementById('activity-phase');
const activityElapsed = document.getElementById('activity-elapsed');
const activitySummary = document.getElementById('activity-summary');
const activityCount = document.getElementById('activity-count');
gaugeProgress.style.strokeDasharray = String(gaugeLength);
gaugeProgress.style.strokeDashoffset = String(gaugeLength);

const t = key => translations[language][key];
const locale = () => language === 'en' ? 'en-US' : 'ru-RU';
const number = value => new Intl.NumberFormat(locale()).format(value);
const decimal = value => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(value);
const rate = value => value == null ? '—' : decimal(value);
const modelName = session => `${session.model || t('modelUnknown')}${session.effort ? ' · ' + session.effort.toUpperCase() : ''}`;

function freshSessionsLabel(count) {
  if (language === 'en') return count === 1 ? 'recent measurement' : 'recent measurements';
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return 'свежий замер';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'свежих замера';
  return 'свежих замеров';
}

function activitySignalsLabel(count) {
  if (language === 'en') return count === 1 ? 'activity signal' : 'activity signals';
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return 'сигнал активности';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'сигнала активности';
  return 'сигналов активности';
}

function age(ms) {
  if (ms < 5000) return t('justNow');
  if (ms < 60_000) return `${Math.floor(ms / 1000)} ${t('secondsAgo')}`;
  return `${Math.floor(ms / 60_000)} ${t('minutesAgo')}`;
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function sourceName(source) {
  if (source === 'vscode') return t('vscode');
  if (source === 'cli') return t('cli');
  return t('codex');
}

function renderSession(session, now) {
  const card = element('article', `session ${session.fresh || session.turnActive ? 'active' : 'idle'}${selectedSessionId === session.id ? ' selected' : ''}`);
  const top = element('div', 'session-top');
  const title = element('div', 'session-title');
  title.append(element('span', 'status-dot'));
  title.append(element('h3', '', session.project || t('projectUnknown')));
  top.append(title);
  top.append(element('span', 'model', modelName(session)));
  card.append(top);

  const subline = element('div', 'session-subline');
  const ageEl = element('div', 'session-age', age(Math.max(0, now - session.at)));
  subline.append(ageEl);
  const focus = element('button', 'focus-button', selectedSessionId === session.id ? t('focused') : t('focus'));
  focus.type = 'button';
  focus.setAttribute('aria-pressed', String(selectedSessionId === session.id));
  focus.addEventListener('click', () => {
    selectedSessionId = selectedSessionId === session.id ? null : session.id;
    if (lastData) render(lastData, true);
  });
  subline.append(focus);
  card.append(subline);
  const body = element('div', 'session-body');
  const speed = element('div', 'speed');
  speed.append(element('div', 'metric-label', session.turnActive && session.rate == null
    ? t('awaitingResult') : t('rateLabel')));
  const value = element('div', 'speed-value');
  value.append(element('strong', '', rate(session.rate)));
  value.append(element('span', '', t('unit')));
  speed.append(value);
  const track = element('div', 'track');
  track.title = t('scale');
  const fill = element('div', 'fill');
  fill.style.width = `${Math.min(100, (session.rate || 0))}%`;
  track.append(fill);
  speed.append(track);
  body.append(speed);

  const details = element('div', 'details');
  for (const [label, value] of [
    [t('responseTokens'), session.responseTokens == null ? '—' : number(session.responseTokens)],
    [t('duration'), session.duration == null ? '—' : `${decimal(session.duration)} ${t('seconds')}`],
    [t('outputTotal'), number(session.output)],
  ]) {
    const row = element('div', 'detail');
    row.append(element('span', '', label));
    row.append(element('strong', '', value));
    details.append(row);
  }
  body.append(details);
  card.append(body);

  const foot = element('div', 'session-foot');
  const meta = element('div', 'session-meta');
  const client = element('span', '', `${t('client')}: ${sourceName(session.source)}`);
  client.title = t('clientHelp');
  meta.append(client);
  meta.append(element('span', 'method', session.method === 'output_start'
    ? t('outputStartMethod') : session.method === 'response'
      ? t('responseMethod') : session.method === 'interval' ? t('intervalMethod') : t('noRate')));
  meta.append(element('span', 'session-id', session.id.slice(0, 8)));
  foot.append(meta);
  const button = element('button', 'copy-button', t('copy'));
  button.type = 'button';
  button.disabled = session.rate == null;
  button.addEventListener('click', async () => {
    try {
      button.textContent = await window.pulse.share(session.id, language) ? t('copied') : t('copyFailed');
    } catch {
      button.textContent = t('copyFailed');
    }
    setTimeout(() => { if (button.isConnected) button.textContent = t('copy'); }, 1800);
  });
  foot.append(button);
  card.append(foot);
  return card;
}

function applyLanguage() {
  document.documentElement.lang = language;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  document.getElementById('lang-ru').setAttribute('aria-pressed', String(language === 'ru'));
  document.getElementById('lang-en').setAttribute('aria-pressed', String(language === 'en'));
}

function updateGauge(value, max, sampleKey, stale, scopeKey) {
  const key = `${value ?? 'none'}:${max}`;
  gaugePanel.classList.toggle('stale', stale);
  gaugeMid.textContent = number(max / 2);
  gaugeMax.textContent = value != null && value > max ? `${number(max)}+` : number(max);
  if (sampleKey !== lastGaugeSample) {
    if (lastGaugeSample != null && sampleKey && lastGaugeScope === scopeKey) {
      gaugePanel.classList.remove('pulse');
      void gaugePanel.offsetWidth;
      gaugePanel.classList.add('pulse');
      setTimeout(() => gaugePanel.classList.remove('pulse'), 750);
    }
    lastGaugeSample = sampleKey;
  }
  lastGaugeScope = scopeKey;
  if (key === lastGaugeTarget) return;
  lastGaugeTarget = key;
  if (gaugeFrame != null) cancelAnimationFrame(gaugeFrame);
  const fraction = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  gaugeFrame = requestAnimationFrame(() => {
    gaugeNeedle.style.transform = `rotate(${-90 + fraction * 180}deg)`;
    gaugeProgress.style.strokeDashoffset = String(gaugeLength * (1 - fraction));
    gaugeFrame = null;
  });
}

function formatElapsed(milliseconds) {
  const tenths = Math.max(0, Math.floor(milliseconds / 100));
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

function updateActivity() {
  if (!lastData) return;
  const session = lastData.sessions.find(item => item.id === selectedSessionId)
    || lastData.sessions.find(item => item.turnActive)
    || lastData.sessions[0];
  const active = Boolean(session?.turnActive);
  gaugePanel.classList.toggle('working', active);
  activitySummary.hidden = !session;
  if (session) {
    activityCount.textContent = number(session.activityCount || 0);
    activityLabel.textContent = activitySignalsLabel(session.activityCount || 0);
  }
  activityPhase.title = t('activityHelp');
  if (!session?.turnStartedAt) {
    activityPhase.textContent = t('gaugeCaption');
    activityElapsed.textContent = '';
    return;
  }
  const names = {
    working: 'activityWorking',
    reasoning: 'activityReasoning',
    tool: 'activityTool',
    writing: 'activityWriting',
    done: 'activityDone',
  };
  activityPhase.textContent = (active ? t('activityLast') + ' ' : '')
    + t(names[session.phase] || 'activityWorking');
  const end = active ? Date.now() : session.activityAt || session.turnStartedAt;
  activityElapsed.textContent = formatElapsed(end - session.turnStartedAt);
}

function render(data, force = false) {
  lastData = data;
  const recent = data.sessions.filter(session => session.fresh);
  const measured = recent.filter(session => session.rate != null);
  const selected = data.sessions.find(session => session.id === selectedSessionId);
  if (selectedSessionId && !selected) selectedSessionId = null;
  const target = selected ? selected.rate
    : measured.length ? measured.reduce((sum, session) => sum + session.rate, 0) : null;
  rateEl.textContent = rate(target);
  countEl.textContent = number(recent.length);
  freshLabel.textContent = freshSessionsLabel(recent.length);
  heroLabel.textContent = selected ? t('selectedHeroLabel')
    : data.scope ? t('projectHeroLabel') : t('heroLabel');
  heroCaption.textContent = selected ? t('selectedCaption') : t('heroCaption');
  gaugeScope.textContent = selected
    ? `${modelName(selected)} · ${selected.fresh ? age(Math.max(0, data.checkedAt - selected.at)) : t('staleMeasure')}`
    : data.scope ? `${t('projectScope')}: ${data.scope}` : t('allScope');
  showAll.hidden = !selected;
  const sampleKey = selected
    ? `${selected.id}:${selected.at}`
    : measured.map(session => `${session.id}:${session.at}`).join('|');
  updateGauge(target, selected ? 120 : 240, sampleKey,
    selected ? !selected.fresh : !measured.length, selected?.id || 'all');
  checkedEl.textContent = `${t('checked')} ${new Date(data.checkedAt).toLocaleTimeString(locale())}`;
  errorEl.hidden = !data.error;
  errorEl.textContent = data.error ? `${t('error')}: ${data.error}` : '';

  const key = JSON.stringify(data.sessions);
  if (force || key !== lastSessionsKey) {
    sessionsEl.replaceChildren(...data.sessions.map(session => renderSession(session, data.checkedAt)));
    lastSessionsKey = key;
  } else {
    sessionsEl.querySelectorAll('.session-age').forEach((node, index) => {
      node.textContent = age(Math.max(0, data.checkedAt - data.sessions[index].at));
    });
  }
  emptyEl.hidden = data.sessions.length > 0;
  updateActivity();
}

showAll.addEventListener('click', () => {
  selectedSessionId = null;
  if (lastData) render(lastData, true);
});
for (const code of ['ru', 'en']) {
  document.getElementById(`lang-${code}`).addEventListener('click', () => {
    language = code;
    localStorage.setItem('token-pulse-language', code);
    applyLanguage();
    if (lastData) render(lastData, true);
  });
}
applyLanguage();
setInterval(updateActivity, 100);
window.pulse.onUpdate(render);
window.pulse.snapshot().then(render);
