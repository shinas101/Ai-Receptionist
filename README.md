# ABC Health Care — AI Virtual Medical Receptionist & Clinical Dashboard

An enterprise-ready, voice-enabled AI medical receptionist and clinical management system built with **LiveKit Agents**, **OpenAI**, **PostgreSQL (pgvector)** / **SQLite**, and a **React + Vite** live management dashboard.

---

## 🌟 Key Features

### 1. AI Voice Medical Receptionist (Mia)
- **Natural Conversations**: Conversational AI receptionist equipped with Voice Activity Detection (Silero VAD), real-time speech-to-text, LLM reasoning, and text-to-speech.
- **Autonomous Clinic Workflows**: Handles patient profile lookups by phone number, doctor recommendations by specialty, real-time slot checking, appointment booking, rescheduling, and cancellations.
- **Clinical Emergency Triage Protocol**: Automatically detects emergency/acute symptoms (severe chest pain, difficulty breathing, stroke symptoms) and instructs callers to dial emergency medical services (112 / 108 / 911) immediately.
- **Persistent Patient Memory**: Automatically retains and recalls patient preferences and consultation history via vector embeddings and semantic search.

### 2. Clinical Web Dashboard & Live Audio Visualizer
- **Modern React & Vite UI**: Dark-mode clinical interface with real-time audio waveform visualizers, active call status, and patient consultation details.
- **Live Interactive Calendar**: Filter appointments by status, search by patient phone or doctor name, and inspect patient records.
- **Admin & Clinic Settings**: In-browser PIN-protected settings management, customizable clinic hours, and Google Calendar sync controls.

### 3. Doctors & Specialties Roster
- **Dr. Rahul Nair**: General Physician (Room 102 · Primary Care Wing)
- **Dr. Priya Menon**: Consultant Dermatologist (Room 205 · Specialty Dermatology)
- **Dr. Anil Kumar**: Senior Cardiologist (Room 310 · Cardiac Center)

### 4. Dual Database Architecture
- **PostgreSQL + pgvector**: Production-grade async database connection with automatic schema migration and vector embeddings.
- **Resilient SQLite Fallback**: Zero-configuration local database fallback if PostgreSQL is not running.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python 3.10+** (or [uv](https://github.com/astral-sh/uv))
- **Node.js 18+** & npm
- **LiveKit Cloud account** (or self-hosted LiveKit server)
- **OpenAI API Key**

### 2. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
OPENAI_API_KEY=your_openai_api_key

# Optional: PostgreSQL Connection (defaults to localhost:5433 with SQLite fallback)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_receptionist
```

### 3. Install Python Dependencies

Using `uv` (recommended):
```bash
uv sync
```

Or using standard `pip`:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e .
```

### 4. Optional: Database Schema Setup (PostgreSQL)

If using PostgreSQL, enable pgvector and run the schema:
```bash
psql -U postgres -d ai_receptionist -f db.sql
```
*(Note: `app/memory/db.py` will also automatically verify and apply migrations upon startup).*

---

## 🏃 Running the Application

Run the 3 components (can run in separate terminal windows):

### Terminal 1: Token Server & Clinical API
```bash
uv run python token_server.py
# Server runs on http://localhost:8080
```

### Terminal 2: LiveKit Voice Agent Worker
```bash
uv run agent.py dev
```

### Terminal 3: Frontend Web Dashboard
```bash
cd frontend
npm install
npm run dev
# Dashboard runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser, click **"Start Call"**, and speak with Mia!

---

## 🛠️ Project Structure

```
ai-receptionist/
├── agent.py               # LiveKit AI voice agent (Mia's persona, clinical safety prompt, tools)
├── token_server.py        # aiohttp API server (JWT dispatch, appointments CRUD, settings API)
├── db.sql                 # PostgreSQL schema (customers, customer_memories, doctors, appointments)
├── pyproject.toml         # Python project configuration & dependencies
├── .env.example           # Environment template for credentials
├── .gitignore             # Configured git ignore rules
├── app/
│   ├── google_calendar.py # Google Calendar API integration
│   ├── settings.py        # Persistent clinic configuration & admin authentication
│   ├── tools.py           # Receptionist scheduling tools (booking, checking availability, slots)
│   └── memory/
│       ├── db.py          # PostgreSQL pool initialization, SQLite fallback, auto-migration
│       ├── embeddings.py  # Semantic vector embedding generator
│       ├── service.py     # Database queries for doctors, customers, and appointments
│       └── tools.py       # MemoryTools (find_customer, save_customer, remember, recall)
├── data/
│   └── settings.json      # Clinic settings and default configuration
└── frontend/              # React + Vite frontend application
    ├── src/
    │   ├── components/    # LiveCalendar, AgentSidePanel, AudioVisualizer, Header
    │   ├── hooks/         # useLiveKit WebRTC connection hook
    │   ├── services/      # REST API client
    │   └── App.jsx        # Main clinical workspace view
    └── package.json       # Frontend dependencies
```

---

## 🔒 Security & Privacy

- All sensitive credentials (`.env`, `credentials.json`, tokens, private keys) are strictly ignored by `.gitignore`.
- Admin endpoints require PIN verification (`data/settings.json`).
- LiveKit WebRTC tokens are minted securely per session with granular room permissions.

---

## 📄 License
This project is open-source under the MIT License.
