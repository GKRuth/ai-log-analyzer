(https://github.com/user-attachments/files/22005649/n_8_n_telegram_loki_reports_git_hub_package.1.md)
# n8n-telegram-loki-reports

Телеграм-бот на **n8n** с «умными» отчётами о медленных запросах (Loki + Grafana), Prometheus/Node Exporter для метрик. Ориентир: одна ВМ (\~7 ГБ RAM), всё в Docker. Можно работать с внешним LLM (OpenRouter) или локальным (Ollama/LM Studio).

---

## 📦 Репозиторий — структура

```text
.
├─ README.md                  # это описание
├─ docker-compose.yml         # быстрый подъём всех сервисов
├─ .env.example               # шаблон переменных окружения (копируй в .env)
├─ n8n/
│  ├─ workflows/
│  │  ├─ bot-and-reports.example.json    # импорт в n8n (заглушка, см. ниже)
│  │  └─ probes.example.json             # опциональные пробы A/B/C для дебага
│  └─ snippets/                          # код Function-узлов (копипаст в UI n8n)
│     ├─ init_start_timer.js
│     ├─ build_log.js
│     ├─ make_loki_window.js
│     ├─ build_metrics_and_prompt.js
│     ├─ extract_summary_merge.js
│     ├─ build_report_text.js
│     ├─ probe_A_build_log.js
│     ├─ probe_B_fetch_loki.js
│     └─ probe_C_metrics_summary.js
├─ grafana/
│  ├─ provisioning/
│  │  ├─ datasources/datasource.yml      # Loki/Prometheus подхватятся автоматически
│  │  └─ dashboards/dashboards.yml
│  └─ dashboards/
│     └─ n8n-telegram.json               # пример дашборда (p95, ошибки, счётчики)
├─ loki/
│  └─ config/loki-config.yml
├─ promtail/
│  └─ config/promtail-config.yml
├─ prometheus/
│  └─ prometheus.yml
└─ docs/
   └─ architecture.mmd                   # диаграмма (Mermaid)
```

> **Важно:** сюда **не кладём секреты**. Все токены — только через `.env` или Portainer → Env.

---

## 🧭 Что это делает (коротко)

- Вершина: обычный чат-бот.
- Если ответ пользователю занял **> 60 сек**, n8n собирает окно логов из **Loki**, считает метрики и отправляет краткий отчёт в отдельный канал (например, `@slow_reports_xyz`).
- Observability: Grafana (дашборды), Prometheus + node\_exporter.

Диаграмма:

```mermaid
flowchart LR
  tg[Telegram] -->|Webhook| n8n
  subgraph n8n
    T[Telegram Trigger]
    C2[Code2 / sim (/testslow)]
    IT[Init & Start Timer]
    LLM[Chat Model]
    ENS[Ensure Text]
    SEND[Telegram Send Message]
    BL[Build Log]
    P2L[Push to Loki]
    IF{latency_ms > 60s}
    MW[Make Loki Window]
    FL[Fetch Loki Window]
    BM[Build Metrics & Prompt]
    AR[Analyze (LLM/Off)]
    ES[Extract Summary]
    BT[Build Report Text]
    SENDCH[Telegram → Reports Channel]
  end

  T-->C2-->IT-->LLM-->ENS-->SEND-->BL-->P2L-->IF
  IF -- true --> MW --> FL --> BM --> AR --> ES --> BT --> SENDCH

  subgraph observability
    Loki
    Promtail
    Grafana
    Prometheus
  end

  P2L --> Loki
  Promtail --> Loki
  Grafana --> Loki
  Grafana --> Prometheus
  node_exporter((node_exporter)) --> Prometheus
```

---

## 🚀 Быстрый старт

1. **Склонируй** и создай `.env`:

```bash
cp .env.example .env
# открой .env и заполни переменные (токены, URL и т.д.)
```

2. **Docker network** (если используешь внешнюю `proxy`):

```bash
docker network create proxy || true
```

3. **Подними стек**:

```bash
docker compose up -d
```

4. **Зайди в n8n** → `http://<host>:5678` → **Settings → Import** и импортируй файл `n8n/workflows/bot-and-reports.example.json` (или собери по сниппетам ниже).

5. **Grafana** → `http://<host>:3000` (логин/пароль по умолчанию admin/admin, измени) — должны подхватиться дата-сорсы и пример дашборд.

6. **Телеграм-бот**: добавь бота в канал отчётов **админом**, Chat ID можно числом (`REPORT_CHAT_ID`).

> Для работы с **локальным LLM** (Ollama/LM Studio) см. раздел «Локальная модель» ниже.

---

## 🔧 Конфиги и файлы (копипаст)

### `.env.example`

```dotenv
# ── Бот/канал ───────────────────────────────────────────
TELEGRAM_BOT_TOKEN=__PUT_YOUR_TOKEN__
REPORT_CHAT_ID=-100xxxxxxxxxx

# ── n8n ─────────────────────────────────────────────────
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_ENCRYPTION_KEY=__GENERATE_RANDOM_32_CHARS__
N8N_BASIC_AUTH_ACTIVE=false
N8N_BASIC_AUTH_USER=
N8N_BASIC_AUTH_PASSWORD=

# ── LLM (внешний или локальный) ─────────────────────────
# Вариант A: OpenRouter (внешний)
OPENROUTER_API_KEY=__PUT_YOUR_OPENROUTER_KEY__
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=google/gemini-2.5-flash-lite

# Вариант B: локальная LLM (Ollama/LM Studio) — пример
# LLM_BASE_URL=http://ollama:11434/v1
# LLM_MODEL=gemma2:2b-instruct
# LLM_API_KEY=ollama

# Глобальный рубильник LLM (1=вкл, 0=выкл)
LLM_ENABLED=1
MAX_LLM_CALLS_PER_DAY=500

# ── Loki/Grafana/Prometheus ─────────────────────────────
LOKI_URL=http://loki:3100
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
PROMETHEUS_SCRAPE_INTERNAL=true
```

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  n8n:
    image: n8nio/n8n:1.107.4
    restart: unless-stopped
    env_file: [.env]
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PORT=${N8N_PORT}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - GENERIC_TIMEZONE=Europe/Moscow
      - NODE_FUNCTION_ALLOW_BUILTIN=buffer,crypto
      - NODE_FUNCTION_ALLOW_EXTERNAL=
      - WEBHOOK_URL=
      - LOKI_URL=${LOKI_URL}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - LLM_BASE_URL=${LLM_BASE_URL}
      - LLM_MODEL=${LLM_MODEL}
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_ENABLED=${LLM_ENABLED}
      - MAX_LLM_CALLS_PER_DAY=${MAX_LLM_CALLS_PER_DAY}
      - REPORT_CHAT_ID=${REPORT_CHAT_ID}
    ports:
      - "5678:5678"
    volumes:
      - n8n-data:/home/node/.n8n
    networks: [proxy]

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    networks: [proxy]
    depends_on: [loki]

  loki:
    image: grafana/loki:latest
    restart: unless-stopped
    command: ["-config.file=/etc/loki/local-config.yaml"]
    volumes:
      - ./loki/config/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    ports:
      - "3100:3100"
    networks: [proxy]

  promtail:
    image: grafana/promtail:latest
    restart: unless-stopped
    command: ["-config.file=/etc/promtail/config.yml"]
    volumes:
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./promtail/config/promtail-config.yml:/etc/promtail/config.yml:ro
    networks: [proxy]

  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    command:
      - --config.file=/etc/prometheus/prometheus.yml
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks: [proxy]

  node_exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped
    pid: host
    network_mode: host

volumes:
  n8n-data:
  grafana-data:
  loki-data:
  prometheus-data:

networks:
  proxy:
    external: true
```

### `n8n/snippets/init_start_timer.js`

```js
// Init & Start Timer — сохраняем started_at, request_id и компактный контекст
const m = $json.message || $json.edited_message || {};
const started = $json.started_at ?? Date.now();
const reqId = $json.request_id ?? Math.random().toString(36).slice(2,10).toUpperCase();

return [{
  json: {
    started_at: started,
    request_id: reqId,
    chat_id: m.chat?.id ?? $json.chat_id,
    user_id: m.from?.id ?? $json.user_id,
    message_id: m.message_id ?? $json.message_id,
    text: (m.text ?? '').slice(0, 1500),
    has_image: !!(m.photo && m.photo.length),
    input: m.text ?? '' // если Memory ждёт input
  }
}];
```

### `n8n/snippets/build_log.js`

```js
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
```

### `n8n/snippets/make_loki_window.js`

```js
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
```

### `n8n/snippets/build_metrics_and_prompt.js`

```js
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
```

### `n8n/snippets/extract_summary_merge.js`

````js
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
````

### `n8n/snippets/build_report_text.js`

```js
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
```

### `grafana/provisioning/datasources/datasource.yml`

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: true
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
```

### `grafana/provisioning/dashboards/dashboards.yml`

```yaml
apiVersion: 1
providers:
  - name: 'n8n-telegram'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

### `grafana/dashboards/n8n-telegram.json`

> Примерный дашборд с панелями: p95 за 15м, ошибки по моделям за 10м, количество событий по user за 5м. Используй запросы:

```
quantile_over_time(0.95, {app="n8n-bot"} | json | unwrap latency_ms [15m])

sum by (model) (count_over_time({app="n8n-bot",status="error"}[10m]))

sum by (user_id) (count_over_time({app="n8n-bot"}[5m]))
```

(Импортируй через Grafana → Dashboards → Import и подставь свою JSON-конфигурацию.)

### `loki/config/loki-config.yml`

```yaml
server:
  http_listen_port: 3100
positions:
  filename: /loki/positions.yaml
common:
  path: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h
ruler:
  alertmanager_url: http://localhost:9093
```

### `promtail/config/promtail-config.yml`

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0
positions:
  filename: /tmp/positions.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push
scrape_configs:
  - job_name: docker
    static_configs:
      - targets: [localhost]
        labels:
          job: docker
          __path__: /var/lib/docker/containers/*/*-json.log
```

### `prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['prometheus:9090']
  - job_name: node_exporter
    static_configs:
      - targets: ['localhost:9100']
```

---

## 🧪 Импорт воркфлоу n8n

В `n8n/workflows/*.example.json` оставлены заглушки. Импортируй свой экспорт или собери схему, используя сниппеты из `n8n/snippets`. Ключевые узлы:

- **Init & Start Timer** → `init_start_timer.js`
- **Build Log** → `build_log.js`
- **Push to Loki** (HTTP Request) → `POST ${LOKI_URL}/loki/api/v1/push`
- **IF Slow?** → `{{ Number($json.latency_ms || 0) > 60000 }}`
- **Make Loki Window** → `make_loki_window.js`
- **Fetch Loki Window** (HTTP Request) → `GET ${LOKI_URL}/loki/api/v1/query_range` (параметры из `make_loki_window.js`)
- **Build Metrics & Prompt** → `build_metrics_and_prompt.js`
- **Analyze** (опц., можно отключить при нуле токенов) → вызов LLM
- **Extract Summary** → `extract_summary_merge.js`
- **Build Report Text** → `build_report_text.js`
- **Telegram Send Message** → в канал (`REPORT_CHAT_ID`), Parse Mode = None

---

## 🔐 Безопасность и практики

- **Секреты** — только в `.env`/credentials; не коммить.
- **Telegram Parse Mode** = None (иначе `can't parse entities`).
- **LLM kill switch**: `LLM_ENABLED=0` отключит обращения к модели (ветку отчёта тоже можно заглушить).
- **Memory** (если нужна в чатовой ветке): Context Window Length = 2, ключ по `chat_id`.
- **Права бота** в канале отчётов: как минимум **Post Messages**.

---

## 🧩 Типичные ошибки и решения

- `Bad Request: chat not found` → неверный `REPORT_CHAT_ID` или бот не админ канала.
- `JSON parameter needs to be valid JSON` → в HTTP-узле выбери **Send Body: JSON**.
- Loki 400 parse error → проверь `start/end` в ns (умножение на `1e6`).
- IF ожидает boolean → `{{ Number($json.latency_ms || 0) > 60000 }}` + оператор **is true**.
- Telegram `can't parse entities` → Parse Mode = None или экранируй MarkdownV2.
- `Prompt tokens limit exceeded` / «жрёт токены» → без AI Agent; Chat Model с двумя сообщениями; Memory K=2.

---

## 🧠 Локальная модель вместо внешней

Можно подключить Ollama/LM Studio:

- **Base URL**: `http://ollama:11434/v1` (или `http://<tailscale-ip>:11434/v1`)
- **Model**: `gemma2:2b-instruct`
- **API Key**: произвольная строка (например, `ollama`)

Смотри также: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` в `.env`.

---

## 📄 Лицензия

MIT (на ваше усмотрение).



---

# bot-and-reports.example.json

Ниже — минимальный, **унифицированный** воркфлоу без Agent-нод. Он работает с любым OpenAI‑совместимым LLM (OpenRouter, Ollama, LM Studio) через переменные окружения:

- `LLM_BASE_URL` — базовый URL (`https://openrouter.ai/api/v1` или `http://ollama:11434/v1` и т.п.)
- `LLM_API_KEY` — ключ (для Ollama/LM Studio можно заглушку `local`)
- `LLM_MODEL` — имя модели (например, `google/gemini-2.5-flash-lite` или `gemma2:2b-instruct`)
- `LLM_ENABLED` — `1`/`0` для включения анализа отчётов
- `SLOW_THRESHOLD_MS` — порог медленности (по умолчанию 60000)
- `LOKI_URL`, `REPORT_CHAT_ID` — Loki и канал отчётов

> Перед импортом убедись, что в n8n заданы переменные окружения (через `.env` или в контейнере). После импорта просто выбери креды для Telegram.

```json
{
  "name": "bot-and-reports (example)",
  "nodes": [
    {
      "parameters": {},
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "typeVersion": 1,
      "position": [-1200, -600]
    },
    {
      "parameters": {
        "jsCode": "// нормализуем вход и ставим метку времени старта
const m = $json.message || $json.edited_message || {};
const started = Date.now();
const reqId = Math.random().toString(36).slice(2,10).toUpperCase();
return [{ json: {
  started_at: started,
  chat_id: m.chat?.id,
  user_id: m.from?.id,
  message_id: m.message_id,
  text: (m.text ?? '').slice(0, 1500),
  request_id: reqId
}}];"
      },
      "name": "Init & Start Timer",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-960, -600]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$env.LLM_BASE_URL}}/chat/completions",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "=Bearer {{$env.LLM_API_KEY}}" },
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={
  \"model\": \"={{$env.LLM_MODEL}}\",
  \"messages\": [
    { \"role\": \"system\", \"content\": \"Отвечай кратко (1–2 предложения), по-русски. Без Markdown и JSON.\" },
    { \"role\": \"user\", \"content\": \"={{ $item(0).$node['Init & Start Timer'].json.text || $item(0).$node['Telegram Trigger'].json.message.text || '' }}\" }
  ],
  \"temperature\": 0.2,
  \"max_tokens\": {{ Number($env.LLM_MAX_TOKENS || 120) }}
}"
      },
      "name": "Chat LLM (HTTP)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-720, -600]
    },
    {
      "parameters": {
        "jsCode": "const resp = $json.body ?? $json;
let txt = resp?.choices?.[0]?.message?.content ?? resp?.choices?.[0]?.text ?? resp?.output_text ?? '';
return [{ json: { ...$json, reply_text: String(txt||'').trim() || 'Готов помочь.' } }];"
      },
      "name": "Ensure Text",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-520, -600]
    },
    {
      "parameters": {
        "chatId": "={{ $json.chat_id || $item(0).$node['Init & Start Timer'].json.chat_id || $json.message?.chat?.id }}",
        "text": "={{ $json.reply_text }}",
        "additionalFields": { "appendAttribution": false, "parse_mode": "None" }
      },
      "name": "Telegram Send Reply",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [-320, -600]
    },
    {
      "parameters": {
        "jsCode": "// Build Log — формируем запись и пакет для Loki
const init = $('Init & Start Timer').item.json;
const ended_ms = Date.now();
const latency_ms = ended_ms - init.started_at;
const resp = $json.body ?? $json;
const usage = resp?.usage || {};
const record = {
  ts: new Date().toISOString(),
  chat_id: String(init.chat_id),
  user_id: String(init.user_id||''),
  request_id: String(init.request_id),
  started_at_ms: init.started_at,
  ended_at_ms,
  latency_ms,
  status: 'ok',
  model: String($env.LLM_MODEL || 'llm'),
  tokens_in: usage.prompt_tokens ?? usage.inputTokens ?? 0,
  tokens_out: usage.completion_tokens ?? usage.outputTokens ?? 0,
  reply_text: String($json.reply_text||'').slice(0, 4000)
};
return [{ json: {
  ...$json,
  latency_ms,
  loki_body: { streams: [{
    stream: { app: 'n8n-bot', chat_id: record.chat_id, user_id: record.user_id, request_id: record.request_id, model: record.model, status: record.status },
    values: [[ String(Date.now()*1e6), JSON.stringify(record) ]]
  }]}
}}];"
      },
      "name": "Build Log",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-720, -360]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$env.LOKI_URL}}/loki/api/v1/push",
        "sendHeaders": true,
        "headerParameters": { "parameters": [ {"name": "Content-Type", "value": "application/json"} ] },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.loki_body }}"
      },
      "name": "Push to Loki",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-520, -360]
    },
    {
      "parameters": {
        "conditions": {
          "options": { "version": 2 },
          "conditions": [
            { "leftValue": "={{ Number($json.latency_ms || 0) > Number($env.SLOW_THRESHOLD_MS || 60000) }}", "operator": {"type":"boolean","operation":"true","singleValue": true} }
          ],
          "combinator": "and"
        }
      },
      "name": "Slow? > threshold",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [-320, -360]
    },
    {
      "parameters": {
        "jsCode": "// окно поиска по chat_id+request_id
const init = $('Init & Start Timer').item.json;
const start = Math.max(0, init.started_at - 120000);
const end   = Date.now() + 60000;
return [{ json: {
  chat_id: String(init.chat_id),
  request_id: String(init.request_id),
  loki_query: `{app=\\"n8n-bot\\", chat_id=\\"${init.chat_id}\\", request_id=\\"${init.request_id}\\"} | json`,
  start_ns: String(start*1e6),
  end_ns: String(end*1e6),
  limit: 1000,
  direction: 'backward'
}}];"
      },
      "name": "Make Loki Window",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-120, -360]
    },
    {
      "parameters": {
        "url": "={{$env.LOKI_URL}}/loki/api/v1/query_range",
        "sendQuery": true,
        "queryParameters": { "parameters": [
          {"name":"query","value":"={{$json.loki_query}}"},
          {"name":"start","value":"={{$json.start_ns}}"},
          {"name":"end","value":"={{$json.end_ns}}"},
          {"name":"limit","value":"={{$json.limit}}"},
          {"name":"direction","value":"backward"}
        ]}
      },
      "name": "Fetch Loki Window",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [80, -360],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "jsCode": "// парсим Loki + метрики + промпт
const res = $json?.data?.result ?? $json?.body?.data?.result ?? [];
const logs = [];
for (const s of res) for (const [ts, line] of (s.values||[])) { try { logs.push(JSON.parse(line)); } catch { logs.push({raw: line}); } }
const lat = logs.map(e=>e.latency_ms).filter(n=>typeof n==='number').sort((a,b)=>a-b);
const p95 = lat.length ? Math.trunc(lat[Math.floor(0.95*(lat.length-1))]) : null;
const max = lat.length ? lat[lat.length-1] : null;
const errors = logs.filter(e=>e.status==='error'||e.error).length;
const model = (logs.find(e=>e.model)?.model) || 'unknown';
const user_id = logs.find(e=>e.user_id)?.user_id || '';
const request_id = logs.find(e=>e.request_id)?.request_id || $('Init & Start Timer').item.json.request_id;
const sample = logs.slice(0,20).map(e => JSON.stringify(e).slice(0,300)).join('\n');
const metrics = { count: logs.length, p95_ms: p95, max_ms: max, errors, model, user_id, request_id };
const header = `Ты DevOps-ассистент. Дай краткий отчёт (5–8 строк), без Markdown/JSON.`;
const prompt = `${header}\nМетрики: ${JSON.stringify(metrics)}\nФрагменты логов:${sample ? '\n'+sample : ' (пусто)'}\n`;
return [{ json: { ...$json, metrics, request_id, prompt } }];"
      },
      "name": "Build Metrics & Prompt",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [280, -360]
    },
    {
      "parameters": {
        "conditions": {
          "options": { "version": 2 },
          "conditions": [ { "leftValue": "={{ String($env.LLM_ENABLED || '1') === '1' }}", "operator": {"type":"boolean","operation":"true","singleValue": true} } ],
          "combinator": "and"
        }
      },
      "name": "LLM enabled?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [480, -360]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{$env.LLM_BASE_URL}}/chat/completions",
        "sendHeaders": true,
        "headerParameters": { "parameters": [
          { "name": "Authorization", "value": "=Bearer {{$env.LLM_API_KEY}}" },
          { "name": "Content-Type", "value": "application/json" }
        ] },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={
  \"model\": \"={{$env.LLM_MODEL}}\",
  \"messages\": [
    { \"role\": \"system\", \"content\": \"Ты DevOps-помощник. Будь кратким и по делу.\" },
    { \"role\": \"user\", \"content\": \"={{$json.prompt}}\" }
  ],
  \"temperature\": 0.2,
  \"max_tokens\": 180
}"
      },
      "name": "OpenRouter Analyze (HTTP)",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [680, -440],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "jsCode": "const resp = $json.body ?? $json;
let txt = resp?.choices?.[0]?.message?.content ?? resp?.choices?.[0]?.text ?? resp?.output_text ?? '';
if (typeof txt !== 'string') txt = String(txt||'');
const m = $('Build Metrics & Prompt').item.json.metrics || {};
if (!txt.trim()) txt = `Авто-резюме: текста нет. events=${m.count||0}, p95=${m.p95_ms||'—'} ms, max=${m.max_ms||'—'} ms, errors=${m.errors||0}`;
return [{ json: { ...$('Build Metrics & Prompt').item.json, ai_summary: txt } }];"
      },
      "name": "Extract Summary",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [880, -440]
    },
    {
      "parameters": {
        "jsCode": "const m = $json.metrics || {};
const text = [
  `🧾 Отчёт по запросу ${$json.request_id || '(нет id)'}`,
  `— событий: ${m.count ?? 0}`,
  `— p95: ${m.p95_ms ?? '—'} ms, max: ${m.max_ms ?? '—'} ms`,
  `— ошибок: ${m.errors ?? 0}`,
  '',
  $json.ai_summary || '(нет ответа от модели)'
].join('\n');
return [{ json: { ...$json, report_text: text } }];"
      },
      "name": "Build Report Text",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1080, -440]
    },
    {
      "parameters": {
        "chatId": "={{$env.REPORT_CHAT_ID}}",
        "text": "={{$json.report_text}}",
        "additionalFields": { "appendAttribution": false, "parse_mode": "None" }
      },
      "name": "Telegram Send Report",
      "type": "n8n-nodes-base.telegram",
      "typeVersion": 1.2,
      "position": [1280, -440]
    }
  ],
  "connections": {
    "Telegram Trigger": { "main": [[{ "node": "Init & Start Timer", "type": "main", "index": 0 }]] },
    "Init & Start Timer": { "main": [[{ "node": "Chat LLM (HTTP)", "type": "main", "index": 0 }]] },
    "Chat LLM (HTTP)": { "main": [[{ "node": "Ensure Text", "type": "main", "index": 0 }]] },
    "Ensure Text": { "main": [[{ "node": "Telegram Send Reply", "type": "main", "index": 0 }, { "node": "Build Log", "type": "main", "index": 0 }]] },
    "Build Log": { "main": [[{ "node": "Push to Loki", "type": "main", "index": 0 }, { "node": "Slow? > threshold", "type": "main", "index": 0 }]] },
    "Slow? > threshold": { "main": [[{ "node": "Make Loki Window", "type": "main", "index": 0 }]] },
    "Make Loki Window": { "main": [[{ "node": "Fetch Loki Window", "type": "main", "index": 0 }]] },
    "Fetch Loki Window": { "main": [[{ "node": "Build Metrics & Prompt", "type": "main", "index": 0 }]] },
    "Build Metrics & Prompt": { "main": [[{ "node": "LLM enabled?", "type": "main", "index": 0 }]] },
    "LLM enabled?": { "main": [[{ "node": "OpenRouter Analyze (HTTP)", "type": "main", "index": 0 }]] },
    "OpenRouter Analyze (HTTP)": { "main": [[{ "node": "Extract Summary", "type": "main", "index": 0 }]] },
    "Extract Summary": { "main": [[{ "node": "Build Report Text", "type": "main", "index": 0 }]] },
    "Build Report Text": { "main": [[{ "node": "Telegram Send Report", "type": "main", "index": 0 }]] }
  },
  "active": false,
  "settings": { "executionOrder": "v1" }
}
```

## .env.example (дополнения)

```dotenv
# LLM (любой OpenAI-совместимый)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-...
LLM_MODEL=google/gemini-2.5-flash-lite
LLM_MAX_TOKENS=120
LLM_ENABLED=1
SLOW_THRESHOLD_MS=60000

# Loki / Reports
LOKI_URL=http://loki:3100
REPORT_CHAT_ID=-100xxxxxxxxxx
```

**Импорт**: в n8n → Settings → Import from file → выбери содержимое JSON выше. После импорта назначь креды Telegram у двух нод «Telegram …».

