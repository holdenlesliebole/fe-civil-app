import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────

const TOPICS = [
  { id: "Mathematics and Statistics", label: "Mathematics & Statistics", weight: 10, color: "#6366f1" },
  { id: "Ethics and Professional Practice", label: "Ethics & Professional Practice", weight: 5, color: "#8b5cf6" },
  { id: "Engineering Economics", label: "Engineering Economics", weight: 6, color: "#a855f7" },
  { id: "Statics", label: "Statics", weight: 10, color: "#0ea5e9" },
  { id: "Dynamics", label: "Dynamics", weight: 5, color: "#06b6d4" },
  { id: "Mechanics of Materials", label: "Mechanics of Materials", weight: 9, color: "#14b8a6" },
  { id: "Materials", label: "Materials", weight: 6, color: "#10b981" },
  { id: "Fluid Mechanics", label: "Fluid Mechanics", weight: 7, color: "#22c55e" },
  { id: "Surveying", label: "Surveying", weight: 7, color: "#eab308" },
  { id: "Water Resources and Environmental Engineering", label: "Water Resources & Environmental", weight: 12, color: "#f97316" },
  { id: "Structural Engineering", label: "Structural Engineering", weight: 12, color: "#ef4444" },
  { id: "Geotechnical Engineering", label: "Geotechnical Engineering", weight: 12, color: "#dc2626" },
  { id: "Transportation Engineering", label: "Transportation Engineering", weight: 11, color: "#e11d48" },
  { id: "Construction Engineering", label: "Construction Engineering", weight: 10, color: "#f43f5e" },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const diffColor = (d) =>
  d === "Easy" ? "#10b981" : d === "Medium" ? "#eab308" : "#ef4444";

function weightedRandom() {
  const total = TOPICS.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of TOPICS) { r -= t.weight; if (r <= 0) return t.id; }
  return TOPICS[0].id;
}

// ── Streaming helpers ──────────────────────────────────────────────────────

async function streamQuestion(topic, difficulty, onChunk, onDone, onError) {
  try {
    const res = await fetch("/api/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, difficulty }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.error) { onError(msg.error); return; }
          if (msg.chunk) { full += msg.chunk; onChunk(full); }
          if (msg.done) {
            try {
              const clean = msg.full.replace(/```json|```/g, "").trim();
              onDone(JSON.parse(clean));
            } catch { onError("Failed to parse question JSON"); }
          }
        } catch {}
      }
    }
  } catch (e) {
    onError(e.message);
  }
}

async function streamTutor(payload, onChunk, onDone, onError) {
  try {
    const res = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.error) { onError(msg.error); return; }
          if (msg.chunk) { full += msg.chunk; onChunk(full); }
          if (msg.done) onDone(full);
        } catch {}
      }
    }
  } catch (e) {
    onError(e.message);
  }
}

async function streamFormula(query, onChunk, onDone, onError) {
  try {
    const res = await fetch("/api/formula-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          if (msg.error) { onError(msg.error); return; }
          if (msg.chunk) { full += msg.chunk; onChunk(full); }
          if (msg.done) onDone(full);
        } catch {}
      }
    }
  } catch (e) {
    onError(e.message);
  }
}

// ── Shared UI components ───────────────────────────────────────────────────

const card = {
  background: "#0f172a", border: "1px solid #1e293b",
  borderRadius: 10, padding: 20,
};
const labelSt = {
  display: "block", marginBottom: 12,
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11, letterSpacing: "0.12em",
  color: "#475569", fontWeight: 700,
};

function TopicBadge({ topicId, small }) {
  const t = TOPICS.find(x => x.id === topicId);
  if (!t) return null;
  return (
    <span style={{
      display: "inline-block",
      background: t.color + "22", color: t.color,
      border: `1px solid ${t.color}44`, borderRadius: 4,
      padding: small ? "2px 8px" : "4px 12px",
      fontSize: small ? 11 : 12,
      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
      letterSpacing: "0.04em", whiteSpace: "nowrap",
    }}>
      {t.label}
    </span>
  );
}

function Spinner({ label = "generating question..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "48px 0" }}>
      <div style={{
        width: 36, height: 36, border: "3px solid #1e293b",
        borderTopColor: "#38bdf8", borderRadius: "50%",
        animation: "spin 0.75s linear infinite",
      }} />
      <span style={{ color: "#475569", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
        {label}
      </span>
    </div>
  );
}

function StreamingText({ text }) {
  return (
    <div style={{
      color: "#cbd5e1", fontSize: 14, lineHeight: 1.85,
      fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: "pre-wrap",
      animation: "fadeIn 0.2s ease",
    }}>
      {text}
      <span style={{
        display: "inline-block", width: 2, height: "1em",
        background: "#38bdf8", marginLeft: 2, verticalAlign: "middle",
        animation: "spin 1s steps(2) infinite", borderRadius: 1,
      }} />
    </div>
  );
}

// ── Setup Screen ───────────────────────────────────────────────────────────

function SetupScreen({ onStart, onHistory }) {
  const [topic, setTopic] = useState("random");
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(5);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 48, paddingTop: 8 }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          border: "1px solid #334155", borderRadius: 8,
          padding: "5px 14px", marginBottom: 22,
        }}>
          <span style={{ color: "#38bdf8", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.18em" }}>
            NCEES FE CIVIL CBT
          </span>
        </div>
        <h1 style={{
          fontSize: 44, fontWeight: 800, margin: "0 0 10px",
          fontFamily: "'Sora', sans-serif", lineHeight: 1.1,
          background: "linear-gradient(135deg, #f8fafc 30%, #64748b 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Practice Exam
        </h1>
        <p style={{ color: "#475569", fontSize: 15, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          AI-generated questions · streaming answers · live tutoring
        </p>
        {usage && (
          <p style={{ color: "#334155", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", marginTop: 8 }}>
            api usage: ~${usage.estimated_cost_usd.toFixed(4)} all time
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Topic */}
        <div style={card}>
          <label style={labelSt}>TOPIC AREA</label>
          <select value={topic} onChange={e => setTopic(e.target.value)} style={{
            width: "100%", padding: "12px 14px", borderRadius: 8,
            border: "1px solid #334155", background: "#1e293b",
            color: "#f1f5f9", fontSize: 14,
            fontFamily: "'IBM Plex Sans', sans-serif", outline: "none", cursor: "pointer",
          }}>
            <option value="random">🎲 Random (weighted by exam frequency)</option>
            {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Difficulty */}
        <div style={card}>
          <label style={labelSt}>DIFFICULTY</label>
          <div style={{ display: "flex", gap: 10 }}>
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: "12px 0", borderRadius: 8, cursor: "pointer",
                fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
                border: `1px solid ${difficulty === d ? diffColor(d) : "#334155"}`,
                background: difficulty === d ? diffColor(d) + "22" : "transparent",
                color: difficulty === d ? diffColor(d) : "#475569",
                transition: "all 0.15s",
              }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div style={card}>
          <label style={labelSt}>NUMBER OF QUESTIONS</label>
          <div style={{ display: "flex", gap: 10 }}>
            {[3, 5, 10, 15].map(n => (
              <button key={n} onClick={() => setCount(n)} style={{
                flex: 1, padding: "12px 0", borderRadius: 8, cursor: "pointer",
                fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: 16,
                border: `1px solid ${count === n ? "#38bdf8" : "#334155"}`,
                background: count === n ? "#38bdf822" : "transparent",
                color: count === n ? "#38bdf8" : "#475569",
                transition: "all 0.15s",
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => onStart({ topic, difficulty, count })} style={{
          padding: "17px 0", borderRadius: 10, border: "none",
          background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
          color: "#fff", fontSize: 17, fontWeight: 800,
          fontFamily: "'Sora', sans-serif", cursor: "pointer",
          letterSpacing: "0.02em", boxShadow: "0 4px 32px #0ea5e933",
          transition: "opacity 0.15s",
        }}
          onMouseOver={e => e.target.style.opacity = 0.88}
          onMouseOut={e => e.target.style.opacity = 1}
        >
          Start Session →
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onHistory} style={{
            flex: 1, padding: "12px 0", borderRadius: 10,
            border: "1px solid #1e293b", background: "transparent",
            color: "#475569", fontSize: 14, fontWeight: 600,
            fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer",
            letterSpacing: "0.04em",
          }}>
            📋 Study History
          </button>
          <a href="/handbook" target="_blank" rel="noreferrer" style={{
            flex: 1, padding: "12px 0", borderRadius: 10, textAlign: "center",
            border: "1px solid #1e293b", background: "transparent",
            color: "#475569", fontSize: 14, fontWeight: 600,
            fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer",
            letterSpacing: "0.04em", textDecoration: "none", display: "block",
          }}>
            📖 Open Handbook
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Question Screen ────────────────────────────────────────────────────────

function QuestionScreen({ config, onFinish }) {
  const [qData, setQData] = useState(null);
  const [streamingRaw, setStreamingRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [prefetched, setPrefetched] = useState(null);

  const questionStartRef = useRef(null);

  // Handbook state
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [handbookQuery, setHandbookQuery] = useState("");
  const [handbookResult, setHandbookResult] = useState("");
  const [handbookLoading, setHandbookLoading] = useState(false);

  // Tutor state
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorMessages, setTutorMessages] = useState([]);
  const [tutorStreaming, setTutorStreaming] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);
  const tutorEndRef = useRef(null);

  const pickTopic = useCallback(() =>
    config.topic === "random" ? weightedRandom() : config.topic, [config.topic]);

  const fetchQuestion = useCallback((setParsed, setRaw, setErr) => {
    const topicId = pickTopic();
    return { topicId, stop: streamQuestion(topicId, config.difficulty, setRaw, (parsed) => {
      parsed._topicId = topicId;
      setParsed(parsed);
    }, setErr) };
  }, [pickTopic, config.difficulty]);

  // Load first question + prefetch second
  useEffect(() => {
    setLoading(true);
    setStreamingRaw("");
    setError(null);

    const { topicId } = fetchQuestion(
      (parsed) => { setQData(parsed); setLoading(false); questionStartRef.current = Date.now(); },
      (raw) => setStreamingRaw(raw),
      (e) => { setError(e); setLoading(false); }
    );

    // Prefetch next question silently
    if (config.count > 1) {
      setTimeout(() => {
        let prefetchedData = null;
        fetchQuestion(
          (parsed) => { prefetchedData = parsed; setPrefetched(parsed); },
          () => {},
          () => {}
        );
      }, 500);
    }
  }, []); // eslint-disable-line

  const advanceQuestion = useCallback(async () => {
    if (tutorMessages.length > 0 && qData) {
      fetch("/api/save-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: qData._topicId,
          question: qData.question,
          messages: tutorMessages,
        }),
      }).catch(() => {});
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx >= config.count) {
      onFinish(answers);
      return;
    }

    setCurrentIdx(nextIdx);
    setSelected(null);
    setRevealed(false);
    setTutorOpen(false);
    setTutorMessages([]);
    setTutorStreaming("");
    setHandbookOpen(false);
    setHandbookQuery("");
    setHandbookResult("");

    if (prefetched) {
      setQData(prefetched);
      setPrefetched(null);
      setLoading(false);
      setStreamingRaw("");
      questionStartRef.current = Date.now();

      // Prefetch the one after
      if (nextIdx + 1 < config.count) {
        setTimeout(() => {
          fetchQuestion(
            (parsed) => setPrefetched(parsed),
            () => {},
            () => {}
          );
        }, 300);
      }
    } else {
      setLoading(true);
      setStreamingRaw("");
      setQData(null);
      fetchQuestion(
        (parsed) => { setQData(parsed); setLoading(false); questionStartRef.current = Date.now(); },
        (raw) => setStreamingRaw(raw),
        (e) => { setError(e); setLoading(false); }
      );
    }
  }, [currentIdx, config.count, answers, prefetched, fetchQuestion, onFinish]);

  const handleReveal = () => {
    setRevealed(true);
    const timeSpentSec = questionStartRef.current
      ? Math.round((Date.now() - questionStartRef.current) / 1000)
      : null;
    const result = {
      topic: qData._topicId,
      correct: qData.correct === selected,
      question: qData.question,
      selected,
      correctAnswer: qData.correct,
      explanation: qData.explanation,
      timeSpentSec,
    };
    setAnswers(prev => [...prev, result]);
    fetch("/api/save-result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...result,
        difficulty: config.difficulty,
        choices: qData.choices,
        handbook_hint: qData.handbook_hint,
      }),
    }).catch(() => {});
  };

  // Tutor send
  const handleTutorSend = async () => {
    if (!tutorInput.trim() || tutorLoading) return;
    const msg = tutorInput.trim();
    setTutorInput("");
    const newMessages = [...tutorMessages, { role: "user", content: msg }];
    setTutorMessages(newMessages);
    setTutorLoading(true);
    setTutorStreaming("");

    const apiMessages = tutorMessages.length === 0
      ? [] // server builds context from first message
      : newMessages.map(m => ({ role: m.role, content: m.content }));

    await streamTutor(
      {
        question: qData.question,
        choices: qData.choices,
        correct: qData.correct,
        selected,
        explanation: qData.explanation,
        messages: apiMessages,
        followUp: msg,
      },
      (partial) => setTutorStreaming(partial),
      (full) => {
        setTutorMessages(prev => [...prev, { role: "assistant", content: full }]);
        setTutorStreaming("");
        setTutorLoading(false);
        setTimeout(() => tutorEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      },
      (e) => {
        setTutorMessages(prev => [...prev, { role: "assistant", content: `Error: ${e}` }]);
        setTutorStreaming("");
        setTutorLoading(false);
      }
    );
  };

  const progress = ((currentIdx + (revealed ? 1 : 0)) / config.count) * 100;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#64748b" }}>
          <span style={{ color: "#f8fafc", fontWeight: 700 }}>{currentIdx + 1}</span> / {config.count}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setHandbookOpen(o => !o)} style={{
            padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer",
            background: handbookOpen ? "#0ea5e922" : "transparent",
            color: handbookOpen ? "#38bdf8" : "#475569",
            border: `1px solid ${handbookOpen ? "#0ea5e944" : "#334155"}`,
          }}>📖 HANDBOOK</button>
          <span style={{
            padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            background: diffColor(config.difficulty) + "22",
            color: diffColor(config.difficulty),
            border: `1px solid ${diffColor(config.difficulty)}44`,
          }}>{config.difficulty.toUpperCase()}</span>
          {qData && <TopicBadge topicId={qData._topicId} small />}
        </div>
      </div>

      {/* Handbook panel */}
      {handbookOpen && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...labelSt, margin: 0 }}>FORMULA LOOKUP</span>
            <a href="/handbook" target="_blank" rel="noreferrer" style={{
              color: "#38bdf8", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
              textDecoration: "none",
            }}>open full handbook ↗</a>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: handbookResult ? 14 : 0 }}>
            <input
              value={handbookQuery}
              onChange={e => setHandbookQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && handbookQuery.trim() && !handbookLoading) {
                  setHandbookResult("");
                  setHandbookLoading(true);
                  streamFormula(
                    handbookQuery.trim(),
                    (partial) => setHandbookResult(partial),
                    () => setHandbookLoading(false),
                    () => setHandbookLoading(false),
                  );
                }
              }}
              placeholder="e.g. Manning's equation, moment of inertia, Darcy-Weisbach..."
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 8,
                border: "1px solid #334155", background: "#0a0f1a",
                color: "#f1f5f9", fontSize: 14,
                fontFamily: "'IBM Plex Sans', sans-serif", outline: "none",
              }}
            />
            <button
              disabled={handbookLoading || !handbookQuery.trim()}
              onClick={() => {
                if (!handbookQuery.trim() || handbookLoading) return;
                setHandbookResult("");
                setHandbookLoading(true);
                streamFormula(
                  handbookQuery.trim(),
                  (partial) => setHandbookResult(partial),
                  () => setHandbookLoading(false),
                  () => setHandbookLoading(false),
                );
              }}
              style={{
                padding: "10px 18px", borderRadius: 8, border: "none",
                background: "#0ea5e9", color: "#fff", fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", fontSize: 14,
                opacity: (handbookLoading || !handbookQuery.trim()) ? 0.4 : 1,
              }}>→</button>
          </div>
          {handbookLoading && !handbookResult && <Spinner label="looking up..." />}
          {handbookResult && <StreamingText text={handbookResult} />}
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: 3, background: "#1e293b", borderRadius: 2, marginBottom: 28 }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: "linear-gradient(90deg, #0ea5e9, #6366f1)",
          width: `${progress}%`, transition: "width 0.4s ease",
        }} />
      </div>

      {/* Loading state */}
      {loading && <Spinner />}

      {error && (
        <div style={{ textAlign: "center", padding: 40, color: "#f87171", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
          {error}
          <br />
          <button onClick={() => { setError(null); setLoading(true); fetchQuestion(
            (p) => { setQData(p); setLoading(false); },
            (r) => setStreamingRaw(r),
            (e) => { setError(e); setLoading(false); }
          ); }} style={{ marginTop: 16, color: "#38bdf8", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
            ↺ retry
          </button>
        </div>
      )}

      {!loading && !error && qData && (
        <>
          {/* Question card */}
          <div style={{ ...card, marginBottom: 16 }}>
            {qData.handbook_hint && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 16, padding: "8px 12px",
                background: "#0a0f1a", borderRadius: 6, border: "1px solid #1e293b",
              }}>
                <span style={{ fontSize: 13 }}>📖</span>
                <span style={{ color: "#475569", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {qData.handbook_hint}
                </span>
              </div>
            )}
            <p style={{
              margin: 0, fontSize: 16, lineHeight: 1.75,
              color: "#f1f5f9", fontFamily: "'IBM Plex Sans', sans-serif",
            }}>
              {qData.question}
            </p>
          </div>

          {/* Answer choices */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {Object.entries(qData.choices).map(([key, val]) => {
              let borderColor = "#334155", bg = "transparent", color = "#94a3b8";
              if (!revealed && selected === key) { borderColor = "#0ea5e9"; bg = "#0ea5e914"; color = "#f1f5f9"; }
              if (revealed && key === qData.correct) { borderColor = "#10b981"; bg = "#10b98110"; color = "#f1f5f9"; }
              if (revealed && key === selected && key !== qData.correct) { borderColor = "#ef4444"; bg = "#ef444410"; color = "#f87171"; }
              return (
                <button key={key} onClick={() => !revealed && setSelected(key)} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "13px 16px", borderRadius: 8,
                  border: `1px solid ${borderColor}`, background: bg, color,
                  cursor: revealed ? "default" : "pointer",
                  textAlign: "left", transition: "all 0.15s",
                  fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 15, lineHeight: 1.55,
                }}>
                  <span style={{
                    minWidth: 26, height: 26, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    background: revealed && key === qData.correct ? "#10b981"
                      : revealed && key === selected ? "#ef4444"
                      : selected === key ? "#0ea5e9" : "#1e293b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700, color: "#fff",
                  }}>{key}</span>
                  <span style={{ flex: 1 }}>{val}</span>
                  {revealed && key === qData.correct && <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>}
                  {revealed && key === selected && key !== qData.correct && <span style={{ color: "#ef4444", flexShrink: 0 }}>✗</span>}
                </button>
              );
            })}
          </div>

          {/* Check / Next button */}
          {!revealed ? (
            <button onClick={handleReveal} disabled={!selected} style={{
              width: "100%", padding: "15px 0", borderRadius: 8, border: "none",
              background: selected ? "linear-gradient(135deg, #0ea5e9, #6366f1)" : "#1e293b",
              color: selected ? "#fff" : "#334155",
              fontSize: 15, fontWeight: 700, fontFamily: "'Sora', sans-serif",
              cursor: selected ? "pointer" : "not-allowed", transition: "all 0.15s",
              boxShadow: selected ? "0 4px 24px #0ea5e922" : "none",
            }}>
              {selected ? "Check Answer" : "Select an answer"}
            </button>
          ) : (
            <>
              {/* Explanation */}
              <div style={{
                ...card, marginBottom: 14,
                borderColor: qData.correct === selected ? "#10b98144" : "#ef444444",
                background: qData.correct === selected ? "#10b98108" : "#ef444408",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>{qData.correct === selected ? "✅" : "❌"}</span>
                  <span style={{
                    fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 15,
                    color: qData.correct === selected ? "#10b981" : "#ef4444",
                  }}>
                    {qData.correct === selected ? "Correct!" : `Incorrect — correct answer: ${qData.correct}`}
                  </span>
                </div>
                <div style={{
                  color: "#cbd5e1", fontSize: 14, lineHeight: 1.85,
                  fontFamily: "'IBM Plex Sans', sans-serif", whiteSpace: "pre-wrap",
                }}>
                  {qData.explanation}
                </div>
              </div>

              {/* Tutor toggle */}
              <button onClick={() => setTutorOpen(o => !o)} style={{
                width: "100%", padding: "11px 0", marginBottom: 12,
                borderRadius: 8, border: "1px solid #1e293b",
                background: tutorOpen ? "#1e293b" : "transparent",
                color: "#64748b", fontSize: 13, fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer",
              }}>
                {tutorOpen ? "▲ close tutor" : "💬 still confused? ask the tutor"}
              </button>

              {/* Tutor chat */}
              {tutorOpen && (
                <div style={{ ...card, marginBottom: 14 }}>
                  <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    {tutorMessages.length === 0 && (
                      <p style={{ color: "#334155", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", margin: 0 }}>
                        Ask anything — why is this the right method? why is choice B wrong? walk me through it again...
                      </p>
                    )}
                    {tutorMessages.map((m, i) => (
                      <div key={i} style={{
                        padding: "10px 14px", borderRadius: 8,
                        background: m.role === "user" ? "#0ea5e914" : "#1e293b",
                        border: `1px solid ${m.role === "user" ? "#0ea5e933" : "#334155"}`,
                        color: "#e2e8f0", fontSize: 14, lineHeight: 1.75,
                        fontFamily: "'IBM Plex Sans', sans-serif",
                        alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                        maxWidth: "92%", whiteSpace: "pre-wrap",
                        animation: "fadeIn 0.2s ease",
                      }}>
                        {m.content}
                      </div>
                    ))}
                    {tutorStreaming && (
                      <div style={{
                        padding: "10px 14px", borderRadius: 8,
                        background: "#1e293b", border: "1px solid #334155",
                        alignSelf: "flex-start", maxWidth: "92%",
                        animation: "fadeIn 0.2s ease",
                      }}>
                        <StreamingText text={tutorStreaming} />
                      </div>
                    )}
                    <div ref={tutorEndRef} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={tutorInput}
                      onChange={e => setTutorInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleTutorSend()}
                      placeholder="Ask a follow-up..."
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 8,
                        border: "1px solid #334155", background: "#0a0f1a",
                        color: "#f1f5f9", fontSize: 14,
                        fontFamily: "'IBM Plex Sans', sans-serif", outline: "none",
                      }}
                    />
                    <button onClick={handleTutorSend} disabled={tutorLoading || !tutorInput.trim()} style={{
                      padding: "10px 18px", borderRadius: 8, border: "none",
                      background: "#0ea5e9", color: "#fff", fontWeight: 700,
                      fontFamily: "'IBM Plex Mono', monospace", cursor: "pointer", fontSize: 14,
                      opacity: (tutorLoading || !tutorInput.trim()) ? 0.4 : 1,
                    }}>→</button>
                  </div>
                </div>
              )}

              <button onClick={advanceQuestion} style={{
                width: "100%", padding: "15px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: "'Sora', sans-serif", cursor: "pointer",
                boxShadow: "0 4px 24px #0ea5e922",
              }}>
                {currentIdx + 1 >= config.count ? "View Results →" : "Next Question →"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Results Screen ─────────────────────────────────────────────────────────

function ResultsScreen({ answers, config, onRetry, onNewSession }) {
  const score = answers.filter(a => a.correct).length;
  const pct = Math.round((score / answers.length) * 100);
  const missed = answers.filter(a => !a.correct);

  const topicBreakdown = {};
  answers.forEach(a => {
    if (!topicBreakdown[a.topic]) topicBreakdown[a.topic] = { correct: 0, total: 0 };
    topicBreakdown[a.topic].total++;
    if (a.correct) topicBreakdown[a.topic].correct++;
  });

  const grade = pct >= 75 ? { label: "Strong Pass", color: "#10b981" }
    : pct >= 60 ? { label: "Passing", color: "#eab308" }
    : { label: "Needs Work", color: "#ef4444" };

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "0 20px" }}>
      {/* Score circle */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: `conic-gradient(${grade.color} ${pct * 3.6}deg, #1e293b 0deg)`,
          margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%", background: "#0a0f1a",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: "#f8fafc" }}>
              {pct}%
            </span>
          </div>
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif", color: "#f8fafc", fontSize: 28, marginBottom: 8 }}>
          Session Complete
        </h2>
        <span style={{
          padding: "4px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          background: grade.color + "22", color: grade.color, border: `1px solid ${grade.color}44`,
        }}>{grade.label}</span>
        <p style={{ color: "#475569", marginTop: 10, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14 }}>
          {score} of {answers.length} correct · {config.difficulty}
        </p>
      </div>

      {/* Topic breakdown */}
      {Object.keys(topicBreakdown).length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <p style={{ ...labelSt, marginBottom: 16 }}>PERFORMANCE BY TOPIC</p>
          {Object.entries(topicBreakdown).map(([topicId, data]) => {
            const tp = Math.round((data.correct / data.total) * 100);
            const tc = TOPICS.find(t => t.id === topicId)?.color || "#64748b";
            return (
              <div key={topicId} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <TopicBadge topicId={topicId} small />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#64748b" }}>
                    {data.correct}/{data.total} ({tp}%)
                  </span>
                </div>
                <div style={{ height: 4, background: "#1e293b", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${tp}%`, background: tc, borderRadius: 2, transition: "width 0.7s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Missed questions */}
      {missed.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <p style={{ ...labelSt, marginBottom: 16 }}>MISSED QUESTIONS</p>
          {missed.map((a, i) => (
            <div key={i} style={{
              padding: "12px 14px", borderRadius: 8, marginBottom: 10,
              background: "#0a0f1a", border: "1px solid #1e293b",
            }}>
              <p style={{ margin: "0 0 8px", color: "#e2e8f0", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.5 }}>
                {a.question.length > 130 ? a.question.slice(0, 130) + "…" : a.question}
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#ef4444" }}>You: {a.selected}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#10b981" }}>Correct: {a.correctAnswer}</span>
                <TopicBadge topicId={a.topic} small />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onNewSession} style={{
          flex: 1, padding: "14px 0", borderRadius: 8,
          border: "1px solid #334155", background: "transparent",
          color: "#94a3b8", fontSize: 14, fontWeight: 600,
          fontFamily: "'Sora', sans-serif", cursor: "pointer",
        }}>New Session</button>
        {missed.length > 0 && (
          <button onClick={() => onRetry(missed)} style={{
            flex: 1, padding: "14px 0", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
            color: "#fff", fontSize: 14, fontWeight: 700,
            fontFamily: "'Sora', sans-serif", cursor: "pointer",
          }}>Retry Missed ({missed.length})</button>
        )}
      </div>
    </div>
  );
}

// ── History Screen ─────────────────────────────────────────────────────────

function formatTime(sec) {
  if (sec == null) return null;
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function HistoryScreen({ onBack }) {
  const [tab, setTab] = useState("questions");
  const [questions, setQuestions] = useState([]);
  const [tutorSessions, setTutorSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/history").then(r => r.json()).catch(() => []),
      fetch("/api/tutor-history").then(r => r.json()).catch(() => []),
    ]).then(([q, t]) => {
      setQuestions([...q].reverse());
      setTutorSessions([...t].reverse());
      setLoading(false);
    });
  }, []);

  const totalQ   = questions.length;
  const correctQ = questions.filter(q => q.correct).length;
  const pct      = totalQ > 0 ? Math.round(correctQ / totalQ * 100) : 0;
  const timedQ   = questions.filter(q => q.timeSpentSec != null);
  const avgSec   = timedQ.length > 0
    ? Math.round(timedQ.reduce((s, q) => s + q.timeSpentSec, 0) / timedQ.length)
    : null;

  const toggle = (i) => setExpandedIdx(expandedIdx === i ? null : i);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button onClick={onBack} style={{
          background: "none", border: "1px solid #334155", borderRadius: 6,
          color: "#64748b", padding: "6px 14px", cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
        }}>← back</button>
        <h2 style={{ margin: 0, fontFamily: "'Sora', sans-serif", fontSize: 22, color: "#f8fafc" }}>
          Study History
        </h2>
      </div>

      {loading && <Spinner label="loading history..." />}

      {!loading && (
        <>
          {/* Stats summary */}
          {totalQ > 0 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              {[
                { label: "QUESTIONS", value: totalQ },
                { label: "CORRECT", value: `${correctQ} (${pct}%)` },
                { label: "AVG TIME", value: avgSec != null ? formatTime(avgSec) : "—" },
                { label: "TUTOR SESSIONS", value: tutorSessions.length },
              ].map(s => (
                <div key={s.label} style={{ ...card, flex: 1, textAlign: "center", padding: "14px 10px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Sora', sans-serif", color: "#f8fafc", marginBottom: 4 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "#475569", letterSpacing: "0.1em" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e293b", paddingBottom: 12 }}>
            {[["questions", `QUESTIONS (${questions.length})`], ["tutor", `TUTOR (${tutorSessions.length})`]].map(([key, label]) => (
              <button key={key} onClick={() => { setTab(key); setExpandedIdx(null); }} style={{
                padding: "7px 18px", borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 700,
                background: tab === key ? "#1e293b" : "transparent",
                color: tab === key ? "#38bdf8" : "#475569",
              }}>{label}</button>
            ))}
          </div>

          {/* Questions list */}
          {tab === "questions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {questions.length === 0 && (
                <p style={{ color: "#334155", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, textAlign: "center", padding: 40 }}>
                  No question history yet — complete a session to start tracking.
                </p>
              )}
              {questions.map((q, i) => (
                <div key={i} onClick={() => toggle(i)}
                  style={{ ...card, cursor: "pointer", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14 }}>{q.correct ? "✅" : "❌"}</span>
                    <TopicBadge topicId={q.topic} small />
                    {q.difficulty && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                        background: diffColor(q.difficulty) + "22", color: diffColor(q.difficulty),
                        border: `1px solid ${diffColor(q.difficulty)}44`,
                      }}>{q.difficulty.toUpperCase()}</span>
                    )}
                    {q.timeSpentSec != null && (
                      <span style={{ color: "#475569", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                        ⏱ {formatTime(q.timeSpentSec)}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", color: "#334155", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                      {formatDate(q.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.5 }}>
                    {q.question?.length > 120 ? q.question.slice(0, 120) + "…" : q.question}
                  </p>

                  {expandedIdx === i && (
                    <div style={{ marginTop: 14, borderTop: "1px solid #1e293b", paddingTop: 14 }}>
                      <p style={{ margin: "0 0 12px", color: "#f1f5f9", fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.75 }}>
                        {q.question}
                      </p>
                      {q.choices && Object.entries(q.choices).map(([key, val]) => {
                        const isCorrect = key === q.correctAnswer;
                        const isWrong   = key === q.selected && !q.correct;
                        return (
                          <div key={key} style={{
                            padding: "7px 12px", borderRadius: 6, marginBottom: 6, fontSize: 13,
                            fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.5,
                            background: isCorrect ? "#10b98110" : isWrong ? "#ef444410" : "#0a0f1a",
                            border: `1px solid ${isCorrect ? "#10b98144" : isWrong ? "#ef444444" : "#1e293b"}`,
                            color: isCorrect ? "#10b981" : isWrong ? "#f87171" : "#64748b",
                          }}>
                            <strong>{key}.</strong> {val}
                            {isCorrect && <span style={{ marginLeft: 8 }}>✓ correct</span>}
                            {isWrong   && <span style={{ marginLeft: 8 }}>✗ your answer</span>}
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 12, padding: "12px 14px", background: "#0a0f1a", borderRadius: 6, border: "1px solid #1e293b" }}>
                        <p style={{ margin: 0, color: "#cbd5e1", fontSize: 13, fontFamily: "'IBM Plex Sans', sans-serif", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                          {q.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tutor sessions list */}
          {tab === "tutor" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tutorSessions.length === 0 && (
                <p style={{ color: "#334155", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, textAlign: "center", padding: 40 }}>
                  No tutor sessions yet — use the tutor after answering a question.
                </p>
              )}
              {tutorSessions.map((s, i) => (
                <div key={i} onClick={() => toggle(i)}
                  style={{ ...card, cursor: "pointer", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14 }}>💬</span>
                    <TopicBadge topicId={s.topic} small />
                    <span style={{ color: "#475569", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {s.messages?.length} messages
                    </span>
                    <span style={{ marginLeft: "auto", color: "#334155", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                      {formatDate(s.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 12, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                    {s.question?.length > 100 ? s.question.slice(0, 100) + "…" : s.question}
                  </p>

                  {expandedIdx === i && (
                    <div style={{ marginTop: 14, borderTop: "1px solid #1e293b", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                      {s.messages?.map((m, j) => (
                        <div key={j} style={{
                          padding: "10px 14px", borderRadius: 8,
                          background: m.role === "user" ? "#0ea5e914" : "#1e293b",
                          border: `1px solid ${m.role === "user" ? "#0ea5e933" : "#334155"}`,
                          color: "#e2e8f0", fontSize: 13, lineHeight: 1.75,
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "92%", whiteSpace: "pre-wrap",
                        }}>
                          {m.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState(null);
  const [answers, setAnswers] = useState([]);

  // Heartbeat — tells server the tab is still open
  useEffect(() => {
    const id = setInterval(() => {
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", color: "#f1f5f9", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ padding: "32px 0 80px" }}>
        {screen === "setup" && (
          <SetupScreen
            onStart={cfg => { setConfig(cfg); setScreen("question"); }}
            onHistory={() => setScreen("history")}
          />
        )}
        {screen === "question" && config && (
          <QuestionScreen
            config={config}
            onFinish={ans => { setAnswers(ans); setScreen("results"); }}
          />
        )}
        {screen === "results" && (
          <ResultsScreen
            answers={answers}
            config={config}
            onRetry={(missed) => {
              setConfig(c => ({ ...c, count: missed.length, topic: "random" }));
              setAnswers([]);
              setScreen("question");
            }}
            onNewSession={() => { setConfig(null); setAnswers([]); setScreen("setup"); }}
          />
        )}
        {screen === "history" && (
          <HistoryScreen onBack={() => setScreen("setup")} />
        )}
      </div>
    </div>
  );
}
