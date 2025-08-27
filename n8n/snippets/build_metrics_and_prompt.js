// Универсальный парсер ответа Loki + формирование метрик и промпта
const res = $json?.data?.result ?? $json?.body?.data?.result ?? [];
const logs = [];
for (const s of res) for (const [ts, line] of (s.values||[])) {
  try { logs.push(JSON.parse(line)); } catch { logs.push({raw: line}); }
}
// добавим текущий пакет сверху, если есть
const packet = $('Build Log').item.json.packet || {};
if (Object.keys(packet).length) logs.unshift(packet);

const lat = logs.map(e => e.latency_ms).filter(n => typeof n === 'number').sort((a,b)=>a-b);
const p95 = lat.length ? Math.trunc(lat[Math.floor(0.95*(lat.length-1))]) : null;
const max = lat.length ? lat[lat.length-1] : null;
const errors = logs.filter(e => e.status==='error'||e.error).length;
const model = (logs.find(e=>e.model)?.model) || 'unknown';
const user_id = logs.find(e=>e.user_id)?.user_id || '';
const request_id = logs.find(e=>e.request_id)?.request_id || (Math.random().toString(36).slice(2,10)).toUpperCase();

const metrics = { count: logs.length, p95_ms: p95, max_ms: max, errors, model, user_id, request_id };

// приоритет/подсказка причины кодом, чтобы модель не «фантазировала»
let priority = 'S3';
if ((metrics.p95_ms ?? 0) > 6000) priority = 'S1';
else if ((metrics.p95_ms ?? 0) > 3000 || (metrics.errors ?? 0) > 0) priority = 'S2';
let cause_hint = 'нормально';
if ((metrics.errors ?? 0) > 0)                cause_hint = 'ошибка кода/n8n';
else if ((metrics.p95_ms ?? 0) > 60000)       cause_hint = 'таймаут';
else if ((metrics.p95_ms ?? 0) > 3000)        cause_hint = 'медленная модель/нагрузка';

const sample = logs.slice(0,20).map(e => JSON.stringify(e).slice(0,300)).join('\n');
const header = `Ты DevOps-ассистент. Дай отчёт (5–8 строк), без Markdown/JSON: что произошло; причина; факты; user_id/модель/токены; приоритет; рекомендации (буллетами). Макс 700 символов.`;
const prompt = `${header}\nПриоритет: ${priority}\nПодсказка причины: ${cause_hint}\nМетрики: ${JSON.stringify(metrics)}\nФрагменты логов:\n${sample}`;

return [{ json: { ...$json, metrics, priority, cause_hint, request_id, prompt } }];
