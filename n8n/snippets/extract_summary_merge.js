// Постобработка ответа модели для отчёта
const resp = $json.body ?? $json;
let txt =
  resp?.choices?.[0]?.message?.content ??
  resp?.choices?.[0]?.text ??
  resp?.output_text ?? '';

if (typeof txt !== 'string') txt = String(txt || '');

// убрать Markdown-заборы/управляющие символы
txt = txt.replace(/```[\s\S]*?```/g, '');
txt = txt.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+\n/g, '\n').trim();

// мягкий лимит 700 символов
const LIMIT = 700;
if (txt.length > LIMIT) {
  const cut = txt.slice(0, LIMIT);
  const last = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
  txt = last >= 100 ? cut.slice(0, last + 1) : cut + '…';
}

if (!txt) {
  const m = $('Build Metrics & Prompt').item.json.metrics ?? {};
  const apiError = resp?.error?.message ?? resp?.error ?? null;
  txt = [
    'Авто-резюме: текст от модели не получен.',
    `events=${m.count ?? 0}, p95=${m.p95_ms ?? '—'} ms, max=${m.max_ms ?? '—'} ms, errors=${m.errors ?? 0}`,
    apiError ? `OpenRouter error: ${apiError}` : 'OpenRouter: без явной ошибки'
  ].join('\n');
}

const base = $('Build Metrics & Prompt').item.json;
return [{ json: { ...base, ai_summary: txt } }];
