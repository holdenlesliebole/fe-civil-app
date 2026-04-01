# FE Civil Practice Exam

AI-powered practice questions for the NCEES FE Civil CBT exam.

---

## Prerequisites

- **Node.js** v18 or later → https://nodejs.org  
  (check: `node --version`)
- An **Anthropic API key** → https://console.anthropic.com  
  (billing is pay-per-use — see cost estimate below)

---

## Setup (one time)

**1. Add your API key**

```bash
cp server/.env.example server/.env
```

Open `server/.env` and replace `sk-ant-your-key-here` with your real key.

**2. Make the scripts executable**

```bash
chmod +x start.sh create_shortcut.sh
```

---

## Running the app

```bash
./start.sh
```

On first run this builds the app (~30 seconds). After that it starts immediately. The browser opens automatically. **Close the browser tab to shut everything down.**

---

## Dock shortcut (macOS)

Run once to create a one-click launcher:

```bash
./create_shortcut.sh
```

A Finder window opens — drag **FE Civil Exam.app** to your Dock. Clicking it launches the app and opens your browser automatically. Closing the browser tab shuts the server down and closes the terminal window.

---

## Reference handbook

Place the NCEES FE Reference Handbook PDF anywhere in this folder. The app will detect it automatically and serve it at the **Open Handbook** button. The file is gitignored so it won't be committed.

---

## Features

- **All 14 FE Civil topic areas** — weighted by actual exam frequency
- **3 difficulty levels** — Easy, Medium, Hard
- **Streaming questions** — responses appear word-by-word
- **Question prefetching** — next question loads in the background
- **Step-by-step explanations** — full worked solution + why each wrong answer is wrong
- **Live tutor chat** — ask follow-up questions after any answer
- **Formula lookup** — type any concept during a question to get the formula and handbook section instantly
- **Reference handbook viewer** — open the full PDF in a browser tab
- **Study history** — every question and tutor conversation saved locally; browse, filter, and review past sessions
- **Time tracking** — see how long each question took; average time shown in history
- **API usage display** — running cost estimate shown on the home screen
- **Results screen** — score, topic breakdown, missed questions, retry missed option
- **Auto-shutdown** — closing the browser tab stops the server and closes the terminal

---

## Cost estimate

Using `claude-sonnet-4-20250514`:

| Session | Questions | Est. cost |
|---------|-----------|-----------|
| Short   | 5         | ~$0.02    |
| Medium  | 10        | ~$0.04    |
| Long    | 15        | ~$0.06    |

Tutor follow-ups and formula lookups add a small amount. A full month of daily sessions ≈ $1–2 total.

---

## Troubleshooting

**App doesn't open after clicking dock icon:**  
The first launch builds the client (~30s). Subsequent launches are fast.

**Port already in use:**
```bash
lsof -ti:3000 | xargs kill
```

**Force a rebuild** (after updating source files):
```bash
rm -rf client/build
```
Then relaunch — it will rebuild automatically.

**Dependencies not installing:**
```bash
cd server && npm install
cd ../client && npm install
```

**API key not working:**  
Make sure the key starts with `sk-ant-` and has a credit balance at console.anthropic.com.
