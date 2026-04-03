# FE Civil Practice Exam App

An AI-powered practice exam for the **NCEES Fundamentals of Engineering (FE) Civil** exam. The app generates realistic, multiple-choice questions using Claude (Anthropic's AI), complete with step-by-step solutions, wrong-answer explanations, and a live tutor you can chat with for follow-up help.

---

## What You Need Before Starting

1. **Node.js v18 or newer** -- this is the runtime that powers the app.
   - Download it from [nodejs.org](https://nodejs.org/) (choose the LTS version).
   - After installing, open Terminal and verify it's working:
     ```
     node --version
     ```
     You should see something like `v18.x.x` or higher.

2. **An Anthropic API key** -- this lets the app talk to Claude to generate questions.
   - Create an account at [console.anthropic.com](https://console.anthropic.com/).
   - Go to **API Keys** and create a new key. It will start with `sk-ant-...`.
   - You'll need a payment method on file -- typical usage costs around **$0.01-0.02 per question** (a few cents per study session).

3. **macOS** -- the launcher scripts use macOS-specific features (Terminal window control, the `open` command, etc.). The core app will work on other operating systems, but you'd need to start the server manually with `cd server && node index.js`.

---

## Setup (First Time Only)

### Step 1: Open Terminal

Press **Cmd + Space**, type **Terminal**, and hit Enter. You'll see a command prompt where you can type commands.

### Step 2: Navigate to the App Folder

Use the `cd` (change directory) command to navigate into the app folder. For example, if you put the app in your Documents folder:

```bash
cd ~/Documents/fe-civil-app
```

> **Tip:** You can also type `cd ` (with a space after it) and then drag the `fe-civil-app` folder from Finder directly into the Terminal window -- it will paste the full path for you.

### Step 3: Set Up Your API Key

Copy the example environment file and add your key:

```bash
cp server/.env.example server/.env
```

Now open the new file in a text editor:

```bash
open -e server/.env
```

Replace `sk-ant-your-key-here` with your actual API key from Anthropic. Save and close the file.

### Step 4: Make the Launch Scripts Executable

This tells macOS it's okay to run these scripts:

```bash
chmod +x start.sh create_shortcut.sh
```

That's it for setup! Everything else (installing dependencies, building the app) happens automatically the first time you launch.

---

## Running the App

### Option A: Run from Terminal

From inside the `fe-civil-app` folder, run:

```bash
./start.sh
```

The first launch will take about 30-60 seconds while it installs packages and builds the app. Subsequent launches are much faster. Your browser will automatically open to **http://localhost:3000** when the app is ready.

**To stop the app:** close the browser tab (the server shuts down automatically), or press **Ctrl + C** in Terminal.

### Option B: Create a Dock Shortcut (One-Click Launch)

If you want to launch the app with a single click from your Dock:

```bash
./create_shortcut.sh
```

This creates an app called **FE Civil Exam** in your `~/Applications` folder. A Finder window will open -- drag it to your Dock. From then on, just click the icon to start studying. Closing the browser tab shuts everything down (server + terminal window).

---

## Features

### AI-Generated Practice Questions

- Covers all **14 FE Civil topic areas**, weighted by how frequently they appear on the actual exam:
  - Mathematics & Statistics, Ethics & Professional Practice, Engineering Economics, Statics, Dynamics, Mechanics of Materials, Materials, Fluid Mechanics, Surveying, Water Resources & Environmental, Structural Engineering, Geotechnical Engineering, Transportation Engineering, and Construction Engineering
- Choose your **difficulty level** (Easy, Medium, or Hard) and **session length** (5, 10, or 15 questions)
- Every question includes a **detailed step-by-step solution** and explanations for why each wrong answer is incorrect
- Questions use both **SI and USCS units**, just like the real exam
- Responses stream in word-by-word so you see progress immediately

### Live Tutor Chat

After answering a question, you can ask the AI tutor follow-up questions -- "Why can't I use this formula here?", "Can you explain that step differently?", etc. The tutor remembers the full context of the question you're working on so it can give relevant, specific answers.

### Formula Lookup

Need a formula during practice? Use the built-in formula lookup to search for any concept (e.g., "moment of inertia", "Manning's equation") and get the relevant formulas along with the FE Reference Handbook section they come from -- no need to leave the question screen.

### FE Reference Handbook Viewer

Place a copy of the NCEES FE Reference Handbook PDF anywhere in the app's root folder (any file with "handbook" in the name). The app detects it automatically and adds an **Open Handbook** button that opens the full PDF in a new browser tab -- just like having it available during the real exam. The file is gitignored so it won't be committed.

### Study History & Progress Tracking

- Browse all your past questions, answers, and tutor conversations
- See how long each question took and your average response time
- View your results broken down by topic area after each session
- Retry questions you got wrong to reinforce weak areas

### Smart Question Prefetching

While you're reviewing your answer and the explanation, the app silently loads the next question in the background so there's no wait time when you're ready to move on.

### Usage & Cost Tracking

The home screen shows your running total of API usage and estimated cost, so there are no surprises on your Anthropic bill.

### Auto-Shutdown

Closing the browser tab automatically stops the server and closes the Terminal window -- no need to manually kill anything.

---

## Cost Estimate

The app uses `claude-sonnet-4-20250514`. Here's roughly what each session costs:

| Session | Questions | Est. cost |
|---------|-----------|-----------|
| Short   | 5         | ~$0.02    |
| Medium  | 10        | ~$0.04    |
| Long    | 15        | ~$0.06    |

Tutor follow-ups and formula lookups add a small amount on top. A full month of daily practice sessions runs roughly **$1-2 total**.

---

## Project Structure

```
fe-civil-app/
├── client/              # React frontend
│   ├── src/
│   │   ├── App.js       # Main application component (all screens & logic)
│   │   └── index.js     # Entry point
│   └── public/
│       └── index.html   # HTML shell with fonts & dark theme
│
├── server/              # Express backend
│   ├── index.js         # API server & Claude integration
│   ├── .env             # Your API key (not committed to git)
│   └── .env.example     # Template for .env
│
├── data/                # Auto-created local storage (gitignored)
│   ├── question_history.json   # All answered questions & results
│   ├── tutor_history.json      # Tutor chat conversations
│   └── usage.json              # Cumulative token usage & cost
│
├── start.sh             # Main launcher script
├── create_shortcut.sh   # macOS Dock shortcut creator
└── .gitignore
```

---

## Troubleshooting

### "ANTHROPIC_API_KEY is not set"

Make sure you created the `server/.env` file (Step 3 above) and it contains your key:

```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

### Port 3000 is already in use

Another app is using that port. Free it up with:

```bash
lsof -ti:3000 | xargs kill
```

Then run `./start.sh` again.

### The build step is slow or fails

The first build compiles the React frontend and can take 30-60 seconds -- this is normal. If it fails, make sure Node.js is installed correctly (`node --version` should return v18+). You can also try clearing and reinstalling everything:

```bash
rm -rf client/node_modules server/node_modules client/build
./start.sh
```

### API key not working

Make sure the key starts with `sk-ant-` and that you have a credit balance at [console.anthropic.com](https://console.anthropic.com/).

### App doesn't open after clicking the Dock icon

The first launch builds the client (~30-60 seconds). Wait for the Terminal window to show "Starting on http://localhost:3000" before expecting the browser to open. Subsequent launches are fast.

### Force a rebuild after editing source files

```bash
rm -rf client/build
./start.sh
```

The app will detect the missing build and recompile automatically.
