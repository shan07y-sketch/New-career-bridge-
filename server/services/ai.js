'use strict';
/**
 * LLM provider layer. Works with free API keys from Google Gemini or Groq, and
 * also OpenRouter, OpenAI and Anthropic. The provider is detected from the key.
 * Models are discovered from the provider and the layer falls back to the next
 * model when one is unavailable or out of free quota.
 */
const crypto = require('node:crypto');

const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta',
    preferred: ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'],
  },
  groq: {
    label: 'Groq',
    base: 'https://api.groq.com/openai/v1',
    preferred: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant'],
  },
  openrouter: {
    label: 'OpenRouter',
    base: 'https://openrouter.ai/api/v1',
    preferred: ['meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-oss-20b:free', 'deepseek/deepseek-chat-v3-0324:free', 'qwen/qwen3-32b:free'],
  },
  openai: {
    label: 'OpenAI',
    base: 'https://api.openai.com/v1',
    preferred: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5-mini'],
  },
  anthropic: {
    label: 'Anthropic Claude',
    base: 'https://api.anthropic.com/v1',
    preferred: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5', 'claude-sonnet-4-5'],
  },
};

function detectProvider(key) {
  const k = String(key || '').trim();
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

/** Server-level key from environment variables. */
function envConfig() {
  const pairs = [
    ['AI_API_KEY', null], ['GEMINI_API_KEY', 'gemini'], ['GOOGLE_API_KEY', 'gemini'], ['GROQ_API_KEY', 'groq'],
    ['OPENROUTER_API_KEY', 'openrouter'], ['ANTHROPIC_API_KEY', 'anthropic'], ['OPENAI_API_KEY', 'openai'],
  ];
  for (const [name, provider] of pairs) {
    const key = (process.env[name] || '').trim();
    if (key) {
      const p = (process.env.AI_PROVIDER || provider || detectProvider(key) || '').toLowerCase();
      if (!PROVIDERS[p]) continue;
      return { provider: p, key, model: process.env.AI_MODEL || null, source: 'env', envName: name };
    }
  }
  return null;
}

class AIError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.kind = kind; // auth | model | quota | rate | server | network | unsupported | bad_output | not_configured
    this.status = status;
  }
}

const stats = { calls: 0, ok: 0, failed: 0, lastError: null, lastModel: null, lastAt: null };
const discovery = new Map(); // provider:keyhash -> { models, working, at }
const keyHash = (k) => crypto.createHash('sha256').update(k).digest('hex').slice(0, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- concurrency limit -------------------------------------------------------
let active = 0;
const waiters = [];
async function withSlot(fn) {
  if (active >= 2) await new Promise((r) => waiters.push(r));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  }
}

function baseFor(cfg) {
  return (process.env.AI_BASE_URL || PROVIDERS[cfg.provider].base).replace(/\/+$/, '');
}

async function http(url, { method = 'GET', headers = {}, body, timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  } catch (e) {
    if (e.name === 'AbortError') throw new AIError('network', 'The AI provider took too long to respond.');
    throw new AIError('network', `Could not reach the AI provider (${e.cause?.code || e.message}).`);
  } finally {
    clearTimeout(t);
  }
}

function errorMessage(data) {
  if (!data) return '';
  if (typeof data.error === 'string') return data.error;
  return data.error?.message || data.message || data.raw || JSON.stringify(data).slice(0, 300);
}

function classify(status, data) {
  const msg = errorMessage(data);
  const low = msg.toLowerCase();
  if (status === 401 || status === 403 || /api key not valid|invalid api key|invalid x-api-key|incorrect api key|api_key_invalid|permission denied/.test(low)) {
    return new AIError('auth', `The AI API key was rejected: ${msg}`, status);
  }
  if (status === 404 || /not found|does not exist|decommissioned|deprecated|no endpoints found|model_not_found|is not supported for generatecontent/.test(low)) {
    return new AIError('model', msg || 'Model not found', status);
  }
  if (status === 429) {
    if (/limit: 0|quota exceeded for metric|daily|per day|requests per day|insufficient_quota|credit/.test(low)) return new AIError('quota', msg, status);
    return new AIError('rate', msg, status);
  }
  if (status === 400 && /response_format|json mode|json_object|responsemimetype|system instruction|developer instruction|max_tokens|max_completion_tokens|temperature/.test(low)) {
    return new AIError('unsupported', msg, status);
  }
  if (status === 402) return new AIError('quota', msg || 'Payment required by the AI provider', status);
  if (status >= 500) return new AIError('server', msg || `AI provider error ${status}`, status);
  return new AIError('bad_request', msg || `AI request failed (${status})`, status);
}

// ---- model discovery ---------------------------------------------------------
function rankGemini(ids) {
  const version = (id) => parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
  return ids
    .filter((id) => /^gemini-(\d+(\.\d+)?-)?flash(-lite)?(-latest)?$/.test(id) || /^gemini-flash(-lite)?-latest$/.test(id))
    .sort((a, b) => (a.includes('lite') - b.includes('lite')) || (version(b) - version(a)));
}

async function listModels(cfg) {
  const base = baseFor(cfg);
  try {
    if (cfg.provider === 'gemini') {
      const r = await http(`${base}/models?pageSize=1000`, { headers: { 'x-goog-api-key': cfg.key }, timeoutMs: 15000 });
      if (!r.ok) throw classify(r.status, r.data);
      const ids = (r.data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => String(m.name).replace(/^models\//, ''));
      return rankGemini(ids);
    }
    if (cfg.provider === 'anthropic') {
      const r = await http(`${base}/models?limit=100`, { headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' }, timeoutMs: 15000 });
      if (!r.ok) throw classify(r.status, r.data);
      const ids = (r.data.data || []).map((m) => m.id);
      return [...ids.filter((id) => id.includes('haiku')), ...ids.filter((id) => id.includes('sonnet'))];
    }
    const r = await http(`${base}/models`, { headers: { authorization: `Bearer ${cfg.key}` }, timeoutMs: 15000 });
    if (!r.ok) throw classify(r.status, r.data);
    const models = r.data.data || [];
    let ids = models.map((m) => m.id);
    if (cfg.provider === 'openrouter') {
      ids = models.filter((m) => String(m.id).endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0)).map((m) => m.id);
    }
    const bad = /whisper|tts|guard|embed|moderation|audio|image|dall-e|vision-preview|realtime|transcribe|search|computer|codex|instruct-0|oss-safeguard/i;
    ids = ids.filter((id) => !bad.test(id));
    const score = (id) => (/70b|120b|gpt-oss|4\.1-mini|4o-mini|5-mini|llama-4|qwen3|deepseek|kimi/.test(id) ? 0 : 1);
    return ids.sort((a, b) => score(a) - score(b));
  } catch (e) {
    if (e instanceof AIError && e.kind === 'auth') throw e;
    return []; // listing is best-effort; the preferred list is still tried
  }
}

async function candidateModels(cfg) {
  const k = cfg.provider + ':' + keyHash(cfg.key) + ':' + (cfg.model || '');
  let entry = discovery.get(k);
  if (!entry || Date.now() - entry.at > 6 * 3600 * 1000) {
    const discovered = await listModels(cfg);
    const preferred = PROVIDERS[cfg.provider].preferred;
    const available = discovered.length ? preferred.filter((p) => discovered.includes(p)) : preferred;
    const list = [...new Set([cfg.model, ...available, ...discovered, ...(discovered.length ? [] : preferred)].filter(Boolean))];
    entry = { models: list, working: null, at: Date.now() };
    discovery.set(k, entry);
  }
  const ordered = entry.working ? [entry.working, ...entry.models.filter((m) => m !== entry.working)] : entry.models;
  return { entry, models: ordered };
}

// ---- provider calls -----------------------------------------------------------
async function callGemini(cfg, model, { system, prompt, json, temperature, maxTokens }, adapt) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: adapt.noSystem ? `${system}\n\n${prompt}` : prompt }] }],
    generationConfig: { temperature, maxOutputTokens: Math.max(maxTokens, 8192) },
  };
  if (!adapt.noSystem) body.systemInstruction = { parts: [{ text: system }] };
  if (json && !adapt.noJson) body.generationConfig.responseMimeType = 'application/json';
  const r = await http(`${baseFor(cfg)}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': cfg.key }, body,
  });
  if (!r.ok) throw classify(r.status, r.data);
  const cand = (r.data.candidates || [])[0];
  if (!cand) {
    const reason = r.data.promptFeedback?.blockReason;
    throw new AIError('bad_output', reason ? `The AI provider blocked the request (${reason}).` : 'The AI returned no answer.');
  }
  const text = (cand.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  if (!text.trim()) throw new AIError('bad_output', `The AI returned an empty answer (${cand.finishReason || 'unknown'}).`);
  return text;
}

async function callOpenAICompatible(cfg, model, { system, prompt, json, temperature, maxTokens }, adapt) {
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
  };
  if (!adapt.noTemperature) body.temperature = temperature;
  if (adapt.maxCompletion) body.max_completion_tokens = Math.max(maxTokens, 4096);
  else body.max_tokens = Math.max(maxTokens, 4096);
  if (json && !adapt.noJson) body.response_format = { type: 'json_object' };
  const headers = { authorization: `Bearer ${cfg.key}` };
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.PUBLIC_URL || 'https://careerbridge.app';
    headers['X-Title'] = 'CareerBridge';
  }
  const r = await http(`${baseFor(cfg)}/chat/completions`, { method: 'POST', headers, body });
  if (!r.ok) throw classify(r.status, r.data);
  const msg = r.data.choices?.[0]?.message;
  const text = typeof msg?.content === 'string' ? msg.content : Array.isArray(msg?.content) ? msg.content.map((c) => c.text || '').join('') : '';
  if (!text.trim()) throw new AIError('bad_output', 'The AI returned an empty answer.');
  return text;
}

async function callAnthropic(cfg, model, { system, prompt, temperature, maxTokens }, adapt) {
  const body = { model, max_tokens: Math.max(maxTokens, 4096), system, messages: [{ role: 'user', content: prompt }] };
  if (!adapt.noTemperature) body.temperature = temperature;
  const r = await http(`${baseFor(cfg)}/messages`, {
    method: 'POST', headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' }, body,
  });
  if (!r.ok) throw classify(r.status, r.data);
  const text = (r.data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  if (!text.trim()) throw new AIError('bad_output', 'The AI returned an empty answer.');
  return text;
}

async function callModel(cfg, model, opts) {
  const adapt = {};
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (cfg.provider === 'gemini') return await callGemini(cfg, model, opts, adapt);
      if (cfg.provider === 'anthropic') return await callAnthropic(cfg, model, opts, adapt);
      return await callOpenAICompatible(cfg, model, opts, adapt);
    } catch (e) {
      if (e.kind !== 'unsupported') throw e;
      const low = e.message.toLowerCase();
      if (/system instruction|developer instruction/.test(low) && !adapt.noSystem) adapt.noSystem = true;
      else if (/response_format|json|responsemimetype/.test(low) && !adapt.noJson) adapt.noJson = true;
      else if (/max_tokens/.test(low) && !adapt.maxCompletion) adapt.maxCompletion = true;
      else if (/temperature/.test(low) && !adapt.noTemperature) adapt.noTemperature = true;
      else throw new AIError('model', e.message, e.status);
    }
  }
  throw new AIError('model', 'The model rejected the request format.');
}

function parseJsonLoose(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AIError('bad_output', 'The AI answer was not valid JSON.');
  const slice = t.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new AIError('bad_output', 'The AI answer was not valid JSON.');
    }
  }
}

/**
 * Runs a completion. `cfg` = { provider, key, model }.
 * Returns { text, data (parsed JSON when json:true), model, provider }.
 */
async function complete(cfg, { system, prompt, json = false, temperature = 0.4, maxTokens = 2048 }) {
  if (!cfg || !cfg.key) throw new AIError('not_configured', 'No AI provider is connected. Add a free Gemini or Groq API key in Settings → AI.');
  return withSlot(async () => {
    stats.calls += 1;
    stats.lastAt = new Date().toISOString();
    const { entry, models } = await candidateModels(cfg);
    let lastErr = null;
    const tried = [];
    for (const model of models.slice(0, 6)) {
      tried.push(model);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const sys = json ? `${system}\nRespond with a single valid JSON object only, no markdown.` : system;
          const text = await callModel(cfg, model, { system: sys, prompt, json, temperature, maxTokens });
          const data = json ? parseJsonLoose(text) : null;
          entry.working = model;
          stats.ok += 1;
          stats.lastModel = model;
          stats.lastError = null;
          return { text, data, model, provider: cfg.provider };
        } catch (e) {
          lastErr = e;
          if (e.kind === 'auth' || e.kind === 'network' || e.kind === 'not_configured') {
            stats.failed += 1;
            stats.lastError = e.message;
            throw e;
          }
          if ((e.kind === 'rate' || e.kind === 'server' || e.kind === 'bad_output') && attempt === 0) {
            await sleep(e.kind === 'rate' ? 2500 : 1200);
            continue;
          }
          break; // model / quota / unsupported → next model
        }
      }
    }
    stats.failed += 1;
    const msg = lastErr ? lastErr.message : 'No model available';
    stats.lastError = msg;
    const kind = lastErr?.kind === 'quota' || lastErr?.kind === 'rate' ? 'quota' : (lastErr?.kind || 'model');
    const err = new AIError(kind, kind === 'quota'
      ? `The free AI quota is used up for now (tried ${tried.join(', ')}). Wait a minute or add another key in Settings → AI. Details: ${msg}`
      : `AI request failed (tried ${tried.join(', ')}): ${msg}`, lastErr?.status);
    throw err;
  });
}

module.exports = { PROVIDERS, detectProvider, envConfig, complete, AIError, stats, parseJsonLoose, listModels, discovery };
