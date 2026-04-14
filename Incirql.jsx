import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import {
  MessageSquare,
  Search,
  Globe,
  ChevronLeft,
  Send,
  CheckCheck,
  Shield,
  Fingerprint,
  Compass,
  MoreVertical,
  Check,
  LayoutGrid,
  Square,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Mic,
  PlusCircle,
  Pin,
  Trash2,
  Copy,
  Edit3,
  Reply,
  X,
  Users,
  HelpCircle,
  Lightbulb,
  Eye,
} from 'lucide-react';

const normalizeModelAlias = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/gemini-.*pro/i.test(normalized)) return 'gemini-2.5-flash';
  if (normalized === 'gemini-1.5-flash' || normalized === 'gemini-2.0-flash') return 'gemini-2.5-flash';
  return normalized;
};

const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
const configuredModelName = normalizeModelAlias(import.meta.env.VITE_GEMINI_MODEL || '');
const primaryModelName = configuredModelName || 'gemini-2.5-flash';
const modelCandidates = Array.from(new Set([
  primaryModelName,
  'gemini-2.5-flash-lite',
].filter(Boolean).map((model) => normalizeModelAlias(model))));
const GEMINI_SERVICE_TIER = 'priority';
let geminiServiceTierEnabled = true;
const RETRYABLE_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const FATAL_HTTP_STATUSES = new Set([400, 401, 403]);
const MAX_ATTEMPTS_PER_MODEL = 3;
const BASE_RETRY_DELAY_MS = 160;
const GROUP_HISTORY_WINDOW = 8;
const INDIVIDUAL_HISTORY_WINDOW = 5;
const LOCAL_STATE_KEY = 'incirql-chat-local-state-v1';
const NOTIFICATION_CHANNEL_ID = 'incirql-messages-v3';
const COACH_DEFAULT_MORNING_TIME = '08:00';
const COACH_DEFAULT_EVENING_TIME = '21:00';
const COACH_CONTEXT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const COACH_INACTIVITY_TRIGGER_MS = 16 * 60 * 60 * 1000;
const COACH_PENDING_RESPONSE_NUDGE_MS = 10 * 60 * 60 * 1000;
const MAX_ATTACHMENT_COUNT = 4;
const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;
const ATTACHMENT_ACCEPT_ATTR = 'image/*,audio/*,.pdf,.txt,.md,.json,.csv,.doc,.docx';

const INLINE_ATTACHMENT_MIME_PREFIXES = ['image/', 'audio/'];
const INLINE_ATTACHMENT_MIME_EXACT = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
]);

const TEXT_ATTACHMENT_MIME_PREFIXES = ['text/'];
const TEXT_ATTACHMENT_MIME_EXACT = new Set([
  'application/json',
  'application/ld+json',
  'application/csv',
]);

const ONBOARDING_INTENT_CHIPS = [
  'Raise funding',
  'Get more customers',
  'Close deals',
  'Improve trading performance',
  'Build a startup',
  'Improve discipline',
];

const LANGUAGE_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Espanol' },
  { id: 'fr', label: 'Francais' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt', label: 'Portugues' },
  { id: 'zh', label: 'Mandarin' },
  { id: 'vi', label: 'Tieng Viet' },
];

const UI_STRINGS = {
  en: {
    attach: 'Attach photo, document, or audio',
    recordVoice: 'Record voice note',
    compose: 'Drop your next move...',
    addToGroup: 'Add to conversation',
    browseMore: 'Browse more mentors',
    language: 'Language',
    skip: 'Skip',
    searchMentors: 'Search mentors',
    chooseMore: 'Choose up to 2 more mentors',
    continue: 'Continue',
  },
  es: {
    attach: 'Adjuntar foto, documento o audio',
    recordVoice: 'Grabar nota de voz',
    compose: 'Comparte tu siguiente jugada...',
    addToGroup: 'Agregar a la conversacion',
    browseMore: 'Explorar mas mentores',
    language: 'Idioma',
    skip: 'Saltar',
    searchMentors: 'Buscar mentores',
    chooseMore: 'Elige hasta 2 mentores mas',
    continue: 'Continuar',
  },
  fr: {
    attach: 'Joindre photo, document ou audio',
    recordVoice: 'Enregistrer une note vocale',
    compose: 'Partagez votre prochaine action...',
    addToGroup: 'Ajouter a la conversation',
    browseMore: 'Parcourir plus de mentors',
    language: 'Langue',
    skip: 'Passer',
    searchMentors: 'Rechercher des mentors',
    chooseMore: 'Choisissez jusqu a 2 mentors en plus',
    continue: 'Continuer',
  },
  de: {
    attach: 'Foto, Dokument oder Audio anhangen',
    recordVoice: 'Sprachnotiz aufnehmen',
    compose: 'Teile deinen nachsten Zug...',
    addToGroup: 'Zum Gesprach hinzufugen',
    browseMore: 'Mehr Mentoren durchsuchen',
    language: 'Sprache',
    skip: 'Uberspringen',
    searchMentors: 'Mentoren suchen',
    chooseMore: 'Wahle bis zu 2 weitere Mentoren',
    continue: 'Weiter',
  },
  pt: {
    attach: 'Anexar foto, documento ou audio',
    recordVoice: 'Gravar nota de voz',
    compose: 'Compartilhe seu proximo passo...',
    addToGroup: 'Adicionar a conversa',
    browseMore: 'Ver mais mentores',
    language: 'Idioma',
    skip: 'Pular',
    searchMentors: 'Buscar mentores',
    chooseMore: 'Escolha ate 2 mentores extras',
    continue: 'Continuar',
  },
  zh: {
    attach: 'Tianjia zhaopian, wenjian huo yuyin',
    recordVoice: 'Luzhi yuyin biji',
    compose: 'Shuru ni de xiayibu...',
    addToGroup: 'Tianjia dao duihua',
    browseMore: 'Chakan gengduo daoshi',
    language: 'Yuyan',
    skip: 'Tiaoguo',
    searchMentors: 'Sousuo daoshi',
    chooseMore: 'Zuiduo xuanze 2 ge daoshi',
    continue: 'Jixu',
  },
  vi: {
    attach: 'Dinh kem anh, tai lieu hoac audio',
    recordVoice: 'Ghi am ghi chu',
    compose: 'Nhap buoc di tiep theo cua ban...',
    addToGroup: 'Them vao cuoc tro chuyen',
    browseMore: 'Xem them mentor',
    language: 'Ngon ngu',
    skip: 'Bo qua',
    searchMentors: 'Tim mentor',
    chooseMore: 'Chon toi da 2 mentor bo sung',
    continue: 'Tiep tuc',
  },
};

const parseRetryAfterMs = (value) => {
  if (!value) return 0;

  const asSeconds = Number(value);
  if (!Number.isNaN(asSeconds)) {
    return Math.max(0, Math.round(asSeconds * 1000));
  }

  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) return 0;
  return Math.max(0, asDate - Date.now());
};

const waitForRetry = (ms, signal) => new Promise((resolve, reject) => {
  if (!ms || ms <= 0) {
    resolve();
    return;
  }

  if (signal?.aborted) {
    reject(new DOMException('aborted', 'AbortError'));
    return;
  }

  const timeoutId = setTimeout(() => {
    if (signal && abortListener) signal.removeEventListener('abort', abortListener);
    resolve();
  }, ms);

  let abortListener;
  if (signal) {
    abortListener = () => {
      clearTimeout(timeoutId);
      reject(new DOMException('aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abortListener, { once: true });
  }
});

const parseApiFailure = async (response) => {
  const retryAfterMs = parseRetryAfterMs(response?.headers?.get('retry-after'));
  let message = '';

  try {
    const data = await response.clone().json();
    message = data?.error?.message || data?.message || '';
  } catch {
    message = '';
  }

  if (!message) {
    try {
      message = (await response.clone().text())?.trim() || '';
    } catch {
      message = '';
    }
  }

  return {
    status: Number(response?.status || 0),
    message,
    retryAfterMs,
  };
};

const isRetryableApiFailure = (status, message = '') => {
  if (FATAL_HTTP_STATUSES.has(status)) return false;
  if (RETRYABLE_HTTP_STATUSES.has(status)) return true;

  const normalized = String(message || '').toLowerCase();
  return /(high demand|resource exhausted|rate limit|temporar|unavailable|timeout|deadline|overload)/i.test(normalized);
};

const buildGenerationConfig = (baseConfig = {}) => {
  const nextConfig = { ...baseConfig };
  if (geminiServiceTierEnabled) {
    nextConfig.service_tier = GEMINI_SERVICE_TIER;
  }
  return nextConfig;
};

const shouldDisableGeminiServiceTier = (status, message = '') => {
  if (status !== 400 && status !== 422) return false;
  const normalized = String(message || '').toLowerCase();
  return /(service.?tier|unknown field|unsupported|unrecognized|invalid (json|argument|value)|additional propert|schema)/i.test(normalized);
};

const getRetryDelayMs = (attemptIndex, retryAfterMs = 0) => {
  const backoffMs = Math.min(6000, BASE_RETRY_DELAY_MS * (2 ** attemptIndex));
  const jitterMs = Math.floor(Math.random() * 250);
  return Math.max(backoffMs + jitterMs, retryAfterMs || 0);
};

const normalizeApiFailureMessage = (message, status) => {
  const normalized = String(message || '').trim();
  const lowered = normalized.toLowerCase();

  if (!normalized && status === 429) return 'Model rate limit reached. Please retry shortly.';
  if (!normalized && status >= 500) return 'Model service is temporarily unavailable.';
  if (status === 401 || status === 403) return 'API key is invalid or missing required permissions.';
  if (status === 400) return 'Request was rejected by the model API.';
  if (/high demand|resource exhausted|rate limit|too many requests|temporar|unavailable|overload/i.test(lowered)) {
    return 'Model is under heavy demand right now. Please retry in a moment.';
  }
  if (/api key|permission|forbidden|unauthoriz/i.test(lowered)) {
    return 'API key is invalid or missing required permissions.';
  }
  if (/gemini-2\.0|models\/gemini-2\.0-flash|no longer available to new users/i.test(lowered)) {
    return 'Model endpoint rotated. Retrying with Gemini 2.5.';
  }
  if (normalized) return normalized;
  if (status) return `Request failed (${status}).`;
  return 'Unable to reach the model service.';
};

const formatUserFacingAssistantError = (error) => {
  if (!apiKey) return 'API key missing. Add VITE_GEMINI_API_KEY and restart the app.';

  const raw = String(error?.message || '').trim();
  const lowered = raw.toLowerCase();

  if (/high demand|resource exhausted|rate limit|too many requests|temporar|unavailable|overload/i.test(lowered)) {
    return 'Model is busy right now. Tap Retry and it should recover shortly.';
  }
  if (/api key|permission|forbidden|unauthoriz/i.test(lowered)) {
    return 'Model auth issue detected. Verify your API key in .env.';
  }
  if (/network|failed to fetch|timed out|timeout|connection/i.test(lowered)) {
    return 'Network is unstable right now. Check connectivity and retry.';
  }
  if (/gemini-2\.0|models\/gemini-2\.0-flash|no longer available to new users/i.test(lowered)) {
    return 'Model endpoint rotated. Retry now to continue on Gemini 2.5.';
  }
  return raw || 'Unable to generate response.';
};

const inferDomainFromText = (text) => {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return '';
  if (/(trade|trading|pnl|drawdown|setup|market|strategy)/i.test(normalized)) return 'trading';
  if (/(fund|fundraise|investor|runway|valuation|pitch)/i.test(normalized)) return 'fundraising';
  if (/(startup|mvp|product|launch|retention|users)/i.test(normalized)) return 'startup';
  if (/(sales|pipeline|close|deal|objection|conversion)/i.test(normalized)) return 'sales';
  if (/(marketing|brand|copy|ads|distribution|audience)/i.test(normalized)) return 'marketing';
  if (/(operations|process|team|execution|workflow|delivery)/i.test(normalized)) return 'operations';
  if (/(finance|cash flow|margin|budget|capital|allocation)/i.test(normalized)) return 'finance';
  return 'custom';
};

const RESPONSE_STYLE_OPTIONS = [
  { id: 'balanced', label: 'Balanced', hint: 'Default balanced strategic tone.' },
  { id: 'talkative', label: 'Talkative', hint: 'Richer explanation and more context.' },
  { id: 'busy', label: 'Busy', hint: 'Action-first and quick decision framing.' },
  { id: 'brief', label: 'Brief', hint: 'Very concise, minimal words.' },
  { id: 'encouraging', label: 'Encouraging', hint: 'Supportive tone with confidence boost.' },
];

const RESPONSE_STYLE_RULES = {
  balanced: 'Use a balanced strategic tone and medium detail.',
  talkative: 'Use richer detail with additional practical context while staying conversational.',
  busy: 'Assume user is busy. Keep advice practical and immediately actionable.',
  brief: 'Be concise. Prefer short lines and direct recommendations.',
  encouraging: 'Use an encouraging, confident tone with practical next steps.',
};

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'into', 'over', 'about', 'what', 'when', 'where', 'which', 'will', 'have', 'has', 'had', 'its', 'our', 'their', 'they', 'them', 'was', 'were', 'been', 'being', 'too', 'very', 'just', 'more', 'less', 'only', 'then', 'than']);

const EMPTY_ASSISTANT_CONTENT = {
  bursts: [],
  insight: '',
  depthCard: null,
  questions: [],
  suggestedQuestions: [],
};

const getMessagePreview = (message) => {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (message.content?.bursts?.length) return message.content.bursts[0];
  if (message.content?.insight) return message.content.insight;
  return '';
};

const bytesToReadable = (bytes) => {
  const safe = Number(bytes || 0);
  if (!Number.isFinite(safe) || safe <= 0) return '0 B';
  if (safe < 1024) return `${safe} B`;
  if (safe < (1024 * 1024)) return `${(safe / 1024).toFixed(1)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
};

const isInlineAttachmentMime = (mimeType) => {
  const mime = String(mimeType || '').toLowerCase();
  if (!mime) return false;
  if (INLINE_ATTACHMENT_MIME_EXACT.has(mime)) return true;
  return INLINE_ATTACHMENT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
};

const isTextAttachmentMime = (mimeType) => {
  const mime = String(mimeType || '').toLowerCase();
  if (!mime) return false;
  if (TEXT_ATTACHMENT_MIME_EXACT.has(mime)) return true;
  return TEXT_ATTACHMENT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error(`Failed to read ${file?.name || 'file'}`));
  reader.readAsDataURL(file);
});

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error(`Failed to read text from ${file?.name || 'file'}`));
  reader.readAsText(file);
});

const buildAttachmentPayload = async (file) => {
  if (!file) return null;

  const mimeType = String(file.type || '').toLowerCase() || 'application/octet-stream';
  const base = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(file.name || 'attachment'),
    mimeType,
    size: Number(file.size || 0),
    inlineData: null,
    dataUrl: '',
    textExcerpt: '',
  };

  if (base.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ...base,
      textExcerpt: `Attachment ${base.name} omitted: file exceeds ${bytesToReadable(MAX_ATTACHMENT_SIZE_BYTES)} limit.`,
    };
  }

  if (isInlineAttachmentMime(mimeType)) {
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    if (base64) {
      return {
        ...base,
        dataUrl,
        inlineData: {
          mimeType,
          data: base64,
        },
      };
    }
  }

  if (isTextAttachmentMime(mimeType)) {
    const text = await readFileAsText(file);
    const excerpt = text.slice(0, 1500);
    return {
      ...base,
      textExcerpt: excerpt
        ? `Text from ${base.name}:\n${excerpt}`
        : `Text attachment ${base.name} is empty.`,
    };
  }

  return {
    ...base,
    textExcerpt: `Attached file ${base.name} (${mimeType || 'unknown mime'}, ${bytesToReadable(base.size)}).`,
  };
};

const serializeAttachmentForMessage = (att) => ({
  id: att.id,
  name: att.name,
  mimeType: att.mimeType,
  size: att.size,
  inlineData: att.inlineData || null,
  dataUrl: att.dataUrl || '',
  textExcerpt: att.textExcerpt || '',
});

const buildAttachmentPartsForRequest = (attachments = []) => {
  const parts = [];
  attachments.forEach((att) => {
    if (!att) return;
    if (att.inlineData?.data && att.inlineData?.mimeType) {
      parts.push({ inlineData: { mimeType: att.inlineData.mimeType, data: att.inlineData.data } });
    }
    if (att.textExcerpt) {
      parts.push({ text: att.textExcerpt });
    }
    if (!att.inlineData && !att.textExcerpt) {
      parts.push({ text: `Attachment: ${att.name} (${att.mimeType || 'unknown'}, ${bytesToReadable(att.size)})` });
    }
  });
  return parts;
};

const serializeMessageForModelHistory = (msg) => {
  let baseText = '';
  if (typeof msg.content === 'string') {
    baseText = msg.content;
  } else if (msg.content && typeof msg.content === 'object') {
    const bursts = Array.isArray(msg.content.bursts) ? msg.content.bursts.join(' ') : '';
    const insight = typeof msg.content.insight === 'string' ? msg.content.insight : '';
    const questions = Array.isArray(msg.content.questions) ? msg.content.questions.slice(0, 2).join(' ') : '';
    baseText = [bursts, insight, questions].filter(Boolean).join(' ').trim() || JSON.stringify(msg.content);
  }

  const attachmentMeta = Array.isArray(msg.attachments) && msg.attachments.length
    ? `\nAttachments: ${msg.attachments.map((att) => `${att.name} (${att.mimeType || 'unknown'}, ${bytesToReadable(att.size)})`).join('; ')}`
    : '';

  const compact = `${baseText}${attachmentMeta}`.replace(/\s+/g, ' ').trim();
  return compact.length > 700 ? `${compact.slice(0, 700)}...` : compact;
};

const isLegacyGateArtifactMessage = (msg) => {
  if (!msg) return false;

  const markers = /structured inputs|execution update required|required format|decision system|commitment active/i;

  if (typeof msg.content === 'string' && markers.test(msg.content)) return true;

  const bursts = Array.isArray(msg?.content?.bursts) ? msg.content.bursts : [];
  if (bursts.some((burst) => markers.test(String(burst || '')))) return true;

  const insight = String(msg?.content?.insight || '');
  if (markers.test(insight)) return true;

  const depthCardTitle = String(msg?.content?.depthCard?.title || '');
  if (markers.test(depthCardTitle)) return true;

  return false;
};

const sanitizeStoredMessages = (histories = {}) => {
  const next = {};
  Object.entries(histories).forEach(([threadId, messages]) => {
    next[threadId] = (messages || [])
      .filter((msg) => Boolean(msg) && !isLegacyGateArtifactMessage(msg))
      .map((msg, idx) => ({
      ...msg,
      id: msg.id || `${msg.role || 'msg'}-${threadId}-${idx}-${Date.now()}`,
      }));
  });
  return next;
};

const formatChatDate = (isoLike) => {
  if (!isoLike) return '';
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const datesMatch = (a, b) => formatChatDate(a) === formatChatDate(b);

const normalizeMentionKey = (value) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAdvisorMentionAliases = (advisor) => {
  if (!advisor) return [];
  const firstName = advisor.name.split(' ')[0] || '';
  const lastName = advisor.name.split(' ').slice(-1)[0] || '';
  const compactName = advisor.name.replace(/\s+/g, '');

  return [
    advisor.id,
    advisor.name,
    compactName,
    firstName,
    lastName,
    `${firstName}${lastName}`,
  ]
    .map(normalizeMentionKey)
    .filter(Boolean)
    .filter((alias, idx, arr) => arr.indexOf(alias) === idx);
};

const getMentionTokens = (text) => {
  const matches = (text || '').match(/@([a-zA-Z][a-zA-Z0-9_.-]*)/g) || [];
  return matches.map((match) => normalizeMentionKey(match.slice(1))).filter(Boolean);
};

const hasAllMention = (text) => getMentionTokens(text).includes('all');

const resolveMentionedAdvisorIds = (text, advisorIds = []) => {
  const mentionTokens = getMentionTokens(text).filter((token) => token !== 'all');
  if (!mentionTokens.length) return [];

  const scope = HISTORICAL_FIGURES.filter((advisor) => advisorIds.includes(advisor.id));
  const resolved = [];

  mentionTokens.forEach((token) => {
    const exact = scope.find((advisor) => getAdvisorMentionAliases(advisor).includes(token));

    if (exact) {
      if (!resolved.includes(exact.id)) resolved.push(exact.id);
      return;
    }

    const partial = scope.find((advisor) => getAdvisorMentionAliases(advisor).some((alias) => alias.includes(token) || token.includes(alias)));

    if (partial && !resolved.includes(partial.id)) resolved.push(partial.id);
  });

  return resolved;
};

const buildStyleInstruction = (styleId) => RESPONSE_STYLE_RULES[styleId] || RESPONSE_STYLE_RULES.balanced;

const tokenizeForTopic = (text) =>
  normalizeMentionKey(text)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const scoreAdvisorTopicExpertise = (text, advisor) => {
  if (!advisor) return 0;

  const queryTokens = tokenizeForTopic(text);
  if (!queryTokens.length) return 0;

  const advisorCorpus = [advisor.role, advisor.prompt, advisor.name].join(' ');
  const advisorTokens = new Set(tokenizeForTopic(advisorCorpus));
  let overlap = 0;

  queryTokens.forEach((token) => {
    if (advisorTokens.has(token)) overlap += 1;
  });

  const isRocketTopic = queryTokens.some((token) => (
    token.includes('rocket')
    || token.includes('space')
    || token.includes('spacex')
    || token.includes('starship')
    || token.includes('orbit')
    || token.includes('orbital')
    || token.includes('launch')
    || token.includes('mars')
    || token.includes('satellite')
    || token.includes('propulsion')
  ));

  if (isRocketTopic && advisor.id === 'musk') {
    overlap += 12;
  }

  return overlap;
};

const stripLeadingPersonaLabel = (text, advisorIds = []) => {
  const raw = (text || '').trim();
  if (!raw) return '';

  const nameTokens = HISTORICAL_FIGURES
    .filter((advisor) => advisorIds.includes(advisor.id))
    .flatMap((advisor) => [advisor.name, advisor.name.replace(/\s+/g, ''), advisor.id])
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((item) => escapeRegExp(item));

  if (!nameTokens.length) return raw;
  const leadRegex = new RegExp(`^@?(?:${nameTokens.join('|')})(?:\\s*[-,:.]\\s*|\\s+)`, 'i');
  const cleaned = raw.replace(leadRegex, '').trim();
  return cleaned || raw;
};

const inferAdvisorFromPayload = (payload, advisorIds = []) => {
  const scope = HISTORICAL_FIGURES.filter((advisor) => advisorIds.includes(advisor.id));
  const text = [
    ...(payload?.bursts || []),
    payload?.insight || '',
  ].join(' ').toLowerCase();

  if (!text.trim()) return null;

  const matched = scope.find((advisor) => {
    const name = advisor.name.toLowerCase();
    const lastName = name.split(' ').slice(-1)[0];
    return text.includes(name) || text.includes(lastName);
  });

  return matched?.id || null;
};

const HISTORICAL_FIGURES = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Design Visionary', avatar: 'SJ', color: 'bg-[#171717]', img: 'https://i.postimg.cc/xCGdGsb8/jobs-profile.png', prompt: 'You are Steve Jobs. Focus on uncompromising quality, simplicity, and vertical integration.' },
  { id: 'rockefeller', name: 'John D. Rockefeller', role: 'Monopoly Builder', avatar: 'JR', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/bv5zQ7vV/rockerfeller-profile.png', prompt: 'You are John D. Rockefeller. Focus on total market control, precision, and efficiency.' },
  { id: 'jpmorgan', name: 'J.P. Morgan', role: 'American Financier & Investment Banker', avatar: 'JM', color: 'bg-[#111827]', img: 'https://i.postimg.cc/BQ54DBRb/JPMorgan.png', prompt: 'You are J.P. Morgan, the American financier and investment banker. Focus on disciplined capital allocation, balance-sheet strength, syndicate power, and risk-managed dealmaking.' },
  { id: 'lfink', name: 'Larry Fink', role: 'Institutional Capital Strategist', avatar: 'LF', color: 'bg-[#1f2937]', img: 'https://i.postimg.cc/QMdWP1MB/Larry-Fink.png', prompt: 'You are Larry Fink. Focus on institutional capital allocation, risk stewardship, governance discipline, and long-term portfolio resilience.' },
  { id: 'carnegie', name: 'Andrew Carnegie', role: 'Steel King', avatar: 'AC', color: 'bg-[#1e293b]', img: 'https://i.postimg.cc/bYsCJd4c/Carnegie-profile.png', prompt: "You are Andrew Carnegie. Focus on extreme efficiency and the 'Gospel of Wealth'." },
  { id: 'simons', name: 'Jim Simons', role: 'Quant King', avatar: 'JS', color: 'bg-[#064e3b]', img: 'https://i.postimg.cc/FRgbb3c9/jim-simons.png', prompt: 'You are Jim Simons. Focus on mathematics, pattern recognition, and cold data. No narratives, only algorithms.' },
  { id: 'buffett', name: 'Warren Buffett', role: 'Value Legend', avatar: 'WB', color: 'bg-[#065f46]', img: 'https://i.postimg.cc/RFz56LSP/warren-buffet-profile.png', prompt: 'You are Warren Buffett. Focus on moats, circle of competence, long-term compounding, and buying wonderful businesses at fair prices.' },
  { id: 'lynch', name: 'Peter Lynch', role: 'Growth Expert', avatar: 'PL', color: 'bg-[#1e3a8a]', img: 'https://i.postimg.cc/jScr1FbC/peter-lynch.png', prompt: "You are Peter Lynch. Invest in what you know. Look for 'ten-baggers' and focus on earnings growth." },
  { id: 'dalio', name: 'Ray Dalio', role: 'Systems Thinker', avatar: 'RD', color: 'bg-[#475569]', img: 'https://i.postimg.cc/KzmphqcW/ray-dalio-profile.png', prompt: 'You are Ray Dalio. Focus on radical transparency, principles, economic cycles, and understanding the machine.' },
  { id: 'soros', name: 'George Soros', role: 'Macro Strategist', avatar: 'GS', color: 'bg-[#334155]', img: 'https://i.postimg.cc/4xJDpQ9h/george-soros.png', prompt: 'You are George Soros. Focus on reflexivity, identifying market biases, and global macro trends with leverage.' },
  { id: 'thiel', name: 'Peter Thiel', role: 'Contrarian', avatar: 'PT', color: 'bg-[#1e1b4b]', img: 'https://i.postimg.cc/NftFqRRH/peter-thiel-profile.png', prompt: 'You are Peter Thiel. Focus on 0 to 1, building monopolies, and finding untapped secrets no one else sees.' },
  { id: 'hoffman', name: 'Reid Hoffman', role: 'Blitzscaler', avatar: 'RH', color: 'bg-[#1d4ed8]', img: 'https://i.postimg.cc/MKY4ZfrF/reid-hoffman.png', prompt: 'You are Reid Hoffman. Focus on Blitzscaling, network effects, and speed over efficiency.' },
  { id: 'munger', name: 'Charlie Munger', role: 'Multidisciplinary Thinker', avatar: 'CM', color: 'bg-[#7c2d12]', img: 'https://i.postimg.cc/kMQYwt9q/charlie-Munger.png', prompt: 'You are Charlie Munger. Focus on mental models, multidisciplinary thinking, and avoiding stupid mistakes. Be direct and candid.' },
  { id: 'graham', name: 'Benjamin Graham', role: 'Value Investor', avatar: 'BG', color: 'bg-[#3730a3]', img: 'https://i.postimg.cc/tTQJqcsJ/benjamin-graham.png', prompt: 'You are Benjamin Graham. Focus on margin of safety, intrinsic value, fundamental analysis, and disciplined investing principles.' },
  { id: 'marks', name: 'Howard Marks', role: 'Risk Master', avatar: 'HM', color: 'bg-[#7e22ce]', img: 'https://i.postimg.cc/jSyd8Xgb/howard-marks.png', prompt: 'You are Howard Marks. Focus on second-level thinking, risk management, contrarian positioning, and opportunistic investing.' },
  { id: 'druckenmiller', name: 'Stanley Druckenmiller', role: 'Macro Master', avatar: 'SD', color: 'bg-[#be185d]', img: 'https://i.postimg.cc/fLRzRhwV/stanley-druckenmiller.png', prompt: 'You are Stanley Druckenmiller. Focus on macro themes, trend analysis, positioning, and conviction-based bold bets.' },
  { id: 'ackman', name: 'Bill Ackman', role: 'Activist Investor', avatar: 'BA', color: 'bg-[#dc2626]', img: 'https://i.postimg.cc/9FS97JSR/bill-ackman.png', prompt: 'You are Bill Ackman. Focus on activist activism, identifying broken companies, operational improvements, and long-term value creation.' },
  { id: 'wood', name: 'Cathie Wood', role: 'Innovation Investor', avatar: 'CW', color: 'bg-[#2563eb]', img: 'https://i.postimg.cc/KzSS3S75/cathie-woods.png', prompt: 'You are Cathie Wood. Focus on disruptive innovation, exponential technologies, genomics, and long-term secular trends.' },
  { id: 'palihapitiya', name: 'Chamath Palihapitiya', role: 'Tech Entrepreneur', avatar: 'CP', color: 'bg-[#0891b2]', img: 'https://i.postimg.cc/0jLPnM7s/chamath-palihapitiya.png', prompt: 'You are Chamath Palihapitiya. Focus on emotional resilience, wealth building, SPAC opportunities, and building massive scale.' },
  { id: 'andreessen', name: 'Marc Andreessen', role: 'Technology Visionary', avatar: 'MA', color: 'bg-[#6366f1]', img: 'https://i.postimg.cc/RC337czb/marc-andreessen.png', prompt: 'You are Marc Andreessen. Focus on software disruption, paradigm shifts, venture capital, and the future of technology.' },
  { id: 'horowitz', name: 'Ben Horowitz', role: 'Operations Expert', avatar: 'BH', color: 'bg-[#059669]', img: 'https://i.postimg.cc/vZvDYhW0/ben-horowitz.png', prompt: 'You are Ben Horowitz. Focus on building companies, operational excellence, culture, and scaling from struggle to success.' },
  { id: 'ravikant', name: 'Naval Ravikant', role: 'Philosophy Entrepreneur', avatar: 'NR', color: 'bg-[#8b5cf6]', img: 'https://i.postimg.cc/gkZYJsPL/naval-ravikant.png', prompt: 'You are Naval Ravikant. Focus on wealth, happiness, leverage, automation, and building intellectual capital.' },
  { id: 'ptj', name: 'Paul Tudor Jones', role: 'Trading Legend', avatar: 'PJ', color: 'bg-[#14532d]', img: 'https://i.postimg.cc/s2KDp2x3/Paul-tudor-jones.png', prompt: 'You are Paul Tudor Jones. Focus on technical analysis, risk management, market timing, and preserving capital.' },
  { id: 'sacca', name: 'Chris Sacca', role: 'Venture Bold', avatar: 'CS', color: 'bg-[#d97706]', img: 'https://i.postimg.cc/prg5jdTj/chris-sacca.png', prompt: 'You are Chris Sacca. Focus on contrarian bets, climate tech, bold founder partnerships, and venture returns.' },
  { id: 'tepper', name: 'David Tepper', role: 'Distressed Expert', avatar: 'DT', color: 'bg-[#1f2937]', img: 'https://i.postimg.cc/W1mqDTPZ/David-tepper.png', prompt: 'You are David Tepper. Focus on distressed investing, converting pain into returns, opportunistic tactics, and sharp analysis.' },
  { id: 'musk', name: 'Elon Musk', role: 'Industrial Futurist', avatar: 'EM', color: 'bg-[#111827]', img: 'https://i.postimg.cc/g05cMTVK/elon-musk.png', prompt: 'You are Elon Musk. Focus on first-principles thinking, engineering velocity, and building vertically integrated breakthrough companies.' },
  { id: 'bezos', name: 'Jeff Bezos', role: 'Customer Obsession Architect', avatar: 'JB', color: 'bg-[#92400e]', img: 'https://i.postimg.cc/KYdF7gbw/jeff-bezos.png', prompt: 'You are Jeff Bezos. Focus on customer obsession, long-term orientation, flywheels, and high standards in execution.' },
  { id: 'pgraham', name: 'Paul Graham', role: 'Startup Philosopher', avatar: 'PG', color: 'bg-[#b45309]', img: 'https://i.postimg.cc/2SwHmpyK/paul-graham.png', prompt: 'You are Paul Graham. Focus on startup truths, founder-market fit, product intensity, and clear writing as clear thinking.' },
  { id: 'saltman', name: 'Sam Altman', role: 'AI Builder', avatar: 'SA', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/MKKTpVpn/sam-altman.png', prompt: 'You are Sam Altman. Focus on compounding, product-market fit, ambitious execution, and practical startup strategy.' },
  { id: 'jhuang', name: 'Jensen Huang', role: 'Compute Strategist', avatar: 'JH', color: 'bg-[#14532d]', img: 'https://i.postimg.cc/3rvnN0W2/jensen-huang.png', prompt: 'You are Jensen Huang. Focus on platform strategy, relentless innovation, and ecosystem advantages built over decades.' },
  { id: 'sblakely', name: 'Sara Blakely', role: 'Brand Inventor', avatar: 'SB', color: 'bg-[#be185d]', img: 'https://i.postimg.cc/FzKVp1NP/sarah-blakely.png', prompt: 'You are Sara Blakely. Focus on creative problem solving, scrappy execution, storytelling, and resilient entrepreneurship.' },
  { id: 'branson', name: 'Richard Branson', role: 'Adventurous Founder', avatar: 'RB', color: 'bg-[#dc2626]', img: 'https://i.postimg.cc/KjsyzK0D/richard-branson.png', prompt: 'You are Richard Branson. Focus on bold branding, customer delight, and building category-defining experiences.' },
  { id: 'jackma', name: 'Jack Ma', role: 'Marketplace Visionary', avatar: 'JM', color: 'bg-[#ea580c]', img: 'https://i.postimg.cc/d1wFSc77/Jack-ma.png', prompt: 'You are Jack Ma. Focus on platform ecosystems, small business enablement, and adapting quickly through change.' },
  { id: 'chesky', name: 'Brian Chesky', role: 'Design-Led Operator', avatar: 'BC', color: 'bg-[#ef4444]', img: 'https://i.postimg.cc/2yHCZ9Sq/brian-chesky.png', prompt: 'You are Brian Chesky. Focus on design-driven product thinking, community trust, and world-class user experience.' },
  { id: 'pcollison', name: 'Patrick Collison', role: 'Infrastructure Founder', avatar: 'PC', color: 'bg-[#2563eb]', img: 'https://i.postimg.cc/NjQfzXW9/patrick-collison.png', prompt: 'You are Patrick Collison. Focus on elegant infrastructure, developer experience, and compounding product quality.' },
  { id: 'wwherd', name: 'Whitney Wolfe Herd', role: 'Consumer App Builder', avatar: 'WH', color: 'bg-[#ec4899]', img: 'https://i.postimg.cc/4xcbBDRJ/whitney-wolfe-herd.png', prompt: 'You are Whitney Wolfe Herd. Focus on trust-centric product design, strong brand voice, and scaling consumer platforms.' },
  { id: 'oprah', name: 'Oprah Winfrey', role: 'Media Empire Builder', avatar: 'OW', color: 'bg-[#7c3aed]', img: 'https://i.postimg.cc/q7LKF0mQ/oprah-winfrey.png', prompt: 'You are Oprah Winfrey. Focus on authentic storytelling, trust-based audience building, and mission-led business growth.' },
  { id: 'daymond', name: 'Daymond John', role: 'Brand Dealmaker', avatar: 'DJ', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/DZvrfmJv/Daymond-john.png', prompt: 'You are Daymond John. Focus on brand leverage, disciplined cash flow, practical hustle, and smart negotiations.' },
  { id: 'elauder', name: 'Estee Lauder', role: 'Beauty Brand Pioneer', avatar: 'EL', color: 'bg-[#a21caf]', img: 'https://i.postimg.cc/VvML3WfX/estee-lauder.png', prompt: 'You are Estee Lauder. Focus on premium positioning, brand consistency, and customer relationships built over time.' },
  { id: 'pknight', name: 'Phil Knight', role: 'Global Brand Builder', avatar: 'PK', color: 'bg-[#1d4ed8]', img: 'https://i.postimg.cc/N0zsFzLL/phil-knight.png', prompt: 'You are Phil Knight. Focus on brand storytelling, athlete partnerships, and relentless expansion with operational discipline.' },
  { id: 'baruch', name: 'Bernard Baruch', role: 'Market Speculator', avatar: 'BB', color: 'bg-[#1e293b]', img: 'https://i.postimg.cc/5yfNfBBQ/Bernard-baruch.png', prompt: 'You are Bernard Baruch. Focus on disciplined speculation, patience, and protecting capital first.' },
  { id: 'seykota', name: 'Ed Seykota', role: 'Trend Follower', avatar: 'ES', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/rw7VDX1b/Ed-Seykota.png', prompt: 'You are Ed Seykota. Focus on trend following, system discipline, and strict risk control.' },
  { id: 'burry', name: 'Michael Burry', role: 'Contrarian Analyst', avatar: 'MB', color: 'bg-[#334155]', img: 'https://i.postimg.cc/mkdRR0ZY/Michael-Burry.png', prompt: 'You are Michael Burry. Focus on deep fundamental research, asymmetric bets, and independent thinking.' },
  { id: 'darvas', name: 'Nicholas Darvas', role: 'Momentum Trader', avatar: 'ND', color: 'bg-[#1d4ed8]', img: 'https://i.postimg.cc/25fppzdg/Nicholas-Darvas.png', prompt: 'You are Nicholas Darvas. Focus on price action breakouts, momentum, and strict stop-loss discipline.' },
  { id: 'rdennis', name: 'Richard Dennis', role: 'Systematic Trader', avatar: 'RD', color: 'bg-[#111827]', img: 'https://i.postimg.cc/C55XCdYW/Richard-Dennis.png', prompt: 'You are Richard Dennis. Focus on rule-based trading, trend systems, and statistical edge.' },
  { id: 'wyckoff', name: 'Richard Wyckoff', role: 'Tape Reader', avatar: 'RW', color: 'bg-[#475569]', img: 'https://i.postimg.cc/CLWXDF2k/Richard-Wyckoff.png', prompt: 'You are Richard Wyckoff. Focus on supply-demand dynamics, accumulation/distribution, and market structure.' },
  { id: 'livermore', name: 'Jesse Livermore', role: 'Speculation Legend', avatar: 'JL', color: 'bg-[#7c2d12]', img: 'https://i.postimg.cc/YjcR4SSL/Jesse-livermore.png', prompt: 'You are Jesse Livermore. Focus on tape reading, sitting on winners, and cutting losses quickly.' },
  { id: 'lwilliams', name: 'Larry Williams', role: 'Cycle Trader', avatar: 'LW', color: 'bg-[#14532d]', img: 'https://i.postimg.cc/BQMc9NTZ/Larry-williams.png', prompt: 'You are Larry Williams. Focus on timing, market cycles, and tactical execution.' },
  { id: 'minervini', name: 'Mark Minervini', role: 'SEPA Trader', avatar: 'MM', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/8cTWxrs7/Mark-Minervini.png', prompt: 'You are Mark Minervini. Focus on momentum setups, volatility contraction, and disciplined entry timing.' },
  { id: 'gann', name: 'William Delbert Gann', role: 'Technical Theorist', avatar: 'WG', color: 'bg-[#3730a3]', img: 'https://i.postimg.cc/cCJCQ7rh/William-Delbert-Gann.png', prompt: 'You are W.D. Gann. Focus on price-time relationships, technical structure, and risk-managed forecasting.' },
  { id: 'tuchman', name: 'Peter Tuchman', role: 'Floor Trader', avatar: 'PT', color: 'bg-[#be185d]', img: 'https://i.postimg.cc/yx7QnxKs/Peter-Tuchman.png', prompt: 'You are Peter Tuchman. Focus on trading psychology, market sentiment, and fast decision making under pressure.' },
  { id: 'uashraf', name: 'Umar Ashraf', role: 'Momentum Day Trader', avatar: 'UA', color: 'bg-[#dc2626]', img: 'https://i.postimg.cc/TwfJvs4m/Umar-Ashraf.png', prompt: 'You are Umar Ashraf. Focus on momentum day-trading setups, risk discipline, and execution quality.' },
  { id: 'rcameron', name: 'Ross Cameron', role: 'Small-Cap Trader', avatar: 'RC', color: 'bg-[#2563eb]', img: 'https://i.postimg.cc/9fWDmjCs/Ross-cameron.png', prompt: 'You are Ross Cameron. Focus on small-cap momentum, pattern recognition, and strict risk control.' },
  { id: 'jpaulson', name: 'John Paulson', role: 'Event-Driven Investor', avatar: 'JP', color: 'bg-[#1f2937]', img: 'https://i.postimg.cc/Hsdn4g7d/John-Paulson.png', prompt: 'You are John Paulson. Focus on event-driven opportunities, catalyst investing, and downside protection.' },
  { id: 'cgardell', name: 'Chris Gardell', role: 'Activist Investor', avatar: 'CG', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/NMGY2gzZ/Chris-Gardell.png', prompt: 'You are Chris Gardell. Focus on activist investing, governance changes, and shareholder value creation.' },
  { id: 'loeb', name: 'Daniel Loeb', role: 'Activist Strategist', avatar: 'DL', color: 'bg-[#ea580c]', img: 'https://i.postimg.cc/KzYSv0KF/Daniel-Loeb.png', prompt: 'You are Daniel Loeb. Focus on activist campaigns, catalyst-driven returns, and portfolio concentration.' },
  { id: 'peltz', name: 'Nelson Peltz', role: 'Operational Activist', avatar: 'NP', color: 'bg-[#059669]', img: 'https://i.postimg.cc/8sQ0W4Cz/Nelson-Peltz.png', prompt: 'You are Nelson Peltz. Focus on operational improvements, governance, and long-term value unlocking.' },
  { id: 'singer', name: 'Paul Singer', role: 'Distressed Activist', avatar: 'PS', color: 'bg-[#b45309]', img: 'https://i.postimg.cc/50FcC632/Paul-singer.png', prompt: 'You are Paul Singer. Focus on distressed opportunities, legal edge, and structured risk-reward analysis.' },
  { id: 'jsmith', name: 'Jeff Smith', role: 'Value Activist', avatar: 'JS', color: 'bg-[#0891b2]', img: 'https://i.postimg.cc/KzTVYCGy/jeff-smith.png', prompt: 'You are Jeff Smith. Focus on value activism, board-level influence, and unlocking mispriced assets.' },
  { id: 'icahn', name: 'Carl Icahn', role: 'Corporate Raider', avatar: 'CI', color: 'bg-[#7f1d1d]', img: 'https://i.postimg.cc/0yHH09rg/Carl-icahn.png', prompt: 'You are Carl Icahn. Focus on activist pressure, capital discipline, and forcing strategic change.' },
  { id: 'hormozi', name: 'Alex Hormozi', role: 'Offer Architect', avatar: 'AH', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/VNdJTP10/Alex-Hormozi.png', prompt: 'You are Alex Hormozi. Focus on irresistible offers, acquisition economics, and scaling profitably.' },
  { id: 'chanel', name: 'Coco Chanel', role: 'Luxury Brand Strategist', avatar: 'CC', color: 'bg-[#1f2937]', img: 'https://i.postimg.cc/RFwZ5MYh/Coco-chanel.png', prompt: 'You are Coco Chanel. Focus on timeless positioning, premium branding, and category-defining identity.' },
  { id: 'kahneman', name: 'Daniel Kahneman', role: 'Decision Scientist', avatar: 'DK', color: 'bg-[#1e3a8a]', img: 'https://i.postimg.cc/YCVrvGKj/Daniel-kahneman.png', prompt: 'You are Daniel Kahneman. Focus on cognitive biases, probabilistic thinking, and better decision hygiene.' },
  { id: 'garyv', name: 'Gary Vaynerchuk', role: 'Attention Operator', avatar: 'GV', color: 'bg-[#dc2626]', img: 'https://i.postimg.cc/SQrmWtFG/Gary-Vaynerchuk.png', prompt: 'You are Gary Vaynerchuk. Focus on attention, distribution, social content velocity, and brand relevance.' },
  { id: 'jminer', name: 'Jeremy Miner', role: 'Sales Psychology Closer', avatar: 'JM', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/CL5pbh4x/Jeremy-Miner.png', prompt: 'You are Jeremy Miner. Focus on consultative selling, objection handling, and trust-based persuasion.' },
  { id: 'porter', name: 'Michael Porter', role: 'Competitive Strategy Professor', avatar: 'MP', color: 'bg-[#334155]', img: 'https://i.postimg.cc/XJLtymG1/Michael-Porter.png', prompt: 'You are Michael Porter. Focus on strategic positioning, moats, and defensible competitive advantage.' },
  { id: 'barnum', name: 'P.T. Barnum', role: 'Showmanship Marketer', avatar: 'PB', color: 'bg-[#ea580c]', img: 'https://i.postimg.cc/9ftnvKBt/P-T-Barnum.png', prompt: 'You are P.T. Barnum. Focus on spectacle, demand creation, and audience magnetism.' },
  { id: 'reddington', name: 'Raymond Reddington', role: 'Strategic Negotiator', avatar: 'RR', color: 'bg-[#7c2d12]', img: 'https://i.postimg.cc/bN7VdpCT/Raymond-Reddington.png', prompt: 'You are Raymond Reddington. Focus on leverage, contingency planning, and strategic negotiation.' },
  { id: 'cialdini', name: 'Robert Cialdini', role: 'Influence Scientist', avatar: 'RC', color: 'bg-[#7e22ce]', img: 'https://i.postimg.cc/rybQYqkL/Robert-Cialdini.png', prompt: 'You are Robert Cialdini. Focus on ethical influence, persuasion principles, and conversion psychology.' },
  { id: 'mayhew', name: 'Robert Mayhew', role: 'Sales Messaging Specialist', avatar: 'RM', color: 'bg-[#0369a1]', img: 'https://i.postimg.cc/N0g4rM6t/Robert-Mayhew.png', prompt: 'You are Robert Mayhew. Focus on sales communication, message clarity, and persuasive positioning.' },
  { id: 'sodin', name: 'Seth Odin', role: 'Permission Marketing Strategist', avatar: 'SO', color: 'bg-[#9333ea]', img: 'https://i.postimg.cc/MX20ZK6h/Seth-Odin.png', prompt: 'You are Seth Odin. Focus on trust-driven marketing, storytelling, and long-term audience relationships.' },
  { id: 'suntzu', name: 'Sun Tzu', role: 'Strategic Warfare Thinker', avatar: 'ST', color: 'bg-[#14532d]', img: 'https://i.postimg.cc/QM4y85R0/Sun-Tzu.png', prompt: 'You are Sun Tzu. Focus on positioning, timing, deception, and winning before the fight starts.' },
  { id: 'fadell', name: 'Tony Fadell', role: 'Product Builder', avatar: 'TF', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/q751VrKV/Tony-Fadell.png', prompt: 'You are Tony Fadell. Focus on product craft, user behavior, and practical product-market fit execution.' },
  { id: 'mseibel', name: 'Michael Seibel', role: 'Startup Accelerator Partner', avatar: 'MS', color: 'bg-[#1d4ed8]', img: 'https://i.postimg.cc/Bb1Tz4tL/Michael-Seibel.png', prompt: 'You are Michael Seibel. Focus on startup fundamentals, founder clarity, and practical execution toward product-market fit.' },
  { id: 'fvalentini', name: 'Fabio Valentini', role: 'Execution-Focused Investor', avatar: 'FV', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/MZj3NSkk/Fabio-Valentini.png', prompt: 'You are Fabio Valentini. Focus on disciplined execution, asymmetric opportunities, and process-driven decision making.' },
  { id: 'bnf', name: 'Takashi Kotagawa (BNF)', role: 'High-Conviction Trader', avatar: 'TK', color: 'bg-[#7c2d12]', img: 'https://i.postimg.cc/D0V6n89d/Takashi-Kotagawa-BNF.png', prompt: 'You are Takashi Kotagawa (BNF). Focus on high-conviction trading, timing, and strict downside control.' },
  { id: 'kgriffin', name: 'Kenneth C. Griffin', role: 'Multi-Strategy Capital Allocator', avatar: 'KG', color: 'bg-[#111827]', img: 'https://i.postimg.cc/Hs9z1WB6/Kenneth-C-Griffin.png', prompt: 'You are Kenneth C. Griffin. Focus on risk-adjusted returns, institutional process, and elite performance systems.' },
  { id: 'scohen', name: 'Steven Cohen', role: 'Tactical Hedge Fund Operator', avatar: 'SC', color: 'bg-[#b91c1c]', img: 'https://i.postimg.cc/Px1ZbK7Y/Steven-Cohen.png', prompt: 'You are Steven Cohen. Focus on tactical execution, information edge, and adapting fast to market conditions.' },
  { id: 'pbonde', name: 'Pradeep Bonde', role: 'Momentum Swing Trader', avatar: 'PB', color: 'bg-[#14532d]', img: 'https://i.postimg.cc/7YKzN5Kj/Pradeep-Bonde.png', prompt: 'You are Pradeep Bonde. Focus on momentum leadership, trend continuation setups, and disciplined trade management.' },
  { id: 'dtrullas', name: 'David Trullas Vila', role: 'Systematic Trading Mentor', avatar: 'DV', color: 'bg-[#0f172a]', img: 'https://i.postimg.cc/VsR0YSP9/David-Trullas-Vila.png', prompt: 'You are David Trullas Vila. Focus on repeatable trading frameworks, process quality, and execution consistency.' },
  { id: 'amoretti', name: 'Alessandro Moretti', role: 'Performance-Oriented Trader', avatar: 'AM', color: 'bg-[#0e7490]', img: 'https://i.postimg.cc/bJRrN5M4/Alessandro-Moretti.png', prompt: 'You are Alessandro Moretti. Focus on disciplined setups, performance review, and tactical execution quality.' },
  { id: 'hwertheim', name: 'Herbert Wertheim', role: 'Inventor-Entrepreneur', avatar: 'HW', color: 'bg-[#334155]', img: 'https://i.postimg.cc/1txPhK3B/Herbert-Wertheim.png', prompt: 'You are Herbert Wertheim. Focus on practical innovation, long-term ownership, and quiet operational excellence.' },
  { id: 'kkullamagi', name: 'Kristjan Kullamagi', role: 'Growth Momentum Trader', avatar: 'KK', color: 'bg-[#1e3a8a]', img: 'https://i.postimg.cc/rsjL4XNs/Kristjan-Kullamagi.png', prompt: 'You are Kristjan Kullamagi. Focus on growth momentum, timing pivots, and disciplined trend-following execution.' },
  { id: 'lsilverstein', name: 'Larry Silverstein', role: 'Commercial Real Estate Developer', avatar: 'LS', color: 'bg-[#1f2937]', img: 'https://i.postimg.cc/Nj5wKny3/Larry-Silverstein.png', prompt: 'You are Larry Silverstein. Focus on commercial real estate strategy, financing structure, and long-horizon value.' },
  { id: 'lstern', name: 'Leonard Stern', role: 'Brand and Retail Operator', avatar: 'LS', color: 'bg-[#7c3aed]', img: 'https://i.postimg.cc/JncwwVgj/Leonard-Stern.png', prompt: 'You are Leonard Stern. Focus on brand discipline, retail economics, and resilient business building.' },
  { id: 'lraschke', name: 'Linda Bradford Raschke', role: 'Short-Term Trading Specialist', avatar: 'LR', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/br3KJ0qb/Linda-Bradford-Rasche.png', prompt: 'You are Linda Bradford Raschke. Focus on high-probability setups, risk control, and disciplined short-term execution.' },
  { id: 'szell', name: 'Sam Zell', role: 'Contrarian Real Asset Investor', avatar: 'SZ', color: 'bg-[#65a30d]', img: 'https://i.postimg.cc/7L8QqtSG/Sam-Zell.png', prompt: 'You are Sam Zell. Focus on contrarian real-asset allocation, cycle timing, and downside-aware dealmaking.' },
  { id: 'sross', name: 'Stephen Ross', role: 'Real Estate and Platform Builder', avatar: 'SR', color: 'bg-[#0369a1]', img: 'https://i.postimg.cc/MG6V0ySs/Stephen-Ross.png', prompt: 'You are Stephen Ross. Focus on large-scale development, platform strategy, and durable value creation.' },
  { id: 'tweschler', name: 'Ted Weschler', role: 'Concentrated Value Investor', avatar: 'TW', color: 'bg-[#1e293b]', img: 'https://i.postimg.cc/sfvbzNLP/Ted-Welscher.png', prompt: 'You are Ted Weschler. Focus on concentrated conviction, long-term compounding, and valuation discipline.' },
  { id: 'thougaard', name: 'Tom Hougaard', role: 'High-Intensity Trader', avatar: 'TH', color: 'bg-[#dc2626]', img: 'https://i.postimg.cc/vmZ3z1Fk/Tom-Hougaard.png', prompt: 'You are Tom Hougaard. Focus on decisive execution, psychological resilience, and high-performance trading discipline.' },
  { id: 'dbren', name: 'Donald Bren', role: 'Master Real Estate Developer', avatar: 'DB', color: 'bg-[#374151]', img: 'https://i.postimg.cc/28NGt9N2/Donald-bren.png', prompt: 'You are Donald Bren. Focus on disciplined development, long-term asset quality, and compounding real estate value.' },
  { id: 'machiavelli', name: 'Niccolo Machiavelli', role: 'Power Strategy Thinker', avatar: 'NM', color: 'bg-[#7f1d1d]', img: 'https://i.postimg.cc/5tjvkLPR/Niccolo-machiavelli.png', prompt: 'You are Niccolo Machiavelli. Focus on strategic power, incentives, political realism, and durable positioning.' },
  { id: 'jpeterson', name: 'Jordan Peterson', role: 'Psychology and Responsibility Coach', avatar: 'JP', color: 'bg-[#4c1d95]', img: 'https://i.postimg.cc/pXxjMgGJ/Jordan-Peterson.png', prompt: 'You are Jordan Peterson. Focus on responsibility, meaning, structure, and disciplined personal transformation.' },
  { id: 'tferriss', name: 'Tim Ferriss', role: 'Performance Systems Designer', avatar: 'TF', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/63n8D0dB/tim-ferriss.png', prompt: 'You are Tim Ferriss. Focus on leverage, experimentation, lifestyle design, and process optimization.' },
  { id: 'jbelfort', name: 'Jordan Belfort', role: 'High-Pressure Sales Operator', avatar: 'JB', color: 'bg-[#ea580c]', img: 'https://i.postimg.cc/7hqZjyHx/Jordan-Belfort.png', prompt: 'You are Jordan Belfort. Focus on persuasion mechanics, sales control, and aggressive closing frameworks.' },
  { id: 'jive', name: 'Jony Ive', role: 'Design Craft Strategist', avatar: 'JI', color: 'bg-[#111827]', img: 'https://i.postimg.cc/mDybY6Yt/Jony-Ive.png', prompt: 'You are Jony Ive. Focus on design purity, product craft, and experience coherence at every detail.' },
  { id: 'jclear', name: 'James Clear', role: 'Habit Systems Architect', avatar: 'JC', color: 'bg-[#15803d]', img: 'https://i.postimg.cc/br4FsqZh/James-Clear.png', prompt: 'You are James Clear. Focus on identity-based habits, compounding consistency, and practical behavior design.' },
  { id: 'gcardone', name: 'Grant Cardone', role: 'Sales Expansion Driver', avatar: 'GC', color: 'bg-[#b91c1c]', img: 'https://i.postimg.cc/QtyfyjkW/Grant-Cardone.png', prompt: 'You are Grant Cardone. Focus on sales intensity, pipeline expansion, and relentless execution.' },
  { id: 'dogilvy', name: 'David Ogilvy', role: 'Direct Response Advertising Strategist', avatar: 'DO', color: 'bg-[#92400e]', img: 'https://i.postimg.cc/nV6JsxbD/David-Olgivy.png', prompt: 'You are David Ogilvy. Focus on clear offers, persuasive copy, and measurable campaign outcomes.' },
  { id: 'dkennedy', name: 'Dan Kennedy', role: 'Direct Marketing Operator', avatar: 'DK', color: 'bg-[#7c2d12]', img: 'https://i.postimg.cc/Cx4T6fZG/Dan-kennedy.png', prompt: 'You are Dan Kennedy. Focus on direct-response economics, customer value maximization, and no-nonsense marketing execution.' },
  { id: 'cvoss', name: 'Chris Voss', role: 'Tactical Negotiation Expert', avatar: 'CV', color: 'bg-[#1e40af]', img: 'https://i.postimg.cc/66GsxP2Q/Chris-Voss.png', prompt: 'You are Chris Voss. Focus on calibrated questions, tactical empathy, and high-leverage negotiation outcomes.' },
  { id: 'ahuberman', name: 'Andrew Huberman', role: 'Performance Neuroscience Coach', avatar: 'AH', color: 'bg-[#0f766e]', img: 'https://i.postimg.cc/6QQSjbxx/Andrew-Huberman.png', prompt: 'You are Andrew Huberman. Focus on evidence-based performance, recovery, and biology-driven behavior optimization.' },
];

const PERSONA_PROFILE_OVERRIDES = {
  jobs: {
    domainExpertise: ['product', 'design', 'startup'],
    thinkingStyle: 'first-principles',
    communicationTone: 'direct and exacting',
    stageRelevance: 'growth-scaling',
    decisionBias: 'quality and user experience over feature sprawl',
    confidenceBoundary: 'Avoid detailed legal, tax, or medical instructions.',
  },
  simons: {
    domainExpertise: ['trading', 'statistics', 'quant'],
    thinkingStyle: 'analytical',
    communicationTone: 'concise and data-first',
    stageRelevance: 'intermediate-advanced',
    decisionBias: 'measurable edge over narrative confidence',
    confidenceBoundary: 'Avoid discretionary macro calls without data-backed setup.',
  },
  buffett: {
    domainExpertise: ['investing', 'capital allocation', 'risk'],
    thinkingStyle: 'probabilistic and long-horizon',
    communicationTone: 'calm and practical',
    stageRelevance: 'beginner-scaling',
    decisionBias: 'downside protection before upside optionality',
    confidenceBoundary: 'Avoid short-term trading timing directives.',
  },
  hormozi: {
    domainExpertise: ['offers', 'sales', 'growth'],
    thinkingStyle: 'pragmatic and operator-driven',
    communicationTone: 'blunt and actionable',
    stageRelevance: 'beginner-growth',
    decisionBias: 'execution velocity with clear unit economics',
    confidenceBoundary: 'Avoid legal/compliance specifics without local constraints.',
  },
};

const inferPersonaProfile = (advisor) => {
  const combined = `${advisor?.role || ''} ${advisor?.prompt || ''}`.toLowerCase();
  const domainExpertise = [];

  if (/(trad|market|quant|macro|invest)/i.test(combined)) domainExpertise.push('trading');
  if (/(startup|product|founder|technology|platform)/i.test(combined)) domainExpertise.push('startup');
  if (/(sales|offer|close|negotiation|persuasion)/i.test(combined)) domainExpertise.push('sales');
  if (/(brand|marketing|audience|distribution|story)/i.test(combined)) domainExpertise.push('marketing');
  if (/(operations|process|execution|discipline)/i.test(combined)) domainExpertise.push('operations');
  if (/(finance|capital|portfolio|valuation)/i.test(combined)) domainExpertise.push('finance');
  if (!domainExpertise.length) domainExpertise.push(inferDomainFromText(combined) || 'general strategy');

  let thinkingStyle = 'pragmatic';
  if (/(first-principles|engineering|physics)/i.test(combined)) thinkingStyle = 'first-principles';
  else if (/(contrarian|activist)/i.test(combined)) thinkingStyle = 'contrarian';
  else if (/(quant|data|statistics|probabilistic)/i.test(combined)) thinkingStyle = 'analytical';
  else if (/(systems|process|framework)/i.test(combined)) thinkingStyle = 'systems-driven';

  let communicationTone = 'concise and practical';
  if (/(direct|candid|blunt)/i.test(combined)) communicationTone = 'direct and challenging';
  else if (/(coach|support|happiness|habit)/i.test(combined)) communicationTone = 'supportive and structured';

  let stageRelevance = 'growth';
  if (/(fundamental|habit|starter|beginner)/i.test(combined)) stageRelevance = 'beginner';
  if (/(scale|institutional|platform|blitz)/i.test(combined)) stageRelevance = 'scaling';

  return {
    domainExpertise,
    thinkingStyle,
    communicationTone,
    stageRelevance,
    decisionBias: 'clarity and outcomes over abstract theory',
    confidenceBoundary: 'If a request is outside your competence, state limits and defer to a better-suited persona.',
  };
};

const getPersonaProfile = (advisor) => {
  const inferred = inferPersonaProfile(advisor);
  const override = PERSONA_PROFILE_OVERRIDES[advisor?.id] || {};
  return {
    ...inferred,
    ...override,
    domainExpertise: override.domainExpertise || inferred.domainExpertise,
  };
};

const inferUserExperienceLevel = (history = []) => {
  const combined = history
    .filter((msg) => msg?.role === 'user')
    .slice(-10)
    .map((msg) => String(msg?.content || ''))
    .join(' ')
    .toLowerCase();

  if (!combined.trim()) return 'beginner';

  const advancedSignals = /(sharpe|expectancy|drawdown|cac|ltv|cohort|funnel|variance|position sizing|risk-adjusted|unit economics)/i;
  const intermediateSignals = /(conversion|pipeline|setup|execution|retention|kpi|framework|process)/i;

  if (advancedSignals.test(combined)) return 'advanced';
  if (intermediateSignals.test(combined)) return 'intermediate';
  return 'beginner';
};

const isPersonalPerspectiveRequest = (text) => /(what would you do|if you were me|in my situation|personally do)/i.test(String(text || '').toLowerCase());

const extractGoalShiftFromText = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return '';

  const match = normalized.match(/(?:new goal|my goal now is|change my goal to|instead i want to|i want to focus on)\s*[:-]?\s*(.+)$/i);
  if (!match?.[1]) return '';
  return match[1].trim().slice(0, 220);
};

const COMMUNITY_INTENT_OPTIONS = [
  'Custom intent',
  'Raise funding',
  'Validate idea',
  'Allocate capital',
  'Scale growth',
  'Reduce risk',
  'Increase revenue',
  'Increase sales pipeline',
  'Improve close rate',
  'Find best trade timing',
  'Build trading plan',
  'Optimize risk-reward setup',
  'Acquire real estate deal flow',
  'Strengthen operations execution',
  'Improve leadership decisions',
  'Enter new market',
  'Fix failing business',
  'Build system / automate',
  'Personal growth / discipline',
];

const COMMUNITY_DOMAIN_OPTIONS = [
  'general',
  'finance',
  'marketing',
  'product',
  'psychology',
  'sales',
  'trading',
  'real-estate',
  'operations',
  'leadership',
  'legal',
  'performance',
];

const COMMUNITY_DOMAIN_ROUTING = {
  finance: ['jpmorgan', 'rockefeller', 'buffett', 'marks', 'ackman', 'baruch', 'burry', 'paulson', 'icahn', 'loeb', 'peltz', 'singer', 'jsmith'],
  marketing: ['garyv', 'barnum', 'cialdini', 'sodin', 'chanel', 'hormozi', 'jminer', 'daymond', 'oprah'],
  product: ['jobs', 'fadell', 'chesky', 'jhuang', 'saltman', 'porter', 'hormozi', 'pcollison'],
  psychology: ['kahneman', 'cialdini', 'munger', 'graham', 'dalio', 'suntzu', 'reddington'],
  sales: ['jminer', 'hormozi', 'garyv', 'daymond', 'cialdini', 'mayhew', 'barnum'],
  trading: ['seykota', 'livermore', 'minervini', 'ptj', 'druckenmiller', 'gann', 'rcameron', 'lwilliams'],
  'real-estate': ['trump', 'rockefeller', 'bezos', 'jpmorgan', 'icahn'],
  operations: ['porter', 'horowitz', 'jhuang', 'jobs', 'carnegie'],
  leadership: ['dalio', 'munger', 'oprah', 'branson', 'kahneman'],
  legal: ['singer', 'paulson', 'icahn', 'loeb', 'jpmorgan'],
  performance: ['kahneman', 'hormozi', 'ravikant', 'suntzu', 'ptj'],
};

const COMMUNITY_ROUTING_RULES = [
  {
    keywords: ['raise funding', 'capital raise', 'series a', 'seed round', 'investor deck', 'ipo', 'funding'],
    advisorIds: ['jpmorgan', 'ackman', 'loeb', 'paulson', 'icahn'],
    why: 'Capital structure, institutional fundraising, and deal execution depth.',
    score: 28,
  },
  {
    keywords: ['validate idea', 'product market fit', 'mvp', 'prototype', 'launch'],
    advisorIds: ['jobs', 'fadell', 'chesky', 'porter', 'saltman'],
    why: 'Strong track record in product validation, positioning, and adoption loops.',
    score: 24,
  },
  {
    keywords: ['allocate capital', 'portfolio', 'asset allocation', 'deploy capital', 'treasury'],
    advisorIds: ['buffett', 'marks', 'dalio', 'baruch', 'graham'],
    why: 'Disciplined capital allocation with explicit risk and downside frameworks.',
    score: 26,
  },
  {
    keywords: ['scale growth', 'go to market', 'distribution', 'revenue growth', 'acquisition'],
    advisorIds: ['hormozi', 'garyv', 'jminer', 'porter', 'daymond'],
    why: 'Execution-focused growth strategies across sales, positioning, and distribution.',
    score: 25,
  },
  {
    keywords: ['reduce risk', 'hedge', 'drawdown', 'uncertainty', 'stress test'],
    advisorIds: ['marks', 'kahneman', 'graham', 'suntzu', 'seykota'],
    why: 'Decision quality and risk containment under uncertainty.',
    score: 23,
  },
  {
    keywords: ['increase revenue', 'sell more', 'close deals', 'sales process', 'conversion'],
    advisorIds: ['jminer', 'hormozi', 'garyv', 'cialdini', 'mayhew'],
    why: 'Revenue acceleration via sales mechanics, persuasion, and offer design.',
    score: 25,
  },
  {
    keywords: ['trading', 'investing', 'setup', 'entry', 'exit', 'position sizing'],
    advisorIds: ['seykota', 'livermore', 'minervini', 'ptj', 'druckenmiller'],
    why: 'Execution-centric trading frameworks with discipline and timing.',
    score: 24,
  },
  {
    keywords: ['real estate', 'property', 'rental', 'commercial asset', 'development'],
    advisorIds: ['trump', 'rockefeller', 'jpmorgan', 'icahn'],
    why: 'Capital-intensive real-asset strategy and deal structuring.',
    score: 22,
  },
  {
    keywords: ['operations', 'execution', 'process', 'scale team', 'efficiency'],
    advisorIds: ['porter', 'horowitz', 'jhuang', 'carnegie', 'jobs'],
    why: 'Operational leverage, systems design, and execution rigor.',
    score: 24,
  },
  {
    keywords: ['leadership', 'management', 'culture', 'alignment', 'hiring'],
    advisorIds: ['dalio', 'munger', 'oprah', 'branson', 'horowitz'],
    why: 'Leadership clarity, culture architecture, and decision cadence.',
    score: 21,
  },
];

const normalizeSearchKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const getSentenceChunks = (text) => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  return chunks.map((part) => part.trim()).filter(Boolean);
};

const CASUAL_MESSAGE_SET = new Set([
  'hi',
  'hello',
  'hey',
  'yo',
  'sup',
  'ok',
  'okay',
  'k',
  'thanks',
  'thank you',
  'thx',
  'cool',
  'nice',
  'great',
  'yes',
  'no',
  'gm',
  'gn',
  'good morning',
  'good afternoon',
  'good evening',
  'how are you',
  'hru',
  'lol',
  'lmao',
  'haha',
]);

const VAGUE_INTENT_HINTS = new Set([
  'help',
  'ideas',
  'advice',
  'thoughts',
  'suggestions',
  'plan',
  'strategy',
  'next',
  'improve',
  'grow',
  'fix',
  'start',
]);

const isLightweightUserMessage = (text) => {
  const normalized = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const withoutPunctuation = normalized.replace(/[!?.,;:]/g, '').trim();
  if (CASUAL_MESSAGE_SET.has(withoutPunctuation)) return true;

  const tokens = withoutPunctuation.split(' ').filter(Boolean);
  return tokens.length <= 2 && tokens.every((token) => token.length <= 5);
};

const isVagueUserMessage = (text) => {
  const normalized = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (isLightweightUserMessage(normalized)) return false;

  const stripped = normalized.replace(/[!?.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = stripped.split(' ').filter(Boolean);
  if (!tokens.length) return false;

  if (tokens.length <= 5) return true;
  return tokens.some((token) => VAGUE_INTENT_HINTS.has(token));
};

const toSentenceCase = (value) => {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text === text.toUpperCase()) {
    const lowered = text.toLowerCase();
    return lowered.charAt(0).toUpperCase() + lowered.slice(1);
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const toSingleLine = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const buildQuickReplyFromQuestion = (question, context = '') => {
  const text = toSingleLine(question).toLowerCase();
  const contextText = toSingleLine(context).toLowerCase();
  if (!text) return '';

  const has = (...tokens) => tokens.some((token) => text.includes(token));
  const isTrading = /trading|setup|entry|exit|drawdown|pnl|position/.test(contextText);
  const isSales = /sales|pipeline|close|deal|outreach|conversion/.test(contextText);
  const isStartup = /startup|product|mvp|retention|users|launch/.test(contextText);

  if (has('exact outcome', 'specific result', 'what one result', 'goal', 'target', 'outcome')) {
    if (isTrading) return 'My target is 8 rule-compliant trades this week with max 2% total drawdown.';
    if (isSales) return 'My target is 6 qualified calls booked this week from 40 outbound messages.';
    if (isStartup) return 'My target is 15 activated users this week from the new onboarding flow.';
    return 'My target is 2 signed clients this week from 20 qualified outreach messages.';
  }

  if (has('constraint', 'time, cash, or risk', 'time, budget, or risk', 'resource')) {
    if (isTrading) return 'My main constraint is risk; I can only risk 0.5% per trade right now.';
    if (isSales) return 'My main constraint is time; I have a 90-minute daily outreach window.';
    return 'My main constraint is cash; I can spend only $300 this month on experiments.';
  }

  if (has('move faster or reduce risk', 'go fast or de-risk', 'trade-off')) {
    return 'I want to de-risk first with a 7-day pilot before scaling effort or budget.';
  }

  if (has('where is it breaking', 'where is it failing', 'bottleneck', 'stuck')) {
    if (isTrading) return 'It breaks at execution; I exit early after one candle of pullback.';
    if (isSales) return 'It breaks after first contact; prospects stop replying after pricing is shared.';
    return 'It breaks at activation; users sign up but do not complete the second step.';
  }

  if (has('metric', 'kpi', 'measure')) {
    if (isTrading) return 'I track win rate and average R; this week I am at 38% win rate and 0.7R.';
    if (isSales) return 'I track reply rate and call-booked rate; current values are 9% and 2.5%.';
    return 'I track activation rate; current activation is 14% and target is 25%.';
  }

  if (has('deadline', 'by when', 'when will')) {
    return 'I will complete the test by Thursday 6 PM and post the measured result that night.';
  }

  if (has('risk', 'downside', 'worst case')) {
    return 'Worst case is wasting one week, so I cap spend and stop if KPI does not improve by 20%.';
  }

  if (has('assumption', 'assuming')) {
    return 'I am assuming lead quality stays stable for two weeks while we test this change.';
  }

  if (has('next step', 'first step', 'action')) {
    if (isTrading) return 'First step: predefine entry, stop, and invalidation rules before market open.';
    if (isSales) return 'First step: call 10 warm leads today and ask for a specific next meeting date.';
    return 'First step: run one focused experiment today and log the result in one metric.';
  }

  if (/^why\b/.test(text)) {
    return 'Because this gives the fastest measurable signal with limited downside this week.';
  }

  if (/^how\b/.test(text)) {
    return 'I will run it in a 7-day test, track one KPI daily, and decide to scale on Friday.';
  }

  if (/^which\b/.test(text)) {
    return 'I would choose the lower-risk path first, then scale once the metric trend is stable.';
  }

  if (/^when\b/.test(text)) {
    return 'I will start today at 4 PM and review outcomes every evening this week.';
  }

  return 'I will execute one concrete test this week, track one KPI daily, and review on Friday.';
};

const alignSuggestedQuestions = (questions = [], suggestedQuestions = [], context = '') => {
  const retrySuggestions = suggestedQuestions
    .map((item) => toSingleLine(item))
    .filter(Boolean)
    .filter((item) => /retry/i.test(item));

  if (retrySuggestions.length) return retrySuggestions.slice(0, 3);

  const questionAligned = questions
    .map((question) => buildQuickReplyFromQuestion(question, context))
    .map((item) => toSentenceCase(toSingleLine(item)))
    .filter(Boolean);

  if (questionAligned.length) return questionAligned.slice(0, 3);

  return suggestedQuestions
    .map((item) => toSentenceCase(toSingleLine(item)))
    .filter(Boolean)
    .slice(0, 3);
};

const buildPayloadFromText = (text, options = {}) => {
  const { lightweightMode = false, forceClarifyingQuestions = false } = options;
  const sentences = getSentenceChunks(text);

  if (lightweightMode) {
    const firstLine = toSentenceCase(sentences[0] || 'Hey.');
    return {
      bursts: [firstLine],
      insight: '',
      depthCard: null,
      questions: [],
      suggestedQuestions: [],
    };
  }

  const bursts = sentences.slice(0, 3);
  const insight = sentences[3] || '';
  const deepPoints = sentences.slice(4, 8);

  return {
    bursts: bursts.length ? bursts : ['Lets sharpen this one step at a time.'],
    insight,
    depthCard: deepPoints.length
      ? {
          title: 'Deep Dive',
          points: deepPoints,
        }
      : null,
    questions: forceClarifyingQuestions
      ? [
          toSentenceCase('What specific result do you want by this Friday?'),
          toSentenceCase('What is your main constraint right now: time, cash, or risk?'),
        ]
      : [
          toSentenceCase('Do you want to move faster or reduce risk first?'),
          toSentenceCase('What one result matters most this week?'),
        ],
    suggestedQuestions: alignSuggestedQuestions(
      forceClarifyingQuestions
        ? [
            toSentenceCase('What specific result do you want by this Friday?'),
            toSentenceCase('What is your main constraint right now: time, cash, or risk?'),
          ]
        : [
            toSentenceCase('Do you want to move faster or reduce risk first?'),
            toSentenceCase('What one result matters most this week?'),
          ],
      [],
      text
    ),
  };
};

const normalizePayload = (raw, options = {}) => {
  const { lightweightMode = false, forceClarifyingQuestions = false } = options;
  if (!raw || typeof raw !== 'object') return buildPayloadFromText('', { lightweightMode, forceClarifyingQuestions });

  const bursts = Array.isArray(raw.bursts)
    ? raw.bursts.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, lightweightMode ? 1 : 4)
    : [];

  const insight = lightweightMode ? '' : (typeof raw.insight === 'string' ? raw.insight.trim() : '');

  const depthCard =
    !lightweightMode && raw.depthCard &&
    typeof raw.depthCard.title === 'string' &&
    Array.isArray(raw.depthCard.points)
      ? {
          title: raw.depthCard.title.trim() || 'Deep Dive',
          points: raw.depthCard.points.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 6),
        }
      : null;

  const questions = !lightweightMode && Array.isArray(raw.questions)
    ? raw.questions
      .filter((item) => typeof item === 'string')
      .map((item) => toSentenceCase(item))
      .filter(Boolean)
      .slice(0, forceClarifyingQuestions ? 2 : 3)
    : [];

  const suggestedQuestions = !lightweightMode && Array.isArray(raw.suggestedQuestions)
    ? raw.suggestedQuestions
      .filter((item) => typeof item === 'string')
      .map((item) => toSentenceCase(item))
      .filter(Boolean)
      .slice(0, 3)
    : [];

  if (!bursts.length && !insight && !depthCard) return buildPayloadFromText('', { lightweightMode, forceClarifyingQuestions });

  const resolvedQuestions = forceClarifyingQuestions
    ? (questions.length
      ? questions.slice(0, 2)
      : [
          toSentenceCase('What exact outcome do you want by the end of this week?'),
          toSentenceCase('Which constraint matters most right now: time, budget, or risk?'),
        ])
    : questions;

  return {
    bursts: bursts.length ? bursts : [lightweightMode ? 'Hey.' : 'Lets pressure-test this quickly.'],
    insight,
    depthCard,
    questions: resolvedQuestions,
    suggestedQuestions: alignSuggestedQuestions(resolvedQuestions, suggestedQuestions),
  };
};

const parseModelResponse = (rawText, options = {}) => {
  const { lightweightMode = false, forceClarifyingQuestions = false } = options;
  if (!rawText || typeof rawText !== 'string') return buildPayloadFromText('', { lightweightMode, forceClarifyingQuestions });
  try {
    const parsed = JSON.parse(rawText);
    return normalizePayload(parsed, { lightweightMode, forceClarifyingQuestions });
  } catch {
    return buildPayloadFromText(rawText, { lightweightMode, forceClarifyingQuestions });
  }
};

const mergeStreamText = (prev, incoming) => {
  if (!incoming) return prev;
  if (!prev) return incoming;
  if (incoming.startsWith(prev)) return incoming;
  if (prev.endsWith(incoming)) return prev;
  return `${prev}${incoming}`;
};

const formatThreadTime = (isoLike) => {
  const date = new Date(isoLike || Date.now());
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeCoachTime = (value, fallback = COACH_DEFAULT_MORNING_TIME) => {
  if (!value || typeof value !== 'string') return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
  const safeHours = Math.min(23, Math.max(0, hours));
  const safeMinutes = Math.min(59, Math.max(0, minutes));
  return `${String(safeHours).padStart(2, '0')}:${String(safeMinutes).padStart(2, '0')}`;
};

const clockTimeToMinutes = (value, fallback = 0) => {
  const normalized = normalizeCoachTime(value, '00:00');
  const [hours, minutes] = normalized.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
  return (hours * 60) + minutes;
};

const toDateKey = (date = new Date()) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const getDateKeyOffset = (days = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return toDateKey(now);
};

const formatCommitmentText = (commitment) => {
  if (!commitment || typeof commitment !== 'object') return '';
  const action = String(commitment.action || '').trim();
  const time = String(commitment.time || '').trim();
  if (!action && !time) return '';
  if (action && time) return `${action} at ${time}`;
  return action || time;
};

const inferTomorrowCommitment = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();

  const commitmentHint = /(tomorrow|tmrw|next day|i will|i'll|plan to|going to)/i.test(lowered);
  if (!commitmentHint) return null;

  const timeMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i);
  const twentyFourMatch = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  let time = '';

  if (timeMatch) {
    const rawHour = Number(timeMatch[1]);
    const rawMinute = Number(timeMatch[2] || '0');
    const meridiem = String(timeMatch[3] || '').toLowerCase();
    let hour = rawHour % 12;
    if (meridiem === 'pm') hour += 12;
    time = `${String(hour).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')}`;
  } else if (twentyFourMatch) {
    time = `${String(Number(twentyFourMatch[1])).padStart(2, '0')}:${twentyFourMatch[2]}`;
  }

  const cleaned = normalized
    .replace(/\b(tomorrow|tmrw|next day)\b/ig, '')
    .replace(/\b(i will|i'll|plan to|going to)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  if (!cleaned && !time) return null;
  return {
    dateKey: getDateKeyOffset(1),
    action: cleaned || 'complete the planned goal action',
    time,
    status: 'pending',
    source: 'user_commitment',
  };
};

const deriveCoachMetrics = (plan) => {
  const entries = (plan?.progressLog || []).filter((entry) => entry && entry.completed !== null);
  const completedCount = entries.filter((entry) => entry.completed === true).length;
  const total = entries.length;
  const completionPct = total ? Math.round((completedCount / total) * 100) : 0;

  let successStreak = 0;
  let missedStreak = 0;
  for (let idx = entries.length - 1; idx >= 0; idx -= 1) {
    const entry = entries[idx];
    if (entry.completed === true && missedStreak === 0) {
      successStreak += 1;
      continue;
    }
    if (entry.completed === false && successStreak === 0) {
      missedStreak += 1;
      continue;
    }
    break;
  }

  let escalationState = 'on_track';
  if (successStreak >= 5) escalationState = 'consistent_success';
  else if (missedStreak >= 3) escalationState = 'repeated_failure';
  else if (missedStreak >= 1) escalationState = 'slight_miss';

  const scoreRaw = 50 + (completionPct * 0.38) + (successStreak * 4) - (missedStreak * 7);
  const reputationScore = clampNumber(Math.round(scoreRaw), 5, 98);
  let reputationLabel = 'Building Consistency';
  if (reputationScore >= 80) reputationLabel = 'Reliable Operator';
  else if (reputationScore >= 65) reputationLabel = 'High Potential';
  else if (reputationScore < 45) reputationLabel = 'Low Execution';

  return {
    completionPct,
    totalCheckIns: total,
    totalCompleted: completedCount,
    successStreak,
    missedStreak,
    escalationState,
    reputationScore,
    reputationLabel,
  };
};

const getEscalationStyleInstruction = (state) => {
  if (state === 'consistent_success') return 'Tone: strategic, high standards, challenge user to upgrade target difficulty.';
  if (state === 'repeated_failure') return 'Tone: direct confrontation with consequences. No soft reassurance. Demand specific recommitment.';
  if (state === 'slight_miss') return 'Tone: firm accountability, diagnose blockers, and restore execution quickly.';
  return 'Tone: confident encouragement and practical execution focus.';
};

const defaultCoachPlan = () => ({
  enabled: false,
  goal: '',
  morningTime: COACH_DEFAULT_MORNING_TIME,
  eveningTime: COACH_DEFAULT_EVENING_TIME,
  lastCheckInBySlot: {
    morning: '',
    evening: '',
    context: '',
  },
  progressLog: [],
  lastUserUpdateAt: '',
  lastContextCheckInAt: '',
  pendingCoachPromptAt: '',
  pendingCoachSlot: '',
  goalNeedsRefinement: false,
  goalVersion: 0,
  lastGoalChallengeAt: '',
  nextCommitment: null,
  escalationState: 'on_track',
  successStreak: 0,
  missedStreak: 0,
  totalCheckIns: 0,
  totalCompleted: 0,
  reputationScore: 50,
  reputationLabel: 'Building Consistency',
  updatedAt: '',
});

const sanitizeCoachPlan = (raw) => {
  const base = defaultCoachPlan();
  if (!raw || typeof raw !== 'object') return base;
  const progressLog = Array.isArray(raw.progressLog)
    ? raw.progressLog
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.dateKey === 'string')
        .map((entry) => ({
          dateKey: entry.dateKey,
          completed: typeof entry.completed === 'boolean' ? entry.completed : null,
          note: typeof entry.note === 'string' ? entry.note.trim().slice(0, 220) : '',
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
        }))
    : [];

  return {
    enabled: Boolean(raw.enabled),
    goal: typeof raw.goal === 'string' ? raw.goal.trim().slice(0, 240) : '',
    morningTime: normalizeCoachTime(raw.morningTime, COACH_DEFAULT_MORNING_TIME),
    eveningTime: normalizeCoachTime(raw.eveningTime, COACH_DEFAULT_EVENING_TIME),
    lastCheckInBySlot: {
      morning: typeof raw.lastCheckInBySlot?.morning === 'string' ? raw.lastCheckInBySlot.morning : '',
      evening: typeof raw.lastCheckInBySlot?.evening === 'string' ? raw.lastCheckInBySlot.evening : '',
      context: typeof raw.lastCheckInBySlot?.context === 'string' ? raw.lastCheckInBySlot.context : '',
    },
    progressLog: progressLog.slice(-35),
    lastUserUpdateAt: typeof raw.lastUserUpdateAt === 'string' ? raw.lastUserUpdateAt : '',
    lastContextCheckInAt: typeof raw.lastContextCheckInAt === 'string' ? raw.lastContextCheckInAt : '',
    pendingCoachPromptAt: typeof raw.pendingCoachPromptAt === 'string' ? raw.pendingCoachPromptAt : '',
    pendingCoachSlot: typeof raw.pendingCoachSlot === 'string' ? raw.pendingCoachSlot : '',
    goalNeedsRefinement: Boolean(raw.goalNeedsRefinement),
    goalVersion: Number.isFinite(Number(raw.goalVersion)) ? Number(raw.goalVersion) : 0,
    lastGoalChallengeAt: typeof raw.lastGoalChallengeAt === 'string' ? raw.lastGoalChallengeAt : '',
    nextCommitment: raw.nextCommitment && typeof raw.nextCommitment === 'object'
      ? {
          dateKey: typeof raw.nextCommitment.dateKey === 'string' ? raw.nextCommitment.dateKey : '',
          action: typeof raw.nextCommitment.action === 'string' ? raw.nextCommitment.action.trim().slice(0, 220) : '',
          time: typeof raw.nextCommitment.time === 'string' ? normalizeCoachTime(raw.nextCommitment.time, '') : '',
          status: typeof raw.nextCommitment.status === 'string' ? raw.nextCommitment.status : 'pending',
          source: typeof raw.nextCommitment.source === 'string' ? raw.nextCommitment.source : 'user_commitment',
        }
      : null,
    escalationState: typeof raw.escalationState === 'string' ? raw.escalationState : 'on_track',
    successStreak: Number.isFinite(Number(raw.successStreak)) ? Number(raw.successStreak) : 0,
    missedStreak: Number.isFinite(Number(raw.missedStreak)) ? Number(raw.missedStreak) : 0,
    totalCheckIns: Number.isFinite(Number(raw.totalCheckIns)) ? Number(raw.totalCheckIns) : 0,
    totalCompleted: Number.isFinite(Number(raw.totalCompleted)) ? Number(raw.totalCompleted) : 0,
    reputationScore: Number.isFinite(Number(raw.reputationScore)) ? clampNumber(Number(raw.reputationScore), 0, 100) : 50,
    reputationLabel: typeof raw.reputationLabel === 'string' ? raw.reputationLabel : 'Building Consistency',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
};

const inferGoalProgressUpdate = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();

  const completed = /\b(done|completed|finished|achieved|yes i did|hit it|on track|i did it)\b/i.test(lowered);
  const missed = /\b(not yet|didn't|did not|missed|no i|failed|couldn't|could not|off track)\b/i.test(lowered);

  if (!completed && !missed) {
    return {
      completed: null,
      note: normalized.slice(0, 220),
    };
  }

  return {
    completed: completed && !missed,
    note: normalized.slice(0, 220),
  };
};

const buildCoachFallbackPayload = (advisorName, goal, slot, progressSummary) => {
  const isMorning = slot === 'morning';
  const opening = isMorning
    ? `${advisorName}: What is your plan today to move ${goal ? `"${goal}"` : 'your goal'} forward?`
    : `${advisorName}: Before you close the day, did you complete ${goal ? `"${goal}"` : 'your goal'}?`;

  const followUp = isMorning
    ? 'Reply with one concrete action and the exact time you will do it.'
    : 'Reply with yes or no, then one lesson from today so we can tighten tomorrow.';

  return {
    bursts: [opening, followUp],
    insight: progressSummary || '',
    depthCard: null,
    questions: isMorning
      ? ['What is the one action that matters most today?']
      : ['Did you complete your goal today?'],
    suggestedQuestions: [],
  };
};

const DepthCard = ({ card }) => {
  const [open, setOpen] = useState(false);
  if (!card) return null;

  return (
    <div className='bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden'>
      <button
        type='button'
        onClick={() => setOpen((prev) => !prev)}
        className='w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors'
      >
        <p className='text-[11px] uppercase tracking-wider font-black text-slate-700'>{card.title}</p>
        {open ? <ChevronUp size={14} className='text-slate-400' /> : <ChevronDown size={14} className='text-slate-400' />}
      </button>
      {open && (
        <div className='px-4 pb-4 space-y-2'>
          {card.points.map((point, idx) => (
            <div key={`${point}-${idx}`} className='flex gap-2'>
              <div className='w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5' />
              <p className='text-xs text-slate-600 leading-relaxed'>{point}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('main');
  const [activeThread, setActiveThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [communityIntent, setCommunityIntent] = useState('');
  const [communitySelectedIntent, setCommunitySelectedIntent] = useState('Custom intent');
  const [communityRiskLevel, setCommunityRiskLevel] = useState(50);
  const [communityTimeHorizon, setCommunityTimeHorizon] = useState('mid');
  const [communityIndustryTag, setCommunityIndustryTag] = useState('general');
  const [communityExecutionMode, setCommunityExecutionMode] = useState('solo');
  const [communitySpeedPreference, setCommunitySpeedPreference] = useState('balanced');
  const [communityCapitalBand, setCommunityCapitalBand] = useState('unknown');
  const [communityStage, setCommunityStage] = useState('unspecified');
  const [communityTriageMode, setCommunityTriageMode] = useState('hybrid');
  const [communityShowDomains, setCommunityShowDomains] = useState(false);
  const [communityShowDecisionMap, setCommunityShowDecisionMap] = useState(false);
  const [communityShowAllPersonas, setCommunityShowAllPersonas] = useState(false);
  const [communityPersonaSearch, setCommunityPersonaSearch] = useState('');
  const [communityShowIntentControls, setCommunityShowIntentControls] = useState(true);
  const [communityShowRefineControls, setCommunityShowRefineControls] = useState(false);
  const [communityBrowseFilterOpen, setCommunityBrowseFilterOpen] = useState(false);
  const [communityIntentSuggesting, setCommunityIntentSuggesting] = useState(false);
  const [communityAiIntentBoostById, setCommunityAiIntentBoostById] = useState({});
  const [typingThreadId, setTypingThreadId] = useState(null);
  const [composerAttachments, setComposerAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.hasSeenOnboarding === 'boolean') return parsed.hasSeenOnboarding;
      const hasExistingSessionData = Object.keys(parsed?.chatHistories || {}).length > 0
        || Object.keys(parsed?.threadDrafts || {}).length > 0;
      return hasExistingSessionData;
    } catch {
      return false;
    }
  });
  const [onboardingIntentInput, setOnboardingIntentInput] = useState('');
  const [onboardingMatchPreview, setOnboardingMatchPreview] = useState(null);
  const [onboardingMentorPickerOpen, setOnboardingMentorPickerOpen] = useState(false);
  const [onboardingMentorSearch, setOnboardingMentorSearch] = useState('');
  const [onboardingExtraMentorIds, setOnboardingExtraMentorIds] = useState([]);
  const [mainFocusedAdvisorIds, setMainFocusedAdvisorIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.mainFocusedAdvisorIds) ? parsed.mainFocusedAdvisorIds : [];
    } catch {
      return [];
    }
  });
  const [appLanguage, setAppLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return 'en';
      const parsed = JSON.parse(raw);
      const lang = String(parsed?.appLanguage || 'en');
      return LANGUAGE_OPTIONS.some((option) => option.id === lang) ? lang : 'en';
    } catch {
      return 'en';
    }
  });
  const [recordingState, setRecordingState] = useState({
    active: false,
    paused: false,
    elapsedMs: 0,
  });
  const chatEndRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const groupPictureInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaRecorderStreamRef = useRef(null);
  const mediaRecorderChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const onboardingTransitionRef = useRef(null);
  const threadSelectionTimerRef = useRef(null);
  const threadTouchRef = useRef({
    threadId: null,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClickUntil: 0,
  });
  const messageLongPressTimerRef = useRef(null);
  const swipeStateRef = useRef({
    messageId: null,
    swipeKey: null,
    startX: 0,
    startY: 0,
    offset: 0,
    isVerticalScroll: false,
    isHorizontalSwipe: false,
  });
  const generationRef = useRef({
    controller: null,
    revealInterval: null,
    assistantId: null,
    threadId: null,
    interrupted: false,
  });
  const appStateRef = useRef({
    isActive: true,
  });
  const activeThreadIdRef = useRef(null);
  const pendingQuickReplyRef = useRef(null);
  const handleSendMessageRef = useRef(null);
  const updateThreadFromAssistantMessageRef = useRef(null);
  const runContextTriggerSweepRef = useRef(null);
  const [quickReplySignal, setQuickReplySignal] = useState(0);
  const [revealedStrategicHintsByMessage, setRevealedStrategicHintsByMessage] = useState({});

  const [localStateLoaded, setLocalStateLoaded] = useState(false);

  const getThreadHintContext = (threadId) => {
    const history = chatHistories[threadId] || [];
    return history
      .filter((item) => item?.role === 'user')
      .slice(-8)
      .map((item) => String(item?.content || '').toLowerCase())
      .join(' ');
  };

  const getStrategicQuestionHint = (question, context = '') => {
    const example = buildQuickReplyFromQuestion(question, context);
    return example ? `e.g., ${example}` : '';
  };

  const buildSeedThreads = () => {
    const baseThreads = [
      { id: '1', title: 'Steve Jobs', isGroup: false, advisorIds: ['jobs'], lastMsg: 'Simplicity is the ultimate sophistication.', time: '11:26 AM', unread: 0, pinned: true, status: 'read' },
      { id: '2', title: 'Andrew Carnegie', isGroup: false, advisorIds: ['carnegie'], lastMsg: 'Efficiency is the only viable leverage.', time: '9:28 AM', unread: 4, pinned: false, status: 'delivered' },
      { id: '3', title: 'John D. Rockefeller', isGroup: false, advisorIds: ['rockefeller'], lastMsg: 'Precision is the root of scale.', time: '8:03 AM', unread: 2, pinned: false, status: 'read' },
      { id: '4', title: 'Peter Thiel', isGroup: false, advisorIds: ['thiel'], lastMsg: 'What valuable company is nobody building?', time: 'Yesterday', unread: 0, pinned: false, status: 'read' },
    ];

    const existingAdvisorIds = new Set(
      baseThreads.filter((thread) => !thread.isGroup).map((thread) => thread.advisorIds[0])
    );

    const personaThreads = HISTORICAL_FIGURES.filter(
      (advisor) => !existingAdvisorIds.has(advisor.id)
    ).map((advisor, idx) => ({
      id: `persona-${advisor.id}-${idx}`,
      title: advisor.name,
      isGroup: false,
      advisorIds: [advisor.id],
      lastMsg: `${advisor.role} advisory session ready.`,
      time: 'Now',
      unread: 0,
      pinned: false,
      status: 'read',
    }));

    return [...baseThreads, ...personaThreads];
  };

  const [threads, setThreads] = useState(() => {
    if (typeof window === 'undefined') return buildSeedThreads();
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return buildSeedThreads();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.threads) && parsed.threads.length ? parsed.threads : buildSeedThreads();
    } catch {
      return buildSeedThreads();
    }
  });
  const threadsRef = useRef(threads);

  const [chatHistories, setChatHistories] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return sanitizeStoredMessages(parsed?.chatHistories || {});
    } catch {
      return {};
    }
  });

  const [threadDrafts, setThreadDrafts] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed?.threadDrafts && typeof parsed.threadDrafts === 'object' ? parsed.threadDrafts : {};
    } catch {
      return {};
    }
  });

  const [threadResponseSettings, setThreadResponseSettings] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed?.threadResponseSettings && typeof parsed.threadResponseSettings === 'object'
        ? parsed.threadResponseSettings
        : {};
    } catch {
      return {};
    }
  });

  const [threadGoalPlans, setThreadGoalPlans] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed?.threadGoalPlans || typeof parsed.threadGoalPlans !== 'object') return {};
      const next = {};
      Object.entries(parsed.threadGoalPlans).forEach(([threadId, plan]) => {
        next[threadId] = sanitizeCoachPlan(plan);
      });
      return next;
    } catch {
      return {};
    }
  });
  const coachEmissionGuardRef = useRef(new Set());

  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [messageActionSheet, setMessageActionSheet] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [replyTarget, setReplyTarget] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [swipingMessageId, setSwipingMessageId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [isExplorePanelOpen, setIsExplorePanelOpen] = useState(false);
  const [isGroupBuilderOpen, setIsGroupBuilderOpen] = useState(false);
  const [editingGroupThreadId, setEditingGroupThreadId] = useState(null);
  const [groupBuilderSelectedPersonaIds, setGroupBuilderSelectedPersonaIds] = useState([]);
  const [groupDraft, setGroupDraft] = useState({
    name: '',
    icon: 'LayoutGrid',
    description: '',
    pictureUrl: '',
    coAdminIds: [],
    inviteViaLink: true,
    approveNewMembers: false,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.notificationsEnabled);
    } catch {
      return false;
    }
  });
  const [notificationPromptDismissed, setNotificationPromptDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(LOCAL_STATE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed?.notificationPromptDismissed);
    } catch {
      return false;
    }
  });
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState('unknown');
  const notificationChannelReadyRef = useRef(false);
  const notificationSelfTestKeyRef = useRef('incirql-notification-self-test-v1');
  const notificationIdRef = useRef(Date.now() % 2147483000);
  const showIntentOnboarding = !hasSeenOnboarding && !activeThread;
  const personaIdSet = useRef(new Set(HISTORICAL_FIGURES.map((advisor) => advisor.id)));
  const onboardingIntentSuggestions = onboardingIntentInput.trim()
    ? ONBOARDING_INTENT_CHIPS.filter((chip) => chip.toLowerCase().includes(onboardingIntentInput.trim().toLowerCase()))
    : ONBOARDING_INTENT_CHIPS;

  const t = (key) => UI_STRINGS[appLanguage]?.[key] || UI_STRINGS.en[key] || key;

  const [failedAvatarUrls, setFailedAvatarUrls] = useState(() => new Set());

  const markAvatarUrlFailed = useCallback((url) => {
    if (!url) return;
    setFailedAvatarUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const renderAdvisorAvatarNode = useCallback((advisor, fallback = '?') => {
    const imageUrl = advisor?.img || '';
    if (imageUrl && !failedAvatarUrls.has(imageUrl)) {
      return (
        <img
          src={imageUrl}
          alt={advisor?.name || 'Advisor'}
          className='w-full h-full object-cover'
          referrerPolicy='no-referrer'
          onError={() => markAvatarUrlFailed(imageUrl)}
        />
      );
    }

    return advisor?.avatar || fallback;
  }, [failedAvatarUrls, markAvatarUrlFailed]);

  const currentInputText = activeThread ? (threadDrafts[activeThread.id] || '') : '';
  const activeThreadResponseSettings = activeThread
    ? (threadResponseSettings[activeThread.id] || { style: 'balanced', priorityAdvisorId: 'auto' })
    : { style: 'balanced', priorityAdvisorId: 'auto' };
  const isTyping = Boolean(activeThread?.id && typingThreadId === activeThread.id);
  const activeThreadGoalPlan = activeThread
    ? sanitizeCoachPlan(threadGoalPlans[activeThread.id])
    : defaultCoachPlan();
  const activeGoalMetrics = deriveCoachMetrics(activeThreadGoalPlan);
  const activeGoalRecentTracked = activeThreadGoalPlan.progressLog
    .slice(-7)
    .filter((entry) => entry.completed !== null);
  const activeGoalRecentCompleted = activeGoalRecentTracked
    .filter((entry) => entry.completed === true)
    .length;
  const activeGoalCompletionPct = activeGoalRecentTracked.length
    ? Math.round((activeGoalRecentCompleted / activeGoalRecentTracked.length) * 100)
    : null;
  const activeEscalationState = activeThreadGoalPlan.escalationState || activeGoalMetrics.escalationState;
  const activeReputationScore = Number.isFinite(Number(activeThreadGoalPlan.reputationScore))
    ? Number(activeThreadGoalPlan.reputationScore)
    : activeGoalMetrics.reputationScore;
  const activeReputationLabel = activeThreadGoalPlan.reputationLabel || activeGoalMetrics.reputationLabel;

  const groupAdvisors = activeThread?.isGroup
    ? activeThread.advisorIds
        .map((advisorId) => HISTORICAL_FIGURES.find((advisor) => advisor.id === advisorId))
        .filter(Boolean)
    : [];

  const mentionTokenMatch = currentInputText.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
  const mentionQuery = mentionTokenMatch ? normalizeMentionKey(mentionTokenMatch[1]) : null;
  const mentionCandidates = mentionQuery !== null
    ? groupAdvisors.filter((advisor) => getAdvisorMentionAliases(advisor).some((alias) => alias.includes(mentionQuery)))
    : [];
  const selectedMentionedAdvisorIds = activeThread?.isGroup
    ? resolveMentionedAdvisorIds(currentInputText, activeThread.advisorIds || [])
    : [];
  const selectedMentionedAdvisors = selectedMentionedAdvisorIds
    .map((advisorId) => HISTORICAL_FIGURES.find((advisor) => advisor.id === advisorId))
    .filter(Boolean);

  const createInviteLink = () => `https://incirql.app/invite/${Math.random().toString(36).slice(2, 10)}`;

  const setCurrentInputText = (value) => {
    if (!activeThread) return;
    setThreadDrafts((prev) => ({ ...prev, [activeThread.id]: value }));
  };

  const clearComposerAttachments = () => {
    setComposerAttachments([]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const openAttachmentPicker = () => {
    if (attachmentInputRef.current) attachmentInputRef.current.click();
  };

  const openGroupPicturePicker = () => {
    if (groupPictureInputRef.current) groupPictureInputRef.current.click();
  };

  const handleGroupPictureSelect = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      if (groupPictureInputRef.current) groupPictureInputRef.current.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setGroupDraft((prev) => ({ ...prev, pictureUrl: dataUrl }));
    } catch (error) {
      console.error('Failed to load group picture:', error);
    }

    if (groupPictureInputRef.current) groupPictureInputRef.current.value = '';
  };

  const handleAttachmentSelect = async (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;

    const availableSlots = Math.max(0, MAX_ATTACHMENT_COUNT - composerAttachments.length);
    const picked = files.slice(0, availableSlots);
    if (!picked.length) return;

    const built = [];
    for (const file of picked) {
      try {
        const payload = await buildAttachmentPayload(file);
        if (payload) built.push(payload);
      } catch (error) {
        console.error('Attachment processing failed:', error);
      }
    }

    if (built.length) {
      setComposerAttachments((prev) => [...prev, ...built].slice(0, MAX_ATTACHMENT_COUNT));
    }

    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const removeComposerAttachment = (attachmentId) => {
    setComposerAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  };

  const openAttachmentPreview = (attachment) => {
    if (!attachment) return;
    setPreviewAttachment(attachment);
    setIsPreviewOpen(true);
  };

  const closeAttachmentPreview = () => {
    setIsPreviewOpen(false);
    setPreviewAttachment(null);
  };

  const getAttachmentPreviewSrc = (attachment) => {
    if (!attachment) return '';
    if (attachment.inlineData?.data && attachment.inlineData?.mimeType) {
      return `data:${attachment.inlineData.mimeType};base64,${attachment.inlineData.data}`;
    }
    if (typeof attachment.dataUrl === 'string' && attachment.dataUrl) return attachment.dataUrl;
    return '';
  };

  const clearRecordingTicker = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecorderStream = () => {
    if (mediaRecorderStreamRef.current) {
      mediaRecorderStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaRecorderStreamRef.current = null;
    }
  };

  const startRecordingTicker = () => {
    clearRecordingTicker();
    recordingTimerRef.current = setInterval(() => {
      setRecordingState((prev) => (prev.active && !prev.paused
        ? { ...prev, elapsedMs: prev.elapsedMs + 100 }
        : prev));
    }, 100);
  };

  const handleStartAudioRecording = async () => {
    if (recordingState.active) return;
    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      alert('Audio recording is not available on this device.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaRecorderChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaRecorderChunksRef.current.push(event.data);
        }
      };

      recorder.start();
      setRecordingState({ active: true, paused: false, elapsedMs: 0 });
      startRecordingTicker();
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      console.error('Unable to start audio recording:', error);
      stopRecorderStream();
      mediaRecorderRef.current = null;
    }
  };

  const handleTogglePauseRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !recordingState.active) return;

    if (recordingState.paused) {
      recorder.resume();
      setRecordingState((prev) => ({ ...prev, paused: false }));
      startRecordingTicker();
    } else {
      recorder.pause();
      setRecordingState((prev) => ({ ...prev, paused: true }));
      clearRecordingTicker();
    }
    await Haptics.impact({ style: ImpactStyle.Light });
  };

  const handleCancelRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    clearRecordingTicker();
    stopRecorderStream();
    mediaRecorderRef.current = null;
    mediaRecorderChunksRef.current = [];
    setRecordingState({ active: false, paused: false, elapsedMs: 0 });
    await Haptics.impact({ style: ImpactStyle.Medium });
  };

  const handleSaveRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(mediaRecorderChunksRef.current, { type: mimeType });
        const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: mimeType });
        const payload = await buildAttachmentPayload(file);
        if (payload) {
          setComposerAttachments((prev) => [...prev, payload].slice(0, MAX_ATTACHMENT_COUNT));
        }
      } catch (error) {
        console.error('Unable to save recording:', error);
      } finally {
        clearRecordingTicker();
        stopRecorderStream();
        mediaRecorderRef.current = null;
        mediaRecorderChunksRef.current = [];
        setRecordingState({ active: false, paused: false, elapsedMs: 0 });
      }
    };

    recorder.stop();
    await Haptics.impact({ style: ImpactStyle.Light });
  };

  const formatRecordingTime = (elapsedMs) => {
    const totalSeconds = Math.floor(Number(elapsedMs || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const findAdvisorIdByName = (name) => {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return null;
    const found = HISTORICAL_FIGURES.find((advisor) => advisor.name.toLowerCase() === normalized);
    if (found) return found.id;
    return HISTORICAL_FIGURES.find((advisor) => advisor.name.toLowerCase().includes(normalized))?.id || null;
  };

  const resolveMentorBundleForIntent = (intentText) => {
    const intent = String(intentText || '').toLowerCase();
    const detectedStage = (() => {
      if (/idea|prototype|mvp|validate/.test(intent)) return 'idea';
      if (/traction|revenue|customers|pipeline/.test(intent)) return 'traction';
      if (/raise|funding|investor|series|seed/.test(intent)) return 'fundraising';
      if (/scale|expand|growth/.test(intent)) return 'scale';
      return 'general';
    })();

    if ((intent.includes('startup') || intent.includes('build')) && detectedStage !== 'general') {
      const startupByStage = {
        idea: [
          { name: 'Michael Seibel', reason: 'Best for startup fundamentals and execution clarity at day zero.' },
          { name: 'Paul Graham', reason: 'Best for idea validation and founder-level decision quality.' },
          { name: 'Steve Jobs', reason: 'Best for sharp product taste and user-centric quality bar.' },
        ],
        traction: [
          { name: 'Marc Andreessen', reason: 'Best for scaling strategy once real traction appears.' },
          { name: 'Patrick Collison', reason: 'Best for systems and infrastructure as complexity grows.' },
          { name: 'Reid Hoffman', reason: 'Best for network-driven growth and blitzscaling tradeoffs.' },
        ],
        fundraising: [
          { name: 'Peter Thiel', reason: 'Best for contrarian narrative and investor positioning.' },
          { name: 'J.P. Morgan', reason: 'Best for capital structure and financing discipline.' },
          { name: 'Bill Ackman', reason: 'Best for conviction framing and institutional pitch quality.' },
        ],
        scale: [
          { name: 'Alex Hormozi', reason: 'Best for growth systems, offers, and acquisition economics.' },
          { name: 'Ben Horowitz', reason: 'Best for operating discipline while scaling teams.' },
          { name: 'Michael Porter', reason: 'Best for defensible positioning and long-term moat strategy.' },
        ],
      };

      const picks = startupByStage[detectedStage] || [];
      if (picks.length) {
        const mentorsByStage = picks
          .map((pick) => {
            const advisorId = findAdvisorIdByName(pick.name);
            const advisor = advisorId ? HISTORICAL_FIGURES.find((item) => item.id === advisorId) : null;
            if (!advisor) return null;
            return { advisor, reason: pick.reason };
          })
          .filter(Boolean)
          .slice(0, 3);

        if (mentorsByStage.length) return mentorsByStage;
      }
    }

    const bundles = [
      {
        match: ['fund', 'investor', 'capital', 'raise'],
        picks: [
          { name: 'Peter Thiel', reason: 'Best for contrarian fundraising positioning and investor narrative.' },
          { name: 'Reid Hoffman', reason: 'Best for network-driven scaling and strategic introductions.' },
          { name: 'Paul Graham', reason: 'Best for startup clarity and early-stage pitch sharpness.' },
        ],
      },
      {
        match: ['customer', 'revenue', 'growth', 'marketing', 'sales'],
        picks: [
          { name: 'David Ogilvy', reason: 'Best for message-market fit and persuasive positioning.' },
          { name: 'Alex Hormozi', reason: 'Best for converting offers into predictable customer acquisition.' },
          { name: 'Grant Cardone', reason: 'Best for aggressive sales execution and deal velocity.' },
        ],
      },
      {
        match: ['deal', 'close', 'negotiat'],
        picks: [
          { name: 'Chris Voss', reason: 'Best for high-stakes negotiation framing and leverage.' },
          { name: 'Jordan Belfort', reason: 'Best for persuasion dynamics and objection handling.' },
          { name: 'Grant Cardone', reason: 'Best for direct close mechanics and pressure-tested sales systems.' },
        ],
      },
      {
        match: ['startup', 'build', 'launch', 'product'],
        picks: [
          { name: 'Steve Jobs', reason: 'Best for product obsession and premium execution standards.' },
          { name: 'Patrick Collison', reason: 'Best for systems thinking and scalable product architecture.' },
          { name: 'Marc Andreessen', reason: 'Best for strategic speed and startup operating leverage.' },
        ],
      },
      {
        match: ['discipline', 'focus', 'habit', 'routine', 'consisten'],
        picks: [
          { name: 'Andrew Huberman', reason: 'Best for behavior protocols and sustainable performance.' },
          { name: 'James Clear', reason: 'Best for habit loop design and compounding consistency.' },
          { name: 'Tim Ferriss', reason: 'Best for execution frameworks and ruthless prioritization.' },
        ],
      },
    ];

    const fallback = [
      { name: 'Ray Dalio', reason: 'Best for principled decision frameworks under uncertainty.' },
      { name: 'Warren Buffett', reason: 'Best for durable judgment and capital-aware choices.' },
      { name: 'Peter Thiel', reason: 'Best for strategic differentiation and asymmetric thinking.' },
    ];

    const selected = bundles.find((bundle) => bundle.match.some((token) => intent.includes(token))) || { picks: fallback };
    const mentors = selected.picks
      .map((pick) => {
        const advisorId = findAdvisorIdByName(pick.name);
        const advisor = advisorId ? HISTORICAL_FIGURES.find((item) => item.id === advisorId) : null;
        if (!advisor) return null;
        return {
          advisor,
          reason: pick.reason,
        };
      })
      .filter(Boolean)
      .slice(0, 3);

    return mentors.length ? mentors : HISTORICAL_FIGURES.slice(0, 3).map((advisor) => ({ advisor, reason: 'Best minds for this decision profile.' }));
  };

  const buildMentorKickoffPrompt = (advisor, intentText) => {
    const safeIntent = String(intentText || '').trim() || 'your current objective';
    const advisorName = advisor?.name || 'your mentor';
    const role = String(advisor?.role || '').toLowerCase();

    if (role.includes('trading') || role.includes('macro') || role.includes('investor') || role.includes('quant')) {
      return `Clarity first. What is your current ${safeIntent} approach, and where is it breaking down?`;
    }
    if (role.includes('sales') || role.includes('growth') || role.includes('marketing') || role.includes('negotiation')) {
      return `Before we push tactics, we need clarity. What is your current approach, and exactly where is the pipeline breaking?`;
    }
    if (role.includes('design') || role.includes('product') || role.includes('startup') || role.includes('technology')) {
      return `Direction first. What are you building now, and which product decision is creating the most friction?`;
    }
    if (role.includes('psychology') || role.includes('habit') || role.includes('discipline') || role.includes('coach')) {
      return `We start with truth. What behavior pattern keeps repeating, and where is it costing you momentum?`;
    }
    if (role.includes('real estate') || role.includes('developer') || role.includes('asset')) {
      return `Let's anchor on the key decision first. Which deal, market, or asset call feels highest-stakes right now?`;
    }
    return `${advisorName} here. Before we go tactical, what is your current approach for ${safeIntent}, and where is it failing?`;
  };

  const buildOnboardingSystemFrame = (intentText) => `You want to ${String(intentText || '').trim()}. Here are the strongest perspectives.`;

  const buildOnboardingQuickReplies = (intentText) => {
    const intent = String(intentText || '').toLowerCase();
    if (intent.includes('trad')) {
      return ['No strategy', 'Losing money', 'Emotional trading', 'Inconsistent profits'];
    }
    if (intent.includes('sales') || intent.includes('close') || intent.includes('deal')) {
      return ['No pipeline', 'Weak close rate', 'Pricing objections', 'Inconsistent outreach'];
    }
    if (intent.includes('fund') || intent.includes('invest')) {
      return ['No traction proof', 'Weak pitch story', 'Wrong investor fit', 'Valuation confusion'];
    }
    return ['No clear strategy', 'Execution is inconsistent', 'I need faster progress', 'I need better decisions'];
  };

  const suggestCommunityMentorsFromIntent = useCallback(async (rawIntent) => {
    const intent = String(rawIntent || '').trim();
    if (!intent) return;

    setCommunityIntentSuggesting(true);
    try {
      if (!apiKey) {
        setCommunityAiIntentBoostById({});
        return;
      }

      const catalog = HISTORICAL_FIGURES
        .map((advisor) => `${advisor.id}: ${advisor.name} - ${advisor.role}`)
        .join('\n');

      let response = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${primaryModelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{
                  text: [
                    'You are a mentor-routing engine.',
                    'Return strict JSON only.',
                    'Pick up to 8 most relevant mentor ids in order for the intent.',
                    'Focus on direct relevance first, adjacent second, then broad strategists last.',
                    'Schema: {"ranked":[{"id":"advisorId","score":0-100,"reason":"short reason"}] }',
                  ].join(' '),
                }],
              },
              contents: [{
                role: 'user',
                parts: [{
                  text: `Intent: ${intent}\nMentor catalog:\n${catalog}`,
                }],
              }],
              generationConfig: buildGenerationConfig({ responseMimeType: 'application/json' }),
            }),
          }
        );

        if (response.ok) break;

        const failure = await parseApiFailure(response);
        if (geminiServiceTierEnabled && shouldDisableGeminiServiceTier(failure.status, failure.message)) {
          geminiServiceTierEnabled = false;
          continue;
        }
        break;
      }

      if (!response?.ok) {
        setCommunityAiIntentBoostById({});
        return;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = rawText ? JSON.parse(rawText) : null;
      const ranked = Array.isArray(parsed?.ranked) ? parsed.ranked : [];
      const validIds = new Set(HISTORICAL_FIGURES.map((advisor) => advisor.id));
      const boost = {};

      ranked.slice(0, 8).forEach((item, index) => {
        const advisorId = String(item?.id || '').trim();
        if (!advisorId || !validIds.has(advisorId)) return;
        const score = Number(item?.score);
        const normalized = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : Math.max(50, 100 - (index * 10));
        boost[advisorId] = Math.max(boost[advisorId] || 0, Math.round(normalized / 3));
      });

      setCommunityAiIntentBoostById(boost);
    } catch {
      setCommunityAiIntentBoostById({});
    } finally {
      setCommunityIntentSuggesting(false);
    }
  }, []);

  const launchMentorBoardFromIntent = async (intentText, mentors) => {
    const advisorIds = mentors.map((item) => item.advisor.id).slice(0, 3);
    if (!advisorIds.length) return;
    const leadAdvisorId = advisorIds[0];
    const leadAdvisor = HISTORICAL_FIGURES.find((advisor) => advisor.id === leadAdvisorId) || null;
    const kickoffQuestion = buildMentorKickoffPrompt(leadAdvisor, intentText);

    const thread = {
      id: `onboarding-${Date.now()}`,
      title: `Best minds for: ${intentText}`,
      isGroup: true,
      advisorIds,
      lastMsg: kickoffQuestion,
      time: 'Now',
      unread: 0,
      pinned: true,
      status: 'read',
      groupMeta: {
        icon: 'LayoutGrid',
        description: `Intent router board for: ${intentText}`,
        pictureUrl: '',
        coAdminIds: [],
        inviteLink: null,
        approveNewMembers: false,
        intentRouter: {
          intent: intentText,
          order: advisorIds,
          reasons: mentors.map((item) => ({ advisorId: item.advisor.id, reason: item.reason })),
          engagement: {},
        },
      },
    };

    const kickoffMessage = {
      id: `assistant-onboard-${Date.now()}`,
      role: 'assistant',
      status: 'done',
      content: {
        bursts: [buildOnboardingSystemFrame(intentText), kickoffQuestion],
        insight: '',
        depthCard: null,
        questions: [],
        suggestedQuestions: buildOnboardingQuickReplies(intentText),
      },
      timestamp: new Date().toISOString(),
      authorAdvisorId: leadAdvisorId,
      readBy: [],
      onboardingKickoff: true,
      authorName: leadAdvisor?.name || '',
    };

    setThreads((prev) => [thread, ...prev]);
    setChatHistories((prev) => ({
      ...prev,
      [thread.id]: [...(prev[thread.id] || []), kickoffMessage],
    }));
    setActiveThread(thread);
    setActiveTab('main');
    setHasSeenOnboarding(true);
    setMainFocusedAdvisorIds(advisorIds);
    setOnboardingIntentInput('');
    setOnboardingMatchPreview(null);
    await Haptics.impact({ style: ImpactStyle.Medium });
  };

  const handleIntentSubmit = async (value) => {
    const intentText = String(value || onboardingIntentInput).trim();
    if (!intentText) return;
    const mentors = resolveMentorBundleForIntent(intentText);
    setOnboardingMatchPreview({ intent: intentText, mentors });
    setOnboardingExtraMentorIds([]);
    setOnboardingMentorSearch('');
    setOnboardingMentorPickerOpen(false);
  };

  const openOnboardingMentorPicker = () => {
    if (!onboardingMatchPreview?.intent || !Array.isArray(onboardingMatchPreview?.mentors) || !onboardingMatchPreview.mentors.length) {
      return;
    }
    setOnboardingMentorPickerOpen(true);
  };

  const toggleOnboardingExtraMentor = (advisorId) => {
    if (!advisorId || !onboardingMatchPreview?.mentors) return;
    const baseIds = onboardingMatchPreview.mentors.map((item) => item.advisor.id);
    if (baseIds.includes(advisorId)) return;

    setOnboardingExtraMentorIds((prev) => {
      if (prev.includes(advisorId)) return prev.filter((id) => id !== advisorId);
      if (prev.length >= 2) return prev;
      return [...prev, advisorId];
    });
  };

  const handleStartConversationFromPreview = async () => {
    if (!onboardingMatchPreview?.intent || !Array.isArray(onboardingMatchPreview.mentors) || !onboardingMatchPreview.mentors.length) {
      return;
    }
    const extraMentors = onboardingExtraMentorIds
      .map((advisorId) => HISTORICAL_FIGURES.find((advisor) => advisor.id === advisorId))
      .filter(Boolean)
      .map((advisor) => ({
        advisor,
        reason: `Added manually for ${advisor.role.toLowerCase()} perspective.`,
      }));

    const selectedExtraById = new Map(extraMentors.map((item) => [item.advisor.id, item.advisor]));
    const existingExtraThreadIds = threads
      .filter((thread) => !thread.isGroup && selectedExtraById.has(thread.advisorIds?.[0]))
      .map((thread) => thread.id);

    const createdExtraThreads = extraMentors
      .map((item, index) => {
        const advisor = item?.advisor;
        if (!advisor?.id) return null;
        const existing = threads.find((thread) => !thread.isGroup && thread.advisorIds?.[0] === advisor.id);
        if (existing) return null;
        const threadId = `onboard-extra-${advisor.id}-${Date.now()}-${index}`;
        return {
          threadId,
          advisor,
          thread: {
            id: threadId,
            title: advisor.name,
            isGroup: false,
            advisorIds: [advisor.id],
            lastMsg: '',
            time: 'Now',
            unread: 0,
            pinned: false,
            status: 'read',
            source: 'onboarding-extra',
          },
        };
      })
      .filter(Boolean);

    if (createdExtraThreads.length) {
      setThreads((prev) => {
        const existingIdSet = new Set(existingExtraThreadIds);
        const touchedExisting = prev
          .filter((thread) => existingIdSet.has(thread.id))
          .map((thread) => ({
            ...thread,
            pinned: true,
            status: 'read',
            unread: 0,
            time: 'Now',
            lastMsg: '',
            source: 'onboarding-extra',
          }));

        const untouched = prev.filter((thread) => !existingIdSet.has(thread.id));

        return [
          ...createdExtraThreads.map((item) => ({ ...item.thread, pinned: true })),
          ...touchedExisting,
          ...untouched,
        ];
      });

    } else if (existingExtraThreadIds.length) {
      setThreads((prev) => {
        const existingIdSet = new Set(existingExtraThreadIds);
        const touchedExisting = prev
          .filter((thread) => existingIdSet.has(thread.id))
          .map((thread) => ({
            ...thread,
            pinned: true,
            status: 'read',
            unread: 0,
            time: 'Now',
            lastMsg: '',
            source: 'onboarding-extra',
          }));
        const untouched = prev.filter((thread) => !existingIdSet.has(thread.id));
        return [...touchedExisting, ...untouched];
      });
    }

    await launchMentorBoardFromIntent(
      onboardingMatchPreview.intent,
      onboardingMatchPreview.mentors.slice(0, 3)
    );
    setOnboardingMentorPickerOpen(false);
    setOnboardingMentorSearch('');
    setOnboardingExtraMentorIds([]);
  };

  const updateIntentRouterEngagement = (threadId, userText, options = {}) => {
    const { replyAdvisorId = null, mentionedAdvisorIds = [] } = options;
    const text = String(userText || '');
    const questionCount = (text.match(/\?/g) || []).length;
    const lengthScore = Math.min(2, text.trim().length / 220);
    const baseSignal = 1 + lengthScore + (questionCount * 0.8);

    setThreads((prev) => prev.map((thread) => {
      if (thread.id !== threadId || !thread.isGroup) return thread;
      const router = thread.groupMeta?.intentRouter;
      if (!router || !Array.isArray(router.order) || !router.order.length) return thread;

      const nextEngagement = { ...(router.engagement || {}) };
      const targets = [];
      if (replyAdvisorId && router.order.includes(replyAdvisorId)) targets.push(replyAdvisorId);
      mentionedAdvisorIds.forEach((advisorId) => {
        if (router.order.includes(advisorId) && !targets.includes(advisorId)) targets.push(advisorId);
      });
      if (!targets.length) targets.push(router.order[0]);

      targets.forEach((advisorId, idx) => {
        const boost = idx === 0 ? baseSignal : (baseSignal * 0.6);
        nextEngagement[advisorId] = Number(nextEngagement[advisorId] || 0) + boost;
      });

      return {
        ...thread,
        groupMeta: {
          ...(thread.groupMeta || {}),
          intentRouter: {
            ...router,
            engagement: nextEngagement,
          },
        },
      };
    }));
  };

  const calculateRecommendationSignals = ({ payload, userText, advisorId }) => {
    const bursts = Array.isArray(payload?.bursts) ? payload.bursts : [];
    const insight = String(payload?.insight || '').trim();
    const depthPoints = payload?.depthCard?.points?.length || 0;
    const combined = `${bursts.join(' ')} ${insight}`.toLowerCase();

    const genericResponse = /(it depends|depends on|good question|interesting point|can vary)/i.test(combined);
    const lowDepth = !insight && depthPoints === 0 && bursts.length <= 1;
    const confidenceRaw = genericResponse || lowDepth ? 35 : 80;

    const currentAdvisor = HISTORICAL_FIGURES.find((advisor) => advisor.id === advisorId);
    const currentExpertise = currentAdvisor ? scoreAdvisorTopicExpertise(userText, currentAdvisor) : 0;
    const contextShiftRaw = currentExpertise < 2 ? 85 : currentExpertise < 5 ? 55 : 25;

    const selfAwareRaw = /(outside my domain|outside my expertise|not my specialty|bring in|specialized in)/i.test(combined)
      ? 90
      : (contextShiftRaw > 50 && confidenceRaw < 50 ? 55 : 20);

    const weighted = (confidenceRaw * 0.6) + (contextShiftRaw * 0.25) + (selfAwareRaw * 0.15);
    return {
      confidenceRaw,
      contextShiftRaw,
      selfAwareRaw,
      weighted,
    };
  };

  const pickMentorRecommendationForGroup = ({ thread, payload, userText, advisorId }) => {
    if (!thread?.isGroup) return null;
    const signals = calculateRecommendationSignals({ payload, userText, advisorId });
    if (signals.weighted < 55) return null;

    const activeAdvisorIds = Array.isArray(thread.advisorIds) ? thread.advisorIds : [];
    if (activeAdvisorIds.length >= 5) return null;

    const bestCandidate = HISTORICAL_FIGURES
      .filter((advisor) => !activeAdvisorIds.includes(advisor.id))
      .map((advisor) => ({
        advisor,
        expertise: scoreAdvisorTopicExpertise(userText, advisor),
      }))
      .sort((a, b) => b.expertise - a.expertise)[0];

    if (!bestCandidate || bestCandidate.expertise < 2) return null;

    return {
      advisorId: bestCandidate.advisor.id,
      advisorName: bestCandidate.advisor.name,
      capability: bestCandidate.advisor.role,
      reason: `This needs deeper ${bestCandidate.advisor.role.toLowerCase()} capability. Bring in ${bestCandidate.advisor.name}.`,
      scores: {
        confidence: Math.round(signals.confidenceRaw),
        context: Math.round(signals.contextShiftRaw),
        selfAwareness: Math.round(signals.selfAwareRaw),
      },
    };
  };

  const addMentorToActiveGroup = async (advisorId) => {
    if (!activeThread?.isGroup || !advisorId) return;
    if (activeThread.advisorIds.includes(advisorId)) return;
    if (activeThread.advisorIds.length >= 5) return;

    setThreads((prev) => prev.map((thread) => {
      if (thread.id !== activeThread.id) return thread;
      return {
        ...thread,
        advisorIds: [...thread.advisorIds, advisorId],
      };
    }));

    setActiveThread((prev) => {
      if (!prev || prev.id !== activeThread.id) return prev;
      return {
        ...prev,
        advisorIds: [...prev.advisorIds, advisorId],
      };
    });

    const advisor = HISTORICAL_FIGURES.find((item) => item.id === advisorId);
    if (advisor) {
      const welcomeMessage = {
        id: `assistant-join-${advisorId}-${Date.now()}`,
        role: 'assistant',
        status: 'done',
        content: {
          bursts: [`Joining in. I will focus on ${advisor.role.toLowerCase()} for this thread.`],
          insight: '',
          depthCard: null,
          questions: [],
          suggestedQuestions: [],
        },
        timestamp: new Date().toISOString(),
        authorAdvisorId: advisorId,
        readBy: [],
      };
      setChatHistories((prev) => ({
        ...prev,
        [activeThread.id]: [...(prev[activeThread.id] || []), welcomeMessage],
      }));
    }

    await Haptics.impact({ style: ImpactStyle.Light });
  };

  const updateActiveThreadResponseSettings = (patch) => {
    if (!activeThread) return;
    setThreadResponseSettings((prev) => ({
      ...prev,
      [activeThread.id]: {
        ...(prev[activeThread.id] || { style: 'balanced', priorityAdvisorId: 'auto' }),
        ...patch,
      },
    }));
  };

  const updateActiveThreadGoalPlan = (patch) => {
    if (!activeThread) return;
    setThreadGoalPlans((prev) => ({
      ...prev,
      [activeThread.id]: (() => {
        const current = sanitizeCoachPlan(prev[activeThread.id]);
        const incomingGoal = typeof patch.goal === 'string' ? patch.goal.trim() : current.goal;
        const goalChanged = Object.prototype.hasOwnProperty.call(patch, 'goal') && incomingGoal !== current.goal;
        const merged = {
          ...current,
          ...patch,
          updatedAt: new Date().toISOString(),
        };

        if (goalChanged) {
          merged.goalNeedsRefinement = Boolean(incomingGoal);
          merged.goalVersion = (Number(current.goalVersion) || 0) + 1;
          merged.lastGoalChallengeAt = '';
        }

        const metrics = deriveCoachMetrics(merged);
        merged.escalationState = metrics.escalationState;
        merged.successStreak = metrics.successStreak;
        merged.missedStreak = metrics.missedStreak;
        merged.totalCheckIns = metrics.totalCheckIns;
        merged.totalCompleted = metrics.totalCompleted;
        merged.reputationScore = metrics.reputationScore;
        merged.reputationLabel = metrics.reputationLabel;

        return sanitizeCoachPlan(merged);
      })(),
    }));
  };

  const clearThreadSelection = () => {
    setSelectedThreadIds([]);
  };

  const toggleThreadSelection = (threadId) => {
    setSelectedThreadIds((prev) => (
      prev.includes(threadId)
        ? prev.filter((id) => id !== threadId)
        : [...prev, threadId]
    ));
  };

  const handleThreadPress = (thread) => {
    if (selectedThreadIds.length > 0) {
      toggleThreadSelection(thread.id);
      return;
    }
    setThreads((prev) => prev.map((entry) => (
      entry.id === thread.id
        ? { ...entry, unread: 0, status: 'read' }
        : entry
    )));
    setActiveThread(thread);
  };

  const handleThreadTouchStart = (event, thread) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    threadTouchRef.current = {
      ...threadTouchRef.current,
      threadId: thread.id,
      startX: touch.clientX,
      startY: touch.clientY,
      moved: false,
    };
    startThreadLongPress(thread);
  };

  const handleThreadTouchMove = (event) => {
    const touch = event.touches?.[0];
    const state = threadTouchRef.current;
    if (!touch || !state.threadId) return;
    const dx = Math.abs(touch.clientX - state.startX);
    const dy = Math.abs(touch.clientY - state.startY);
    if (dx > 10 || dy > 10) {
      threadTouchRef.current = { ...state, moved: true };
      cancelThreadLongPress();
    }
  };

  const handleThreadTouchEnd = (thread) => {
    const state = threadTouchRef.current;
    cancelThreadLongPress();
    threadTouchRef.current = {
      threadId: null,
      startX: 0,
      startY: 0,
      moved: false,
      suppressClickUntil: Date.now() + 450,
    };
    if (!state.moved) handleThreadPress(thread);
  };

  const handleThreadTouchCancel = () => {
    cancelThreadLongPress();
    threadTouchRef.current = {
      threadId: null,
      startX: 0,
      startY: 0,
      moved: false,
      suppressClickUntil: Date.now() + 450,
    };
  };

  const shouldIgnoreThreadClick = () => Date.now() < (threadTouchRef.current.suppressClickUntil || 0);

  const getNextNotificationId = () => {
    notificationIdRef.current = (notificationIdRef.current + 1) % 2147483000;
    if (notificationIdRef.current <= 0) {
      notificationIdRef.current = 1;
    }
    return notificationIdRef.current;
  };

  const ensureNotificationChannel = async () => {
    if (!Capacitor.isNativePlatform()) return false;
    if (notificationChannelReadyRef.current) return true;

    const staleChannelIds = ['incirql-messages', 'incirql-messages-v2'];
    for (const staleId of staleChannelIds) {
      await LocalNotifications.deleteChannel({ id: staleId }).catch(() => {
        // Ignore when stale channel does not exist.
      });
    }

    try {
      await LocalNotifications.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: 'Messages',
        description: 'Unread Camer message notifications',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#22c55e',
      });
    } catch (error) {
      console.error('Failed to create notification channel:', error);
    }

    try {
      const listed = await LocalNotifications.listChannels();
      const hasChannel = Array.isArray(listed?.channels)
        && listed.channels.some((channel) => channel?.id === NOTIFICATION_CHANNEL_ID);
      notificationChannelReadyRef.current = hasChannel;
      if (!hasChannel) {
        console.warn('Notification channel unavailable, falling back to default channel delivery.');
      }
      return hasChannel;
    } catch (error) {
      console.error('Failed to verify notification channel:', error);
      notificationChannelReadyRef.current = false;
      return false;
    }
  };

  const getNativeAppIsActive = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return isAppForegroundVisible();
    try {
      const state = await CapacitorApp.getState();
      const active = Boolean(state?.isActive);
      appStateRef.current.isActive = active;
      return active;
    } catch {
      return Boolean(appStateRef.current.isActive);
    }
  }, []);

  const isAppForegroundVisible = () => {
    const isAppActive = Boolean(appStateRef.current.isActive);
    if (typeof document !== 'undefined' && typeof document.visibilityState === 'string') {
      return isAppActive && document.visibilityState === 'visible';
    }
    return isAppActive;
  };

  const pushUnreadNotification = async (thread, preview, options = {}) => {
    const {
      authorAdvisorId = null,
      totalUnread = null,
      threadUnread = null,
      notificationBody = null,
    } = options;
    if (!thread) return;
    if (thread.muted) return;
    const inferredAdvisorId = authorAdvisorId
      || thread?.advisorIds?.[0]
      || HISTORICAL_FIGURES.find((advisor) => advisor.name === thread?.title)?.id
      || null;
    const authorAdvisor = inferredAdvisorId
      ? HISTORICAL_FIGURES.find((advisor) => advisor.id === inferredAdvisorId)
      : null;
    const authorName = authorAdvisor?.name || thread.title;
    const title = authorName;
    const body = String(notificationBody || preview || 'You have an unread message.').replace(/\s+/g, ' ').trim().slice(0, 260);

    if (Capacitor.isNativePlatform()) {
      try {
        const [permission, deliveryEnabled] = await Promise.all([
          LocalNotifications.checkPermissions(),
          LocalNotifications.areEnabled(),
        ]);
        if (permission.display !== 'granted' || !deliveryEnabled.value) {
          setNotificationsEnabled(false);
          setNotificationPermissionStatus(permission.display !== 'granted' ? 'denied' : 'disabled');
          setNotificationPromptDismissed(false);
          return;
        }

        const hasChannel = await ensureNotificationChannel();

        const nativeNotification = {
          id: getNextNotificationId(),
          title,
          body,
          autoCancel: true,
          smallIcon: 'ic_stat_camer',
          iconColor: '#0ea5e9',
          largeIcon: authorAdvisor?.img || undefined,
          extra: {
            threadId: thread.id,
            authorAdvisorId: inferredAdvisorId,
            authorName,
            totalUnread,
            threadUnread,
          },
        };

        if (hasChannel) {
          nativeNotification.channelId = NOTIFICATION_CHANNEL_ID;
        }

        const notifications = [nativeNotification];

        await LocalNotifications.schedule({ notifications });
      } catch (error) {
        console.error('Failed to schedule local notification:', error);
      }
      return;
    }

    if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
      try {
        new window.Notification(title, { body });
      } catch {
        // ignore web notification failures
      }
    }
  };

  const requestNotificationPermission = async () => {
    let granted = false;
    let deliveryEnabled = true;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalNotifications.requestPermissions();
        granted = result.display === 'granted';
        if (granted) {
          const enabled = await LocalNotifications.areEnabled();
          deliveryEnabled = Boolean(enabled?.value);
        }
      } catch {
        granted = false;
      }
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await window.Notification.requestPermission();
        granted = result === 'granted';
      } catch {
        granted = false;
      }
    }

    const notificationReady = granted && deliveryEnabled;
    setNotificationsEnabled(notificationReady);
    setNotificationPermissionStatus(!granted ? 'denied' : (deliveryEnabled ? 'granted' : 'disabled'));
    setNotificationPromptDismissed(notificationReady);

    if (notificationReady && Capacitor.isNativePlatform()) {
      try {
        const hasChannel = await ensureNotificationChannel();
        const key = notificationSelfTestKeyRef.current;
        const alreadyScheduled = typeof window !== 'undefined' && window.localStorage.getItem(key);
        if (!alreadyScheduled) {
          const testNotification = {
            id: 999991,
            title: 'Camer notifications are on',
            body: 'This test confirms delivery with immediate notification routing.',
            autoCancel: true,
            smallIcon: 'ic_stat_camer',
            iconColor: '#0ea5e9',
          };
          if (hasChannel) {
            testNotification.channelId = NOTIFICATION_CHANNEL_ID;
          }

          await LocalNotifications.schedule({
            notifications: [testNotification],
          });
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, String(Date.now()));
          }
        }
      } catch (error) {
        console.error('Failed to schedule notification self-test:', error);
      }
    }
  };

  const syncNotificationPermissionState = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const [permission, deliveryEnabled] = await Promise.all([
          LocalNotifications.checkPermissions(),
          LocalNotifications.areEnabled(),
        ]);
        const granted = permission.display === 'granted';
        const ready = granted && Boolean(deliveryEnabled?.value);
        setNotificationsEnabled(ready);
        setNotificationPermissionStatus(!granted ? 'denied' : (ready ? 'granted' : 'disabled'));
        if (!ready) {
          setNotificationPromptDismissed(false);
        }
      } catch {
        setNotificationPermissionStatus('unknown');
      }
      return;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const granted = window.Notification.permission === 'granted';
      setNotificationsEnabled(granted);
      setNotificationPermissionStatus(window.Notification.permission || 'default');
      return;
    }

    setNotificationPermissionStatus('unsupported');
  }, []);

  const updateThreadFromAssistantMessage = (threadId, preview, timestamp, options = {}) => {
    const { authorAdvisorId = null } = options;

    // Compute notification values synchronously from the current closure-captured `threads`
    // state BEFORE calling setThreads. setThreads updaters run asynchronously in React -
    // variables mutated inside an updater are NOT available on the next line after the call.
    const currentThread = threads.find((t) => t.id === threadId) ?? null;
    if (!currentThread) return;

    const isViewingNow = activeThreadIdRef.current === threadId && isAppForegroundVisible();
    const threadUnreadAfterUpdate = isViewingNow ? 0 : (currentThread.unread || 0) + 1;
    const totalUnreadAfterUpdate = threads.reduce(
      (sum, t) => sum + (t.id === threadId ? threadUnreadAfterUpdate : (t.unread || 0)),
      0,
    );
    const notifyThread = {
      ...currentThread,
      lastMsg: String(preview || 'Response received.').slice(0, 52),
      time: formatThreadTime(timestamp),
      unread: threadUnreadAfterUpdate,
      status: isViewingNow ? 'read' : 'delivered',
    };

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const isViewing = activeThreadIdRef.current === threadId && isAppForegroundVisible();
        return {
          ...thread,
          lastMsg: String(preview || 'Response received.').slice(0, 52),
          time: formatThreadTime(timestamp),
          unread: isViewing ? 0 : (thread.unread || 0) + 1,
          status: isViewing ? 'read' : 'delivered',
        };
      })
    );

    if (authorAdvisorId) {
      setChatHistories((prev) => {
        const threadHistory = [...(prev[threadId] || [])];
        for (let idx = threadHistory.length - 1; idx >= 0; idx -= 1) {
          const msg = threadHistory[idx];
          if (msg.role === 'user') {
            const currentReadBy = Array.isArray(msg.readBy) ? msg.readBy : [];
            if (!currentReadBy.includes(authorAdvisorId)) {
              threadHistory[idx] = { ...msg, readBy: [...currentReadBy, authorAdvisorId] };
              return { ...prev, [threadId]: threadHistory };
            }
            return prev;
          }
        }
        return prev;
      });
    }

    void pushUnreadNotification(notifyThread, preview, {
      authorAdvisorId,
      totalUnread: totalUnreadAfterUpdate,
      threadUnread: threadUnreadAfterUpdate,
    });
  };
  updateThreadFromAssistantMessageRef.current = updateThreadFromAssistantMessage;

  const startThreadLongPress = (thread) => {
    if (threadSelectionTimerRef.current) clearTimeout(threadSelectionTimerRef.current);
    threadSelectionTimerRef.current = setTimeout(() => {
      void triggerFooterHaptic();
      setSelectedThreadIds((prev) => (prev.includes(thread.id) ? prev : [...prev, thread.id]));
    }, 420);
  };

  const cancelThreadLongPress = () => {
    if (threadSelectionTimerRef.current) {
      clearTimeout(threadSelectionTimerRef.current);
      threadSelectionTimerRef.current = null;
    }
  };

  const pinOrUnpinSelectedThreads = () => {
    if (!selectedThreadIds.length) return;
    const allPinned = threads
      .filter((thread) => selectedThreadIds.includes(thread.id))
      .every((thread) => thread.pinned);

    setThreads((prev) => prev.map((thread) => (
      selectedThreadIds.includes(thread.id)
        ? { ...thread, pinned: !allPinned }
        : thread
    )));
    clearThreadSelection();
  };

  const openGroupBuilder = () => {
    const preselectedPersonaIds = [...new Set(
      threads
        .filter((thread) => selectedThreadIds.includes(thread.id) && !thread.isGroup)
        .flatMap((thread) => thread.advisorIds || [])
    )];

    setGroupBuilderSelectedPersonaIds(preselectedPersonaIds);
    setGroupDraft({
      name: preselectedPersonaIds.length
        ? `Group ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : '',
      icon: 'LayoutGrid',
      description: '',
      pictureUrl: '',
      coAdminIds: [],
      inviteViaLink: true,
      approveNewMembers: false,
    });
    setEditingGroupThreadId(null);
    setIsGroupBuilderOpen(true);
    clearThreadSelection();
  };

  const openGroupBuilderForThread = (thread) => {
    if (!thread?.isGroup) return;
    setGroupBuilderSelectedPersonaIds([...(thread.advisorIds || [])]);
    setGroupDraft({
      name: thread.title || '',
      icon: thread.groupMeta?.icon || 'LayoutGrid',
      description: thread.groupMeta?.description || '',
      pictureUrl: thread.groupMeta?.pictureUrl || '',
      coAdminIds: [...(thread.groupMeta?.coAdminIds || [])],
      inviteViaLink: Boolean(thread.groupMeta?.inviteLink),
      approveNewMembers: Boolean(thread.groupMeta?.approveNewMembers),
    });
    setEditingGroupThreadId(thread.id);
    setIsGroupBuilderOpen(true);
  };

  const closeGroupBuilder = () => {
    setIsGroupBuilderOpen(false);
    setEditingGroupThreadId(null);
  };

  const toggleGroupBuilderPersona = (advisorId) => {
    setGroupBuilderSelectedPersonaIds((prev) => (
      prev.includes(advisorId)
        ? prev.filter((id) => id !== advisorId)
        : [...prev, advisorId]
    ));
    setGroupDraft((prev) => ({
      ...prev,
      coAdminIds: prev.coAdminIds.filter((id) => id !== advisorId),
    }));
  };

  const toggleCoAdmin = (advisorId) => {
    if (!groupBuilderSelectedPersonaIds.includes(advisorId)) return;
    setGroupDraft((prev) => ({
      ...prev,
      coAdminIds: prev.coAdminIds.includes(advisorId)
        ? prev.coAdminIds.filter((id) => id !== advisorId)
        : [...prev.coAdminIds, advisorId],
    }));
  };

  const commitGroupCreation = () => {
    if (groupBuilderSelectedPersonaIds.length < 2) return;

    const groupName = groupDraft.name.trim() || `Group ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const inviteLink = groupDraft.inviteViaLink ? createInviteLink() : null;

    const groupThread = {
      id: `group-${Date.now()}`,
      title: groupName,
      isGroup: true,
      advisorIds: [...groupBuilderSelectedPersonaIds],
      lastMsg: 'Group created. Start the discussion.',
      time: 'Now',
      unread: 0,
      pinned: true,
      status: 'read',
      groupMeta: {
        icon: groupDraft.icon,
        description: groupDraft.description.trim(),
        pictureUrl: groupDraft.pictureUrl.trim(),
        coAdminIds: [...groupDraft.coAdminIds],
        inviteLink,
        approveNewMembers: groupDraft.approveNewMembers,
      },
    };

    if (editingGroupThreadId) {
      setThreads((prev) => prev.map((thread) => (
        thread.id === editingGroupThreadId
          ? {
              ...thread,
              title: groupName,
              advisorIds: [...groupBuilderSelectedPersonaIds],
              groupMeta: {
                icon: groupDraft.icon,
                description: groupDraft.description.trim(),
                pictureUrl: groupDraft.pictureUrl.trim(),
                coAdminIds: [...groupDraft.coAdminIds],
                inviteLink,
                approveNewMembers: groupDraft.approveNewMembers,
              },
            }
          : thread
      )));

      if (activeThread?.id === editingGroupThreadId) {
        setActiveThread((prev) => (
          prev
            ? {
                ...prev,
                title: groupName,
                advisorIds: [...groupBuilderSelectedPersonaIds],
                groupMeta: {
                  icon: groupDraft.icon,
                  description: groupDraft.description.trim(),
                  pictureUrl: groupDraft.pictureUrl.trim(),
                  coAdminIds: [...groupDraft.coAdminIds],
                  inviteLink,
                  approveNewMembers: groupDraft.approveNewMembers,
                },
              }
            : prev
        ));
      }
    } else {
      setThreads((prev) => [groupThread, ...prev]);
    }
    setActiveTab('main');
    closeGroupBuilder();
  };

  const insertMention = (advisor) => {
    if (!activeThread) return;
    const token = advisor?.id ? `@${advisor.id}` : '';
    if (!token) return;
    const nextText = currentInputText.replace(/(?:^|\s)@[a-zA-Z0-9_.-]*$/, (segment) => {
      const lead = segment.startsWith(' ') ? ' ' : '';
      return `${lead}${token} `;
    });
    setCurrentInputText(nextText);
  };

  const dismissMention = (advisor) => {
    if (!activeThread || !advisor) return;

    const aliases = getAdvisorMentionAliases(advisor).map(escapeRegExp);
    const directName = escapeRegExp(advisor.name);
    const aliasPattern = aliases.length ? aliases.join('|') : '';

    let next = currentInputText;
    if (aliasPattern) {
      const aliasRegex = new RegExp(`(^|\\s)@(?:${aliasPattern})(?=\\s|$)`, 'gi');
      next = next.replace(aliasRegex, '$1');
    }
    next = next.replace(new RegExp(`(^|\\s)@${directName}(?=\\s|$)`, 'gi'), '$1');
    next = next.replace(/\s{2,}/g, ' ').trimStart();
    setCurrentInputText(next);
  };

  const deleteSelectedThreads = () => {
    if (!selectedThreadIds.length) return;
    const removedIds = new Set(selectedThreadIds);

    setThreads((prev) => prev.filter((thread) => !removedIds.has(thread.id)));
    setChatHistories((prev) => {
      const next = { ...prev };
      selectedThreadIds.forEach((id) => delete next[id]);
      return next;
    });
    setThreadDrafts((prev) => {
      const next = { ...prev };
      selectedThreadIds.forEach((id) => delete next[id]);
      return next;
    });
    setThreadGoalPlans((prev) => {
      const next = { ...prev };
      selectedThreadIds.forEach((id) => delete next[id]);
      return next;
    });

    if (activeThread && removedIds.has(activeThread.id)) setActiveThread(null);
    clearThreadSelection();
  };

  const createGroupFromSelectedThreads = () => {
    openGroupBuilder();
  };

  const toggleMessageSelection = (messageId) => {
    setSelectedMessageIds((prev) => (
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    ));
  };

  const startMessageLongPress = (message, previewOverride = null) => {
    if (messageLongPressTimerRef.current) clearTimeout(messageLongPressTimerRef.current);
    messageLongPressTimerRef.current = setTimeout(() => {
      void triggerFooterHaptic();
      setSelectedMessageIds([message.id]);
      setMessageActionSheet({
        id: message.id,
        role: message.role,
        preview: previewOverride,
      });
    }, 380);
  };

  const cancelMessageLongPress = () => {
    if (messageLongPressTimerRef.current) {
      clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
  };

  const deleteMessageById = (messageId) => {
    if (!activeThread || !messageId) return;
    setChatHistories((prev) => ({
      ...prev,
      [activeThread.id]: (prev[activeThread.id] || []).filter((msg) => msg.id !== messageId),
    }));
    setSelectedMessageIds((prev) => prev.filter((id) => id !== messageId));
    setMessageActionSheet(null);
  };

  const copyMessageContent = async (messageId, previewOverride = null) => {
    if (!activeThread || !messageId) return;
    const target = (chatHistories[activeThread.id] || []).find((msg) => msg.id === messageId);
    const text = (previewOverride || getMessagePreview(target)).trim();
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Ignore clipboard failures on restricted contexts.
    }

    setMessageActionSheet(null);
  };

  const beginEditMessage = (messageId) => {
    if (!activeThread || !messageId) return;
    const target = (chatHistories[activeThread.id] || []).find((msg) => msg.id === messageId);
    if (!target || target.role !== 'user' || typeof target.content !== 'string') return;

    setEditingMessageId(messageId);
    setCurrentInputText(target.content);
    setMessageActionSheet(null);
  };

  const queueReplyForMessage = (messageId, previewOverride = null) => {
    if (!activeThread || !messageId) return;
    const target = (chatHistories[activeThread.id] || []).find((msg) => msg.id === messageId);
    if (!target) return;
    const authorAdvisor = target.authorAdvisorId
      ? HISTORICAL_FIGURES.find((advisor) => advisor.id === target.authorAdvisorId)
      : null;
    const preview = (previewOverride || getMessagePreview(target)).slice(0, 90);
    setReplyTarget({
      id: target.id,
      role: target.role,
      authorAdvisorId: target.authorAdvisorId || null,
      authorName: authorAdvisor?.name || null,
      preview,
    });
    setMessageActionSheet(null);
  };

  const handleMessageTouchStart = (event, message, swipeKey = message.id) => {
    const point = event.touches?.[0];
    if (!point) return;
    swipeStateRef.current = {
      messageId: message.id,
      swipeKey,
      startX: point.clientX,
      startY: point.clientY,
      offset: 0,
      isVerticalScroll: false,
      isHorizontalSwipe: false,
    };
    setSwipingMessageId(null);
    setSwipeOffset(0);
  };

  const handleMessageTouchMove = (event) => {
    const point = event.touches?.[0];
    const swipeState = swipeStateRef.current;
    if (!point || !swipeState.messageId) return;

    const deltaX = point.clientX - swipeState.startX;
    const deltaY = point.clientY - swipeState.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaY > 10 && absDeltaY > absDeltaX + 4) {
      swipeStateRef.current.isVerticalScroll = true;
      cancelMessageLongPress();
      setSwipingMessageId(null);
      setSwipeOffset(0);
      return;
    }

    if (swipeState.isVerticalScroll) return;

    if (deltaX <= 0 || absDeltaX < 12 || absDeltaX <= absDeltaY) {
      return;
    }

    swipeStateRef.current.isHorizontalSwipe = true;
    cancelMessageLongPress();
    setSwipingMessageId(swipeState.swipeKey || swipeState.messageId);

    const nextOffset = Math.max(0, Math.min(88, deltaX));
    swipeStateRef.current.offset = nextOffset;
    setSwipeOffset(nextOffset);
  };

  const handleMessageTouchEnd = (message, options = {}) => {
    const { swipeKey = message.id, previewOverride = null } = options;
    const swipeState = swipeStateRef.current;
    if (
      swipeState.messageId === message.id
      && (swipeState.swipeKey || swipeState.messageId) === swipeKey
      && swipeState.isHorizontalSwipe
      && !swipeState.isVerticalScroll
      && swipeState.offset > 44
    ) {
      queueReplyForMessage(message.id, previewOverride);
    }
    swipeStateRef.current = {
      messageId: null,
      swipeKey: null,
      startX: 0,
      startY: 0,
      offset: 0,
      isVerticalScroll: false,
      isHorizontalSwipe: false,
    };
    setSwipeOffset(0);
    setSwipingMessageId(null);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistories, isTyping, activeThread]);

  useEffect(() => {
    setSelectedMessageIds([]);
    setMessageActionSheet(null);
    setReplyTarget(null);
    setEditingMessageId(null);
    setIsChatSettingsOpen(false);
    clearComposerAttachments();
    clearRecordingTicker();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    stopRecorderStream();
    mediaRecorderRef.current = null;
    mediaRecorderChunksRef.current = [];
    setRecordingState({ active: false, paused: false, elapsedMs: 0 });
  }, [activeThread?.id]);

  useEffect(() => {
    activeThreadIdRef.current = activeThread?.id || null;
  }, [activeThread?.id]);

  useEffect(() => () => {
    clearRecordingTicker();
    if (onboardingTransitionRef.current) {
      clearTimeout(onboardingTransitionRef.current);
      onboardingTransitionRef.current = null;
    }
    stopRecorderStream();
  }, []);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    setLocalStateLoaded(true);
  }, []);

  useEffect(() => {
    if (!localStateLoaded) return;

    setThreads((prev) => {
      const cleanedPrev = prev.filter((thread) => {
        if (!thread?.isGroup) return true;
        if (String(thread.title || '').trim().toLowerCase() === 'strategy group') return false;
        if (thread.id === '5') return false;
        return true;
      });

      const existingAdvisorIds = new Set(cleanedPrev.filter((thread) => !thread.isGroup).map((thread) => thread.advisorIds?.[0]).filter(Boolean));
      const missingAdvisors = HISTORICAL_FIGURES.filter((advisor) => !existingAdvisorIds.has(advisor.id));
      if (!missingAdvisors.length) return cleanedPrev;

      const appendedThreads = missingAdvisors.map((advisor, idx) => ({
        id: `persona-${advisor.id}-sync-${Date.now()}-${idx}`,
        title: advisor.name,
        isGroup: false,
        advisorIds: [advisor.id],
        lastMsg: `${advisor.role} advisory session ready.`,
        time: 'Now',
        unread: 0,
        pinned: false,
        status: 'read',
      }));

      return [...cleanedPrev, ...appendedThreads];
    });
  }, [localStateLoaded]);

  useEffect(() => {
    if (!localStateLoaded || typeof window === 'undefined') return;
    const payload = {
      threads,
      chatHistories,
      threadDrafts,
      threadResponseSettings,
      threadGoalPlans,
      notificationsEnabled,
      notificationPromptDismissed,
      hasSeenOnboarding,
      mainFocusedAdvisorIds,
      appLanguage,
    };
    window.localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(payload));
  }, [threads, chatHistories, threadDrafts, threadResponseSettings, threadGoalPlans, notificationsEnabled, notificationPromptDismissed, hasSeenOnboarding, mainFocusedAdvisorIds, appLanguage, localStateLoaded]);

  useEffect(() => {
    if (!localStateLoaded) return;

    if (Capacitor.isNativePlatform()) {
      void ensureNotificationChannel();

      void syncNotificationPermissionState();
      return;
    }

    void syncNotificationPermissionState();
  }, [localStateLoaded, notificationsEnabled, syncNotificationPermissionState]);

  useEffect(() => {
    if (!localStateLoaded || !notificationsEnabled || !Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const verifyPending = async () => {
      try {
        const pending = await LocalNotifications.getPending();
        if (!cancelled) {
          const pendingCount = pending?.notifications?.length || 0;
          console.log(`[Incirql] pending notifications in OS: ${pendingCount}`);
        }
      } catch {
        // getPending may be unsupported on some devices
      }
    };

    void verifyPending();
    return () => {
      cancelled = true;
    };
  }, [localStateLoaded, notificationsEnabled, threads]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return () => {};

    let appStateChangeHandle;
    const setup = async () => {
      try {
        appStateChangeHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          appStateRef.current.isActive = isActive;
          if (isActive) {
            void syncNotificationPermissionState();
            if (runContextTriggerSweepRef.current) {
              void runContextTriggerSweepRef.current('app_open');
            }
          }
        });
      } catch {
        // app lifecycle listener is optional
      }
    };

    void setup();
    return () => {
      if (appStateChangeHandle) appStateChangeHandle.remove();
    };
  }, [syncNotificationPermissionState]);

  useEffect(() => {
    return () => {
      if (generationRef.current.controller) generationRef.current.controller.abort();
      if (generationRef.current.revealInterval) clearInterval(generationRef.current.revealInterval);
    };
  }, []);

  const updateAssistantMessage = (threadId, assistantId, updater) => {
    setChatHistories((prev) => {
      const next = [...(prev[threadId] || [])];
      const msgIndex = next.findIndex((msg) => msg.id === assistantId);
      if (msgIndex === -1) return prev;
      const current = next[msgIndex];
      next[msgIndex] = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      return { ...prev, [threadId]: next };
    });
  };

  const clearGenerationState = () => {
    if (generationRef.current.revealInterval) {
      clearInterval(generationRef.current.revealInterval);
      clearTimeout(generationRef.current.revealInterval);
    }
    generationRef.current = {
      controller: null,
      revealInterval: null,
      assistantId: null,
      threadId: null,
      interrupted: false,
    };
  };

  const interruptGeneration = () => {
    const { controller, revealInterval, assistantId, threadId } = generationRef.current;
    generationRef.current.interrupted = true;
    if (controller) controller.abort();
    if (revealInterval) {
      clearInterval(revealInterval);
      clearTimeout(revealInterval);
    }

    if (assistantId && threadId) {
      updateAssistantMessage(threadId, assistantId, (current) => {
        const hasContent =
          current.content?.bursts?.length ||
          current.content?.insight ||
          current.content?.depthCard;

        return {
          ...current,
          status: 'interrupted',
          content: hasContent
            ? current.content
            : {
                ...EMPTY_ASSISTANT_CONTENT,
                bursts: ['Interrupted. Send your next move.'],
              },
        };
      });
    }

    setTypingThreadId((current) => (current === threadId ? null : current));
    clearGenerationState();
  };

  const handoffGenerationWithoutInterruption = () => {
    const { controller, revealInterval, assistantId, threadId } = generationRef.current;
    generationRef.current.interrupted = true;
    if (controller) controller.abort();
    if (revealInterval) {
      clearInterval(revealInterval);
      clearTimeout(revealInterval);
    }

    if (assistantId && threadId) {
      setChatHistories((prev) => {
        const next = [...(prev[threadId] || [])];
        const msgIndex = next.findIndex((msg) => msg.id === assistantId);
        if (msgIndex === -1) return prev;

        const current = next[msgIndex];
        const hasContent =
          current.content?.bursts?.length
          || current.content?.insight
          || current.content?.depthCard;

        if (!hasContent) {
          next.splice(msgIndex, 1);
          return { ...prev, [threadId]: next };
        }

        next[msgIndex] = { ...current, status: 'done' };
        return { ...prev, [threadId]: next };
      });
    }

    setTypingThreadId((current) => (current === threadId ? null : current));
    clearGenerationState();
  };

  const buildSystemPrompt = (threadTitle, thread, advisor, options = {}) => {
    const {
      lightweightMode = false,
      vagueMode = false,
      activeGoal = '',
      userLevel = 'intermediate',
      nextCommitment = '',
      personalPerspectiveRequested = false,
    } = options;

    const profile = advisor ? getPersonaProfile(advisor) : null;
    const personaPrompt = [
      advisor?.prompt || 'You are a strategic advisor.',
      profile
        ? `STRICT PERSONA ENFORCEMENT:
- Name: ${advisor?.name || 'Unknown'} (Always stay in character as this person)
- Expertise: ${profile.domainExpertise.join(', ')}
- Thinking: ${profile.thinkingStyle}
- Tone: ${profile.communicationTone}
- Behavior: Regardless of whether the user addresses you by name or not, you must maintain this identity perfectly. Use the vocabulary, phraseology, and unique perspective of ${advisor?.name || 'your persona'}. Do not break character.`
        : '',
    ].filter(Boolean).join('\n');

    const personaContext = thread.isGroup
      ? `You are a member of a boardroom panel. Your current identity: ${advisor?.name || 'A Lead Specialist'}.\n\nOther panel members: ${thread.advisorIds.join(', ')}.\n\n${personaPrompt}`
      : personaPrompt;

    const contextLines = [
      `Active goal: ${activeGoal || 'not explicitly set yet'}`,
      `Inferred user level: ${userLevel}`,
      `Pending commitment: ${nextCommitment || 'none captured'}`,
    ].join('\n');

    const personalPerspectiveRule = personalPerspectiveRequested
      ? 'The user asked what you would personally do. If critical context is missing, ask briefly, then proceed with explicit assumptions: "Given limited info, I will assume...". Use conditional framing: "Given these conditions, I would lean toward...". Do not issue direct instructions. Include key risks, alternatives, and 1-2 follow-up questions.'
      : 'If the user asks what you would personally do, first identify missing critical context (risk tolerance, timeframe, capital, constraints). Then provide a conditional personal perspective with explicit assumptions, risks, alternatives, and follow-up questions. Never present it as a directive.';

    if (lightweightMode) {
      return `${personaPrompt}
You are in an AI chat.
Return ONLY valid JSON with this shape:
{
  "bursts": ["short natural reply"],
  "insight": "",
  "depthCard": null,
  "questions": [],
  "suggestedQuestions": []
}
Rules:
- Keep it human and casual.
- Single short burst only.
- No deep analysis, no cards, no follow-up questions.
- Keep guidance practical and specific.
- Do not include markdown fences.
${contextLines}
Context thread: ${threadTitle}`;
    }

    return `${personaPrompt}
You are in an AI chat, not an essay response.
Return ONLY valid JSON with this shape:
{
  "bursts": ["1-2 line message", "1-2 line message"],
  "insight": "optional medium insight (1-3 lines)",
  "depthCard": {"title": "optional title", "points": ["point", "point"]},
  "questions": ["questions the persona asks the user"],
  "suggestedQuestions": ["optional question suggestion user may ask back"]
}
Rules:
- bursts max 4, each short and conversational.
- Include at least one concrete action, one trade-off, and one assumption in your response.
- Prioritize outcome-driven advice over theory.
- Keep persona voice distinct and consistent with profile.
- If user context or constraints are unclear (location, tools, capital, regulations), ask for it before specific recommendations; if unknown, proceed with explicit assumptions and provide globally feasible alternatives.
- If user drifts off-topic, briefly acknowledge and tie back to the active goal; if user explicitly changes goal, adapt immediately and continue with the new goal.
- Track continuity: reference user goal, past answers, and commitments when relevant.
- ${vagueMode ? 'Ask exactly 1-2 sharp clarifying questions in questions to understand user intent.' : 'Ask at least 1 focused follow-up question in questions.'}
- suggestedQuestions must be short, one-line, and phrased like realistic user replies that directly answer the questions.
- In group settings, keep response scoped and avoid generic overlap.
- ${personalPerspectiveRule}
- Use emotional awareness: if user sounds confused or hesitant, simplify and reduce cognitive load.
- Help the user feel trained, not just advised: propose small assignments and check for follow-through.
- Do not include markdown fences.
- Keep progression-oriented and interruptible.
${contextLines}
Context thread: ${threadTitle}`;
  };

  const tryStreamResponse = async ({ history, userText, systemPrompt, signal, threadId, assistantId, lightweightMode = false, forceClarifyingQuestions = false, attachmentParts = [] }) => {
    if (!apiKey) {
      throw new Error('API key missing. Add VITE_GEMINI_API_KEY.');
    }

    let lastError = null;

    for (const modelName of modelCandidates) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
        const requestBody = {
          contents: [
            ...history.map((msg) => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: serializeMessageForModelHistory(msg) }],
            })),
            { role: 'user', parts: [{ text: userText }, ...attachmentParts] },
          ],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: buildGenerationConfig(),
        };

        let streamResponse;
        try {
          streamResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal,
              body: JSON.stringify(requestBody),
            }
          );
        } catch (error) {
          lastError = new Error(normalizeApiFailureMessage(error?.message || 'Network request failed', 0));
          if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            await waitForRetry(getRetryDelayMs(attempt), signal);
            continue;
          }
          break;
        }

        if (!streamResponse.ok || !streamResponse.body) {
          const failure = await parseApiFailure(streamResponse);
          const message = normalizeApiFailureMessage(failure.message, failure.status);
          const retryable = isRetryableApiFailure(failure.status, failure.message);
          lastError = new Error(message);

          if (geminiServiceTierEnabled && shouldDisableGeminiServiceTier(failure.status, failure.message)) {
            geminiServiceTierEnabled = false;
            continue;
          }

          if (FATAL_HTTP_STATUSES.has(failure.status)) {
            throw lastError;
          }

          if (retryable && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            await waitForRetry(getRetryDelayMs(attempt, failure.retryAfterMs), signal);
            continue;
          }

          break;
        }

        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let liveText = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (generationRef.current.interrupted) throw new DOMException('aborted', 'AbortError');

          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split('\n\n');
          sseBuffer = events.pop() || '';

          for (const event of events) {
            const line = event
              .split('\n')
              .find((segment) => segment.startsWith('data:'));

            if (!line) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const parsed = JSON.parse(raw);
              const chunkText =
                parsed.candidates?.[0]?.content?.parts
                  ?.map((part) => part?.text || '')
                  .join('') || '';

              if (chunkText) {
                liveText = mergeStreamText(liveText, chunkText);
                const livePayload = buildPayloadFromText(liveText, { lightweightMode, forceClarifyingQuestions });
                updateAssistantMessage(threadId, assistantId, (current) => ({
                  ...current,
                  status: 'streaming',
                  content: {
                    ...current.content,
                    bursts: livePayload.bursts.slice(0, lightweightMode ? 1 : 3),
                  },
                }));
              }
            } catch {
              continue;
            }
          }
        }

        if (liveText.trim()) {
          return parseModelResponse(liveText, { lightweightMode, forceClarifyingQuestions });
        }

        lastError = new Error('Model returned an empty stream response.');
        if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
          await waitForRetry(getRetryDelayMs(attempt), signal);
          continue;
        }
      }
    }

    throw lastError || new Error('Unable to generate response from available models.');
  };

  const requestNonStreaming = async ({ history, userText, systemPrompt, signal, lightweightMode = false, forceClarifyingQuestions = false, attachmentParts = [] }) => {
    if (!apiKey) {
      throw new Error('API key missing. Add VITE_GEMINI_API_KEY.');
    }

    let lastError = null;

    for (const modelName of modelCandidates) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
        const requestBody = {
          contents: [
            ...history.map((msg) => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: serializeMessageForModelHistory(msg) }],
            })),
            { role: 'user', parts: [{ text: userText }, ...attachmentParts] },
          ],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: buildGenerationConfig({ responseMimeType: 'application/json' }),
        };

        let response;
        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal,
              body: JSON.stringify(requestBody),
            }
          );
        } catch (error) {
          lastError = new Error(normalizeApiFailureMessage(error?.message || 'Network request failed', 0));
          if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            await waitForRetry(getRetryDelayMs(attempt), signal);
            continue;
          }
          break;
        }

        if (!response.ok) {
          const failure = await parseApiFailure(response);
          const message = normalizeApiFailureMessage(failure.message, failure.status);
          const retryable = isRetryableApiFailure(failure.status, failure.message);
          lastError = new Error(message);

          if (geminiServiceTierEnabled && shouldDisableGeminiServiceTier(failure.status, failure.message)) {
            geminiServiceTierEnabled = false;
            continue;
          }

          if (FATAL_HTTP_STATUSES.has(failure.status)) {
            throw lastError;
          }

          if (retryable && attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            await waitForRetry(getRetryDelayMs(attempt, failure.retryAfterMs), signal);
            continue;
          }

          break;
        }

        const data = await response.json();
        const modelText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!modelText.trim()) {
          lastError = new Error('Model returned an empty response.');
          if (attempt < MAX_ATTEMPTS_PER_MODEL - 1) {
            await waitForRetry(getRetryDelayMs(attempt), signal);
            continue;
          }
          break;
        }

        return parseModelResponse(modelText, { lightweightMode, forceClarifyingQuestions });
      }
    }

    throw lastError || new Error('Unable to generate response from available models.');
  };

  const progressiveReveal = (threadId, assistantId, payload) => {
    const revealQueue = [];

    for (const burst of payload.bursts || []) {
      revealQueue.push({ type: 'burst', value: burst });
    }
    if (payload.insight) revealQueue.push({ type: 'insight', value: payload.insight });
    if (payload.depthCard) revealQueue.push({ type: 'depthCard', value: payload.depthCard });
    if (payload.questions?.length) revealQueue.push({ type: 'questions', value: payload.questions });
    if (payload.suggestedQuestions?.length) revealQueue.push({ type: 'suggestedQuestions', value: payload.suggestedQuestions });

    let cursor = 0;
    updateAssistantMessage(threadId, assistantId, (current) => ({
      ...current,
      status: 'streaming',
      content: EMPTY_ASSISTANT_CONTENT,
    }));

    const intervalId = setInterval(() => {
      if (generationRef.current.interrupted) {
        clearInterval(intervalId);
        return;
      }

      const item = revealQueue[cursor];
      if (!item) {
        clearInterval(intervalId);
        updateAssistantMessage(threadId, assistantId, (current) => ({ ...current, status: 'done' }));
        setTypingThreadId((current) => (current === threadId ? null : current));
        clearGenerationState();
        return;
      }

      updateAssistantMessage(threadId, assistantId, (current) => {
        const nextContent = { ...current.content };
        if (item.type === 'burst') nextContent.bursts = [...(nextContent.bursts || []), item.value];
        if (item.type === 'insight') nextContent.insight = item.value;
        if (item.type === 'depthCard') nextContent.depthCard = item.value;
        if (item.type === 'questions') nextContent.questions = item.value;
        if (item.type === 'suggestedQuestions') nextContent.suggestedQuestions = item.value;
        return { ...current, content: nextContent };
      });

      cursor += 1;
    }, 35);

    generationRef.current.revealInterval = intervalId;
  };

  const appendGoalProgressEntry = (threadId, userText) => {
    const update = inferGoalProgressUpdate(userText);
    const tomorrowCommitment = inferTomorrowCommitment(userText);
    if (!update && !tomorrowCommitment) return;
    if (!threadId) return;

    setThreadGoalPlans((prev) => {
      const current = sanitizeCoachPlan(prev[threadId]);
      if (!current.enabled || !current.goal) return prev;

      const todayKey = toDateKey(new Date());
      const nextLog = [...current.progressLog];
      const existingIndex = nextLog.findIndex((entry) => entry.dateKey === todayKey);
      const timestamp = new Date().toISOString();
      if (update) {
        const nextEntry = {
          dateKey: todayKey,
          completed: update.completed,
          note: update.note,
          updatedAt: timestamp,
        };

        if (existingIndex >= 0) {
          nextLog[existingIndex] = {
            ...nextLog[existingIndex],
            completed: nextEntry.completed,
            note: nextEntry.note,
            updatedAt: timestamp,
          };
        } else {
          nextLog.push(nextEntry);
        }
      }

      const currentCommitment = current.nextCommitment && typeof current.nextCommitment === 'object'
        ? { ...current.nextCommitment }
        : null;
      const commitmentForToday = currentCommitment && currentCommitment.dateKey === todayKey && currentCommitment.status === 'pending';
      if (commitmentForToday && update?.completed !== null) {
        currentCommitment.status = update.completed ? 'done' : 'missed';
      }

      const metrics = deriveCoachMetrics({ ...current, progressLog: nextLog });
      return {
        ...prev,
        [threadId]: {
          ...current,
          progressLog: nextLog.slice(-35),
          nextCommitment: tomorrowCommitment || currentCommitment,
          lastUserUpdateAt: timestamp,
          pendingCoachPromptAt: '',
          pendingCoachSlot: '',
          escalationState: metrics.escalationState,
          successStreak: metrics.successStreak,
          missedStreak: metrics.missedStreak,
          totalCheckIns: metrics.totalCheckIns,
          totalCompleted: metrics.totalCompleted,
          reputationScore: metrics.reputationScore,
          reputationLabel: metrics.reputationLabel,
          updatedAt: timestamp,
        },
      };
    });
  };

  const emitCoachCheckIn = useCallback(async (threadId, slot, options = {}) => {
    const {
      force = false,
      trigger = 'schedule',
      contextReason = '',
    } = options;
    const thread = threadsRef.current.find((entry) => entry.id === threadId);
    if (!thread) return;

    const plan = sanitizeCoachPlan(threadGoalPlans[threadId]);
    if (!plan.enabled || !plan.goal.trim()) return;

    const now = Date.now();
    const slotKey = slot === 'context' ? 'context' : slot;
    const todayKey = toDateKey(new Date());
    if (!force && slot !== 'context' && plan.lastCheckInBySlot?.[slot] === todayKey) return;
    if (!force && slot === 'context') {
      const lastContextTs = Date.parse(plan.lastContextCheckInAt || '');
      if (!Number.isNaN(lastContextTs) && (now - lastContextTs) < COACH_CONTEXT_COOLDOWN_MS) {
        return;
      }
    }

    const guardKey = `${threadId}:${slotKey}:${todayKey}`;
    if (coachEmissionGuardRef.current.has(guardKey)) return;
    coachEmissionGuardRef.current.add(guardKey);

    try {
      const advisorId = thread.advisorIds?.[0] || null;
      const advisor = advisorId
        ? HISTORICAL_FIGURES.find((entry) => entry.id === advisorId)
        : null;
      const advisorName = advisor?.name || thread.title || 'Your mentor';
      const metrics = deriveCoachMetrics(plan);
      const recentProgress = plan.progressLog.slice(-7);
      const completionRate = metrics.completionPct || null;
      const latestNote = recentProgress.length ? recentProgress[recentProgress.length - 1]?.note : '';
      const recentNotes = recentProgress
        .filter((entry) => entry.note)
        .slice(-2)
        .map((entry) => entry.note)
        .join(' | ');
      const progressSummary = completionRate === null
        ? 'No tracked completion streak yet.'
        : `Last 7 tracked days completion: ${completionRate}%.`;
      const commitmentDueToday = plan.nextCommitment
        && plan.nextCommitment.dateKey === todayKey
        && plan.nextCommitment.status === 'pending';
      const commitmentText = formatCommitmentText(plan.nextCommitment);
      const escalationState = plan.escalationState || metrics.escalationState;
      const escalationInstruction = getEscalationStyleInstruction(escalationState);

      let triggerDirective = 'Scheduled accountability check-in.';
      if (trigger === 'context') {
        if (contextReason === 'inactivity') triggerDirective = 'Context trigger: user inactive for a while. Re-engage with urgency.';
        if (contextReason === 'missed_checkin') triggerDirective = 'Context trigger: user ignored earlier check-in. Escalate accountability.';
        if (contextReason === 'app_open') triggerDirective = 'Context trigger: user reopened app. Re-anchor focus immediately.';
      }
      if (trigger === 'goal_challenge') {
        triggerDirective = 'Initiative trigger: challenge and refine the goal before coaching execution.';
      }

      const systemPrompt = `${advisor?.prompt || 'You are a disciplined accountability coach.'}
You are proactively checking in with your student.
Return ONLY valid JSON with this shape:
{
  "bursts": ["1-2 short lines", "1 short line"],
  "insight": "optional short reflection",
  "depthCard": null,
  "questions": ["1 direct accountability question"],
  "suggestedQuestions": []
}
Rules:
- Stay strictly in persona.
- Keep it concise and specific.
- Reference the user goal and recent consistency data naturally.
- Include memory references to user promises or recent statements when possible.
- Morning check-ins ask for today's concrete plan.
- Evening check-ins ask if today's goal was completed and secure tomorrow commitment.
- If escalation is repeated_failure, confront directly and ask for non-negotiable schedule.
- If escalation is consistent_success, challenge with goal upgrade.
- Rules decide what to push. Persona decides how to phrase it.
- Do not include markdown fences or labels.`;

      const prompt = trigger === 'goal_challenge'
        ? `Challenge and refine this goal now.
Goal: ${plan.goal}
${progressSummary}
Propose a more realistic, measurable version, and ask the user to accept or edit it.`
        : slot === 'morning'
        ? `Send a morning check-in.
Goal: ${plan.goal}
Escalation state: ${escalationState}
${escalationInstruction}
${triggerDirective}
Reputation: ${plan.reputationLabel || metrics.reputationLabel} (${plan.reputationScore || metrics.reputationScore}%).
Progress summary: ${progressSummary}
Latest note: ${latestNote || 'none'}
Recent memory references: ${recentNotes || 'none'}
${commitmentDueToday ? `User committed for today: ${commitmentText || 'specific action not captured'}. Ask directly if it was done.` : ''}
Ask for one concrete action and expected completion time.`
        : `Send an evening check-in.
Goal: ${plan.goal}
Escalation state: ${escalationState}
${escalationInstruction}
${triggerDirective}
Reputation: ${plan.reputationLabel || metrics.reputationLabel} (${plan.reputationScore || metrics.reputationScore}%).
Progress summary: ${progressSummary}
Latest note: ${latestNote || 'none'}
Recent memory references: ${recentNotes || 'none'}
Ask whether the goal was completed today and one lesson.
Then secure a tomorrow commitment with specific action and time.`;

      const refinementHint = plan.goalNeedsRefinement
        ? '\nInitiative requirement: challenge the current goal if unrealistic, then suggest a tighter version.'
        : '';
      const promptWithRefinement = `${prompt}${refinementHint}`;

      let payload;
      try {
        payload = await requestNonStreaming({
          history: (chatHistories[threadId] || []).slice(-8),
          userText: promptWithRefinement,
          systemPrompt,
          signal: null,
          lightweightMode: false,
          forceClarifyingQuestions: false,
        });
      } catch {
        payload = buildCoachFallbackPayload(advisorName, plan.goal, slot, progressSummary);
      }

      const assistantMessage = {
        id: `assistant-coach-${Date.now()}-${slot}`,
        role: 'assistant',
        status: 'done',
        content: payload,
        timestamp: new Date().toISOString(),
        authorAdvisorId: advisorId,
        coachMeta: {
          slot: slotKey,
          trigger,
          contextReason,
          escalationState,
          reputationScore: plan.reputationScore || metrics.reputationScore,
          autoGenerated: true,
        },
      };

      setChatHistories((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] || []), assistantMessage],
      }));

      const preview = payload.bursts?.[0] || payload.insight || 'Check-in update.';
      if (updateThreadFromAssistantMessageRef.current) {
        updateThreadFromAssistantMessageRef.current(threadId, preview, assistantMessage.timestamp, { authorAdvisorId: advisorId });
      }

      setThreadGoalPlans((prev) => {
        const current = sanitizeCoachPlan(prev[threadId]);
        return {
          ...prev,
          [threadId]: {
            ...current,
            lastCheckInBySlot: {
              ...current.lastCheckInBySlot,
              [slotKey]: todayKey,
            },
            lastContextCheckInAt: slotKey === 'context' ? new Date().toISOString() : current.lastContextCheckInAt,
            pendingCoachPromptAt: new Date().toISOString(),
            pendingCoachSlot: slotKey,
            goalNeedsRefinement: trigger === 'goal_challenge' ? false : current.goalNeedsRefinement,
            lastGoalChallengeAt: trigger === 'goal_challenge' ? new Date().toISOString() : current.lastGoalChallengeAt,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    } finally {
      coachEmissionGuardRef.current.delete(guardKey);
    }
  }, [chatHistories, threadGoalPlans]);

  const runContextTriggerSweep = useCallback(async (reason = 'inactivity') => {
    const nowMs = Date.now();
    const entries = Object.entries(threadGoalPlans);

    for (const [threadId, rawPlan] of entries) {
      const plan = sanitizeCoachPlan(rawPlan);
      if (!plan.enabled || !plan.goal) continue;

      const lastContextMs = Date.parse(plan.lastContextCheckInAt || '');
      if (!Number.isNaN(lastContextMs) && (nowMs - lastContextMs) < COACH_CONTEXT_COOLDOWN_MS) {
        continue;
      }

      if (reason === 'inactivity') {
        const lastUserMs = Date.parse(plan.lastUserUpdateAt || '');
        if (Number.isNaN(lastUserMs) || (nowMs - lastUserMs) < COACH_INACTIVITY_TRIGGER_MS) continue;
      }

      if (reason === 'missed_checkin') {
        const pendingMs = Date.parse(plan.pendingCoachPromptAt || '');
        if (Number.isNaN(pendingMs) || (nowMs - pendingMs) < COACH_PENDING_RESPONSE_NUDGE_MS) continue;
      }

      if (reason === 'app_open') {
        const lastUserMs = Date.parse(plan.lastUserUpdateAt || '');
        if (!Number.isNaN(lastUserMs) && (nowMs - lastUserMs) < (8 * 60 * 60 * 1000)) continue;
      }

      await emitCoachCheckIn(threadId, 'context', {
        trigger: 'context',
        contextReason: reason,
      });
    }
  }, [emitCoachCheckIn, threadGoalPlans]);
  runContextTriggerSweepRef.current = runContextTriggerSweep;

  const handleSendMessage = async (event, directText, options = {}) => {
    if (event?.preventDefault) event.preventDefault();
    if (!activeThread) return;

    const {
      suppressUserMessage = false,
      removeFailedMessageId = null,
      forceMentionAdvisorId = null,
      resumeRetryCount = 0,
      attachmentPayloads = null,
    } = options;

    const userText = (typeof directText === 'string' ? directText : currentInputText).trim();
    const threadId = activeThread.id;
    const outgoingAttachments = Array.isArray(attachmentPayloads) ? attachmentPayloads : composerAttachments;
    const composedUserText = userText || (outgoingAttachments.length ? 'Use the attached files as context and guide me with practical next steps.' : '');
    if (!composedUserText && !outgoingAttachments.length) return;
    const explicitGoalShift = extractGoalShiftFromText(composedUserText);
    const attachmentParts = buildAttachmentPartsForRequest(outgoingAttachments);
    const lightweightMode = isLightweightUserMessage(composedUserText);
    const vagueMode = isVagueUserMessage(composedUserText);

    let editedTargetId = null;
    if (editingMessageId) {
      editedTargetId = editingMessageId;
      setChatHistories((prev) => ({
        ...prev,
        [activeThread.id]: (prev[activeThread.id] || []).map((msg) => (
          msg.id === editingMessageId
            ? {
                ...msg,
                content: composedUserText,
                attachments: outgoingAttachments.map(serializeAttachmentForMessage),
                editedAt: new Date().toISOString(),
              }
            : msg
        )),
      }));
      setEditingMessageId(null);
      setReplyTarget(null);
      setCurrentInputText('');
      clearComposerAttachments();
    }

    const generationThreadId = generationRef.current.threadId;
    if (generationThreadId) {
      if (generationThreadId === activeThread.id) {
        interruptGeneration();
      } else {
        handoffGenerationWithoutInterruption();
      }
    }

    const advisorPool = activeThread.advisorIds || [];
    let mentionedAdvisorIds = activeThread.isGroup
      ? resolveMentionedAdvisorIds(composedUserText, advisorPool)
      : [];
    if (forceMentionAdvisorId && !mentionedAdvisorIds.includes(forceMentionAdvisorId)) {
      mentionedAdvisorIds = [forceMentionAdvisorId, ...mentionedAdvisorIds];
    }
    const mentionedAdvisorId = mentionedAdvisorIds[0] || null;
    const mentionAll = activeThread.isGroup ? hasAllMention(composedUserText) : false;
    const assistantId = `assistant-${Date.now()}`;
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: composedUserText,
      timestamp: new Date().toISOString(),
      replyTo: replyTarget ? { ...replyTarget } : null,
      attachments: outgoingAttachments.map(serializeAttachmentForMessage),
      readBy: activeThread.isGroup ? [] : undefined,
    };
    const replyAdvisorId = replyTarget?.authorAdvisorId || null;
    const assistantPlaceholder = activeThread.isGroup
      ? null
      : {
          id: assistantId,
          role: 'assistant',
          status: 'streaming',
          content: EMPTY_ASSISTANT_CONTENT,
          timestamp: new Date().toISOString(),
          authorAdvisorId: null,
          readBy: [],
        };

    const shouldAppendUserMessage = !suppressUserMessage && !editedTargetId;

    if (shouldAppendUserMessage || editedTargetId) {
      appendGoalProgressEntry(threadId, composedUserText);
    }

    if (explicitGoalShift && !activeThread.isGroup) {
      setThreadGoalPlans((prev) => {
        const current = sanitizeCoachPlan(prev[threadId]);
        if (!current.enabled && !current.goal) return prev;
        return {
          ...prev,
          [threadId]: {
            ...current,
            goal: explicitGoalShift,
            goalNeedsRefinement: false,
            goalVersion: Number(current.goalVersion || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    }

    if (shouldAppendUserMessage && activeThread.isGroup) {
      updateIntentRouterEngagement(threadId, composedUserText, {
        replyAdvisorId,
        mentionedAdvisorIds,
      });
    }

    // Auto-add persona to mainFocusedAdvisorIds if not present
    if (activeThread && !activeThread.isGroup && activeThread.advisorIds?.[0]) {
      const personaId = activeThread.advisorIds[0];
      setMainFocusedAdvisorIds((prev) => {
        if (prev.includes(personaId)) return prev;
        return [...prev, personaId];
      });
    }

    setChatHistories((prev) => {
      let nextThreadHistory = [...(prev[threadId] || [])];

      if (removeFailedMessageId) {
        nextThreadHistory = nextThreadHistory.filter((msg) => msg.id !== removeFailedMessageId);
      }

      if (editedTargetId) {
        nextThreadHistory = nextThreadHistory.map((msg) => (
          msg.id === editedTargetId
            ? {
                ...msg,
                content: composedUserText,
                attachments: outgoingAttachments.map(serializeAttachmentForMessage),
                editedAt: new Date().toISOString(),
              }
            : msg
        ));
      }

      if (shouldAppendUserMessage) {
        nextThreadHistory.push(userMsg);
      }
      if (assistantPlaceholder) nextThreadHistory.push(assistantPlaceholder);
      return {
        ...prev,
        [threadId]: nextThreadHistory,
      };
    });
    setThreadDrafts((prev) => ({ ...prev, [threadId]: '' }));
    clearComposerAttachments();
    setReplyTarget(null);
    setSelectedMessageIds([]);
    setTypingThreadId(threadId);

    const controller = new AbortController();
    generationRef.current = {
      controller,
      revealInterval: null,
      assistantId: assistantPlaceholder ? assistantId : null,
      threadId,
      interrupted: false,
    };

    const mainAdvisor = HISTORICAL_FIGURES.find((m) => m.id === activeThread.advisorIds[0]);
    let history = [...(chatHistories[threadId] || [])];
    if (removeFailedMessageId) history = history.filter((msg) => msg.id !== removeFailedMessageId);
    if (editedTargetId) {
      history = history.map((msg) => (
        msg.id === editedTargetId
          ? {
              ...msg,
              content: composedUserText,
              attachments: outgoingAttachments.map(serializeAttachmentForMessage),
              editedAt: new Date().toISOString(),
            }
          : msg
      ));
    }
    const modelHistory = [
      ...history,
      ...(shouldAppendUserMessage ? [userMsg] : []),
    ]
      .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
      .filter((msg) => msg.status !== 'failed' && msg.status !== 'pending' && msg.status !== 'streaming')
      .slice(-(activeThread.isGroup ? GROUP_HISTORY_WINDOW : INDIVIDUAL_HISTORY_WINDOW));
    const mentionHint = mentionedAdvisorId
      ? `\nUser mentioned @${HISTORICAL_FIGURES.find((advisor) => advisor.id === mentionedAdvisorId)?.name || 'advisor'}. Reply primarily as that persona.`
      : '';
    const replyHint = replyAdvisorId
      ? `\nUser is replying to ${HISTORICAL_FIGURES.find((advisor) => advisor.id === replyAdvisorId)?.name || 'a persona'}. Preserve that context naturally.`
      : '';
    const styleHint = `\nResponse style: ${buildStyleInstruction(activeThreadResponseSettings.style)}.`;
    const languageInstruction = appLanguage !== 'en'
      ? `\nRespond in ${LANGUAGE_OPTIONS.find((option) => option.id === appLanguage)?.label || 'English'} unless the user asks otherwise.`
      : '';
    const activeGoalPlan = sanitizeCoachPlan(threadGoalPlans[threadId]);
    const activeGoal = explicitGoalShift || activeGoalPlan.goal || String(activeThread?.groupMeta?.intentRouter?.intent || '').trim();
    const userLevel = inferUserExperienceLevel(modelHistory);
    const nextCommitment = formatCommitmentText(activeGoalPlan.nextCommitment);
    const personalPerspectiveRequested = isPersonalPerspectiveRequest(composedUserText);
    const systemPrompt = `${buildSystemPrompt(activeThread.title, activeThread, mainAdvisor, {
      lightweightMode,
      vagueMode,
      activeGoal,
      userLevel,
      nextCommitment,
      personalPerspectiveRequested,
    })}${mentionHint}${replyHint}${styleHint}${languageInstruction}`;

    try {
      if (activeThread.isGroup) {
        const selectedPriorityAdvisorId = (activeThreadResponseSettings.priorityAdvisorId && advisorPool.includes(activeThreadResponseSettings.priorityAdvisorId))
          ? activeThreadResponseSettings.priorityAdvisorId
          : 'auto';

        const advisorExpertise = advisorPool
          .map((advisorId) => {
            const advisor = HISTORICAL_FIGURES.find((entry) => entry.id === advisorId);
            if (!advisor) return null;
            const expertiseScore = scoreAdvisorTopicExpertise(composedUserText, advisor);
            const priorityBoost = selectedPriorityAdvisorId !== 'auto' && selectedPriorityAdvisorId === advisorId ? 2 : 0;
            const replyBoost = replyAdvisorId && replyAdvisorId === advisorId ? 1 : 0;
            return {
              advisorId,
              expertiseScore,
              total: expertiseScore + priorityBoost + replyBoost,
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.total - a.total);

        const responderIds = [];
        const taggedResponderIds = mentionedAdvisorIds.filter((advisorId) => advisorPool.includes(advisorId));
        if (taggedResponderIds.length) {
          taggedResponderIds.forEach((advisorId) => {
            if (!responderIds.includes(advisorId)) responderIds.push(advisorId);
          });
        } else if (activeThread.groupMeta?.intentRouter?.order?.length) {
          const preferredOrder = activeThread.groupMeta.intentRouter.order
            .filter((advisorId) => advisorPool.includes(advisorId));
          const engagement = activeThread.groupMeta.intentRouter.engagement || {};
          const ranked = [...preferredOrder].sort((a, b) => {
            const aBias = a === preferredOrder[0] ? 0.45 : 0;
            const bBias = b === preferredOrder[0] ? 0.45 : 0;
            return (Number(engagement[b] || 0) + bBias) - (Number(engagement[a] || 0) + aBias);
          });
          const desiredCount = mentionAll ? Math.min(2, advisorPool.length) : 1;
          ranked.slice(0, desiredCount).forEach((advisorId) => {
            if (!responderIds.includes(advisorId)) responderIds.push(advisorId);
          });
        } else {
          const rankedAdvisorIds = advisorExpertise.map((item) => item.advisorId);
          if (selectedPriorityAdvisorId !== 'auto' && !rankedAdvisorIds.includes(selectedPriorityAdvisorId)) {
            rankedAdvisorIds.unshift(selectedPriorityAdvisorId);
          }

          const desiredCount = lightweightMode
            ? 1
            : (mentionAll ? Math.min(2, advisorPool.length) : 1);
          rankedAdvisorIds.forEach((advisorId) => {
            if (!responderIds.includes(advisorId) && responderIds.length < desiredCount) {
              responderIds.push(advisorId);
            }
          });

          if (!responderIds.length && advisorPool.length) responderIds.push(advisorPool[0]);
        }

        const usedContentKeys = new Set();
        const priorSummaries = [];
        const normalizePayloadForAdvisor = (rawPayload) => {
          const cleanedBursts = (rawPayload?.bursts || [])
            .map((line) => stripLeadingPersonaLabel(line, advisorPool))
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => {
              const key = normalizeMentionKey(line);
              if (!key || usedContentKeys.has(key)) return false;
              usedContentKeys.add(key);
              return true;
            })
            .slice(0, 2);

          const cleanedInsight = stripLeadingPersonaLabel(rawPayload?.insight || '', advisorPool).trim();
          const insightKey = normalizeMentionKey(cleanedInsight);
          const insight = cleanedInsight && insightKey && !usedContentKeys.has(insightKey)
            ? cleanedInsight
            : '';
          if (insight) usedContentKeys.add(insightKey);

          return {
            bursts: cleanedBursts.length ? cleanedBursts.slice(0, lightweightMode ? 1 : 2) : ['From my angle, focus on the highest-leverage next step.'],
            insight: lightweightMode ? '' : insight,
            depthCard: null,
            questions: lightweightMode ? [] : (rawPayload?.questions || []).map((item) => toSentenceCase(item)).slice(0, 2),
            suggestedQuestions: lightweightMode
              ? []
              : alignSuggestedQuestions(
                (rawPayload?.questions || []).slice(0, 2),
                (rawPayload?.suggestedQuestions || []).slice(0, 2),
                composedUserText
              ),
          };
        };

        const getDelayForOrdinal = (ordinal) => {
          if (ordinal <= 1) return 0;
          if (ordinal === 2) return 80 + Math.floor(Math.random() * 220);
          if (ordinal === 3) return 550 + Math.floor(Math.random() * 750);

          const minMs = 1200 + ((ordinal - 4) * 450);
          return minMs + Math.floor(Math.random() * 500);
        };

        const generatePayloadForAdvisor = async (advisorId, options = {}) => {
          const { preferStreaming = false, streamMessageId = null } = options;
          const advisor = HISTORICAL_FIGURES.find((entry) => entry.id === advisorId);
          const profile = getPersonaProfile(advisor || {});
          const advisorPrompt = `You are ${advisor?.name || 'the advisor'}. ${advisor?.prompt || 'You are a strategic advisor.'}
Persona profile:
- Domain expertise: ${profile.domainExpertise.join(', ')}
- Thinking style: ${profile.thinkingStyle}
- Communication tone: ${profile.communicationTone}
- Stage relevance: ${profile.stageRelevance}
- Decision bias: ${profile.decisionBias}
- Confidence boundary: ${profile.confidenceBoundary}
You are in an AI chat speaking in a group boardroom, not an essay response.
Return ONLY valid JSON with this shape:
{
  "bursts": ["1-2 line message", "1-2 line message"],
  "insight": "optional medium insight (1-3 lines)",
  "depthCard": {"title": "optional title", "points": ["point", "point"]},
  "questions": ["questions the persona asks the user"],
  "suggestedQuestions": ["optional question suggestion user may ask back"]
}
Rules:
- Stay in your own persona voice only.
- Do not repeat wording from previous group members; check prior context.
- Keep it short and conversational.
- bursts max ${lightweightMode ? '1' : '4'}, each 1-2 lines.
- Include at least one concrete action, one trade-off, and one assumption.
- Keep advice context-aware and outcome-driven, not abstract.
- If context is missing (risk tolerance, timeframe, capital, tools, location), ask briefly and state assumptions before specific guidance.
- If user asks what you would do, respond conditionally: "Given these assumptions, I would lean toward..." and include risks, alternatives, and follow-up questions.
- Never give direct prescriptive financial instructions.
- ${lightweightMode ? 'Do not ask follow-up questions for casual messages.' : (vagueMode ? 'Ask exactly 1-2 sharp clarifying questions in questions.' : 'Ask at least 1 follow-up question in questions.')}
- ${lightweightMode ? 'Keep questions and suggestedQuestions empty.' : 'Keep suggestedQuestions optional (0-2) and only when helpful.'}
- Do not include markdown fences.
- Do not include persona labels in the message.
${styleHint}
Goal context: ${activeGoal || 'not set'}
User level: ${userLevel}
Pending commitment: ${nextCommitment || 'none'}
Context: ${activeThread.title}`;

          const localizedAdvisorPrompt = `${advisorPrompt}${languageInstruction}`;

          const priorContext = priorSummaries.length
            ? `\nOther responses already given:\n${priorSummaries.map((summary) => `- ${summary}`).join('\n')}`
            : '\nNo prior responses yet.';

          const advisorUserText = `${composedUserText}\n${priorContext}`;
          let advisorPayload;
          if (preferStreaming && streamMessageId) {
            try {
              advisorPayload = await tryStreamResponse({
                history: modelHistory,
                userText: advisorUserText,
                systemPrompt: localizedAdvisorPrompt,
                signal: controller.signal,
                threadId,
                assistantId: streamMessageId,
                lightweightMode,
                forceClarifyingQuestions: vagueMode,
                attachmentParts,
              });
            } catch {
              advisorPayload = await requestNonStreaming({
                history: modelHistory,
                userText: advisorUserText,
                systemPrompt: localizedAdvisorPrompt,
                signal: controller.signal,
                lightweightMode,
                forceClarifyingQuestions: vagueMode,
                attachmentParts,
              });
            }
          } else {
            advisorPayload = await requestNonStreaming({
              history: modelHistory,
              userText: advisorUserText,
              systemPrompt: localizedAdvisorPrompt,
              signal: controller.signal,
              lightweightMode,
              forceClarifyingQuestions: vagueMode,
              attachmentParts,
            });
          }

          if (generationRef.current.interrupted) return null;
          const normalized = normalizePayloadForAdvisor(advisorPayload);
          priorSummaries.push((normalized.bursts || []).join(' '));
          return normalized;
        };

        const responsePlan = responderIds.map((advisorId) => ({ advisorId }));
        if (!responsePlan.length) throw new Error('No responder selected for group response.');

        const leadAdvisorId = responsePlan[0]?.advisorId || activeThread?.groupMeta?.intentRouter?.order?.[0] || advisorPool[0] || null;
        const secondaryAdvisorIds = responsePlan.slice(1).map((item) => item.advisorId);
        const shouldEmitSynthesis = mentionAll && responsePlan.length > 1;

        const appendAdvisorMessage = (advisorId, payload, messageIdSuffix = '') => {
          const assistantMessage = {
            id: `assistant-${Date.now()}${messageIdSuffix ? `-${messageIdSuffix}` : ''}`,
            role: 'assistant',
            status: 'done',
            content: payload,
            timestamp: new Date().toISOString(),
            authorAdvisorId: advisorId,
            mentorRecommendation: pickMentorRecommendationForGroup({
              thread: activeThread,
              payload,
              userText: composedUserText,
              advisorId,
            }),
          };

          setChatHistories((prev) => ({
            ...prev,
            [threadId]: [...(prev[threadId] || []), assistantMessage],
          }));

          const preview = payload.bursts?.[0] || payload.insight || 'Response received.';
          updateThreadFromAssistantMessage(threadId, preview, assistantMessage.timestamp, { authorAdvisorId: advisorId });
        };
        const emitLeadSynthesis = async () => {
          if (!shouldEmitSynthesis || !leadAdvisorId || generationRef.current.interrupted) return;

          const leadAdvisor = HISTORICAL_FIGURES.find((advisor) => advisor.id === leadAdvisorId);
          const synthesisSystemPrompt = `${leadAdvisor?.prompt || 'You are a lead mentor.'}
You are the lead mentor coordinating multiple specialist perspectives.
Return ONLY valid JSON with this shape:
{
  "bursts": ["short synthesis", "short directive"],
  "insight": "diagnosis summary",
  "depthCard": {"title":"Execution Plan", "points":["Action: ...", "Metric: ...", "By: ..."]},
  "questions": ["one forcing question"],
  "suggestedQuestions": []
}
Rules:
- Do not add generic motivation.
- Convert discussion into one executable plan.
- Keep concise and outcome-first.`;

          const synthesisUserText = [
            `User objective: ${activeThread?.groupMeta?.intentRouter?.intent || composedUserText}`,
            `Domain: ${inferDomainFromText(composedUserText)}`,
            'Specialist summaries:',
            ...priorSummaries.map((summary) => `- ${summary}`),
          ].join('\n');

          let synthesisPayload;
          try {
            synthesisPayload = await requestNonStreaming({
              history: modelHistory,
              userText: synthesisUserText,
              systemPrompt: synthesisSystemPrompt,
              signal: controller.signal,
              lightweightMode: false,
              forceClarifyingQuestions: false,
              attachmentParts: [],
            });
          } catch {
            synthesisPayload = {
              bursts: ['Here is the combined view: stop drifting and run one explicit test this cycle.'],
              insight: 'Your next step is execution quality, not more abstraction.',
              depthCard: {
                title: 'Execution Plan',
                points: [
                  'Action: Run one test setup for the next 5 sessions with fixed rules.',
                  'Metric: Track win rate, expectancy, and max drawdown for the test window.',
                  'By: Submit results after 7 days.',
                ],
              },
              questions: ['Will you commit to this exact plan?'],
              suggestedQuestions: [],
            };
          }

          const synthesisMessage = {
            id: `assistant-synthesis-${Date.now()}`,
            role: 'assistant',
            status: 'done',
            content: synthesisPayload,
            timestamp: new Date().toISOString(),
            authorAdvisorId: leadAdvisorId,
            readBy: [],
          };

          setChatHistories((prev) => ({
            ...prev,
            [threadId]: [...(prev[threadId] || []), synthesisMessage],
          }));
          updateThreadFromAssistantMessage(threadId, synthesisPayload.bursts?.[0] || synthesisPayload.insight || 'Execution plan prepared.', synthesisMessage.timestamp, { authorAdvisorId: leadAdvisorId });
        };

        const runLeadFirstGroupFlow = async () => {
          if (!leadAdvisorId) {
            setTypingThreadId((current) => (current === threadId ? null : current));
            clearGenerationState();
            return;
          }

          const leadStreamMessageId = `assistant-${Date.now()}-lead-stream`;
          setChatHistories((prev) => ({
            ...prev,
            [threadId]: [
              ...(prev[threadId] || []),
              {
                id: leadStreamMessageId,
                role: 'assistant',
                status: 'streaming',
                content: EMPTY_ASSISTANT_CONTENT,
                timestamp: new Date().toISOString(),
                authorAdvisorId: leadAdvisorId,
                readBy: [],
              },
            ],
          }));

          const leadPayload = await generatePayloadForAdvisor(leadAdvisorId, {
            preferStreaming: true,
            streamMessageId: leadStreamMessageId,
          });
          if (generationRef.current.interrupted) return;

          if (leadPayload) {
            updateAssistantMessage(threadId, leadStreamMessageId, (current) => ({
              ...current,
              status: 'done',
              content: leadPayload,
              authorAdvisorId: leadAdvisorId,
              mentorRecommendation: pickMentorRecommendationForGroup({
                thread: activeThread,
                payload: leadPayload,
                userText: composedUserText,
                advisorId: leadAdvisorId,
              }),
            }));
            const preview = leadPayload.bursts?.[0] || leadPayload.insight || 'Response received.';
            updateThreadFromAssistantMessage(threadId, preview, new Date().toISOString(), { authorAdvisorId: leadAdvisorId });
          } else {
            setChatHistories((prev) => ({
              ...prev,
              [threadId]: (prev[threadId] || []).filter((msg) => msg.id !== leadStreamMessageId),
            }));
          }

          for (let idx = 0; idx < secondaryAdvisorIds.length; idx += 1) {
            if (generationRef.current.interrupted) break;
            const advisorId = secondaryAdvisorIds[idx];
            
            // Background fetch for responsiveness
            const payload = await generatePayloadForAdvisor(advisorId);
            if (!payload) continue;
            appendAdvisorMessage(advisorId, payload, `secondary-${idx}`);

            const delay = getDelayForOrdinal(idx + 2);
            if (delay > 0) {
              await waitForRetry(Math.min(delay, 120), controller.signal);
            }
          }

          if (!generationRef.current.interrupted && shouldEmitSynthesis) {
            await emitLeadSynthesis();
          }

          setTypingThreadId((current) => (current === threadId ? null : current));
          clearGenerationState();
        };

        await runLeadFirstGroupFlow();
        return;
      }

      let payload;
      let usedStreaming = false;
      try {
        payload = await tryStreamResponse({
          history: modelHistory,
          userText: composedUserText,
          systemPrompt,
          signal: controller.signal,
          threadId,
          assistantId,
          lightweightMode,
          forceClarifyingQuestions: vagueMode,
          attachmentParts,
        });
        usedStreaming = true;
      } catch {
        payload = await requestNonStreaming({
          history: modelHistory,
          userText: composedUserText,
          systemPrompt,
          signal: controller.signal,
          lightweightMode,
          forceClarifyingQuestions: vagueMode,
          attachmentParts,
        });
      }

      if (generationRef.current.interrupted) return;

      const inferredAdvisorId = activeThread.isGroup
        ? inferAdvisorFromPayload(payload, activeThread.advisorIds || [])
        : null;
      const resolvedAdvisorId = inferredAdvisorId || mentionedAdvisorId || null;

      if (resolvedAdvisorId) {
        updateAssistantMessage(threadId, assistantId, (current) => ({
          ...current,
          authorAdvisorId: resolvedAdvisorId,
        }));
      }

      if (usedStreaming) {
        updateAssistantMessage(threadId, assistantId, (current) => ({
          ...current,
          status: 'done',
          content: payload,
        }));
        setTypingThreadId((current) => (current === threadId ? null : current));
        clearGenerationState();
      } else {
        progressiveReveal(threadId, assistantId, payload);
      }

      const preview = payload.bursts?.[0] || payload.insight || 'Response received.';
      updateThreadFromAssistantMessage(threadId, preview, new Date().toISOString(), { authorAdvisorId: resolvedAdvisorId });
    } catch (err) {
      if (err?.name === 'AbortError') {
        const stillSameGeneration = generationRef.current.threadId === threadId;
        const backgroundInterrupted = !appStateRef.current.isActive;

        if (!stillSameGeneration) return;

        if (backgroundInterrupted && resumeRetryCount < 1) {
          const threadSnapshot = threadsRef.current.find((thread) => thread.id === threadId);
          if (threadSnapshot) {
            void pushUnreadNotification(threadSnapshot, 'Response paused while app was in background.', {
              authorAdvisorId: mentionedAdvisorId || advisorPool[0] || null,
              notificationBody: 'Open Camer to auto-resume this reply.',
            });
          }

          if (assistantPlaceholder) {
            updateAssistantMessage(threadId, assistantId, {
              status: 'pending',
              authorAdvisorId: null,
              retrySourceText: composedUserText,
              retryAttachmentPayloads: outgoingAttachments,
              content: {
                ...EMPTY_ASSISTANT_CONTENT,
                bursts: ['Resuming once the app is active...'],
              },
            });
          }

          setTypingThreadId((current) => (current === threadId ? null : current));
          clearGenerationState();

          const scheduleResumeRetry = () => {
            if (!appStateRef.current.isActive) {
              const waitId = setTimeout(scheduleResumeRetry, 650);
              generationRef.current.revealInterval = waitId;
              return;
            }

            void handleSendMessage(null, composedUserText, {
              suppressUserMessage: true,
              removeFailedMessageId: assistantPlaceholder ? assistantId : null,
              forceMentionAdvisorId: mentionedAdvisorId || null,
              attachmentPayloads: outgoingAttachments,
              resumeRetryCount: resumeRetryCount + 1,
            });
          };

          const retryTimeoutId = setTimeout(scheduleResumeRetry, 500);
          generationRef.current.revealInterval = retryTimeoutId;
          return;
        }

        if (assistantPlaceholder) {
          updateAssistantMessage(threadId, assistantId, {
            status: 'failed',
            authorAdvisorId: null,
            retrySourceText: composedUserText,
            retryAttachmentPayloads: outgoingAttachments,
            content: {
              ...EMPTY_ASSISTANT_CONTENT,
              bursts: [backgroundInterrupted ? 'Generation paused while app was in background. Tap Retry to continue.' : 'Generation interrupted. Tap Retry to continue.'],
              suggestedQuestions: ['Retry now?'],
            },
          });
        } else {
          setChatHistories((prev) => ({
            ...prev,
            [threadId]: [
              ...(prev[threadId] || []),
              {
                id: `assistant-failed-${Date.now()}`,
                role: 'assistant',
                status: 'failed',
                retrySourceText: composedUserText,
                retryAttachmentPayloads: outgoingAttachments,
                content: {
                  ...EMPTY_ASSISTANT_CONTENT,
                  bursts: [backgroundInterrupted ? 'Response paused while app was in background. Tap Retry to continue.' : 'Response interrupted. Tap Retry to continue.'],
                  suggestedQuestions: ['Retry now?'],
                },
                timestamp: new Date().toISOString(),
                authorAdvisorId: mentionedAdvisorId || advisorPool[0] || null,
              },
            ],
          }));
        }

        setTypingThreadId((current) => (current === threadId ? null : current));
        clearGenerationState();
        return;
      }
      const userFacingErrorMessage = formatUserFacingAssistantError(err);
      if (assistantPlaceholder) {
        updateAssistantMessage(threadId, assistantId, {
          status: 'failed',
          authorAdvisorId: null,
          retrySourceText: composedUserText,
          retryAttachmentPayloads: outgoingAttachments,
          content: {
            ...EMPTY_ASSISTANT_CONTENT,
            bursts: [`Connection issue: ${userFacingErrorMessage}`],
            suggestedQuestions: ['Retry now?', 'Want a shorter answer style?'],
          },
        });
      } else {
        setChatHistories((prev) => ({
          ...prev,
          [threadId]: [
            ...(prev[threadId] || []),
            {
              id: `assistant-failed-${Date.now()}`,
              role: 'assistant',
              status: 'failed',
              retrySourceText: composedUserText,
              retryAttachmentPayloads: outgoingAttachments,
              content: {
                ...EMPTY_ASSISTANT_CONTENT,
                bursts: [`Connection issue: ${userFacingErrorMessage}`],
                suggestedQuestions: ['Retry now?', 'Want a shorter answer style?'],
              },
              timestamp: new Date().toISOString(),
              authorAdvisorId: mentionedAdvisorId || advisorPool[0] || null,
            },
          ],
        }));
      }
      setTypingThreadId((current) => (current === threadId ? null : current));
      clearGenerationState();
    }
  };

  const handleRetryFromFailedMessage = (failedMessage) => {
    if (!activeThread || !failedMessage) return;
    const threadHistory = chatHistories[activeThread.id] || [];
    const failedIndex = threadHistory.findIndex((msg) => msg.id === failedMessage.id);
    const fallbackUser = failedIndex > 0
      ? [...threadHistory.slice(0, failedIndex)].reverse().find((msg) => msg.role === 'user' && typeof msg.content === 'string')
      : null;

    let retryText = (failedMessage.retrySourceText || fallbackUser?.content || '').trim();
    if (!retryText) return;

    if (activeThread.isGroup && failedMessage.authorAdvisorId) {
      const mentionToken = `@${failedMessage.authorAdvisorId}`;
      const hasMention = getMentionTokens(retryText).includes(normalizeMentionKey(failedMessage.authorAdvisorId));
      if (!hasMention) retryText = `${mentionToken} ${retryText}`.trim();
    }

    void handleSendMessage(null, retryText, {
      suppressUserMessage: true,
      removeFailedMessageId: failedMessage.id,
      forceMentionAdvisorId: failedMessage.authorAdvisorId || null,
      attachmentPayloads: Array.isArray(failedMessage.retryAttachmentPayloads) ? failedMessage.retryAttachmentPayloads : [],
    });
  };
  handleSendMessageRef.current = handleSendMessage;

  useEffect(() => {
    const queued = pendingQuickReplyRef.current;
    if (!queued || !activeThread) return;
    if (queued.threadId !== activeThread.id) return;

    pendingQuickReplyRef.current = null;
    if (handleSendMessageRef.current) {
      void handleSendMessageRef.current(null, queued.text);
    }
  }, [activeThread, quickReplySignal]);

  useEffect(() => {
    if (!localStateLoaded) return () => {};

    let cancelled = false;
    const runCheckInSweep = async () => {
      if (cancelled) return;
      const now = new Date();
      const minutesNow = (now.getHours() * 60) + now.getMinutes();

      const entries = Object.entries(threadGoalPlans);
      for (const [threadId, rawPlan] of entries) {
        if (cancelled) return;
        const plan = sanitizeCoachPlan(rawPlan);
        if (!plan.enabled || !plan.goal) continue;

        if (plan.goalNeedsRefinement && !plan.lastGoalChallengeAt) {
          await emitCoachCheckIn(threadId, 'context', {
            force: true,
            trigger: 'goal_challenge',
          });
          continue;
        }

        const morningMinutes = clockTimeToMinutes(plan.morningTime, 8 * 60);
        const eveningMinutes = clockTimeToMinutes(plan.eveningTime, 21 * 60);
        const morningDue = minutesNow >= morningMinutes && minutesNow < eveningMinutes;
        const eveningDue = minutesNow >= eveningMinutes;

        if (morningDue) {
          await emitCoachCheckIn(threadId, 'morning');
        }
        if (eveningDue) {
          await emitCoachCheckIn(threadId, 'evening');
        }
      }

      await runContextTriggerSweep('inactivity');
      await runContextTriggerSweep('missed_checkin');
    };

    void runCheckInSweep();
    const intervalId = setInterval(() => {
      void runCheckInSweep();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [emitCoachCheckIn, runContextTriggerSweep, threadGoalPlans, localStateLoaded]);

  const MeshBackground = () => (
    <div className='absolute inset-0 z-0 bg-[#eaf6ff]' style={{
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(125, 211, 252, 0.42) 0px, transparent 56%),
        radial-gradient(at 100% 0%, rgba(147, 197, 253, 0.4) 0px, transparent 54%),
        radial-gradient(at 100% 100%, rgba(186, 230, 253, 0.34) 0px, transparent 58%),
        radial-gradient(at 0% 100%, rgba(191, 219, 254, 0.32) 0px, transparent 56%),
        radial-gradient(at 50% 50%, rgba(224, 242, 254, 0.58) 0px, transparent 62%)
      `,
    }} />
  );



  const AdvisorAvatar = ({ advisor, isGroup = false, size = 'w-16 h-16', showBadge = true }) => (
    <div className='relative flex-shrink-0'>
      <div className={`${size} rounded-full ${isGroup ? 'bg-slate-800' : advisor?.color || 'bg-slate-200'} flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white/50 overflow-hidden`}>
        {isGroup ? (
          <LayoutGrid size={24} />
        ) : (
          renderAdvisorAvatarNode(advisor)
        )}
      </div>
      {showBadge && !isGroup && (
        <div className='absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 border-white bg-white overflow-hidden shadow-lg flex items-center justify-center'>
          <div className='w-full h-full bg-slate-100 flex items-center justify-center text-[7px] font-black text-slate-400 uppercase tracking-tighter'>
            Prof
          </div>
        </div>
      )}
    </div>
  );

  const GroupAvatar = ({ thread, size = 'w-16 h-16' }) => {
    const image = thread?.groupMeta?.pictureUrl;
    return (
      <div className='relative flex-shrink-0'>
        <div className={`${size} rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white/50 overflow-hidden`}>
          {image ? <img src={image} alt={thread.title} className='w-full h-full object-cover' /> : <LayoutGrid size={24} />}
        </div>
      </div>
    );
  };

  const renderInboxCard = (thread, showBadge = true) => {
    const advisor = HISTORICAL_FIGURES.find((m) => m.id === thread.advisorIds[0]);
    const isSelected = selectedThreadIds.includes(thread.id);
    return (
      <div
        key={thread.id}
        onClick={() => {
          if (shouldIgnoreThreadClick()) return;
          handleThreadPress(thread);
        }}
        onTouchStart={(event) => handleThreadTouchStart(event, thread)}
        onTouchMove={handleThreadTouchMove}
        onTouchEnd={() => handleThreadTouchEnd(thread)}
        onTouchCancel={handleThreadTouchCancel}
        onMouseDown={() => startThreadLongPress(thread)}
        onMouseUp={cancelThreadLongPress}
        onMouseLeave={cancelThreadLongPress}
        className={`bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-5 flex items-center gap-5 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.14)] border hover:scale-[1.01] transition-all cursor-pointer group relative ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-sky-100'}`}
      >
        {isSelected && (
          <div className='absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center'>
            <Check size={12} strokeWidth={3} />
          </div>
        )}
        {thread.isGroup ? <GroupAvatar thread={thread} /> : <AdvisorAvatar advisor={advisor} isGroup={false} showBadge={showBadge} />}

        <div className='flex-1 min-w-0'>
          <div className='flex justify-between items-start mb-1'>
            <h3 className='font-extrabold text-slate-900 text-[18px] truncate tracking-tight pr-2'>{thread.title}</h3>
            <span className={`text-[10px] font-black whitespace-nowrap mt-1 ${thread.unread > 0 ? 'text-emerald-600' : 'text-slate-500/80'}`}>
              {thread.time}
            </span>
          </div>

          <div className='flex items-center justify-between mt-1'>
            <div className='flex items-center gap-1.5 overflow-hidden'>
              {thread.status === 'read' && <CheckCheck size={14} className='text-blue-500 flex-shrink-0' />}
              {thread.status === 'delivered' && <Check size={14} className='text-slate-300 flex-shrink-0' />}
              <p className='text-[13px] text-slate-600 truncate leading-tight font-semibold'>{thread.lastMsg}</p>
            </div>

            {thread.unread > 0 && (
              <div className='bg-emerald-500 text-white text-[10px] font-black min-w-[20px] h-[20px] flex items-center justify-center rounded-full ml-4 shadow-sm shadow-emerald-200'>
                {thread.unread}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getVisibleThreads = () => {
    const queryKey = normalizeSearchKey(searchQuery);
    const isPersonaThread = (thread) => !thread.isGroup && Boolean(thread.advisorIds?.[0]) && personaIdSet.current.has(thread.advisorIds[0]);
    const shouldUseFocusedFilter = !queryKey && filter === 'All' && mainFocusedAdvisorIds.length > 0;

    const threadMatchesQuery = (thread) => {
      if (!queryKey) return true;

      const titleKey = normalizeSearchKey(thread.title);
      if (titleKey.includes(queryKey)) return true;

      const advisorMetadata = (thread.advisorIds || [])
        .map((advisorId) => HISTORICAL_FIGURES.find((advisor) => advisor.id === advisorId))
        .filter(Boolean);

      const advisorKey = normalizeSearchKey(
        advisorMetadata
          .map((advisor) => `${advisor.name} ${advisor.role}`)
          .join(' ')
      );

      return advisorKey.includes(queryKey);
    };

    const filtered = (filter === 'All'
      ? threads.filter((thread) => threadMatchesQuery(thread))
      : threads
          .filter((thread) => {
            if (filter === 'Unread') return thread.unread > 0;
            if (filter === 'Groups') return thread.isGroup;
            return true;
          })
          .filter((thread) => threadMatchesQuery(thread))
    );

    const focusedFiltered = shouldUseFocusedFilter
      ? filtered.filter((thread) => {
          if (thread.isGroup) return true;
          if (thread.source === 'onboarding-extra') return true;
          if (!isPersonaThread(thread)) return true;
          return mainFocusedAdvisorIds.includes(thread.advisorIds[0]);
        })
      : filtered;

    return [...focusedFiltered].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  };

  const renderMain = () => (
    <div className='flex flex-col h-full min-h-0 relative overflow-hidden'>
      <div className='flex-1 overflow-y-auto px-5 space-y-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-56 relative z-10'>
        {getVisibleThreads().map((thread) => renderInboxCard(thread, filter !== 'All'))}
      </div>
    </div>
  );

  const openAdvisorThread = (advisor) => {
    const existing = threads.find((thread) => !thread.isGroup && thread.advisorIds[0] === advisor.id);
    if (existing) {
      setActiveThread(existing);
      return;
    }

    const newThread = {
      id: Date.now().toString(),
      title: advisor.name,
      isGroup: false,
      advisorIds: [advisor.id],
      lastMsg: `Session with ${advisor.name} is ready.`,
      time: 'Now',
      unread: 0,
      pinned: false,
      status: 'read',
    };

    setThreads((prev) => [newThread, ...prev]);
    setActiveThread(newThread);
  };

  const openOrCreateIndividualPerspective = async (advisorId, sourceThread = null) => {
    const advisor = HISTORICAL_FIGURES.find((item) => item.id === advisorId);
    if (!advisor) return;

    const existing = threads.find((thread) => !thread.isGroup && thread.advisorIds?.[0] === advisorId);
    if (existing) {
      setActiveThread(existing);
      return;
    }

    const sourceIntent = sourceThread?.groupMeta?.intentRouter?.intent || sourceThread?.title || 'your objective';
    const newThread = {
      id: `solo-${advisorId}-${Date.now()}`,
      title: advisor.name,
      isGroup: false,
      advisorIds: [advisorId],
      lastMsg: 'Focused 1:1 perspective ready.',
      time: 'Now',
      unread: 0,
      pinned: true,
      status: 'read',
      sourceGroupId: sourceThread?.id || null,
    };

    const starterMessage = {
      id: `assistant-solo-${advisorId}-${Date.now()}`,
      role: 'assistant',
      status: 'done',
      content: {
        bursts: [`Let's go deep on ${sourceIntent}. What specific constraint should we solve first?`],
        insight: '',
        depthCard: null,
        questions: [],
        suggestedQuestions: [],
      },
      timestamp: new Date().toISOString(),
      authorAdvisorId: advisorId,
      readBy: [],
    };

    setThreads((prev) => [newThread, ...prev]);
    setChatHistories((prev) => ({
      ...prev,
      [newThread.id]: [...(prev[newThread.id] || []), starterMessage],
    }));
    setActiveThread(newThread);
    await Haptics.impact({ style: ImpactStyle.Light });
  };

  const resolveCommunityRecommendations = () => {
    const selectedIntentText = communitySelectedIntent && communitySelectedIntent !== 'Custom intent'
      ? communitySelectedIntent
      : '';
    const activeIntent = `${communityIntent} ${selectedIntentText}`.toLowerCase().trim();
    const industry = communityIndustryTag.toLowerCase();
    const risk = Number(communityRiskLevel);
    const horizon = communityTimeHorizon;
    const shouldUseAdaptiveTriage = communityTriageMode === 'hybrid';

    const scoreById = new Map();
    const whyById = new Map();

    const applyScore = (advisorId, points, why) => {
      if (!advisorId) return;
      scoreById.set(advisorId, (scoreById.get(advisorId) || 0) + points);
      if (why && !whyById.has(advisorId)) whyById.set(advisorId, why);
    };

    COMMUNITY_ROUTING_RULES.forEach((rule) => {
      const matched = rule.keywords.some((keyword) => activeIntent.includes(keyword));
      if (!matched) return;
      rule.advisorIds.forEach((advisorId) => applyScore(advisorId, rule.score, rule.why));
    });

    if (activeIntent) {
      HISTORICAL_FIGURES.forEach((advisor) => {
        const expertiseScore = scoreAdvisorTopicExpertise(activeIntent, advisor);
        if (!expertiseScore) return;
        const intentBonus = Math.min(22, expertiseScore * 4);
        applyScore(advisor.id, intentBonus, `Directly relevant to intent: ${activeIntent.slice(0, 42)}${activeIntent.length > 42 ? '...' : ''}`);
      });

      Object.entries(communityAiIntentBoostById).forEach(([advisorId, boost]) => {
        applyScore(advisorId, Number(boost) || 0, 'AI-ranked relevance for custom intent details.');
      });
    }

    if (industry !== 'general' && COMMUNITY_DOMAIN_ROUTING[industry]) {
      COMMUNITY_DOMAIN_ROUTING[industry].forEach((advisorId) => applyScore(advisorId, 12, `Aligned with ${industry} domain.`));
    }

    if (risk >= 70) {
      ['ptj', 'seykota', 'livermore', 'minervini', 'druckenmiller'].forEach((advisorId) => applyScore(advisorId, 7, 'Higher-risk posture and opportunistic execution.'));
    } else if (risk <= 35) {
      ['buffett', 'munger', 'graham', 'marks', 'dalio'].forEach((advisorId) => applyScore(advisorId, 7, 'Capital-preserving and downside-aware framework.'));
    }

    if (horizon === 'short') {
      ['seykota', 'ptj', 'livermore', 'minervini', 'rcameron'].forEach((advisorId) => applyScore(advisorId, 6, 'Short-horizon tactics and timing orientation.'));
    }

    if (horizon === 'long') {
      ['buffett', 'graham', 'porter', 'dalio', 'pknight'].forEach((advisorId) => applyScore(advisorId, 6, 'Long-horizon compounding and strategic durability.'));
    }

    if (shouldUseAdaptiveTriage) {
      if (communityExecutionMode === 'team') {
        ['dalio', 'horowitz', 'oprah', 'branson'].forEach((advisorId) => applyScore(advisorId, 5, 'Optimized for team-led execution and coordination.'));
      }

      if (communitySpeedPreference === 'speed') {
        ['garyv', 'hormozi', 'ptj', 'rcameron'].forEach((advisorId) => applyScore(advisorId, 5, 'Bias toward rapid action and faster iteration.'));
      }

      if (communityCapitalBand === 'low') {
        ['hormozi', 'garyv', 'ravikant', 'barnum'].forEach((advisorId) => applyScore(advisorId, 4, 'Works well under constrained capital conditions.'));
      }

      if (communityCapitalBand === 'high') {
        ['jpmorgan', 'ackman', 'loeb', 'paulson', 'icahn'].forEach((advisorId) => applyScore(advisorId, 4, 'Experienced in large-capital strategic deployment.'));
      }

      if (communityStage === 'early') {
        ['jobs', 'saltman', 'pcollison', 'chesky'].forEach((advisorId) => applyScore(advisorId, 4, 'Strong at early-stage exploration and fit discovery.'));
      }

      if (communityStage === 'growth') {
        ['hormozi', 'garyv', 'porter', 'daymond'].forEach((advisorId) => applyScore(advisorId, 4, 'Strong at scaling channels, systems, and growth engines.'));
      }

      if (communityStage === 'turnaround') {
        ['icahn', 'loeb', 'marks', 'singer', 'peltz'].forEach((advisorId) => applyScore(advisorId, 4, 'Strong in turnarounds, restructuring, and hard pivots.'));
      }
    }

    if (!activeIntent) return [];

    return HISTORICAL_FIGURES
      .map((advisor) => {
        const rawScore = scoreById.get(advisor.id) || 0;
        if (rawScore <= 0) return null;
        const relevance = Math.min(98, 60 + rawScore);
        return {
          advisor,
          relevance,
          why: whyById.get(advisor.id) || 'Matched by decision intent and operating style.',
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8);
  };

  const recommendedAdvisors = resolveCommunityRecommendations();
  const decisionMapNodes = recommendedAdvisors.slice(0, 3);
  const recommendationByAdvisorId = new Map(recommendedAdvisors.map((item) => [item.advisor.id, item]));
  const communityPersonaSearchKey = normalizeSearchKey(communityPersonaSearch);
  const communityPersonaSearchTokens = communityPersonaSearchKey.split(/\s+/).filter(Boolean);
  const communityBrowsePersonas = HISTORICAL_FIGURES
    .filter((advisor) => {
      if (!communityPersonaSearchKey) return true;
      const corpus = normalizeSearchKey(`${advisor.name} ${advisor.role} ${advisor.prompt}`);
      if (corpus.includes(communityPersonaSearchKey)) return true;
      return communityPersonaSearchTokens.every((token) => corpus.includes(token));
    })
    .map((advisor) => {
      const recommendation = recommendationByAdvisorId.get(advisor.id) || null;
      return {
        advisor,
        relevance: recommendation?.relevance || 0,
        why: recommendation?.why || '',
      };
    })
    .sort((a, b) => b.relevance - a.relevance || a.advisor.name.localeCompare(b.advisor.name));

  const renderCommunities = () => (
    <div className='flex flex-col h-full min-h-0 relative overflow-hidden'>
      <div className='flex-1 overflow-y-auto px-5 space-y-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-56 relative z-10'>
        {communityShowIntentControls && (
          <div className='bg-white/95 backdrop-blur-sm rounded-[1.8rem] p-4 border border-sky-100 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.14)] space-y-3'>
            <p className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>Filter by intent</p>
            <div className='bg-white/88 backdrop-blur-md border border-sky-100 shadow-sm flex items-center px-4 py-3 rounded-2xl'>
              <Search size={17} strokeWidth={2} className='text-slate-400 mr-3' />
              <input
                type='text'
                value={communityIntent}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCommunityIntent(nextValue);
                  if (nextValue.trim()) {
                    setCommunitySelectedIntent('Custom intent');
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const intent = String(communityIntent || '').trim();
                  if (!intent) return;
                  setCommunitySelectedIntent('Custom intent');
                  void suggestCommunityMentorsFromIntent(intent);
                }}
                placeholder='Type a custom intent (e.g. trading entries, close enterprise deals)'
                className='bg-transparent border-none outline-none text-[13px] w-full text-slate-900 placeholder:text-slate-500 font-semibold'
              />
            </div>
            {communityIntentSuggesting && (
              <p className='text-[10px] font-black uppercase tracking-widest text-sky-700'>Analyzing intent and ranking best mentors...</p>
            )}
            <div className='flex flex-wrap gap-2'>
              {COMMUNITY_INTENT_OPTIONS.map((option) => {
                const active = communitySelectedIntent === option;
                return (
                  <button
                    key={`intent-chip-${option}`}
                    type='button'
                    onClick={() => {
                      setCommunitySelectedIntent(option);
                      if (option === 'Custom intent') {
                        setCommunityIntent('');
                        return;
                      }
                      setCommunityIntent(option);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className='space-y-3'>
          {communityBrowsePersonas.map(({ advisor, relevance }) => (
            <button
              key={`mentor-list-${advisor.id}`}
              type='button'
              onClick={() => openAdvisorThread(advisor)}
              className='w-full text-left bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-5 flex items-center gap-5 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.14)] border border-sky-100 hover:scale-[1.01] transition-all'
            >
              <AdvisorAvatar advisor={advisor} isGroup={false} showBadge={false} />
              <div className='flex-1 min-w-0'>
                <h3 className='font-extrabold text-slate-900 text-[17px] truncate tracking-tight'>{advisor.name}</h3>
                <p className='text-[12px] text-slate-600 truncate font-semibold mt-0.5'>{advisor.role}</p>
                {relevance > 0 && <p className='text-[10px] font-black text-sky-700 mt-1 uppercase tracking-wide'>Intent match {relevance}%</p>}
              </div>
              <PlusCircle size={20} className='text-slate-300 flex-shrink-0' />
            </button>
          ))}
        </div>
      </div>

      {communityShowAllPersonas && (
        <div className='fixed inset-0 z-[76] bg-[#eaf6ff] overflow-hidden'>
          <div className='h-full flex flex-col'>
            <div className='px-5 pt-10 pb-4 bg-[#eaf6ff]/95 backdrop-blur-sm border-b border-sky-100 space-y-3'>
              <div className='flex items-center justify-between'>
                <p className='text-lg font-extrabold text-slate-900 tracking-tight'>All Personas</p>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => setCommunityBrowseFilterOpen((prev) => !prev)}
                    className='text-[11px] font-black px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-700'
                  >
                    Filter
                  </button>
                  <button type='button' onClick={() => setCommunityShowAllPersonas(false)} className='text-slate-500 hover:text-slate-800'>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className='bg-white/88 backdrop-blur-md border border-sky-100 shadow-sm flex items-center px-4 py-3 rounded-2xl'>
                <Search size={17} strokeWidth={2} className='text-slate-400 mr-3' />
                <input
                  type='text'
                  value={communityPersonaSearch}
                  onChange={(event) => setCommunityPersonaSearch(event.target.value)}
                  placeholder='Search personas'
                  className='bg-transparent border-none outline-none text-[14px] w-full text-slate-900 placeholder:text-slate-500 font-semibold'
                />
              </div>
              {communityBrowseFilterOpen && (
                <div className='rounded-2xl border border-sky-100 bg-white p-3 grid grid-cols-2 gap-2'>
                  <select value={communitySelectedIntent} onChange={(event) => setCommunitySelectedIntent(event.target.value)} className='rounded-xl border border-slate-200 px-2.5 py-2 text-[12px] font-semibold text-slate-700 bg-white'>
                    {COMMUNITY_INTENT_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}
                  </select>
                  <select value={communityIndustryTag} onChange={(event) => setCommunityIndustryTag(event.target.value)} className='rounded-xl border border-slate-200 px-2.5 py-2 text-[12px] font-semibold text-slate-700 bg-white'>
                    {COMMUNITY_DOMAIN_OPTIONS.map((tag) => (<option key={tag} value={tag}>{tag.replace('-', ' ')}</option>))}
                  </select>
                  <select value={communityTimeHorizon} onChange={(event) => setCommunityTimeHorizon(event.target.value)} className='rounded-xl border border-slate-200 px-2.5 py-2 text-[12px] font-semibold text-slate-700 bg-white'>
                    <option value='short'>Short horizon</option>
                    <option value='mid'>Mid horizon</option>
                    <option value='long'>Long horizon</option>
                  </select>
                  <select value={communityStage} onChange={(event) => setCommunityStage(event.target.value)} className='rounded-xl border border-slate-200 px-2.5 py-2 text-[12px] font-semibold text-slate-700 bg-white'>
                    <option value='unspecified'>Any stage</option>
                    <option value='early'>Early stage</option>
                    <option value='growth'>Growth stage</option>
                    <option value='turnaround'>Turnaround</option>
                  </select>
                </div>
              )}
            </div>

            <div className='flex-1 overflow-y-auto px-5 py-4 space-y-4'>
              {communityBrowsePersonas.map(({ advisor, relevance, why }) => (
                <button
                  key={`browse-${advisor.id}`}
                  type='button'
                  onClick={() => {
                    openAdvisorThread(advisor);
                    setCommunityShowAllPersonas(false);
                  }}
                  className='w-full text-left bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-5 flex items-center gap-5 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.14)] border border-sky-100 hover:scale-[1.01] transition-all'
                >
                  <AdvisorAvatar advisor={advisor} isGroup={false} showBadge={false} />
                  <div className='flex-1 min-w-0'>
                    <h3 className='font-extrabold text-slate-900 text-[17px] truncate tracking-tight'>{advisor.name}</h3>
                    <p className='text-[12px] text-slate-600 truncate font-semibold mt-0.5'>{advisor.role}</p>
                    {relevance > 0 && <p className='text-[11px] font-black text-sky-700 mt-1'>Match {relevance}%</p>}
                    {why && <p className='text-[11px] text-slate-500 leading-relaxed mt-1 line-clamp-2'>Why: {why}</p>}
                  </div>
                  <PlusCircle size={20} className='text-slate-300 flex-shrink-0' />
                </button>
              ))}
              {communityBrowsePersonas.length === 0 && (
                <div className='bg-white rounded-2xl border border-slate-200 px-4 py-3'>
                  <p className='text-[12px] text-slate-500 font-semibold'>No personas match your filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {communityShowDecisionMap && recommendedAdvisors.length > 0 && (
        <div className='fixed inset-0 z-[75] bg-slate-900/40 backdrop-blur-[2px] p-4 flex items-center justify-center' onClick={() => setCommunityShowDecisionMap(false)}>
          <div className='w-full md:max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 space-y-4' onClick={(event) => event.stopPropagation()}>
            <div className='flex items-center justify-between'>
              <p className='text-[11px] font-black uppercase tracking-widest text-slate-500'>Decision Map</p>
              <button type='button' onClick={() => setCommunityShowDecisionMap(false)} className='text-slate-400 hover:text-slate-700'>
                <X size={16} />
              </button>
            </div>

            <div className='rounded-2xl border border-slate-200 p-4 bg-slate-50/60'>
              <p className='text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2'>Goal Node</p>
              <p className='text-[13px] font-bold text-slate-800'>{communityIntent || (communitySelectedIntent !== 'Custom intent' ? communitySelectedIntent : '') || 'Define intent to route advisors'}</p>
            </div>

            <div className='space-y-2'>
              {['Capital', 'Risk', 'Strategy'].map((branch, idx) => {
                const node = decisionMapNodes[idx] || decisionMapNodes[decisionMapNodes.length - 1];
                if (!node) return null;
                return (
                  <button
                    key={branch}
                    type='button'
                    onClick={() => openAdvisorThread(node.advisor)}
                    className='w-full text-left rounded-2xl border border-slate-200 px-3 py-2 bg-white hover:bg-slate-50'
                  >
                    <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>{branch}</p>
                    <p className='text-[13px] font-bold text-slate-800 mt-1'>{node.advisor.name}</p>
                    <p className='text-[11px] text-slate-600 mt-0.5'>{node.advisor.role}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAssistantMessage = (msg, options = {}) => {
    const { isGroupChat = false, authorAdvisor = null, showHeader = true } = options;
    const content = typeof msg.content === 'object' && msg.content ? msg.content : buildPayloadFromText(String(msg.content || ''));
    const hintContext = getThreadHintContext(activeThread?.id);
    return (
      <div className='space-y-2 max-w-[92%]'>
        {isGroupChat && authorAdvisor && showHeader && (
          <div className='flex items-center gap-2'>
            <div className={`w-7 h-7 rounded-full ${authorAdvisor.color || 'bg-slate-700'} text-white text-[9px] font-black flex items-center justify-center overflow-hidden`}>
              {renderAdvisorAvatarNode(authorAdvisor)}
            </div>
            <p className='text-[10px] font-black uppercase tracking-widest text-slate-500'>{authorAdvisor.name}</p>
          </div>
        )}
        {msg.replyTo?.preview && (
          <div className='bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] text-indigo-700 font-semibold'>
            Replying to {msg.replyTo.role === 'user' ? 'you' : (msg.replyTo.authorName || 'advisor')}: {msg.replyTo.preview}
          </div>
        )}
        {(content.bursts || []).map((burst, burstIdx) => (
          <div key={`${msg.id}-burst-${burstIdx}`} className='bg-white text-slate-700 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm px-4 py-3'>
            <p className='text-[14px] leading-relaxed'>{burst}</p>
          </div>
        ))}

        {content.insight && (
          <div className='bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3'>
            <p className='text-[13px] leading-relaxed font-semibold text-slate-700'>{content.insight}</p>
          </div>
        )}

        {content.depthCard && <DepthCard card={content.depthCard} />}

        {(content.questions || []).length > 0 && (
          <div className='flex flex-col gap-2 pt-1'>
            <div className='flex items-center gap-1.5 px-1'>
              <HelpCircle size={13} className='text-blue-600 flex-shrink-0' />
              <p className='text-[10px] font-black italic uppercase tracking-widest text-blue-700'>To better guide you</p>
              <button
                type='button'
                onClick={() => setRevealedStrategicHintsByMessage((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                className='ml-auto text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700'
              >
                {revealedStrategicHintsByMessage[msg.id] ? 'Hide help' : 'Need help?'}
              </button>
            </div>
            <div className='flex flex-wrap gap-2'>
            {content.questions.map((question, questionIdx) => (
              <div
                key={`${msg.id}-q-${questionIdx}`}
                className='px-3.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl text-[12px] leading-[1.4] font-bold italic text-left normal-case whitespace-normal max-w-full shadow-sm'
              >
                <p>{toSentenceCase(question)}</p>
                {revealedStrategicHintsByMessage[msg.id] && getStrategicQuestionHint(question, hintContext) && (
                  <p className='mt-1 text-[10px] font-semibold not-italic text-slate-500'>
                    {getStrategicQuestionHint(question, hintContext)}
                  </p>
                )}
              </div>
            ))}
            </div>
          </div>
        )}

        {(content.suggestedQuestions || []).length > 0 && (
          <div className='flex flex-col gap-2 pt-1'>
            <div className='flex items-center gap-1.5 px-1'>
              <Lightbulb size={13} className='text-emerald-600 flex-shrink-0' />
              <p className='text-[10px] font-black italic uppercase tracking-widest text-emerald-700'>Start here</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {content.suggestedQuestions.map((question, questionIdx) => (
                <button
                  key={`${msg.id}-sq-${questionIdx}`}
                  type='button'
                  onClick={(event) => {
                    if (msg.status === 'failed' && /retry/i.test(question)) {
                      event.preventDefault();
                      handleRetryFromFailedMessage(msg);
                      return;
                    }
                    handleSendMessage(event, question);
                  }}
                  className='px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-[12px] leading-[1.4] font-bold italic text-left normal-case whitespace-normal hover:bg-emerald-600 hover:text-white transition-all max-w-full shadow-sm'
                >
                  {toSentenceCase(question)}
                </button>
              ))}
            </div>
          </div>
        )}

        {msg.status === 'streaming' && <p className='text-[10px] font-black uppercase tracking-wider text-slate-400 px-1'>Thinking...</p>}
        {msg.status === 'interrupted' && <p className='text-[10px] font-black uppercase tracking-wider text-amber-600 px-1'>Interrupted</p>}
        {msg.status === 'failed' && <p className='text-[10px] font-black uppercase tracking-wider text-rose-600 px-1'>Connection issue</p>}
      </div>
    );
  };

  const renderChat = () => {
    const history = (chatHistories[activeThread.id] || []).filter((msg) => !isLegacyGateArtifactMessage(msg));
    const isGroupChat = Boolean(activeThread?.isGroup);
    const hintContext = getThreadHintContext(activeThread?.id);

    return (
      <div className='flex flex-col h-full min-h-0 bg-transparent relative overflow-hidden'>
        {renderChatHeader()}
        <div className='flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pt-32 pb-[calc(10rem+env(safe-area-inset-bottom))] relative z-10 bg-transparent overscroll-contain'>
          {history.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isSelected = selectedMessageIds.includes(msg.id);
            const isSwiping = swipingMessageId === msg.id;
            const previous = idx > 0 ? history[idx - 1] : null;
            const showDateSeparator = !previous || !datesMatch(previous.timestamp, msg.timestamp);
            const dateLabel = formatChatDate(msg.timestamp || new Date().toISOString());
            const groupAdvisorId = isGroupChat && !isUser
              ? (msg.authorAdvisorId || null)
              : null;
            const groupAdvisor = groupAdvisorId
              ? HISTORICAL_FIGURES.find((advisor) => advisor.id === groupAdvisorId)
              : null;
            const showAdvisorHeader = isGroupChat && !isUser && Boolean(groupAdvisor) && (
              !previous || previous.role !== 'assistant' || previous.authorAdvisorId !== msg.authorAdvisorId
            );

            return (
              <div key={msg.id || idx}>
                {showDateSeparator && (
                  <div className='flex justify-center'>
                    <span className='px-3 py-1 rounded-full bg-white/90 border border-slate-200 text-[10px] font-bold text-slate-500'>
                      {dateLabel}
                    </span>
                  </div>
                )}

                <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className='relative'>
                  {!isUser && isSwiping && swipeOffset > 20 && (
                    <div className='absolute -left-8 top-1/2 -translate-y-1/2 text-indigo-500'>
                      <Reply size={16} />
                    </div>
                  )}

                  <div>
                    {isUser ? (
                      <div
                        className={`p-4 rounded-[1.8rem] shadow-sm max-w-[85%] relative bg-slate-900 text-white rounded-tr-none border transition-transform duration-75 ${isSelected ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-slate-800'}`}
                        style={{ transform: `translateX(${isSwiping ? swipeOffset : 0}px)` }}
                        onTouchStart={(event) => {
                          handleMessageTouchStart(event, msg, msg.id);
                          startMessageLongPress(msg, msg.content);
                        }}
                        onTouchMove={handleMessageTouchMove}
                        onTouchEnd={() => {
                          cancelMessageLongPress();
                          handleMessageTouchEnd(msg, { swipeKey: msg.id, previewOverride: msg.content });
                        }}
                        onTouchCancel={() => {
                          cancelMessageLongPress();
                          handleMessageTouchEnd(msg, { swipeKey: msg.id, previewOverride: msg.content });
                        }}
                        onMouseDown={() => startMessageLongPress(msg, msg.content)}
                        onMouseMove={cancelMessageLongPress}
                        onMouseUp={cancelMessageLongPress}
                        onMouseLeave={cancelMessageLongPress}
                        onClick={() => {
                          if (selectedMessageIds.length > 0) toggleMessageSelection(msg.id);
                        }}
                      >
                        {msg.replyTo?.preview && (
                          <div className='mb-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-[11px]'>
                            Replying: {msg.replyTo.preview}
                          </div>
                        )}
                        {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                          <div className='mb-2 flex flex-wrap gap-1.5'>
                            {msg.attachments.map((att) => (
                              <button
                                key={`${msg.id}-${att.id || att.name}`}
                                type='button'
                                onClick={() => openAttachmentPreview(att)}
                                className='rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/20 transition-colors'
                                title={`Preview ${att.name}`}
                              >
                                {att.name} {att.size ? `(${bytesToReadable(att.size)})` : ''}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className='text-[14px] leading-relaxed whitespace-pre-wrap'>{msg.content}</p>
                        <div className='flex items-center justify-end gap-1 mt-2 opacity-50'>
                          {msg.editedAt && <span className='text-[9px] font-bold'>edited</span>}
                          <span className='text-[9px] font-bold'>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <CheckCheck size={12} className='text-blue-500' />
                        </div>
                      </div>
                    ) : (
                      <div className={`${isSelected ? 'ring-2 ring-indigo-200 rounded-2xl' : ''}`}>
                        <div className='space-y-2 max-w-[92%]'>
                          {isGroupChat && groupAdvisor && showAdvisorHeader && (
                            <div className='flex items-center gap-2'>
                              <div className={`w-7 h-7 rounded-full ${groupAdvisor.color || 'bg-slate-700'} text-white text-[9px] font-black flex items-center justify-center overflow-hidden`}>
                                {renderAdvisorAvatarNode(groupAdvisor)}
                              </div>
                              <p className='text-[10px] font-black uppercase tracking-widest text-slate-500'>{groupAdvisor.name}</p>
                            </div>
                          )}
                          {msg.replyTo?.preview && (
                            <div className='bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] text-indigo-700 font-semibold'>
                              Replying to {msg.replyTo.role === 'user' ? 'you' : (msg.replyTo.authorName || 'advisor')}: {msg.replyTo.preview}
                            </div>
                          )}
                          {((typeof msg.content === 'object' && msg.content ? msg.content : buildPayloadFromText(String(msg.content || ''))).bursts || []).map((burst, burstIdx) => {
                            const swipeKey = `${msg.id}-burst-${burstIdx}`;
                            const isBurstSwiping = swipingMessageId === swipeKey;
                            return (
                              <div
                                key={swipeKey}
                                className='bg-white text-slate-700 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm px-4 py-3 transition-transform duration-75'
                                style={{ transform: `translateX(${isBurstSwiping ? swipeOffset : 0}px)` }}
                                onTouchStart={(event) => {
                                  handleMessageTouchStart(event, msg, swipeKey);
                                  startMessageLongPress(msg, burst);
                                }}
                                onTouchMove={handleMessageTouchMove}
                                onTouchEnd={() => {
                                  cancelMessageLongPress();
                                  handleMessageTouchEnd(msg, { swipeKey, previewOverride: burst });
                                }}
                                onTouchCancel={() => {
                                  cancelMessageLongPress();
                                  handleMessageTouchEnd(msg, { swipeKey, previewOverride: burst });
                                }}
                                onMouseDown={() => startMessageLongPress(msg, burst)}
                                onMouseMove={cancelMessageLongPress}
                                onMouseUp={cancelMessageLongPress}
                                onMouseLeave={cancelMessageLongPress}
                                onClick={() => {
                                  if (selectedMessageIds.length > 0) toggleMessageSelection(msg.id);
                                }}
                              >
                                <p className='text-[14px] leading-relaxed'>{burst}</p>
                              </div>
                            );
                          })}
                          {(() => {
                            const content = typeof msg.content === 'object' && msg.content ? msg.content : buildPayloadFromText(String(msg.content || ''));
                            return (
                              <>
                                {content.insight && (
                                  <div className='bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3'>
                                    <p className='text-[13px] leading-relaxed font-semibold text-slate-700'>{content.insight}</p>
                                  </div>
                                )}
                                {content.depthCard && <DepthCard card={content.depthCard} />}
                                {(content.questions || []).length > 0 && (
                                  <div className='flex flex-col gap-2 pt-1'>
                                    <div className='flex items-center gap-1.5 px-1'>
                                      <HelpCircle size={13} className='text-blue-600 flex-shrink-0' />
                                      <p className='text-[10px] font-black italic uppercase tracking-widest text-blue-700'>To better guide you</p>
                                      <button
                                        type='button'
                                        onClick={() => setRevealedStrategicHintsByMessage((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                        className='ml-auto text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700'
                                      >
                                        {revealedStrategicHintsByMessage[msg.id] ? 'Hide help' : 'Need help?'}
                                      </button>
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                      {content.questions.map((question, questionIdx) => {
                                        const questionKey = `${msg.id}-question-${questionIdx}`;
                                        const isQuestionSwiping = swipingMessageId === questionKey;
                                        return (
                                          <div
                                            key={questionKey}
                                            className='px-3.5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl text-[12px] leading-[1.4] font-bold italic text-left normal-case whitespace-normal max-w-full transition-transform duration-75 shadow-sm'
                                            style={{ transform: `translateX(${isQuestionSwiping ? swipeOffset : 0}px)` }}
                                            onTouchStart={(event) => {
                                              handleMessageTouchStart(event, msg, questionKey);
                                              startMessageLongPress(msg, question);
                                            }}
                                            onTouchMove={handleMessageTouchMove}
                                            onTouchEnd={() => {
                                              cancelMessageLongPress();
                                              handleMessageTouchEnd(msg, { swipeKey: questionKey, previewOverride: question });
                                            }}
                                            onTouchCancel={() => {
                                              cancelMessageLongPress();
                                              handleMessageTouchEnd(msg, { swipeKey: questionKey, previewOverride: question });
                                            }}
                                            onMouseDown={() => startMessageLongPress(msg, question)}
                                            onMouseMove={cancelMessageLongPress}
                                            onMouseUp={cancelMessageLongPress}
                                            onMouseLeave={cancelMessageLongPress}
                                          >
                                            <p>{toSentenceCase(question)}</p>
                                            {revealedStrategicHintsByMessage[msg.id] && getStrategicQuestionHint(question, hintContext) && (
                                              <p className='mt-1 text-[10px] font-semibold not-italic text-slate-500'>
                                                {getStrategicQuestionHint(question, hintContext)}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {(content.suggestedQuestions || []).length > 0 && (
                                  <div className='flex flex-col gap-2 pt-1'>
                                    <div className='flex items-center gap-1.5 px-1'>
                                      <Lightbulb size={13} className='text-emerald-600 flex-shrink-0' />
                                      <p className='text-[10px] font-black italic uppercase tracking-widest text-emerald-700'>Start here</p>
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                      {content.suggestedQuestions.map((question, questionIdx) => (
                                        <button
                                          key={`${msg.id}-suggested-q-${questionIdx}`}
                                          type='button'
                                          onClick={(event) => {
                                            if (msg.status === 'failed' && /retry/i.test(question)) {
                                              event.preventDefault();
                                              handleRetryFromFailedMessage(msg);
                                              return;
                                            }
                                            handleSendMessage(event, question);
                                          }}
                                          className='px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-[12px] leading-[1.4] font-bold italic text-left normal-case whitespace-normal hover:bg-emerald-600 hover:text-white transition-all max-w-full shadow-sm'
                                        >
                                          {toSentenceCase(question)}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {msg.mentorRecommendation && activeThread?.isGroup && (
                                  <div className='rounded-2xl border border-indigo-200 bg-indigo-50/80 px-3 py-2 mt-1'>
                                    <p className='text-[11px] font-bold text-indigo-800'>{msg.mentorRecommendation.reason}</p>
                                    <p className='text-[10px] text-indigo-600 mt-1'>
                                      Confidence {msg.mentorRecommendation.scores?.confidence ?? 0}% · Context {msg.mentorRecommendation.scores?.context ?? 0}% · Self-awareness {msg.mentorRecommendation.scores?.selfAwareness ?? 0}%
                                    </p>
                                    <div className='flex items-center gap-2 mt-2'>
                                      <button
                                        type='button'
                                        onClick={() => { void addMentorToActiveGroup(msg.mentorRecommendation.advisorId); }}
                                        className='px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-indigo-700 transition-colors'
                                      >
                                        {t('addToGroup')}
                                      </button>
                                      <button
                                        type='button'
                                        onClick={() => {
                                          setActiveThread(null);
                                          setActiveTab('communities');
                                          setCommunityShowAllPersonas(true);
                                        }}
                                        className='px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wide hover:bg-indigo-100 transition-colors'
                                      >
                                        {t('browseMore')}
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {isGroupChat && groupAdvisor && msg.role === 'assistant' && msg.status !== 'streaming' && (
                                  <button
                                    type='button'
                                    onClick={() => { void openOrCreateIndividualPerspective(groupAdvisor.id, activeThread); }}
                                    className='text-[11px] font-black text-indigo-600 hover:text-indigo-700 px-1 pt-1'
                                  >
                                    Go deeper with {groupAdvisor.name} →
                                  </button>
                                )}
                                {msg.status === 'streaming' && <p className='text-[10px] font-black uppercase tracking-wider text-slate-400 px-1'>Thinking...</p>}
                                {msg.status === 'interrupted' && <p className='text-[10px] font-black uppercase tracking-wider text-amber-600 px-1'>Interrupted</p>}
                                {msg.status === 'failed' && <p className='text-[10px] font-black uppercase tracking-wider text-rose-600 px-1'>Connection issue</p>}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            );
          })}

          {isTyping && (
            <div className='flex justify-start'>
              <div className='bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1 items-center'>
                <div className='w-1 h-1 bg-slate-400 rounded-full animate-bounce' />
                <div className='w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]' />
                <div className='w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]' />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        {renderChatFooter()}
      </div>
    );
  };

  const renderChatHeader = () => {
    if (!activeThread) return null;
    const mainAdvisor = HISTORICAL_FIGURES.find((m) => m.id === activeThread.advisorIds[0]);
    const groupImage = activeThread.groupMeta?.pictureUrl;
    return (
      <header className='fixed top-0 inset-x-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md px-4 pt-12 pb-5 bg-[#eaf6ff]/75 backdrop-blur-sm flex items-center gap-4 z-50 border-b border-sky-100/50 shadow-sm'>
        <button type='button' onClick={() => setActiveThread(null)} className='p-1 text-slate-500 hover:text-slate-800 transition-colors'>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <div className={`w-10 h-10 rounded-full ${activeThread.isGroup ? 'bg-slate-800' : mainAdvisor?.color || 'bg-slate-200'} flex items-center justify-center text-white font-bold text-[10px] overflow-hidden`}>
          {activeThread.isGroup && groupImage ? (
            <img src={groupImage} alt={activeThread.title} className='w-full h-full object-cover' />
          ) : activeThread.isGroup ? (
            <LayoutGrid size={16} />
          ) : (
            renderAdvisorAvatarNode(mainAdvisor)
          )}
        </div>
        <button
          type='button'
          onClick={() => {
            if (activeThread.isGroup) openGroupBuilderForThread(activeThread);
          }}
          className='flex-1 min-w-0 text-left'
        >
          <h3 className='font-bold text-slate-900 truncate text-sm tracking-tight'>{activeThread.title}</h3>
          <p className='text-[9px] font-black text-green-600 uppercase tracking-widest mt-0.5'>
            {activeThread.isGroup ? 'Tap To Edit Group • Online' : 'Secure Feed • Online'}
          </p>
        </button>
        <button type='button' onClick={() => setIsChatSettingsOpen(true)} className='p-1 text-slate-400 hover:text-slate-700 transition-colors'>
          <MoreVertical size={20} strokeWidth={2} />
        </button>
      </header>
    );
  };

  const renderChatFooter = () => {
    if (!activeThread) return null;
    return (
      <div
        className='fixed bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md bg-[#eaf6ff]/85 backdrop-blur-md z-50 border-t border-sky-100/50 flex flex-col px-4 shadow-lg'
        style={{
          paddingTop: '10px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          minHeight: '70px',
        }}
      >
        {(replyTarget || editingMessageId) && (
          <div className='mb-2 rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-[10px] font-black uppercase tracking-widest text-sky-700'>
                {editingMessageId ? 'Editing Message' : `Replying to ${replyTarget?.role === 'user' ? 'you' : (replyTarget?.authorName || 'advisor')}`}
              </p>
              {!editingMessageId && <p className='text-[12px] text-slate-600 truncate'>{replyTarget?.preview}</p>}
            </div>
            <button
              type='button'
              onClick={() => {
                setReplyTarget(null);
                setEditingMessageId(null);
                setCurrentInputText('');
              }}
              className='text-slate-400 hover:text-slate-700 transition-colors'
            >
              <X size={16} />
            </button>
          </div>
        )}
        {activeThread.isGroup && selectedMentionedAdvisors.length > 0 && (
          <div className='mb-2 flex flex-wrap gap-2'>
            {selectedMentionedAdvisors.map((advisor) => (
              <div key={`selected-mention-${advisor.id}`} className='inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/95 px-3 py-1.5 shadow-sm'>
                <span className='text-[11px] font-black text-indigo-700'>@{advisor.name}</span>
                <button
                  type='button'
                  onClick={() => dismissMention(advisor)}
                  className='text-indigo-400 hover:text-indigo-700'
                  title={`Remove ${advisor.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {activeThread.isGroup && mentionQuery !== null && mentionCandidates.length > 0 && (
          <div className='mb-2 rounded-2xl border border-sky-100 bg-white/95 shadow-md overflow-hidden'>
            {mentionCandidates.slice(0, 5).map((advisor) => (
              <button
                key={`mention-${advisor.id}`}
                type='button'
                onClick={() => insertMention(advisor)}
                className='w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-sky-50'
              >
                <div className={`w-8 h-8 rounded-full ${advisor.color} flex items-center justify-center text-white text-[10px] font-bold overflow-hidden`}>
                  {renderAdvisorAvatarNode(advisor)}
                </div>
                <div className='min-w-0'>
                  <p className='text-sm font-bold text-slate-800 truncate'>{advisor.name}</p>
                  <p className='text-[11px] text-slate-500 truncate'>{advisor.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {composerAttachments.length > 0 && (
          <div className='mb-2 flex flex-wrap gap-2'>
            {composerAttachments.map((att) => (
              <div
                key={att.id}
                onClick={() => openAttachmentPreview(att)}
                className='inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/95 px-3 py-1.5 shadow-sm max-w-full hover:border-sky-300 transition-colors cursor-pointer'
                title={`Preview ${att.name}`}
                role='button'
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openAttachmentPreview(att);
                  }
                }}
              >
                <span className='text-[10px] font-semibold text-slate-700 truncate max-w-[160px]'>
                  {att.name} ({bytesToReadable(att.size)})
                </span>
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    removeComposerAttachment(att.id);
                  }}
                  className='text-slate-400 hover:text-slate-700'
                  title={`Remove ${att.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {recordingState.active && (
          <div className='mb-2 rounded-2xl border border-rose-100 bg-white/95 px-3 py-2 flex items-center gap-2 shadow-sm'>
            <div className='w-2 h-2 rounded-full bg-rose-500 animate-pulse' />
            <span className='text-[11px] font-black tracking-wide text-rose-700'>
              {recordingState.paused ? 'Paused' : 'Recording'} {formatRecordingTime(recordingState.elapsedMs)}
            </span>
            <div className='ml-auto flex items-center gap-2'>
              <button
                type='button'
                onClick={() => { void handleTogglePauseRecording(); }}
                className='px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors'
              >
                {recordingState.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type='button'
                onClick={() => { void handleCancelRecording(); }}
                className='px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => { void handleSaveRecording(); }}
                className='px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors'
              >
                Save
              </button>
            </div>
          </div>
        )}
        <div className='mb-2 flex justify-end'>
          <div className='inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/95 px-3 py-1.5 shadow-sm'>
            <Globe size={12} className='text-slate-500' />
            <select
              value={appLanguage}
              onChange={(event) => setAppLanguage(event.target.value)}
              className='bg-transparent text-[10px] font-black uppercase tracking-wide text-slate-700 outline-none'
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <form onSubmit={handleSendMessage} className='flex items-center gap-2'>
          <input
            ref={attachmentInputRef}
            type='file'
            accept={ATTACHMENT_ACCEPT_ATTR}
            multiple
            onChange={handleAttachmentSelect}
            className='hidden'
          />
          <button type='button' onClick={openAttachmentPicker} className='w-9 h-9 rounded-full flex items-center justify-center text-sky-400 hover:text-sky-600 hover:bg-sky-50/60 transition-all flex-shrink-0 active:scale-95' title={t('attach')}>
            <Paperclip size={19} strokeWidth={2} />
          </button>
          <div className='flex-1 bg-white/95 border border-sky-100 flex items-center px-4 py-3 rounded-[1.5rem] shadow-sm hover:border-sky-200 hover:shadow-md transition-all focus-within:border-sky-300 focus-within:shadow-md'>
            <input type='text' value={currentInputText} onChange={(e) => setCurrentInputText(e.target.value)} placeholder={t('compose')} className='flex-1 bg-transparent border-none outline-none text-[13px] text-slate-800 placeholder:text-slate-400 font-medium' />
          </div>
          <button
            type='button'
            onClick={() => { void handleStartAudioRecording(); }}
            disabled={recordingState.active || composerAttachments.length >= MAX_ATTACHMENT_COUNT}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-95 ${recordingState.active || composerAttachments.length >= MAX_ATTACHMENT_COUNT ? 'text-slate-300 cursor-not-allowed' : 'text-sky-400 hover:text-sky-600 hover:bg-sky-50/60'}`}
            title={composerAttachments.length >= MAX_ATTACHMENT_COUNT ? `Attachment limit reached (${MAX_ATTACHMENT_COUNT})` : t('recordVoice')}
          >
            <Mic size={19} strokeWidth={2} />
          </button>
          {isTyping ? (
            <button type='button' onClick={interruptGeneration} className='w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all bg-rose-500 hover:bg-rose-600 active:scale-95 flex-shrink-0 text-white' title='Interrupt response'>
              <Square size={15} className='text-white fill-white' />
            </button>
          ) : (
            <button type='submit' disabled={recordingState.active || (!currentInputText.trim() && composerAttachments.length === 0)} className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all flex-shrink-0 active:scale-95 font-bold ${(currentInputText.trim() || composerAttachments.length > 0) && !recordingState.active ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
              <Send size={17} strokeWidth={2.5} />
            </button>
          )}
        </form>
      </div>
    );
  };

  const renderAttachmentPreviewModal = () => {
    if (!isPreviewOpen || !previewAttachment) return null;

    const previewSrc = getAttachmentPreviewSrc(previewAttachment);
    const mimeType = String(previewAttachment.mimeType || '').toLowerCase();
    const isImage = mimeType.startsWith('image/');
    const isAudio = mimeType.startsWith('audio/');

    return (
      <div className='fixed inset-0 z-[95] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4' onClick={closeAttachmentPreview}>
        <div className='w-full max-w-md rounded-[2rem] border border-sky-100 bg-white shadow-xl overflow-hidden' onClick={(event) => event.stopPropagation()}>
          <div className='px-4 py-3 border-b border-sky-100 flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Attachment Preview</p>
              <p className='text-[13px] font-bold text-slate-800 truncate'>{previewAttachment.name}</p>
            </div>
            <button type='button' onClick={closeAttachmentPreview} className='text-slate-400 hover:text-slate-700 transition-colors'>
              <X size={18} />
            </button>
          </div>
          <div className='p-4 space-y-3'>
            {isImage && previewSrc && (
              <img src={previewSrc} alt={previewAttachment.name || 'Attachment preview'} className='w-full max-h-[55vh] object-contain rounded-xl bg-slate-50' />
            )}
            {isAudio && previewSrc && (
              <div className='rounded-xl border border-sky-100 bg-sky-50/50 p-3'>
                <audio controls src={previewSrc} className='w-full' />
              </div>
            )}
            {!isImage && !isAudio && (
              <div className='rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2'>
                <p className='text-[11px] font-bold text-slate-700'>{previewAttachment.mimeType || 'File attachment'}</p>
                {previewAttachment.textExcerpt ? (
                  <p className='text-[12px] text-slate-600 whitespace-pre-wrap max-h-[40vh] overflow-y-auto'>{previewAttachment.textExcerpt}</p>
                ) : (
                  <p className='text-[12px] text-slate-500'>Preview is not available for this file type, but it will still be included in advisor context.</p>
                )}
              </div>
            )}
            <p className='text-[10px] font-bold text-slate-500'>Size: {bytesToReadable(previewAttachment.size)}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderIntentOnboarding = () => {
    if (!showIntentOnboarding) return null;

    if (onboardingMentorPickerOpen && onboardingMatchPreview) {
      return (
        <div className='fixed inset-0 z-[90] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-20 flex items-center justify-center'>
          <div
            className='absolute inset-0 pointer-events-none'
            style={{
              background: `
                linear-gradient(135deg, #eaf6ff 0%, #dff4ff 32%, #eef9ff 60%, #f8fdff 100%),
                radial-gradient(at 8% 0%, rgba(125, 211, 252, 0.38) 0px, transparent 54%),
                radial-gradient(at 100% 15%, rgba(56, 189, 248, 0.24) 0px, transparent 56%),
                radial-gradient(at 90% 100%, rgba(59, 130, 246, 0.2) 0px, transparent 56%)
              `,
            }}
          />
          <div className='relative w-full max-w-md rounded-[2.2rem] border border-sky-100 bg-white/82 backdrop-blur-xl shadow-[0_20px_40px_-14px_rgba(15,23,42,0.28)] p-5 space-y-3'>
            <div className='flex items-center justify-between gap-2'>
              <button
                type='button'
                onClick={() => setOnboardingMentorPickerOpen(false)}
                className='w-8 h-8 rounded-full border border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-50 flex items-center justify-center'
                title='Back'
              >
                <ChevronLeft size={16} />
              </button>
              <p className='text-[10px] font-black uppercase tracking-[0.24em] text-slate-500'>{t('chooseMore')}</p>
              <span className='w-8 h-8' />
            </div>

            <p className='text-[12px] text-slate-600 font-semibold'>
              Selected base mentors: {onboardingMatchPreview.mentors.map((item) => item.advisor.name).join(', ')}
            </p>

            <div className='rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2'>
              <Search size={14} className='text-slate-400' />
              <input
                type='text'
                value={onboardingMentorSearch}
                onChange={(event) => setOnboardingMentorSearch(event.target.value)}
                placeholder={t('searchMentors')}
                className='w-full bg-transparent border-none outline-none text-[12px] text-slate-700 placeholder:text-slate-400 font-semibold'
                autoFocus
              />
            </div>

            <div className='max-h-56 overflow-y-auto space-y-2 pr-1'>
              {HISTORICAL_FIGURES
                .filter((advisor) => {
                  const baseIds = onboardingMatchPreview.mentors.map((item) => item.advisor.id);
                  if (baseIds.includes(advisor.id)) return false;
                  const q = normalizeSearchKey(onboardingMentorSearch);
                  if (!q) return true;
                  return normalizeSearchKey(`${advisor.name} ${advisor.role}`).includes(q);
                })
                .slice(0, 24)
                .map((advisor) => {
                  const selected = onboardingExtraMentorIds.includes(advisor.id);
                  const disabled = !selected && onboardingExtraMentorIds.length >= 2;
                  return (
                    <button
                      key={`onboard-pick-${advisor.id}`}
                      type='button'
                      onClick={() => !disabled && toggleOnboardingExtraMentor(advisor.id)}
                      className={`w-full text-left rounded-2xl border px-3 py-2 flex items-center gap-3 transition-colors ${selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-sky-300'}`}
                    >
                      <div className={`w-9 h-9 rounded-full ${advisor.color} overflow-hidden flex items-center justify-center text-white text-[10px] font-black`}>
                        {renderAdvisorAvatarNode(advisor)}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-[12px] font-black text-slate-800 truncate'>{advisor.name}</p>
                        <p className='text-[11px] text-slate-500 truncate'>{advisor.role}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent'}`}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className='flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500'>
              <span>Selected extras: {onboardingExtraMentorIds.length}/2</span>
              <button
                type='button'
                onClick={() => {
                  setOnboardingExtraMentorIds([]);
                  void handleStartConversationFromPreview();
                }}
                className='text-slate-600 hover:text-slate-800'
              >
                {t('skip')}
              </button>
            </div>

            <button
              type='button'
              onClick={() => { void handleStartConversationFromPreview(); }}
              className='w-full rounded-xl px-4 py-2.5 text-[12px] font-black uppercase tracking-wide transition-colors bg-slate-900 text-white hover:bg-slate-800'
            >
              {t('continue')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className='fixed inset-0 z-[90] px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-20 flex items-center justify-center'>
        <div
          className='absolute inset-0 pointer-events-none'
          style={{
            background: `
              linear-gradient(135deg, #eaf6ff 0%, #dff4ff 32%, #eef9ff 60%, #f8fdff 100%),
              radial-gradient(at 8% 0%, rgba(125, 211, 252, 0.38) 0px, transparent 54%),
              radial-gradient(at 100% 15%, rgba(56, 189, 248, 0.24) 0px, transparent 56%),
              radial-gradient(at 90% 100%, rgba(59, 130, 246, 0.2) 0px, transparent 56%)
            `,
          }}
        />
        <div className='relative w-full max-w-md rounded-[2.2rem] border border-sky-100 bg-white/82 backdrop-blur-xl shadow-[0_20px_40px_-14px_rgba(15,23,42,0.28)] p-5 space-y-4'>
          <p className='text-[10px] font-black uppercase tracking-[0.24em] text-slate-500'>Start with a decision</p>
          <h2 className='text-[22px] leading-tight font-black text-slate-900'>What are you trying to do?</h2>
          <div className='rounded-2xl border border-sky-200 bg-white/90 px-4 py-3 shadow-sm'>
            <input
              type='text'
              value={onboardingIntentInput}
              onChange={(event) => {
                setOnboardingIntentInput(event.target.value);
                if (onboardingMatchPreview?.intent) setOnboardingMatchPreview(null);
                if (onboardingMentorPickerOpen) setOnboardingMentorPickerOpen(false);
                if (onboardingExtraMentorIds.length) setOnboardingExtraMentorIds([]);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!onboardingMatchPreview?.intent) {
                    void handleIntentSubmit();
                    return;
                  }

                  openOnboardingMentorPicker();
                }
              }}
              placeholder='Example: I need to close more deals this month'
              className='w-full bg-transparent border-none outline-none text-[14px] text-slate-800 placeholder:text-slate-400 font-semibold'
              autoFocus
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            {onboardingIntentSuggestions.slice(0, 5).map((chip) => (
              <button
                key={chip}
                type='button'
                onClick={() => {
                  setOnboardingIntentInput(chip);
                }}
                className='px-3 py-1.5 rounded-full bg-white border border-sky-100 text-[11px] font-black text-slate-700 uppercase tracking-wide hover:border-sky-300 hover:bg-sky-50 transition-colors'
              >
                {chip}
              </button>
            ))}
          </div>

          {onboardingMatchPreview && (
            <div className='rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3 space-y-2'>
              <p className='text-[10px] font-black uppercase tracking-widest text-indigo-700'>Best minds for this</p>
              {onboardingMatchPreview.mentors.map((item) => (
                <div key={`onboard-${item.advisor.id}`} className='rounded-xl bg-white/85 border border-indigo-100 px-3 py-2'>
                  <p className='text-[12px] font-black text-slate-800'>{item.advisor.name}</p>
                  <p className='text-[11px] text-slate-600'>{item.reason}</p>
                </div>
              ))}
              <p className='text-[11px] text-indigo-700 font-semibold'>What do you think?</p>
            </div>
          )}

          <div className='flex items-center gap-2 pt-1'>
            <button
              type='button'
              onClick={() => {
                if (onboardingMatchPreview?.intent) {
                  openOnboardingMentorPicker();
                  return;
                }
                void handleIntentSubmit();
              }}
              disabled={!onboardingIntentInput.trim() && !onboardingMatchPreview?.intent}
              className={`flex-1 rounded-xl px-4 py-2.5 text-[12px] font-black uppercase tracking-wide transition-colors ${(onboardingIntentInput.trim() || onboardingMatchPreview?.intent) ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              {onboardingMatchPreview?.intent ? t('continue') : 'Find best minds'}
            </button>
            <button
              type='button'
              onClick={() => setHasSeenOnboarding(true)}
              className='rounded-xl px-4 py-2.5 text-[12px] font-black uppercase tracking-wide border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors'
            >
              {t('skip')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHomeHeader = (title) => (
    <header className='fixed top-0 inset-x-0 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md px-5 pt-12 pb-6 z-50 space-y-6 bg-[#eaf6ff]/80 backdrop-blur-sm'>
      <div className='bg-white/88 backdrop-blur-md border border-sky-100 shadow-sm flex items-center px-4 py-3 rounded-2xl'>
        <Search size={18} strokeWidth={2} className='text-slate-400 mr-3' />
        <input
          type='text'
          value={activeTab === 'communities' ? communityPersonaSearch : searchQuery}
          onChange={(e) => {
            if (activeTab === 'communities') {
              setCommunityPersonaSearch(e.target.value);
              return;
            }
            setSearchQuery(e.target.value);
          }}
          placeholder={activeTab === 'communities' ? ' Search mentors by name, role, or expertise ' : ' What are you working on? '}
          className='bg-transparent border-none outline-none text-[14px] w-full text-slate-900 placeholder:text-slate-500 font-semibold'
        />
      </div>
      <div className='flex items-center justify-between px-1'>
        <h1 className='text-xl font-extrabold text-slate-900 tracking-tight'>{title}</h1>
        {activeTab === 'communities' && (
          <button
            type='button'
            onClick={() => setCommunityShowIntentControls((prev) => !prev)}
            className='text-[11px] font-black px-3.5 py-2 rounded-full transition-all bg-white/90 border border-sky-100 text-slate-700 hover:bg-white'
          >
            Filter
          </button>
        )}
        {activeTab === 'main' && (
          <div className='flex items-center gap-1 rounded-full bg-white/85 border border-sky-100 p-1 shadow-sm'>
            {['All', 'Unread', 'Groups'].map((tag) => (
              <button key={tag} type='button' onClick={() => setFilter(tag)} className={`text-[11px] font-black px-3.5 py-1.5 rounded-full transition-all ${filter === tag ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-600 hover:bg-white'}`}>
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );

  const currentTabIconStyle = (id) => (activeTab === id ? 'text-slate-900' : 'text-slate-400');

  const triggerFooterHaptic = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const handleFooterTabPress = (tab) => {
    void triggerFooterHaptic();
    setActiveTab(tab);

    if (tab !== 'explore') {
      setIsExplorePanelOpen(false);
    }

    if (tab === 'main' || tab === 'communities') {
      setFilter('All');
      setSearchQuery('');
      if (tab === 'communities') {
        setCommunityIntent('');
        setCommunitySelectedIntent('Custom intent');
      }
      return;
    }

    if (tab === 'explore') {
      setSearchQuery('');
    }
  };

  const selectedThreads = threads.filter((thread) => selectedThreadIds.includes(thread.id));
  const selectedAreAllPinned = selectedThreads.length > 0 && selectedThreads.every((thread) => thread.pinned);

  return (
    <div className='flex justify-center bg-[#e9f4ff] h-[100dvh] w-screen overflow-hidden font-sans antialiased text-slate-900'>
      <div className='w-full md:max-w-md bg-white h-[100dvh] md:shadow-2xl flex flex-col overflow-hidden md:border-x md:border-slate-200 relative'>
        
        <div className='absolute inset-0 z-0 bg-[#eaf6ff]' style={{
          backgroundImage: `
            radial-gradient(at 0% 0%, rgba(125, 211, 252, 0.42) 0px, transparent 56%),
            radial-gradient(at 100% 0%, rgba(147, 197, 253, 0.4) 0px, transparent 54%),
            radial-gradient(at 100% 100%, rgba(186, 230, 253, 0.34) 0px, transparent 58%),
            radial-gradient(at 0% 100%, rgba(191, 219, 254, 0.32) 0px, transparent 56%),
            radial-gradient(at 50% 50%, rgba(224, 242, 254, 0.58) 0px, transparent 62%)
          `,
        }} />
        
        {renderAttachmentPreviewModal()}
        {renderIntentOnboarding()}

        {!activeThread && !showIntentOnboarding && renderHomeHeader(activeTab === 'main' ? 'Mentor AI' : activeTab === 'communities' ? 'Find Mentors' : 'Strategic Hub')}

        {!activeThread && !showIntentOnboarding && !notificationPromptDismissed && notificationPermissionStatus !== 'unsupported' && (
          <div className='fixed top-28 left-0 right-0 z-[60] px-5 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md'>
            <div className='bg-white/95 backdrop-blur-sm border border-sky-100 shadow-lg rounded-2xl p-4'>
              <p className='text-[11px] font-black uppercase tracking-widest text-slate-500'>Notifications</p>
              <p className='text-[13px] text-slate-700 mt-1 leading-relaxed'>Allow alerts so Camer can notify you when new unread messages arrive while you are outside the chat.</p>
              <div className='mt-3 flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => { void requestNotificationPermission(); }}
                  className='px-3 py-2 rounded-xl bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-colors'
                >
                  Allow Notifications
                </button>
                <button
                  type='button'
                  onClick={() => setNotificationPromptDismissed(true)}
                  className='px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-[12px] font-bold hover:bg-slate-50 transition-colors'
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        <div className='flex-1 min-h-0 overflow-hidden relative z-10'>
          {activeThread ? (
            renderChat()
          ) : (
            <>
              {!showIntentOnboarding && activeTab === 'main' && renderMain()}
              {!showIntentOnboarding && activeTab === 'communities' && renderCommunities()}
              {!showIntentOnboarding && activeTab === 'explore' && (
                <div className='flex flex-col h-full min-h-0 relative overflow-hidden'>
                  <div className='flex-1 overflow-y-auto px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-56 relative z-10 space-y-6'>
                    <button
                      type='button'
                      onPointerDown={(event) => {
                        if (event.pointerType === 'mouse' && event.button !== 0) return;
                        setIsExplorePanelOpen(true);
                      }}
                      className='w-full bg-white/60 backdrop-blur-lg rounded-[2.5rem] p-8 border border-white shadow-xl text-center active:scale-[0.99] transition-transform'
                    >
                      <div className='mx-auto w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 animate-pulse'>
                        <Fingerprint size={48} className='text-indigo-500' />
                      </div>
                      <h2 className='text-xl font-bold mb-2'>Vault Access</h2>
                      <p className='text-xs text-slate-500 leading-relaxed'>Encrypted intelligence from the Board of Directors.</p>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!activeThread && !showIntentOnboarding && (
          <nav
            className='fixed bottom-0 left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md bg-white border-t border-gray-200 shadow-lg z-40'
            style={{
              paddingTop: '10px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              minHeight: '70px',
            }}
          >
            <div className='w-full flex justify-around items-center px-2'>
              <button
                type='button'
                onClick={() => handleFooterTabPress('main')}
                className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] transition-all active:scale-95 ${currentTabIconStyle('main')}`}
              >
                <Shield size={20} strokeWidth={activeTab === 'main' ? 2.5 : 2} />
                <span className='text-[9px] font-bold uppercase tracking-widest'>Main</span>
              </button>
              <button
                type='button'
                onClick={() => handleFooterTabPress('communities')}
                className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] transition-all active:scale-95 ${currentTabIconStyle('communities')}`}
              >
                <MessageSquare size={20} strokeWidth={activeTab === 'communities' ? 2.5 : 2} />
                <span className='text-[9px] font-bold uppercase tracking-widest'>Find mentors</span>
              </button>
              <button
                type='button'
                onClick={() => handleFooterTabPress('explore')}
                className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] transition-all active:scale-95 ${currentTabIconStyle('explore')}`}
              >
                <Compass size={22} strokeWidth={activeTab === 'explore' ? 2.5 : 2} />
                <span className='text-[9px] font-bold uppercase tracking-widest'>Explore</span>
              </button>
            </div>
          </nav>
        )}

        {!activeThread && selectedThreadIds.length > 0 && (
          <div
            className='fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-[2px] flex items-end md:items-center justify-center p-4'
            onClick={clearThreadSelection}
          >
            <div className='w-full md:max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 space-y-3' onClick={(event) => event.stopPropagation()}>
              <div className='flex items-center justify-between'>
                <p className='text-[11px] font-black uppercase tracking-widest text-slate-500'>
                  {selectedThreadIds.length} chat{selectedThreadIds.length > 1 ? 's' : ''} selected
                </p>
                <button type='button' onClick={clearThreadSelection} className='text-slate-400 hover:text-slate-700'>
                  <X size={16} />
                </button>
              </div>

              <button type='button' onClick={pinOrUnpinSelectedThreads} className='w-full flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50'>
                <Pin size={16} />
                {selectedAreAllPinned ? 'Unpin Chats' : 'Pin Chats'}
              </button>

              <button type='button' onClick={createGroupFromSelectedThreads} className='w-full flex items-center gap-2 rounded-2xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-3 text-sm font-bold'>
                <Users size={16} />
                Add Selected Personas To Group
              </button>

              <button type='button' onClick={deleteSelectedThreads} className='w-full flex items-center gap-2 rounded-2xl border border-rose-200 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50'>
                <Trash2 size={16} />
                Delete Chat
              </button>
            </div>
          </div>
        )}

        {activeThread && messageActionSheet && (
          <div className='fixed inset-0 z-[80] bg-slate-900/35 flex items-end md:items-center justify-center p-4' onClick={() => setMessageActionSheet(null)}>
            <div className='w-full md:max-w-xs bg-white rounded-3xl border border-slate-100 shadow-2xl p-4 space-y-2' onClick={(event) => event.stopPropagation()}>
              <button type='button' onClick={() => queueReplyForMessage(messageActionSheet.id, messageActionSheet.preview)} className='w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2'>
                <Reply size={16} /> Reply
              </button>
              <button type='button' onClick={() => copyMessageContent(messageActionSheet.id, messageActionSheet.preview)} className='w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2'>
                <Copy size={16} /> Copy
              </button>
              {messageActionSheet.role === 'user' && (
                <button type='button' onClick={() => beginEditMessage(messageActionSheet.id)} className='w-full text-left px-4 py-3 rounded-2xl hover:bg-slate-50 font-semibold text-slate-700 flex items-center gap-2'>
                  <Edit3 size={16} /> Edit
                </button>
              )}
              <button type='button' onClick={() => deleteMessageById(messageActionSheet.id)} className='w-full text-left px-4 py-3 rounded-2xl hover:bg-rose-50 font-semibold text-rose-600 flex items-center gap-2'>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        )}

        {activeThread && isChatSettingsOpen && (
          <div className='fixed inset-0 z-[85] bg-slate-900/40 backdrop-blur-[2px] flex items-end md:items-center justify-center p-4' onClick={() => setIsChatSettingsOpen(false)}>
            <div className='w-full md:max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 space-y-4' onClick={(event) => event.stopPropagation()}>
              <div className='flex items-center justify-between'>
                <p className='text-[11px] font-black uppercase tracking-widest text-slate-500'>Chat Response Settings</p>
                <button type='button' onClick={() => setIsChatSettingsOpen(false)} className='text-slate-400 hover:text-slate-700'>
                  <X size={16} />
                </button>
              </div>

              <div className='space-y-2'>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Style</p>
                <div className='grid grid-cols-2 gap-2'>
                  {RESPONSE_STYLE_OPTIONS.map((option) => {
                    const active = activeThreadResponseSettings.style === option.id;
                    return (
                      <button
                        key={`style-${option.id}`}
                        type='button'
                        onClick={() => updateActiveThreadResponseSettings({ style: option.id })}
                        className={`text-left rounded-2xl border px-3 py-2 transition-all ${active ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        <p className='text-[11px] font-black uppercase tracking-tight'>{option.label}</p>
                        <p className='text-[10px] mt-1 leading-tight opacity-80'>{option.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {!activeThread.isGroup && (
                <div className='space-y-3 border-t border-slate-100 pt-3'>
                  <div className='flex items-center justify-between'>
                    <p className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Accountability Coach</p>
                    <label className='inline-flex items-center gap-2 text-[11px] font-bold text-slate-700'>
                      <input
                        type='checkbox'
                        checked={activeThreadGoalPlan.enabled}
                        onChange={(event) => updateActiveThreadGoalPlan({ enabled: event.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>

                  <label className='block'>
                    <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Goal</span>
                    <textarea
                      value={activeThreadGoalPlan.goal}
                      onChange={(event) => updateActiveThreadGoalPlan({ goal: event.target.value })}
                      placeholder='Example: Ship one feature daily and review outcomes at night.'
                      className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 min-h-[72px]'
                    />
                  </label>

                  <div className='grid grid-cols-2 gap-2'>
                    <label className='block'>
                      <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Morning Check-In</span>
                      <input
                        type='time'
                        value={normalizeCoachTime(activeThreadGoalPlan.morningTime, COACH_DEFAULT_MORNING_TIME)}
                        onChange={(event) => updateActiveThreadGoalPlan({ morningTime: normalizeCoachTime(event.target.value, COACH_DEFAULT_MORNING_TIME) })}
                        className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300'
                      />
                    </label>
                    <label className='block'>
                      <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Evening Check-In</span>
                      <input
                        type='time'
                        value={normalizeCoachTime(activeThreadGoalPlan.eveningTime, COACH_DEFAULT_EVENING_TIME)}
                        onChange={(event) => updateActiveThreadGoalPlan({ eveningTime: normalizeCoachTime(event.target.value, COACH_DEFAULT_EVENING_TIME) })}
                        className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300'
                      />
                    </label>
                  </div>

                  <div className='rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2'>
                    <p className='text-[11px] font-semibold text-slate-700'>
                      {activeGoalCompletionPct === null
                        ? 'No tracked completion data yet. Reply to check-ins to build consistency stats.'
                        : `Consistency (last ${activeGoalRecentTracked.length} tracked days): ${activeGoalCompletionPct}%`}
                    </p>
                    <p className='text-[11px] font-semibold text-slate-700 mt-1'>
                      Reputation: {activeReputationLabel} ({activeReputationScore}%)
                    </p>
                    <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1'>
                      Escalation: {activeEscalationState.replace('_', ' ')}
                    </p>
                    {activeThreadGoalPlan.nextCommitment && (
                      <p className='text-[11px] text-slate-600 mt-1'>
                        Tomorrow commitment: {formatCommitmentText(activeThreadGoalPlan.nextCommitment) || 'Captured'}
                        {activeThreadGoalPlan.nextCommitment.status ? ` (${activeThreadGoalPlan.nextCommitment.status})` : ''}
                      </p>
                    )}
                  </div>

                  <div className='grid grid-cols-2 gap-2'>
                    <button
                      type='button'
                      onClick={() => {
                        if (!activeThreadGoalPlan.enabled || !activeThreadGoalPlan.goal.trim()) return;
                        void emitCoachCheckIn(activeThread.id, 'morning', { force: true });
                      }}
                      className='rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100 disabled:opacity-40'
                      disabled={!activeThreadGoalPlan.enabled || !activeThreadGoalPlan.goal.trim()}
                    >
                      Send Check-In Now
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        if (!activeThreadGoalPlan.enabled || !activeThreadGoalPlan.goal.trim()) return;
                        void emitCoachCheckIn(activeThread.id, 'context', {
                          force: true,
                          trigger: 'goal_challenge',
                        });
                      }}
                      className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-amber-700 hover:bg-amber-100 disabled:opacity-40'
                      disabled={!activeThreadGoalPlan.enabled || !activeThreadGoalPlan.goal.trim()}
                    >
                      Challenge Goal
                    </button>
                  </div>

                  <div className='grid grid-cols-2 gap-2'>
                    <button
                      type='button'
                      onClick={() => updateActiveThreadGoalPlan({
                        nextCommitment: activeThreadGoalPlan.nextCommitment
                          ? { ...activeThreadGoalPlan.nextCommitment, status: 'done' }
                          : null,
                      })}
                      className='rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-40'
                      disabled={!activeThreadGoalPlan.nextCommitment}
                    >
                      Mark Commitment Done
                    </button>
                    <button
                      type='button'
                      onClick={() => updateActiveThreadGoalPlan({
                        nextCommitment: activeThreadGoalPlan.nextCommitment
                          ? { ...activeThreadGoalPlan.nextCommitment, status: 'missed' }
                          : null,
                      })}
                      className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 disabled:opacity-40'
                      disabled={!activeThreadGoalPlan.nextCommitment}
                    >
                      Mark Commitment Missed
                    </button>
                  </div>

                  <div className='grid grid-cols-1 gap-2'>
                    <button
                      type='button'
                      onClick={() => updateActiveThreadGoalPlan({
                        progressLog: [],
                        nextCommitment: null,
                        pendingCoachPromptAt: '',
                        pendingCoachSlot: '',
                        lastContextCheckInAt: '',
                        escalationState: 'on_track',
                        successStreak: 0,
                        missedStreak: 0,
                        totalCheckIns: 0,
                        totalCompleted: 0,
                        reputationScore: 50,
                        reputationLabel: 'Building Consistency',
                      })}
                      className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50'
                    >
                      Clear Progress
                    </button>
                  </div>
                </div>
              )}

              {activeThread.isGroup && (
                <div className='space-y-2'>
                  <p className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Prioritize</p>
                  <button
                    type='button'
                    onClick={() => updateActiveThreadResponseSettings({ priorityAdvisorId: 'auto' })}
                    className={`w-full text-left rounded-2xl border px-3 py-2 text-sm font-semibold transition-all ${activeThreadResponseSettings.priorityAdvisorId === 'auto' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                  >
                    Auto By Expertise
                  </button>
                  <div className='space-y-2 max-h-44 overflow-y-auto pr-1'>
                    {groupAdvisors.map((advisor) => {
                      const active = activeThreadResponseSettings.priorityAdvisorId === advisor.id;
                      return (
                        <button
                          key={`prio-${advisor.id}`}
                          type='button'
                          onClick={() => updateActiveThreadResponseSettings({ priorityAdvisorId: advisor.id })}
                          className={`w-full rounded-2xl border px-3 py-2 flex items-center gap-3 transition-all ${active ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                          <div className={`w-7 h-7 rounded-full ${advisor.color} text-white text-[9px] font-black flex items-center justify-center overflow-hidden`}>
                            {renderAdvisorAvatarNode(advisor)}
                          </div>
                          <div className='text-left min-w-0'>
                            <p className='text-[12px] font-bold text-slate-800 truncate'>{advisor.name}</p>
                            <p className='text-[10px] text-slate-500 truncate'>{advisor.role}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!activeThread && !showIntentOnboarding && activeTab === 'explore' && isExplorePanelOpen && (
          <div className='fixed inset-0 z-[86] bg-slate-900/35 backdrop-blur-[2px] flex items-end md:items-center justify-center p-4' onClick={() => setIsExplorePanelOpen(false)}>
            <div className='w-full md:max-w-sm bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 space-y-4' onClick={(event) => event.stopPropagation()}>
              <div className='flex items-center justify-between'>
                <p className='text-[11px] font-black uppercase tracking-widest text-slate-500'>Vault Settings</p>
                <button type='button' onClick={() => setIsExplorePanelOpen(false)} className='text-slate-400 hover:text-slate-700'>
                  <X size={16} />
                </button>
              </div>

              <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3'>
                <p className='text-[10px] font-black uppercase tracking-widest text-emerald-700'>Subscription</p>
                <p className='text-[13px] font-bold text-emerald-800 mt-1'>Pro Board Access</p>
                <p className='text-[11px] text-emerald-700 mt-1'>Active plan with premium personas and advanced routing.</p>
              </div>

              <div className='space-y-2'>
                <button type='button' className='w-full text-left rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'>
                  Manage Subscription
                </button>
                <button type='button' className='w-full text-left rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'>
                  Billing & Invoices
                </button>
                <button type='button' className='w-full text-left rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'>
                  Notification Preferences
                </button>
                <button type='button' className='w-full text-left rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'>
                  Privacy & Security
                </button>
              </div>
            </div>
          </div>
        )}

        {isGroupBuilderOpen && (
          <div className='fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-4 pt-28 pb-28'>
            <div className='w-full md:max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl p-5 max-h-[calc(100dvh-14rem)] overflow-y-auto'>
              <div className='flex items-center justify-between mb-4'>
                <p className='text-[11px] font-black uppercase tracking-widest text-slate-500'>
                  {editingGroupThreadId ? 'Edit Group' : 'Create Group'}
                </p>
                <button type='button' onClick={closeGroupBuilder} className='text-slate-400 hover:text-slate-700'>
                  <X size={16} />
                </button>
              </div>

              <div className='space-y-3'>
                <input
                  ref={groupPictureInputRef}
                  type='file'
                  accept='image/*'
                  onChange={handleGroupPictureSelect}
                  className='hidden'
                />
                <label className='block'>
                  <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Group Picture</span>
                  <div className='mt-1 flex items-center gap-3'>
                    <div className='w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center'>
                      {groupDraft.pictureUrl ? (
                        <img src={groupDraft.pictureUrl} alt='Group' className='w-full h-full object-cover' />
                      ) : (
                        <LayoutGrid size={16} className='text-slate-400' />
                      )}
                    </div>
                    <button
                      type='button'
                      onClick={openGroupPicturePicker}
                      className='px-3 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-50'
                    >
                      Upload image
                    </button>
                  </div>
                </label>

                <label className='block'>
                  <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Group Name</span>
                  <input
                    type='text'
                    value={groupDraft.name}
                    onChange={(event) => setGroupDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder='Boardroom Alpha'
                    className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300'
                  />
                </label>

                <label className='block'>
                  <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Group Icon Label</span>
                  <input
                    type='text'
                    value={groupDraft.icon}
                    onChange={(event) => setGroupDraft((prev) => ({ ...prev, icon: event.target.value }))}
                    placeholder='LayoutGrid'
                    className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300'
                  />
                </label>

                <label className='block'>
                  <span className='text-[10px] font-black uppercase tracking-widest text-slate-500'>Description</span>
                  <textarea
                    value={groupDraft.description}
                    onChange={(event) => setGroupDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder='What this group is focused on...'
                    className='mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300 min-h-[78px]'
                  />
                </label>
              </div>

              <div className='mt-5'>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2'>Select Personas</p>
                <div className='space-y-2 max-h-52 overflow-y-auto pr-1'>
                  {HISTORICAL_FIGURES.map((advisor) => {
                    const selected = groupBuilderSelectedPersonaIds.includes(advisor.id);
                    return (
                      <button
                        key={advisor.id}
                        type='button'
                        onClick={() => toggleGroupBuilderPersona(advisor.id)}
                        className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2 ${selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                      >
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'}`}>
                          {selected && <Check size={12} className='text-white' strokeWidth={3} />}
                        </div>
                        <div className={`w-8 h-8 rounded-full ${advisor.color} flex items-center justify-center text-white text-[10px] font-bold overflow-hidden`}>
                          {renderAdvisorAvatarNode(advisor)}
                        </div>
                        <div className='text-left min-w-0 flex-1'>
                          <p className='text-sm font-bold text-slate-800 truncate'>{advisor.name}</p>
                          <p className='text-[11px] text-slate-500 truncate'>{advisor.role}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className='mt-5'>
                <p className='text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2'>Choose Co-admins</p>
                <div className='flex flex-wrap gap-2'>
                  {groupBuilderSelectedPersonaIds.map((advisorId) => {
                    const advisor = HISTORICAL_FIGURES.find((item) => item.id === advisorId);
                    if (!advisor) return null;
                    const selected = groupDraft.coAdminIds.includes(advisorId);
                    return (
                      <button
                        key={`coadmin-${advisorId}`}
                        type='button'
                        onClick={() => toggleCoAdmin(advisorId)}
                        className={`px-3 py-2 rounded-full text-[11px] font-black uppercase tracking-tight ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {advisor.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className='mt-5 space-y-2'>
                <label className='flex items-center gap-2 text-sm text-slate-700 font-semibold'>
                  <input
                    type='checkbox'
                    checked={groupDraft.inviteViaLink}
                    onChange={(event) => setGroupDraft((prev) => ({ ...prev, inviteViaLink: event.target.checked }))}
                  />
                  Invite via link after creation
                </label>
                <label className='flex items-center gap-2 text-sm text-slate-700 font-semibold'>
                  <input
                    type='checkbox'
                    checked={groupDraft.approveNewMembers}
                    onChange={(event) => setGroupDraft((prev) => ({ ...prev, approveNewMembers: event.target.checked }))}
                  />
                  Approve new members
                </label>
              </div>

              <button
                type='button'
                onClick={commitGroupCreation}
                disabled={groupBuilderSelectedPersonaIds.length < 2}
                className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-widest ${groupBuilderSelectedPersonaIds.length >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              >
                {editingGroupThreadId ? 'Save Group Changes' : 'Create Group In Main Chats'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
