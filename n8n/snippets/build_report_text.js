// Build Report Text — финальный текст для канала
const req = $json.request_id  || '(нет id)';
const m = $json.metrics || {};
const text = [
  `🧾 Отчёт по запросу ${req}`,
  `— событий: ${m.count ?? 0}`,
  `— p95: ${m.p95_ms ?? '—'} ms, max: ${m.max_ms ?? '—'} ms`,
  `— ошибок: ${m.errors ?? 0}`,
  '',
  $json.ai_summary || '(нет ответа от модели)'
].join('\n');

return [{ json: { ...$json, report_text: text } }];
