// Make Loki Window — окно поиска по request_id
const start = Math.max(0, ($json.started_at_ms ?? Date.now()) - 120000);
const end   = ($json.ended_at_ms ?? Date.now()) + 60000;

return [{
  json: {
    ...$json,
    loki_query: `{app="n8n-bot", chat_id="${$json.chat_id}", request_id="${$json.request_id}"} | json`,
    start_ns: String(start * 1e6),
    end_ns:   String(end   * 1e6),
    limit: 1000,
    direction: 'backward'
  }
}];
