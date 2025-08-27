// Build Log — формируем запись и «пакет» для возможного отчёта
const ctx = $('Init & Start Timer').item.json;
const chat_id = $json.chat_id ?? ctx.chat_id;
const user_id = $json.user_id ?? ctx.user_id;
const started = $json.started_at ?? ctx.started_at ?? Date.now();
const ended_ms = Date.now();
const latency_ms = ended_ms - started;

// Попытка вытащить usage от LLM, если есть
const usage = $json.response?.tokenUsage || $json.tokenUsage || {};
const record = {
  ts: new Date().toISOString(),
  chat_id: String(chat_id),
  user_id: String(user_id ?? ''),
  request_id: $json.request_id ?? ctx.request_id,
  started_at_ms: started,
  ended_at_ms: ended_ms,
  latency_ms,
  status: $json.error ? 'error' : 'ok',
  model: $json.model || 'openrouter',
  tokens_in: usage.promptTokens ?? 0,
  tokens_out: usage.completionTokens ?? 0,
};

return [{
  json: {
    ...$json,
    chat_id, user_id,
    started_at_ms: started,
    ended_at_ms: ended_ms,
    latency_ms,
    packet: record,
    loki_body: {
      streams: [{
        stream: { app: 'n8n-bot', chat_id: String(chat_id), user_id: String(user_id ?? ''), request_id: record.request_id, model: record.model, status: record.status },
        values: [[ String(Date.now()*1e6), JSON.stringify(record) ]]
      }]
    }
  }
}];
