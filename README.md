# ABC Health Care — Clinical Voice AI & Management Platform

A production-grade, voice-driven virtual receptionist and clinical scheduling system built with **LiveKit Agents**, **OpenAI**, **PostgreSQL with pgvector**, and **React**. Designed for outpatient clinics that need reliable call triage, natural multi-turn patient booking, and administrative oversight without relying on third-party SaaS silos.

![ABC Health Care Clinical Dashboard & Voice Assistant](docs/screenshots/dashboard.png)

---

## 💡 Why This Exists

Most medical scheduling bots are rigid IVR menus or sluggish text-based wrappers. ABC Health Care is designed as an interactive, real-time voice pipeline that operates over WebRTC with sub-second turnaround times. Patients talk naturally, interrupt when needed, schedule or reschedule appointments by phone number, and receive safety guidance when presenting acute symptoms.

Behind the voice interface sits a clinical management workspace where reception staff can audit upcoming appointments in real time, inspect patient conversation memories, adjust clinic operating hours, and verify system metrics.

---

## 🏗️ System Architecture

The platform separates the **real-time media pipeline** from the **administrative control plane** to isolate audio latency from database query spikes:

```
                            [ Web Browser / Client ]
                                   │        │
                   WebRTC Audio    │        │ HTTPS / REST
                 (Microphone / SPK)│        │ (Appointments, Admin PIN, Stats)
                                   ▼        ▼
                      ┌────────────────┐ ┌───────────────────────────┐
                      │ LiveKit Server │ │ Nginx Reverse Proxy (443) │
                      │ (Cloud / SFU)  │ │ Rate-Limiting & TLS Term. │
                      └───────┬────────┘ └─────────────┬─────────────┘
                              │                        │
                     Outbound │ WebSockets             │ http://token_server:8080
                              ▼                        ▼
               ┌──────────────────────────┐ ┌───────────────────────────┐
               │  LiveKit Agent (worker)  │ │ Clinical API (aiohttp)    │
               │  Mia Voice Persona       │ │ JWT Minting & REST CRUD   │
               │  - Silero VAD            │ └─────────────┬─────────────┘
               │  - Whisper / Realtime STT│               │
               │  - GPT-4o Triage/Tools   │               │
               │  - Cartesia / OpenAI TTS │               │
               └──────────────┬───────────┘               │
                              │                           │
                              ▼                           ▼
               ┌─────────────────────────────────────────────────────────┐
               │                   Dual Database Engine                  │
               │   Primary: PostgreSQL 16 + pgvector (Async connection)  │
               │   Fallback: In-Process Resilient SQLite (clinic.db)     │
               └─────────────────────────────────────────────────────────┘
```

### Real-Time Voice Pipeline
1. **Transport Layer**: Browser establishes a bidirectional WebRTC session with the LiveKit SFU.
2. **Barge-In Voice Activity Detection (Silero VAD)**: Detects human speech onset locally in streaming frames, instantly canceling in-flight text-to-speech so Mia never talks over patients.
3. **Clinical Reasoning & Safety Triage (LLM)**: Evaluates patient utterances against clinical guardrails. If red-flag symptoms (e.g. crushing chest pain, numbness, respiratory collapse) are detected, Mia immediately halts booking and directs the caller to emergency services (112 / 108 / 911).
4. **Tool Execution**: Agent invokes deterministic functions against the clinic database: customer identification, doctor schedule validation, appointment reservation, and vector memory recall.
5. **Streaming Speech Synthesis**: Synthesizes and pushes audio chunks back across the WebRTC track with minimal latency.

---

## ⚡ Core Engineering Highlights

### 1. Persistent Patient Memory (Vector Embeddings)
- Conversations automatically generate semantic memory entries stored with 1536-dimensional embeddings.
- When an existing patient calls back with their phone number, previous preferences (e.g. *"prefers morning slots"*, *"history of seasonal asthma"*) are retrieved using cosine similarity search and injected into the prompt context.

### 2. Zero-Configuration Dual Database Engine
- **PostgreSQL + pgvector** serves as the production storage layer using `asyncpg` with automated schema migrations and seed scripts.
- If PostgreSQL is unreachable or running in resource-constrained local environments, the backend **transparently switches to an embedded SQLite database** without throwing fatal crashes or dropping connections.

### 3. Hardened Reverse Proxy & Gateway
- Containerized behind an **Nginx** ingress proxy handling TLS 1.2/1.3 termination.
- **Leaky-Bucket Rate Limiting**: Tiered limits protect token minting (`2 req/s`) and clinical CRUD routes (`10 req/s`) with burst queues and standard JSON HTTP 429 errors.
- **Dynamic CORS Whitelisting**: Restricts API calls to approved clinic origins while enabling development across localhost and local IPs.
- **Domainless HTTPS**: Ships with automated SAN SSL generator (`scripts/generate_ssl.py`) for zero-cost secure local/IP deployments without needing a registered domain.

---

## 📁 Repository Structure

```
ai-receptionist/
├── agent.py               # Voice worker: LiveKit agent, triage logic, and tool bindings
├── token_server.py        # aiohttp API: JWT minting, appointment CRUD, clinic settings
├── db.sql                 # PostgreSQL DDL schema with pgvector extensions & indexes
├── docker-compose.yml     # Multi-container orchestration (Postgres, API, Nginx, Agent)
├── Dockerfile             # Production worker image for LiveKit Agent (agent.py start)
├── Dockerfile.api         # Production web image for REST API & Token Server
├── pyproject.toml         # Python project configuration (uv compatible)
├── requirements.txt       # Frozen pip dependencies for standard buildpacks
├── Procfile               # Heroku formation (web: token_server.py, worker: agent.py)
├── runtime.txt            # Heroku runtime declaration (python-3.12.7)
├── app.json               # Heroku 1-Click deploy manifest
├── fly.toml               # Fly.io edge deployment configuration
│
├── app/
│   ├── google_calendar.py # Optional two-way synchronization with Google Calendar API
│   ├── settings.py        # Clinic hours, slot duration, and admin PIN verification
│   ├── tools.py           # Scheduling logic: slot checking, booking, cancellations
│   └── memory/
│       ├── db.py          # Unified database pool, auto-migration & SQLite fallback
│       ├── embeddings.py  # OpenAI text-embedding-3-small vector generator
│       ├── service.py     # Data access layer for doctors, patients, and bookings
│       └── tools.py       # MemoryTools: search, store, and recall patient memories
│
├── nginx/
│   ├── nginx.conf         # Ingress rules: TLS, rate-limiting, and CORS headers
│   └── ssl/               # Self-signed X.509 certificates and keys for local HTTPS
│
├── scripts/
│   └── generate_ssl.py    # Python OpenSSL/Cryptography script for local SAN certificates
│
├── k8s/
│   └── agent-deployment.yaml # Kubernetes Deployment and Secret manifests
│
├── docs/
│   └── screenshots/       # Dashboard and application media
│
└── frontend/              # Clinical dashboard web application
    ├── src/
    │   ├── components/    # LiveCalendar, AgentSidePanel, AudioVisualizer, Header
    │   ├── hooks/         # useLiveKit WebRTC client connection hook
    │   ├── services/      # REST API client
    │   └── App.jsx        # Main single-page clinical dashboard layout
    └── package.json       # React, Vite, Lucide-React, and LiveKit Client
```

---

## 🛠️ Getting Started Locally

### Prerequisites
- **Python 3.11+** (using [uv](https://github.com/astral-sh/uv) is recommended)
- **Node.js 18+** & npm
- **LiveKit Cloud Project** (Credentials: URL, API Key, API Secret)
- **OpenAI API Key**

### 1. Clone & Configure Environment
```bash
git clone https://github.com/shinas101/Ai-Receptionist.git
cd ai-receptionist
cp .env.example .env
```

Edit `.env` with your credentials:
```ini
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
OPENAI_API_KEY=sk-your_openai_key

# Optional: PostgreSQL Connection (defaults to localhost:5433 with automatic SQLite fallback)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_receptionist
```

### 2. Install Dependencies

**Backend:**
```bash
# Using uv (fastest)
uv sync

# Or using standard pip
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

---

## 🏃 Running in Development

Run each component in a separate terminal window:

### 1. Token Dispatch & Clinical API
```bash
uv run python token_server.py
# Running on http://localhost:8080
```

### 2. LiveKit Agent Worker (Hot Reload Mode)
```bash
uv run agent.py dev
# Connects outbound to LiveKit Cloud and listens for room dispatches
```

### 3. Frontend Clinical Dashboard
```bash
cd frontend
npm run dev
# Dashboard running on http://localhost:5173
```

Visit `http://localhost:5173`, click **"Start Consultation"**, and begin speaking with Mia.

---

## 🚀 Production Deployment Options

### Option A: Full-Stack Docker Compose (Recommended for Self-Hosting / VPS)
Runs PostgreSQL with `pgvector`, the Clinical API, the Nginx SSL gateway, and the production LiveKit daemon worker:

```bash
# 1. Generate SSL certificates for localhost / server IP (if needed)
uv run python scripts/generate_ssl.py

# 2. Launch all services
docker compose up --build -d
```
- **HTTPS Gateway**: `https://localhost` (port 443 with TLS 1.2/1.3 and automatic HTTP 80 redirect).
- **Protected Network**: PostgreSQL and the Token Server operate on a private internal bridge network without exposing raw ports to the internet.

### Option B: Heroku Deployment
The repository includes a validated `Procfile`, `runtime.txt`, and `app.json`:

```bash
# 1. Create app and attach Postgres
heroku create ai-receptionist-clinic
heroku addons:create heroku-postgresql:essential-0

# 2. Set environment secrets
heroku config:set \
  LIVEKIT_URL="wss://your-project.livekit.cloud" \
  LIVEKIT_API_KEY="your_api_key" \
  LIVEKIT_API_SECRET="your_api_secret" \
  OPENAI_API_KEY="your_openai_key" \
  ADMIN_PIN="1234"

# 3. Deploy and scale formation
git push heroku main
heroku ps:scale web=1 worker=1
```

### Option C: Edge Agent Worker on Fly.io
LiveKit workers establish outbound WebSocket connections to LiveKit Cloud, meaning agent daemons require **zero open incoming ports**:

```bash
fly secrets set \
  LIVEKIT_URL="wss://your-project.livekit.cloud" \
  LIVEKIT_API_KEY="your_api_key" \
  LIVEKIT_API_SECRET="your_api_secret" \
  OPENAI_API_KEY="your_openai_key" \
  DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/ai_receptionist"

fly deploy
```

### Option D: Kubernetes (AWS EKS / GCP GKE)
For high-traffic operations requiring auto-scaled agent worker pools:

```bash
kubectl apply -f k8s/agent-deployment.yaml
```

---

## 📡 REST API Reference

| Endpoint | Method | Description | Auth / Headers |
|---|---|---|---|
| `/api/token` | `GET` | Mints a scoped LiveKit WebRTC token with room grant | Public |
| `/api/appointments` | `GET` | Lists appointments (supports `doctor_id`, `status`, `date`, `search`) | Public |
| `/api/appointments` | `POST` | Manually books a new clinic appointment | Public |
| `/api/appointments/{id}` | `GET` | Retrieves full appointment details | Public |
| `/api/appointments/{id}` | `PATCH` | Updates appointment times, assigned doctor, or status | Public |
| `/api/appointments/{id}` | `DELETE` | Cancels and removes an appointment record | Public |
| `/api/doctors` | `GET` | Returns list of clinic doctors, specialties, and rooms | Public |
| `/api/stats` | `GET` | Dashboard KPI summary (total, scheduled, completed, cancelled) | Public |
| `/api/settings` | `GET` | Retrieves clinic operating hours, slot intervals, calendar sync | Public |
| `/api/settings` | `POST` | Modifies clinic configuration parameters | `X-Admin-Pin` |
| `/api/admin/verify-pin` | `POST` | Validates security PIN for privileged management actions | Public |

---

## 🔒 Security, Compliance & Data Privacy

- **Minimal PHI Surface**: Patient records are keyed strictly by phone number without collecting unnecessary identifiers.
- **Granular WebRTC Token Scopes**: Tokens generated by `/api/token` are scoped strictly to individual consultation rooms with time-to-live restrictions and disabled recording permissions.
- **Network Level Rate-Limiting**: The Nginx ingress layer protects endpoints from brute-force token minting or denial-of-service through IP-based leaky-bucket queues.
- **Admin PIN Protection**: Clinic settings and schedule modifications require PIN verification before write operations are persisted.
- **Strict Credential Hygiene**: All API keys, database URLs, and OAuth secrets are governed by `.env` and excluded from version control via `.gitignore`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
