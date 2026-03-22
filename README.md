# Aura Finance: AI-First Financial Data Orchestration Pipeline

**Aura Finance** is a robust AI-driven backend pipeline designed to transform unstructured raw transaction data into type-safe, structured financial insights. It orchestrates multiple LLMs and fallback mechanisms to ensure high availability, and serves the processed data to an interactive 3D visualization dashboard.

## System Architecture & Core Features

Unlike standard applications that rely on a single LLM API call, Aura is built with system integrity and resilience in mind, focusing on reliable data transformation through automated orchestration.

### 1. Hybrid Orchestration & Fallback Routing
To guarantee continuous data flow, reduce latency, and optimize API costs, the classification pipeline follows a strict multi-layered fallback strategy:
* **Level 1 (Dictionary & Cache):** Immediate resolution using a known-merchant dictionary with word-boundary regex matching, combined with an in-memory TTL cache for recurring transactions.
* **Level 2 (Gemini API):** Primary AI classification layer for fast, bulk transaction processing.
* **Level 3 (OpenAI GPT-4o-mini):** Secondary AI layer handling complex edge cases.
* **Level 4 (Mock Engine & Testing):** A deterministic fallback mechanism ensuring system availability during complete external API outages. Includes a `USE_MOCK_AI` flag to seamlessly bypass LLM calls during local development or testing.

### 2. Type-Safe AI Integration
To eliminate schema mismatches and malformed JSON outputs, the pipeline enforces strict data structures during AI inference:
* Leverages **GPT-4o-mini Structured Outputs** combined with **Pydantic** models (`response_format`) on the OpenAI fallback route.
* Guarantees that free-text transaction descriptions are reliably parsed into strictly typed JSON fields (e.g., Category, Confidence Score, Reason) before hitting the database or frontend.

### 3. Asynchronous Processing & Persistence
* Built with **FastAPI** to support asynchronous I/O, effectively handling batches of concurrent transaction classification requests.
* **Database Agnostic:** Configured with SQLAlchemy async engines supporting both SQLite (zero-setup for development) and PostgreSQL (for production deployments).
* **Chart-Ready Analytics:** The backend intelligently aggregates classified raw data into structured analytics endpoints, feeding the frontend dashboard.

---

## Tech Stack

**Backend & AI Pipeline**
* **Framework:** Python, FastAPI, SQLAlchemy (asyncpg/aiosqlite)
* **Data Validation:** Pydantic
* **AI Orchestration:** OpenAI API (GPT-4o-mini), Gemini API
* **Architecture:** Multi-LLM Fallback Routing, RESTful API

**Frontend (Visualization)**
* **Core:** React 18, TypeScript, Vite
* **3D Rendering:** Three.js, React Three Fiber, @react-three/drei

---

## Getting Started

### Prerequisites
* Python 3.10+
* Node.js 18+
* OpenAI API Key / Gemini API Key

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment variables
cp env.example .env
# Edit .env to add your API keys.
# Optional: Set DATABASE_URL to a PostgreSQL instance (defaults to SQLite)

# Start the FastAPI server
python main.py
```
The API documentation (Swagger UI) will be available at: `http://localhost:8000/docs`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The interactive dashboard will be available at: `http://localhost:3000`

---

## API Reference

### 1. Classify Single Transaction
`POST /api/v1/classify`

**Request:**
```json
{
  "description": "STARBUCKS SEOUL",
  "amount": 5.5,
  "currency": "USD"
}
```

**Response:**
```json
{
  "district": "Food & Cafe",
  "confidence": 0.95,
  "reason": "Recognized global coffee chain, mapped to Food & Beverage category.",
  "icon": "coffee",
  "color": "#f59e0b"
}
```

### 2. Batch Classification
`POST /api/v1/classify/batch`
Accepts an array of transaction objects and processes them asynchronously through the fallback pipeline.

---

## Development Roadmap

* **Phase 1 (Completed):** Implement Hybrid AI classification pipeline, SQLite/PostgreSQL persistence, and 3D visualization MVP.
* **Phase 2 (In Progress):** Transition from in-memory cache to Redis for distributed caching.
* **Phase 3 (Planned):** Harden PostgreSQL deployment (connection pooling, database migrations via Alembic).
* **Phase 4 (Exploration):** Evaluate event-driven ingestion (e.g., Apache Kafka) for high-throughput, asynchronous transaction streaming.

---

## License
MIT License
