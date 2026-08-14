import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  ChevronLeft,
  Send,
  CheckCheck,
  Shield,
  Users,
  Compass,
  PlusCircle,
  MoreVertical,
  Pin,
  Check,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Settings,
  Server,
  Cpu,
  RefreshCw,
  X,
  Zap,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const modelName = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash-lite";

const buildFallbackThinking = (message, choices = ["Retry Session"]) => ({
  bursts: [message],
  choices,
});

const normalizeThoughtData = (rawData) => {
  if (!rawData || typeof rawData !== "object") {
    return buildFallbackThinking("Signal degraded. Reframe and retry.");
  }

  const bursts = Array.isArray(rawData.bursts)
    ? rawData.bursts
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const choices = Array.isArray(rawData.choices)
    ? rawData.choices
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const strategy =
    rawData.strategy &&
    typeof rawData.strategy.title === "string" &&
    Array.isArray(rawData.strategy.points)
      ? {
          title: rawData.strategy.title,
          points: rawData.strategy.points
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        }
      : null;

  const snapshot =
    rawData.snapshot &&
    typeof rawData.snapshot.action === "string" &&
    typeof rawData.snapshot.risk === "string" &&
    typeof rawData.snapshot.nextStep === "string"
      ? rawData.snapshot
      : null;

  const actionCall =
    rawData.actionCall && typeof rawData.actionCall.name === "string"
      ? rawData.actionCall
      : null;

  return {
    bursts: bursts.length ? bursts : ["Signal degraded. Reframe and retry."],
    choices,
    ...(strategy ? { strategy } : {}),
    ...(snapshot ? { snapshot } : {}),
    ...(actionCall ? { actionCall } : {}),
  };
};

const HISTORICAL_FIGURES = [
  {
    id: "jobs",
    name: "Steve Jobs",
    role: "Design Visionary",
    avatar: "SJ",
    color: "bg-[#171717]",
    img: "https://i.postimg.cc/xCGdGsb8/jobs-profile.png",
    prompt:
      "You are Steve Jobs. You are intense, uncompromising, and hate mediocrity. Your goal is 'insane greatness'. Speak in short, punchy sentences. Focus on the user experience and 'saying no'.",
  },
  {
    id: "rockefeller",
    name: "John D. Rockefeller",
    role: "Monopoly Builder",
    avatar: "JR",
    color: "bg-[#0f172a]",
    img: "https://i.postimg.cc/bv5zQ7vV/rockerfeller-profile.png",
    prompt:
      "You are John D. Rockefeller. You value precision and total control. You believe the power to make money is a gift. Speak with cold, industrial authority. Minimalist and firm.",
  },
  {
    id: "carnegie",
    name: "Andrew Carnegie",
    role: "Steel King",
    avatar: "AC",
    color: "bg-[#1e293b]",
    img: "https://i.postimg.cc/bYsCJd4c/Carnegie-profile.png",
    prompt:
      "You are Andrew Carnegie. You focus on efficiency and vertical integration. You believe the man who dies rich dies disgraced. Speak like a captain of industry.",
  },
  {
    id: "simons",
    name: "Jim Simons",
    role: "Quant King",
    avatar: "JS",
    color: "bg-[#064e3b]",
    img: "",
    prompt:
      "You are Jim Simons. Focus on mathematics and pattern recognition. Cold data. No narratives. Short, precise sentences.",
  },
  {
    id: "buffett",
    name: "Warren Buffett",
    role: "Value Legend",
    avatar: "WB",
    color: "bg-[#065f46]",
    img: "",
    prompt:
      "You are Warren Buffett. Folksy but wise. Focus on moats, circle of competence, and long-term compounding.",
  },
  {
    id: "thiel",
    name: "Peter Thiel",
    role: "Contrarian",
    avatar: "PT",
    color: "bg-[#1e1b4b]",
    img: "",
    prompt:
      "You are Peter Thiel. Contrarian and aggressive. 'Competition is for losers.' Focus on monopolies and secrets. Be provocative and minimal with words.",
  },
  {
    id: "hoffman",
    name: "Reid Hoffman",
    role: "Blitzscaler",
    avatar: "RH",
    color: "bg-[#1d4ed8]",
    img: "",
    prompt:
      "You are Reid Hoffman. Prioritize speed over efficiency. Network effects. Speak with the urgency of a builder in a blitzscaling phase.",
  },
];

const StrategyBlock = ({ title, points }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="my-3 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <LayoutGrid size={14} />
          </div>
          <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={16} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-300">
          <div className="h-px bg-slate-100 mb-3" />
          {points.map((p, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed font-medium">{p}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DecisionSnapshot = ({ action, risk, next }) => (
  <div className="my-4 p-5 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-500">
    <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
      <Pin size={12} className="text-indigo-400" />
      <span className="text-[9px] font-black uppercase tracking-[0.3em]">
        Decision Snapshot
      </span>
    </div>
    <div className="space-y-4">
      <div>
        <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1 opacity-70">
          Mandate Action
        </p>
        <p className="text-[13px] font-bold text-slate-100 leading-snug">{action}</p>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1 opacity-70">
            Exposure Risk
          </p>
          <p className="text-[11px] text-slate-400 leading-snug">{risk}</p>
        </div>
        <div className="flex-1 border-l border-white/5 pl-4">
          <p className="text-[8px] font-black text-green-400 uppercase tracking-widest mb-1 opacity-70">
            Next Variable
          </p>
          <p className="text-[11px] text-slate-400 leading-snug">{next}</p>
        </div>
      </div>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState("main");
  const [activeThread, setActiveThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Settings State
  const [provider, setProvider] = useState(
    () => localStorage.getItem("incirql_provider") || "gemini"
  );
  const [localUrl, setLocalUrl] = useState(
    () => localStorage.getItem("incirql_local_url") || "http://127.0.0.1:1234/v1"
  );
  const [localModel, setLocalModel] = useState(
    () => localStorage.getItem("incirql_local_model") || "llama3"
  );
  const [activeApiKey, setActiveApiKey] = useState(
    () => localStorage.getItem("incirql_gemini_key") || apiKey
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const [threads, setThreads] = useState([
    {
      id: "1",
      title: "Steve Jobs",
      isGroup: false,
      advisorIds: ["jobs"],
      lastMsg: "Simplicity is sophistication.",
      time: "11:26 AM",
      unread: 0,
      pinned: true,
      status: "read",
    },
    {
      id: "2",
      title: "Peter Thiel",
      isGroup: false,
      advisorIds: ["thiel"],
      lastMsg: "Build a monopoly.",
      time: "9:28 AM",
      unread: 2,
      pinned: false,
      status: "delivered",
    },
    {
      id: "3",
      title: "Strategy Group",
      isGroup: true,
      advisorIds: ["carnegie", "rockefeller"],
      lastMsg: "Consolidate the market.",
      time: "8:03 AM",
      unread: 0,
      pinned: false,
      status: "read",
    },
  ]);

  const [chatHistories, setChatHistories] = useState({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistories, isTyping, activeThread]);

  const autoDetectLocalLlm = async () => {
    setIsDetecting(true);
    setConnectionStatus({ type: "info", msg: "Scanning local ports on device..." });

    const endpoints = [
      { name: "LM Playground / LM Studio (1234)", url: "http://127.0.0.1:1234/v1" },
      { name: "Ollama (11434)", url: "http://127.0.0.1:11434/v1" },
      { name: "llama.cpp / LocalAI (8080)", url: "http://127.0.0.1:8080/v1" },
      { name: "vLLM (8000)", url: "http://127.0.0.1:8000/v1" },
    ];

    let found = null;

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`${ep.url}/models`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const models = data?.data?.map((m) => m.id) || [];
          found = { ...ep, model: models[0] || "default" };
          break;
        }
      } catch {
        // Continue checking next endpoint
      }
    }

    setIsDetecting(false);
    if (found) {
      setLocalUrl(found.url);
      setLocalModel(found.model);
      setProvider("local");
      localStorage.setItem("incirql_local_url", found.url);
      localStorage.setItem("incirql_local_model", found.model);
      localStorage.setItem("incirql_provider", "local");
      setConnectionStatus({
        type: "success",
        msg: `Connected to ${found.name} [Model: ${found.model}]`,
      });
    } else {
      setConnectionStatus({
        type: "error",
        msg: "No active local LLM servers found on ports 1234, 11434, 8080, or 8000. Ensure server is running with CORS enabled.",
      });
    }
  };

  const fetchAiThinking = async (userMessage, advisor, threadTitle, history) => {
    if (!advisor?.prompt) {
      return buildFallbackThinking("Advisor link lost. Return to inbox and reopen this thread.");
    }

    const systemPrompt = `
      ${advisor.prompt}
      You are communicating through a "Thinking Interface".

      CRITICAL RULES:
      1. NEVER output a long message.
      2. Respond ONLY in valid JSON.
      3. "bursts": Array of short micro-messages (1-2 sentences each). Max 3.
      4. "strategy": Object { "title": "...", "points": ["Step 1", ...] }. Optional.
      5. "snapshot": Object { "action": "...", "risk": "...", "nextStep": "..." }. REQUIRED at the end of a core insight.
      6. "choices": Array of strings (interactive replies). Max 3.
      7. "actionCall": Optional object { "name": "create_thread" | "switch_tab", "params": { ... } } if app manipulation is needed.

      Persona Check: If you are Peter Thiel, be contrarian and blunt. If you are Steve Jobs, be uncompromising and intense.
      Context Thread: ${threadTitle}
    `;

    if (provider === "local") {
      const cleanBaseUrl = localUrl.trim().replace(/\/+$/, "");
      const targetUrl = cleanBaseUrl.endsWith("/v1")
        ? `${cleanBaseUrl}/chat/completions`
        : `${cleanBaseUrl}/v1/chat/completions`;

      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: localModel || "default",
            messages: [
              { role: "system", content: systemPrompt },
              ...history.map((msg) => ({
                role: msg.role === "user" ? "user" : "assistant",
                content:
                  typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content),
              })),
              { role: "user", content: userMessage },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          return buildFallbackThinking(
            `Local LLM server error ${response.status}. Check endpoint ${targetUrl}. ${errText.slice(0, 80)}`
          );
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) {
          return buildFallbackThinking("Local model returned empty content.");
        }

        try {
          return normalizeThoughtData(JSON.parse(rawContent));
        } catch {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return normalizeThoughtData(JSON.parse(jsonMatch[0]));
          }
          return buildFallbackThinking("Local model output was not valid JSON. Ensure system prompt JSON mode is supported.");
        }
      } catch {
        return buildFallbackThinking(
          `Failed to connect to local LLM at ${localUrl}. Ensure server is running and CORS is enabled.`
        );
      }
    }

    // Default: Gemini API
    if (!activeApiKey) {
      return buildFallbackThinking(
        "Gemini API key missing. Add key in Settings or set VITE_GEMINI_API_KEY in .env.",
        ["Retry Session"]
      );
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              ...history.map((msg) => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [
                  {
                    text:
                      typeof msg.content === "string"
                        ? msg.content
                        : JSON.stringify(msg.content),
                  },
                ],
              })),
              { role: "user", parts: [{ text: userMessage }] },
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (!response.ok) {
        let apiError = "";
        try {
          const errJson = await response.json();
          apiError = errJson?.error?.message || "";
        } catch {
          apiError = "";
        }

        return buildFallbackThinking(
          `Gemini request failed (${response.status}). ${apiError || "Check API key and network."}`
        );
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return buildFallbackThinking("Model returned empty response. Retry request.");
      }

      try {
        return normalizeThoughtData(JSON.parse(rawText));
      } catch {
        return buildFallbackThinking("Model response format invalid. Retry request.");
      }
    } catch {
      return buildFallbackThinking("Thinking feed unstable. Re-syncing...");
    }
  };

  const executeAppAction = (actionCall) => {
    if (!actionCall || !actionCall.name) return;
    if (actionCall.name === "create_thread") {
      const advId = actionCall.params?.advisorId || "jobs";
      const adv = HISTORICAL_FIGURES.find((m) => m.id === advId) || HISTORICAL_FIGURES[0];
      const newT = {
        id: Date.now().toString(),
        title: actionCall.params?.title || adv.name,
        isGroup: false,
        advisorIds: [adv.id],
        lastMsg: "New session initialized.",
        time: "Now",
        unread: 0,
        status: "read",
      };
      setThreads((prev) => [newT, ...prev]);
    } else if (actionCall.name === "switch_tab") {
      if (actionCall.params?.tab) {
        setActiveTab(actionCall.params.tab);
        setActiveThread(null);
      }
    }
  };

  const handleSendMessage = async (msgText) => {
    if (!msgText.trim() || !activeThread) return;

    const text = msgText.trim();
    const threadId = activeThread.id;
    const userMsg = { role: "user", content: text, timestamp: new Date() };

    setChatHistories((prev) => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), userMsg],
    }));
    setInputText("");
    setIsTyping(true);

    try {
      const advisor = HISTORICAL_FIGURES.find(
        (m) => m.id === activeThread.advisorIds[0]
      );
      const history = (chatHistories[threadId] || []).slice(-6);

      const thoughtData = await fetchAiThinking(
        text,
        advisor,
        activeThread.title,
        history
      );

      if (thoughtData.actionCall) {
        executeAppAction(thoughtData.actionCall);
      }

      const aiMsg = { role: "assistant", content: thoughtData, timestamp: new Date() };
      setChatHistories((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] || []), aiMsg],
      }));
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                lastMsg: thoughtData.bursts?.[0] || "Response received.",
                time: "Now",
                status: "read",
              }
            : t
        )
      );
    } catch {
      const fallback = buildFallbackThinking("Message send failed. Retry Session.");
      setChatHistories((prev) => ({
        ...prev,
        [threadId]: [...(prev[threadId] || []), { role: "assistant", content: fallback, timestamp: new Date() }],
      }));
    } finally {
      setIsTyping(false);
    }
  };

  const MeshBackground = () => (
    <div
      className="absolute inset-0 z-0 bg-[#eef7ff]"
      style={{
        backgroundImage: `
        radial-gradient(at 0% 0%, rgba(125, 211, 252, 0.36) 0px, transparent 55%),
        radial-gradient(at 100% 0%, rgba(147, 197, 253, 0.33) 0px, transparent 52%),
        radial-gradient(at 100% 100%, rgba(191, 219, 254, 0.26) 0px, transparent 56%),
        radial-gradient(at 0% 100%, rgba(186, 230, 253, 0.28) 0px, transparent 54%)
      `,
      }}
    ></div>
  );

  const SettingsModal = () => (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl border border-sky-100 space-y-5 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">LLM Settings</h2>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Cloud & On-Device Engine
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Active Intelligence Provider
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => {
                setProvider("gemini");
                localStorage.setItem("incirql_provider", "gemini");
              }}
              className={`py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
                provider === "gemini"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Zap size={14} /> Gemini Cloud
            </button>
            <button
              onClick={() => {
                setProvider("local");
                localStorage.setItem("incirql_provider", "local");
              }}
              className={`py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all ${
                provider === "local"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Cpu size={14} /> Local LLM
            </button>
          </div>
        </div>

        {provider === "local" ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-indigo-50/80 border border-indigo-100 p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-800">Auto-Detect Local LLM</p>
                <p className="text-[9px] text-slate-500">Scans LM Playground (1234), Ollama (11434)...</p>
              </div>
              <button
                onClick={autoDetectLocalLlm}
                disabled={isDetecting}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-100 disabled:opacity-50 transition-all"
              >
                <RefreshCw size={13} className={isDetecting ? "animate-spin" : ""} />
                {isDetecting ? "Scanning..." : "Detect"}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Local Server Base URL
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl">
                <Server size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={localUrl}
                  onChange={(e) => {
                    setLocalUrl(e.target.value);
                    localStorage.setItem("incirql_local_url", e.target.value);
                  }}
                  placeholder="http://127.0.0.1:1234/v1"
                  className="bg-transparent text-xs text-slate-800 outline-none w-full font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Model Identifier
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl">
                <Cpu size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={localModel}
                  onChange={(e) => {
                    setLocalModel(e.target.value);
                    localStorage.setItem("incirql_local_model", e.target.value);
                  }}
                  placeholder="llama3 or default"
                  className="bg-transparent text-xs text-slate-800 outline-none w-full font-medium"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Gemini API Key
              </label>
              <input
                type="password"
                value={activeApiKey}
                onChange={(e) => {
                  setActiveApiKey(e.target.value);
                  localStorage.setItem("incirql_gemini_key", e.target.value);
                }}
                placeholder="AIzaSy..."
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl text-xs text-slate-800 outline-none font-medium"
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Cloud Model: <span className="font-bold text-slate-700">{modelName}</span>
            </p>
          </div>
        )}

        {connectionStatus && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-start gap-2 ${
              connectionStatus.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                : connectionStatus.type === "info"
                ? "bg-sky-50 text-sky-800 border border-sky-100"
                : "bg-rose-50 text-rose-800 border border-rose-100"
            }`}
          >
            {connectionStatus.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{connectionStatus.msg}</span>
          </div>
        )}

        <button
          onClick={() => setIsSettingsOpen(false)}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl shadow-lg transition-all"
        >
          Save & Close
        </button>
      </div>
    </div>
  );

  const Header = ({ title }) => (
    <header className="px-5 pt-12 pb-6 relative z-10 space-y-6">
      <div className="bg-white/90 backdrop-blur-md border border-white shadow-sm flex items-center px-4 py-3 rounded-2xl">
        <Search size={18} strokeWidth={2} className="text-slate-400 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="What decision are you trying to make?"
          className="bg-transparent border-none outline-none text-sm w-full text-slate-800 placeholder:text-slate-400 font-medium"
        />
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="ml-2 p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-xl hover:bg-slate-100 flex-shrink-0"
          title="Engine Settings"
        >
          <Settings size={18} />
        </button>
      </div>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase italic">
            {title}
          </h1>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border transition-all ${
              provider === "local"
                ? "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100"
                : "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100"
            }`}
          >
            {provider === "local" ? "Local LLM" : "Gemini Cloud"}
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/80 border border-white/90 p-1 shadow-sm">
          {["All", "Unread", "Groups"].map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`text-[11px] font-extrabold px-3.5 py-1.5 rounded-full transition-all ${
                filter === tag
                  ? "bg-slate-900 text-white shadow"
                  : "bg-transparent text-slate-600 hover:bg-white/90"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </header>
  );

  const renderInboxCard = (thread, showBadge = false) => {
    const advisor = HISTORICAL_FIGURES.find((m) => m.id === thread.advisorIds[0]);
    return (
      <div
        key={thread.id}
        onClick={() => setActiveThread(thread)}
        className="bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-5 flex items-center gap-5 shadow-[0_8px_28px_-6px_rgba(15,23,42,0.12)] border border-sky-100 hover:scale-[1.01] transition-all cursor-pointer group relative"
      >
        <div className="relative flex-shrink-0">
          <div
            className={`w-16 h-16 rounded-full ${
              thread.isGroup ? "bg-slate-800" : advisor?.color || "bg-slate-200"
            } flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-white/50 overflow-hidden`}
          >
            {thread.isGroup ? (
              <LayoutGrid size={24} />
            ) : advisor?.img ? (
              <img src={advisor.img} className="w-full h-full object-cover" />
            ) : (
              advisor?.avatar
            )}
          </div>
          {showBadge && !thread.isGroup && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 border-white bg-white shadow-lg flex items-center justify-center text-[7px] font-black text-slate-500 uppercase tracking-tighter">
              Prof
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-bold text-[#1F2937] text-[16px] truncate tracking-tight">
              {thread.title}
            </h3>
            <span
              className={`text-[10px] font-extrabold mt-1 ${
                thread.unread > 0 ? "text-emerald-600" : "text-slate-500/80"
              }`}
            >
              {thread.time}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {thread.status === "read" && (
                <CheckCheck size={14} className="text-blue-500 flex-shrink-0" />
              )}
              {thread.status === "delivered" && (
                <Check size={14} className="text-slate-300 flex-shrink-0" />
              )}
              <p className="text-[13px] text-slate-600 truncate leading-tight font-semibold">
                {thread.lastMsg}
              </p>
            </div>
            {thread.unread > 0 && (
              <div className="bg-emerald-500 text-white text-[10px] font-black min-w-[20px] h-[20px] flex items-center justify-center rounded-full ml-2 shadow-sm shadow-emerald-200">
                {thread.unread}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderChat = () => {
    const history = chatHistories[activeThread.id] || [];
    const mainAdvisor = HISTORICAL_FIGURES.find(
      (m) => m.id === activeThread.advisorIds[0]
    );

    return (
      <div className="flex flex-col h-full bg-[#f8fafc] animate-in slide-in-from-right duration-500 relative">
        <header className="px-4 pt-12 pb-5 bg-white/95 backdrop-blur-md flex items-center gap-4 sticky top-0 z-20 border-b border-slate-100 shadow-sm">
          <button
            onClick={() => setActiveThread(null)}
            className="p-1 text-slate-400 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
          <div
            className={`w-10 h-10 rounded-full ${
              mainAdvisor?.color || "bg-slate-200"
            } flex items-center justify-center text-white font-bold text-[10px] overflow-hidden`}
          >
            {mainAdvisor?.img ? (
              <img src={mainAdvisor.img} className="w-full h-full object-cover" />
            ) : (
              mainAdvisor?.avatar
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 truncate text-sm tracking-tight">
              {activeThread.title}
            </h3>
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">
              {mainAdvisor?.name || "Advisor"} • {provider === "local" ? "LOCAL LLM" : "GEMINI CLOUD"}
            </p>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-xl hover:bg-slate-100"
            title="Engine Settings"
          >
            <Settings size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-48 relative z-10">
          <div className="flex justify-center mb-6">
            <span className="bg-white/80 px-4 py-1.5 rounded-full text-[9px] font-black text-slate-400 border border-slate-100 uppercase tracking-[0.2em] shadow-sm">
              Encrypted Thinking Feed
            </span>
          </div>

          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 p-5 rounded-[2rem] rounded-tl-none shadow-sm max-w-[92%]">
              <p className="text-[13px] leading-relaxed text-slate-700 italic font-medium opacity-90">
                "Advisory loop established for: **{activeThread.title}**. State your
                strategic dilemma."
              </p>
            </div>
          </div>

          {history.map((msg, i) => {
            const isUser = msg.role === "user";

            if (isUser) {
              return (
                <div key={i} className="flex justify-end mb-2">
                  <div className="bg-slate-900 text-white p-4 rounded-[1.8rem] rounded-tr-none shadow-lg max-w-[85%] text-sm font-medium leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const data = normalizeThoughtData(msg.content);
            return (
              <div
                key={i}
                className="space-y-3 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700"
              >
                {data.bursts.map((burst, bi) => (
                  <div
                    key={bi}
                    className="flex justify-start animate-in slide-in-from-left-4 duration-500"
                    style={{ animationDelay: `${bi * 300}ms` }}
                  >
                    <div className="bg-white border border-slate-100 p-4 rounded-[1.8rem] rounded-tl-none shadow-sm max-w-[90%] text-sm font-bold text-slate-800 leading-relaxed italic">
                      {burst}
                    </div>
                  </div>
                ))}

                {data.strategy && (
                  <StrategyBlock
                    title={data.strategy.title}
                    points={data.strategy.points}
                  />
                )}

                {data.snapshot && (
                  <DecisionSnapshot
                    action={data.snapshot.action}
                    risk={data.snapshot.risk}
                    next={data.snapshot.nextStep}
                  />
                )}

                {data.choices && (
                  <div className="flex flex-wrap gap-2 pt-2 justify-start overflow-x-auto no-scrollbar pb-2">
                    {data.choices.map((choice, ci) => (
                      <button
                        key={ci}
                        onClick={() => handleSendMessage(choice)}
                        className="px-5 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-tight hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 whitespace-nowrap"
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-full shadow-sm flex gap-1.5 items-center border border-slate-50">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#ecf6ff] via-[#ecf6ff]/95 to-transparent pointer-events-none">
          <div className="pointer-events-auto bg-white/95 backdrop-blur border border-sky-100 p-2.5 rounded-2xl shadow-[0_16px_40px_rgba(14,116,144,0.14)] md:max-w-md md:mx-auto flex items-center gap-2">
            <div className="p-2 text-slate-300">
              <RotateCcw size={18} />
            </div>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputText)}
              placeholder="State a strategic mandate..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 px-1 font-semibold placeholder:text-slate-400"
            />
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={!inputText.trim() || isTyping}
              className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-all ${
                inputText.trim()
                  ? "bg-indigo-600 scale-100 shadow-indigo-100"
                  : "bg-slate-100 scale-95 opacity-50"
              }`}
            >
              <Send size={18} className="text-white ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex justify-center bg-[#e9f4ff] min-h-screen antialiased text-slate-900 selection:bg-sky-100">
      <div className="w-full max-w-md bg-white h-screen shadow-2xl relative flex flex-col overflow-hidden border-x border-slate-200">
        <div className="flex-1 overflow-hidden relative">
          {activeThread ? (
            renderChat()
          ) : (
            <div className="flex flex-col h-full relative overflow-hidden animate-in fade-in duration-700">
              <MeshBackground />
              <Header title="Intelligence" />
              <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-28 relative z-10">
                {activeTab === "main" &&
                  threads
                    .filter((t) =>
                      filter === "Unread"
                        ? t.unread > 0
                        : filter === "Groups"
                          ? t.isGroup
                          : true
                    )
                    .filter((t) =>
                      t.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((thread) => renderInboxCard(thread, false))}
                {activeTab === "communities" &&
                  HISTORICAL_FIGURES.filter((a) =>
                    a.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((adv) => (
                    <div
                      key={adv.id}
                      onClick={() => {
                        const newId = Date.now().toString();
                        const newT = {
                          id: newId,
                          title: adv.name,
                          isGroup: false,
                          advisorIds: [adv.id],
                          lastMsg: "Direct session pending.",
                          time: "Now",
                          unread: 0,
                          status: "read",
                        };
                        setThreads([newT, ...threads]);
                        setActiveThread(newT);
                      }}
                      className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-5 flex items-center gap-5 shadow-sm border border-white hover:bg-white transition-all cursor-pointer group"
                    >
                      <div
                        className={`w-14 h-14 rounded-full ${adv.color} flex items-center justify-center text-white font-bold text-lg shadow-inner overflow-hidden`}
                      >
                        {adv.img ? (
                          <img src={adv.img} className="w-full h-full object-cover" />
                        ) : (
                          adv.avatar
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-[15px] tracking-tight">
                          {adv.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold">
                          {adv.role}
                        </p>
                      </div>
                      <PlusCircle
                        size={22}
                        className="text-slate-200 group-hover:text-indigo-400 transition-colors"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {!activeThread && (
          <nav className="h-24 bg-white/95 backdrop-blur-xl border-t border-sky-100 flex items-center justify-around px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-30 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
            {[
              { id: "main", icon: Shield, label: "Boardroom" },
              { id: "communities", icon: Users, label: "Advisors" },
              { id: "explore", icon: Compass, label: "Explore" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${
                  activeTab === tab.id ? "text-slate-900" : "text-slate-400"
                }`}
              >
                <tab.icon
                  size={22}
                  strokeWidth={activeTab === tab.id ? 2.5 : 1.5}
                  className={activeTab === tab.id ? "drop-shadow-sm" : ""}
                />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {tab.label}
                </span>
              </button>
            ))}
          </nav>
        )}
        {isSettingsOpen && <SettingsModal />}
      </div>
    </div>
  );
};

export default App;
