// Init & Start Timer — сохраняем started_at, request_id и компактный
контекст
const m = $json.message || $json.edited_message || {};
const started = $json.started_at ?? Date.now();
const reqId = $json.request_id ?? Math.random().toString(36).slice(2,
10).toUpperCase();
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
