# Aura Finance Backend - AI Classification & Analytics API

Multi-LLM fallback classification engine and financial analytics API built with FastAPI.

---

## API Endpoints

### Health Check
```
GET /
```

### Single Transaction Classification
```
POST /api/v1/classify
```

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

### Batch Transaction Classification
```
POST /api/v1/classify/batch
```

Accepts an array of transaction objects (max 100) and processes them through the fallback pipeline. Results are automatically persisted to the database.

**Request:**
```json
[
  {"description": "STARBUCKS", "amount": 5.5, "currency": "USD"},
  {"description": "NETFLIX.COM", "amount": 15.99, "currency": "USD"}
]
```

### District List
```
GET /api/v1/districts
```

### Analytics Overview
```
GET /api/v1/analytics/overview
```

Returns budget vs actual, category spend rates, AI advice, and chart-ready statistics (spending distribution, monthly trend, month-over-month, volatility).

### Analytics Insights
```
GET /api/v1/analytics/insights
```

Returns AI-generated smart alerts (warnings and praise) based on balance, spending, and goal progress.

---

## Getting Started

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp env.example .env
# Edit .env to add API keys (see Environment Variables section)

# Start the server
python main.py
```

Server runs at `http://localhost:8000`.
API documentation (Swagger UI): `http://localhost:8000/docs`

---

## Architecture

```
main.py                        # FastAPI entry point, route registration
├── routes/
│   ├── auth.py                # JWT authentication
│   ├── transactions.py        # Classify-and-save endpoints
│   ├── analytics.py           # Analytics overview, insights, goal forecast
│   ├── goals.py               # Goal CRUD and progress
│   ├── finance.py             # Finance overview
│   ├── banking.py             # Bank connection and sync (Tink API)
│   └── user_settings.py       # User preferences
├── services/
│   ├── ai_classifier.py       # Hybrid classification pipeline (Gemini -> OpenAI -> Mock)
│   ├── analytics_service.py   # Budget vs actual, trend, AI advice aggregation
│   ├── insights_service.py    # Rule-based smart alert generation
│   └── mock_ai_engine.py      # Mock AI modules (M1-M6 production interfaces)
├── schemas/
│   └── transaction.py         # Pydantic models (ClassificationResult, TransactionInput)
└── database/
    ├── engine.py              # SQLAlchemy async engine (SQLite dev / PostgreSQL prod)
    ├── models.py              # ORM models (Transaction, Budget, Goal, User, etc.)
    └── crud.py                # Database query layer
```

---

## Classification Pipeline

The `classify_transaction` function follows a strict fallback order:

1. **Rule-based (Dictionary + Regex):** Known-merchant dictionary with word-boundary regex matching. Returns immediately at 100% confidence.
2. **In-memory Cache:** TTL-based cache for previously classified descriptions.
3. **Gemini API (Primary):** Google Gemini 2.0 Flash for fast bulk processing.
4. **OpenAI GPT-4o-mini (Secondary Fallback):** Handles edge cases using Structured Outputs with `response_format=ClassificationResult` to enforce schema compliance.
5. **Mock Engine (Always-on Fallback):** Keyword-based deterministic classifier ensuring availability during full API outages.

Set `USE_MOCK_AI=true` in `.env` to bypass all LLM calls during development.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | No (optional fallback) |
| `GOOGLE_API_KEY` | Google Gemini API key | No (optional primary) |
| `USE_MOCK_AI` | Set `true` to skip all LLM calls | No (default: `false`) |
| `DATABASE_URL` | SQLAlchemy async DB URL | No (default: SQLite) |
| `API_HOST` | Server host | No (default: `0.0.0.0`) |
| `API_PORT` | Server port | No (default: `8000`) |

**DATABASE_URL examples:**
```
sqlite+aiosqlite:///./aura_finance.db       # default (development)
postgresql+asyncpg://user:pw@host:5432/db   # production
```

---

## Test Request

```bash
curl -X POST http://localhost:8000/api/v1/classify \
  -H "Content-Type: application/json" \
  -d '{"description": "STARBUCKS", "amount": 5.5}'
```

---

## Key Design Decisions

- **Async throughout:** FastAPI + SQLAlchemy async for concurrent request handling
- **Schema enforcement:** Pydantic `response_format` on the OpenAI path eliminates malformed JSON outputs
- **Graceful degradation:** Every analytics endpoint returns a safe empty structure instead of a 500 error
- **Database agnostic:** Switch between SQLite and PostgreSQL via a single `DATABASE_URL` environment variable
