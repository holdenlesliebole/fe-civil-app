import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, "..", "data");
const BUILD_DIR = path.join(__dirname, "..", "client", "build");

// Find handbook PDF (any *handbook*.pdf in app root)
const HANDBOOK_PATH = fs.readdirSync(path.join(__dirname, ".."))
  .filter(f => f.toLowerCase().endsWith(".pdf") && f.toLowerCase().includes("handbook"))
  .map(f => path.join(__dirname, "..", f))[0] || null;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const USAGE_FILE         = path.join(DATA_DIR, "usage.json");
const QUESTION_HIST_FILE = path.join(DATA_DIR, "question_history.json");
const TUTOR_HIST_FILE    = path.join(DATA_DIR, "tutor_history.json");

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (e) { console.error("Failed to write", file, e.message); }
}
function appendUsage(inputTokens, outputTokens) {
  const u = readJSON(USAGE_FILE, { total_input_tokens: 0, total_output_tokens: 0 });
  u.total_input_tokens  += inputTokens  || 0;
  u.total_output_tokens += outputTokens || 0;
  u.last_updated = new Date().toISOString();
  writeJSON(USAGE_FILE, u);
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve production React build
if (fs.existsSync(BUILD_DIR)) {
  app.use(express.static(BUILD_DIR));
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert civil engineering exam tutor specializing in the NCEES FE Civil CBT exam. You generate realistic, high-quality multiple choice practice questions exactly matching the format and difficulty of the actual FE Civil exam.

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no preamble, no explanation outside the JSON
- Questions must be technically accurate and match real FE exam style
- Wrong answers (distractors) must be plausible — common mistakes, unit errors, formula mix-ups
- Include realistic numerical calculations when appropriate
- Use both SI and USCS units (vary between questions)
- Reference the FE Reference Handbook where applicable

MANDATORY ACCURACY CHECKS — perform these internally before writing the final JSON:
1. SOLVE FIRST: Fully solve the problem yourself before writing any answer choices. Confirm your answer is mathematically correct.
2. ANSWER IN CHOICES: Your calculated correct answer MUST match exactly one of the four choices. If it does not, revise the problem numbers or choices until it does. Never output a question where the correct answer is absent.
3. TRIGONOMETRY: Double-check all trig — use sin(θ) for components perpendicular to a reference axis and cos(θ) for parallel. Verify standard angles (sin 30°=0.5, cos 30°=0.866, sin 45°=0.707, etc.).
4. UNITS: Confirm dimensional consistency throughout (forces, distances, moments, pressures). Catch unit conversion errors before finalising.
5. SIGN CONVENTIONS: Verify moment and force sign conventions are applied consistently (e.g., ΣM=0 with correct clockwise/counterclockwise signs).
6. DISTRACTOR VALIDATION: Ensure each wrong answer corresponds to a specific, realistic mistake (wrong trig function, wrong moment arm, unit error, etc.) but does NOT accidentally equal the correct answer.
7. BACK-CHECK: After choosing the correct answer letter, confirm that substituting that answer back into the governing equation satisfies it. Only one choice should satisfy equilibrium or the governing equation.

JSON format:
{
  "question": "Full question text with all necessary data",
  "choices": {
    "A": "First choice",
    "B": "Second choice",
    "C": "Third choice",
    "D": "Fourth choice"
  },
  "correct": "A",
  "explanation": "Step-by-step solution showing exactly how to arrive at the correct answer. Show all work and formulas. Then briefly explain why each wrong answer is wrong.",
  "handbook_hint": "Where to find the relevant formula/table in the FE Reference Handbook",
  "topic": "Specific subtopic within the area"
}`;

// ── Generate question (streaming JSON) ──────────────────────────
app.post("/api/question", async (req, res) => {
  const { topic, difficulty } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const prompt = `Generate one ${difficulty.toLowerCase()} difficulty FE Civil exam practice question on the topic: ${topic}.

Difficulty guidelines:
- Easy: Direct formula application, one or two steps, straightforward numbers
- Medium: Multi-step problem, requires identifying the right approach, realistic exam complexity
- Hard: Complex multi-step, combined concepts, tricky distractors, careful unit conversion required

Return only the JSON object described in your instructions.`;

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    let full = "";
    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        full += chunk.delta.text;
        res.write(`data: ${JSON.stringify({ chunk: chunk.delta.text })}\n\n`);
      }
    }
    try {
      const finalMsg = await stream.finalMessage();
      appendUsage(finalMsg.usage?.input_tokens, finalMsg.usage?.output_tokens);
    } catch {}

    res.write(`data: ${JSON.stringify({ done: true, full })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Tutor chat (streaming) ───────────────────────────────────────
app.post("/api/tutor", async (req, res) => {
  const { question, choices, correct, selected, explanation, messages } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const context = `You are a patient, expert FE Civil exam tutor. A student is working on this question:

QUESTION: ${question}

CHOICES:
A: ${choices.A}
B: ${choices.B}
C: ${choices.C}
D: ${choices.D}

CORRECT ANSWER: ${correct}
STUDENT'S ANSWER: ${selected}
ORIGINAL EXPLANATION: ${explanation}

Help the student understand this problem. Be precise, use step-by-step reasoning, and if they're still confused try a different explanation approach. Be encouraging but technically accurate.`;

  const apiMessages = messages.length === 0
    ? [{ role: "user", content: context + "\n\n" + req.body.followUp }]
    : messages;

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: apiMessages,
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ chunk: chunk.delta.text })}\n\n`);
      }
    }
    try {
      const finalMsg = await stream.finalMessage();
      appendUsage(finalMsg.usage?.input_tokens, finalMsg.usage?.output_tokens);
    } catch {}

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Save question result ─────────────────────────────────────────
app.post("/api/save-result", (req, res) => {
  const history = readJSON(QUESTION_HIST_FILE, []);
  history.push({ timestamp: new Date().toISOString(), ...req.body });
  writeJSON(QUESTION_HIST_FILE, history);
  res.json({ ok: true });
});

// ── Save tutor conversation ──────────────────────────────────────
app.post("/api/save-tutor", (req, res) => {
  const history = readJSON(TUTOR_HIST_FILE, []);
  history.push({ timestamp: new Date().toISOString(), ...req.body });
  writeJSON(TUTOR_HIST_FILE, history);
  res.json({ ok: true });
});

// ── Reference handbook PDF ───────────────────────────────────────
app.get("/handbook", (_, res) => {
  if (HANDBOOK_PATH) {
    res.sendFile(HANDBOOK_PATH);
  } else {
    res.status(404).send("Handbook PDF not found. Place a file with 'handbook' in the name in the app root folder.");
  }
});

// ── Formula lookup (streaming) ───────────────────────────────────
app.post("/api/formula-lookup", async (req, res) => {
  const { query } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are an FE Civil exam reference assistant. The student is looking up: "${query}"

Provide:
1. The relevant formula(s) with all variables clearly defined
2. The exact section name in the NCEES FE Reference Handbook where this is found
3. Units and any critical notes about common application mistakes

Be concise and precise — this is quick reference during exam practice.`,
      }],
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ chunk: chunk.delta.text })}\n\n`);
      }
    }
    try {
      const finalMsg = await stream.finalMessage();
      appendUsage(finalMsg.usage?.input_tokens, finalMsg.usage?.output_tokens);
    } catch {}

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── History reads ────────────────────────────────────────────────
app.get("/api/history", (_, res) => res.json(readJSON(QUESTION_HIST_FILE, [])));
app.get("/api/tutor-history", (_, res) => res.json(readJSON(TUTOR_HIST_FILE, [])));

// ── Usage stats ──────────────────────────────────────────────────
app.get("/api/usage", (_, res) => {
  const u = readJSON(USAGE_FILE, { total_input_tokens: 0, total_output_tokens: 0 });
  // claude-sonnet: $3/MTok input, $15/MTok output
  const cost = (u.total_input_tokens * 3 + u.total_output_tokens * 15) / 1_000_000;
  res.json({ ...u, estimated_cost_usd: Math.round(cost * 10000) / 10000 });
});

// ── Heartbeat + auto-shutdown ────────────────────────────────────
let _shutdownTimer = null;
function scheduleShutdown() {
  if (_shutdownTimer) clearTimeout(_shutdownTimer);
  _shutdownTimer = setTimeout(() => {
    console.log("\n👋  Browser tab closed — shutting down.\n");
    process.exit(0);
  }, 15000);
}
// Give browser 30 seconds to open before expecting heartbeats
setTimeout(scheduleShutdown, 30000);

app.post("/api/heartbeat", (_, res) => {
  scheduleShutdown();
  res.json({ ok: true });
});

// ── Health check ─────────────────────────────────────────────────
app.get("/api/health", (_, res) => res.json({ ok: true }));

// ── SPA catch-all (must be last) ─────────────────────────────────
if (fs.existsSync(BUILD_DIR)) {
  app.get("*", (_, res) => res.sendFile(path.join(BUILD_DIR, "index.html")));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n✅ FE Civil app running on http://localhost:${PORT}\n`));
