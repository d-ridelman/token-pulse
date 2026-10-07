function formatShare(session, language = 'ru', version = '0.2.0') {
  if (!Number.isFinite(session?.rate) || !Number.isFinite(session.responseTokens)
      || !Number.isFinite(session.duration)) return null;
  const en = language === 'en';
  const locale = en ? 'en-US' : 'ru-RU';
  const decimal = value => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const integer = value => new Intl.NumberFormat(locale).format(value);
  const model = String((session.model || (en ? 'Unknown' : 'Неизвестна'))
    + (session.effort ? ` · ${session.effort.toUpperCase()}` : ''))
    .replace(/[\r\n]/g, ' ').slice(0, 80);
  const method = session.method === 'output_start'
    ? (en ? 'first response item to usage record' : 'от первого элемента ответа до записи расхода')
    : session.method === 'response'
      ? (en ? 'completed model response' : 'завершённый ответ модели')
      : (en ? 'interval between usage records' : 'интервал между записями');
  return en
    ? `Token Pulse v${version}
Model: ${model}
Output: ${integer(session.responseTokens)} tokens in ${decimal(session.duration)} s
Speed: ${decimal(session.rate)} tokens/s
Measurement: ${method}`
    : `Token Pulse v${version}
Модель: ${model}
Вывод: ${integer(session.responseTokens)} токенов за ${decimal(session.duration)} с
Скорость: ${decimal(session.rate)} ток/с
Замер: ${method}`;
}

module.exports = { formatShare };
