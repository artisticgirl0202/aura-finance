"""
🤖 Aura Finance — AI Transaction Classifier
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Primary  : Google Gemini 2.0 Flash
           - 무료 tier: 1,500 req/day · 1,000,000 tokens/day
           - JSON Schema 강제 출력 (파싱 오류 0%)
           - 응답 < 1.5 s

Fallback : Mock AI (keyword-based)
           - API 키 미설정 / Rate limit / Safety block 시 자동 전환
           - 오프라인에서도 항상 동작

Architecture (Hybrid — Rule-first):
  classify_transaction()
      ├── COMMON_MERCHANTS lookup?  → return immediately (100% confidence)
      ├── Cache hit?  → return cached
      ├── USE_MOCK_AI=true?  → mock_classify()
      ├── GOOGLE_API_KEY set? → gemini_classify()  [primary]
      │       └── fail? → mock_classify()          [fallback-1]
      └── OPENAI_API_KEY set? → openai_classify()  [fallback-2]
              └── fail? → mock_classify()          [fallback-3]
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from typing import Optional

from dotenv import load_dotenv
from schemas.transaction import CityDistrict, ClassificationResult

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── COMMON_MERCHANTS: Rule-based hybrid classification (keys = lowercase) ─────
# Well-known global / Northern European brands → instant match, no AI call.
# Add new entries as needed. Longest keys first when matching (via sorted).
COMMON_MERCHANTS: dict[str, str] = {
    # Food & Cafe (coffee chains, cafes, restaurants)
    "espresso house": "Food & Cafe",
    "espressohouse": "Food & Cafe",
    "starbucks": "Food & Cafe",
    "mcdonald's": "Food & Cafe",
    "mcdonalds": "Food & Cafe",
    "burger king": "Food & Cafe",
    "subway": "Food & Cafe",
    "costa coffee": "Food & Cafe",
    "costa": "Food & Cafe",
    "dunkin": "Food & Cafe",
    "tim hortons": "Food & Cafe",
    "pret a manger": "Food & Cafe",
    "greggs": "Food & Cafe",
    "joe & the juice": "Food & Cafe",
    "wayne's coffee": "Food & Cafe",
    "waynes coffee": "Food & Cafe",
    "max hamburgare": "Food & Cafe",
    "mcdonald": "Food & Cafe",
    "pizza hut": "Food & Cafe",
    "domino's": "Food & Cafe",
    "dominos": "Food & Cafe",
    # Groceries (→ Food & Cafe — closest district)
    "ica": "Food & Cafe",
    "ica maxi": "Food & Cafe",
    "ica supermarket": "Food & Cafe",
    "coop": "Food & Cafe",
    "coop konsum": "Food & Cafe",
    "lidl": "Food & Cafe",
    "aldi": "Food & Cafe",
    "willys": "Food & Cafe",
    "hemkop": "Food & Cafe",
    "tesco": "Food & Cafe",
    "sainsbury": "Food & Cafe",
    "asda": "Food & Cafe",
    "whole foods": "Food & Cafe",
    "trader joe": "Food & Cafe",
    "axelsson": "Food & Cafe",
    # Shopping
    "amazon": "Shopping",
    "amazon.com": "Shopping",
    "ikea": "Shopping",
    "h&m": "Shopping",
    "zara": "Shopping",
    "walmart": "Shopping",
    "target": "Shopping",
    "ebay": "Shopping",
    "zalando": "Shopping",
    "asos": "Shopping",
    "mediamarkt": "Shopping",
    "elgiganten": "Shopping",
    "clas ohlson": "Shopping",
    # Entertainment
    "spotify": "Entertainment",
    "netflix": "Entertainment",
    "disney": "Entertainment",
    "disney+": "Entertainment",
    "hbo": "Entertainment",
    "hbo max": "Entertainment",
    "apple music": "Entertainment",
    "youtube premium": "Entertainment",
    "youtube music": "Entertainment",
    "prime video": "Entertainment",
    "playstation": "Entertainment",
    "xbox": "Entertainment",
    "steam": "Entertainment",
    "nintendo": "Entertainment",
    "deezer": "Entertainment",
    "tidal": "Entertainment",
    "audible": "Entertainment",
    # Transport
    "uber": "Transport",
    "lyft": "Transport",
    "bolt": "Transport",
    "taxi": "Transport",
    "tfl": "Transport",
    "tfl.gov": "Transport",
    "sj": "Transport",
    "vy": "Transport",
    "sas": "Transport",
    "norwegian": "Transport",
    "ryanair": "Transport",
    "easyjet": "Transport",
    "citymapper": "Transport",
    "moovit": "Transport",
    "preem": "Transport",
    "circle k": "Transport",
    "okq8": "Transport",
    # Housing & Utility
    "vattenfall": "Housing & Utility",
    "telia": "Housing & Utility",
    "telenor": "Housing & Utility",
    "comhem": "Housing & Utility",
    "bahnhof": "Housing & Utility",
    # Healthcare
    "apotek": "Healthcare",
    "apoteket": "Healthcare",
    "boots": "Healthcare",
    "cvs": "Healthcare",
    "walgreens": "Healthcare",
    # Finance
    "aws": "Finance",
    "google cloud": "Finance",
    "microsoft azure": "Finance",
    "digitalocean": "Finance",
    # Freelance (income)
    "upwork": "Freelance",
    "fiverr": "Freelance",
    "toptal": "Freelance",
    "contra": "Freelance",
    # Rental Income
    "airbnb": "Rental Income",
    "booking.com": "Rental Income",
    "vrbo": "Rental Income",
    # Salary
    "payroll": "Salary",
    "adp payroll": "Salary",
    "gusto payroll": "Salary",
    # Side Income
    "dividend": "Side Income",
    "cashback": "Side Income",
    "swagbucks": "Side Income",
    "rakuten": "Side Income",
}

# ── District metadata ─────────────────────────────────────────────────────────

DISTRICT_ICON_MAP: dict[CityDistrict, str] = {
    CityDistrict.FOOD_CAFE:      "coffee",
    CityDistrict.SHOPPING:        "shopping-bag",
    CityDistrict.HOUSING:        "home",
    CityDistrict.ENTERTAINMENT:  "film",
    CityDistrict.TRANSPORT:      "car",
    CityDistrict.HEALTHCARE:     "heart-pulse",
    CityDistrict.EDUCATION:      "graduation-cap",
    CityDistrict.FINANCE:        "landmark",
    CityDistrict.FREELANCE:      "code",
    CityDistrict.RENTAL_INCOME:  "home",
    CityDistrict.SALARY:         "briefcase",
    CityDistrict.SIDE_INCOME:     "zap",
    CityDistrict.UNKNOWN:        "help-circle",
}

DISTRICT_COLOR_MAP: dict[CityDistrict, str] = {
    CityDistrict.FOOD_CAFE:      "#f59e0b",
    CityDistrict.SHOPPING:      "#ec4899",
    CityDistrict.HOUSING:       "#3b82f6",
    CityDistrict.ENTERTAINMENT:  "#8b5cf6",
    CityDistrict.TRANSPORT:      "#10b981",
    CityDistrict.HEALTHCARE:     "#ef4444",
    CityDistrict.EDUCATION:     "#06b6d4",
    CityDistrict.FINANCE:        "#fbbf24",
    CityDistrict.FREELANCE:      "#34d399",
    CityDistrict.RENTAL_INCOME:  "#a78bfa",
    CityDistrict.SALARY:         "#10b981",
    CityDistrict.SIDE_INCOME:    "#60a5fa",
    CityDistrict.UNKNOWN:       "#6b7280",
}

# Maps the string a model returns → CityDistrict enum
_DISTRICT_STR_MAP: dict[str, CityDistrict] = {
    "Food & Cafe":       CityDistrict.FOOD_CAFE,
    "Shopping":          CityDistrict.SHOPPING,
    "Housing & Utility": CityDistrict.HOUSING,
    "Entertainment":     CityDistrict.ENTERTAINMENT,
    "Transport":         CityDistrict.TRANSPORT,
    "Healthcare":        CityDistrict.HEALTHCARE,
    "Education":         CityDistrict.EDUCATION,
    "Finance":           CityDistrict.FINANCE,
    "Freelance":         CityDistrict.FREELANCE,
    "Rental Income":     CityDistrict.RENTAL_INCOME,
    "Salary":            CityDistrict.SALARY,
    "Side Income":       CityDistrict.SIDE_INCOME,
    "Unknown":           CityDistrict.UNKNOWN,
}

# ── In-memory cache (Redis-ready TTL pattern) ─────────────────────────────────

_cache: dict[str, tuple[ClassificationResult, float]] = {}
CACHE_TTL = 3600  # 1 hour


def _cache_get(key: str) -> Optional[ClassificationResult]:
    if key in _cache:
        result, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return result
        del _cache[key]
    return None


def _cache_set(key: str, result: ClassificationResult) -> None:
    _cache[key] = (result, time.time())


def _cache_key(description: str, amount: Optional[float]) -> str:
    raw = f"{description.lower().strip()}|{amount or ''}"
    return hashlib.md5(raw.encode()).hexdigest()


# ── Gemini classifier ─────────────────────────────────────────────────────────

# System prompt — concise but complete.
# Color/icon mapping is embedded so the model returns consistent values.
_GEMINI_SYSTEM = """\
You are the AI core of Aura Finance, a fintech app that visualises spending in a 3D city.
Classify each bank transaction into exactly one of 13 districts.

DISTRICTS (name → icon → hex color):
  Food & Cafe       → coffee           → #f59e0b    [starbucks, restaurant, cafe, coffee, ubereats, doordash, burger, bakery, dining, meal]
  Shopping          → shopping-bag     → #ec4899    [amazon, walmart, target, clothes, mall, grocery, supermarket, electronics, apple, shoes, market]
  Housing & Utility → home             → #3b82f6    [rent, mortgage, lease, electricity, water, gas, internet, utility, trash, maintenance, apartment]
  Entertainment     → film             → #8b5cf6    [netflix, spotify, cinema, movie, steam, game, concert, theater, youtube, disney, ticket]
  Transport         → car              → #10b981    [uber, lyft, train, bus, subway, taxi, gas, fuel, parking, flight, airline, transit, toll]
  Healthcare        → heart-pulse      → #ef4444    [pharmacy, hospital, clinic, doctor, dentist, medicine, health, fitness, gym, therapy]
  Education         → graduation-cap   → #06b6d4
  Finance           → landmark         → #fbbf24    [transfer, bank, fee, interest, atm, loan, credit, tax, insurance, investment]
  Freelance         → code             → #34d399    [upwork, fiverr, client, freelance, contract, project, design, consulting]
  Rental Income     → home             → #a78bfa    [tenant, airbnb, booking, rental, property, guest]
  Salary            → briefcase        → #10b981    [payroll, salary, wage, employer, paycheck, company, income]
  Side Income       → zap              → #60a5fa    [dividend, refund, bonus, cashback, survey, reward, sold, gig]
  Unknown           → help-circle      → #6b7280

RULES:
1. Respond ONLY in English. All output (reason, etc.) must be in English.
2. Understand global AND local brand names (all languages).
3. Decode codes: AWS*USAGE=Finance, TFL.GOV.UK=Transport, ICA=Food & Cafe.
4. confidence: 0.0–1.0 (honest — unknown brand = lower).
5. reason: ≤ 12 words, factual English.
6. Return the exact icon and color from the table above.

OUTPUT — valid JSON only, no markdown:
{"district":"<name>","confidence":0.95,"reason":"<reason>","icon":"<icon>","color":"<hex>"}
"""

_gemini_client = None  # lazy singleton


def _get_gemini_client():
    """Lazy-initialise the Gemini client (singleton, thread-safe via GIL)."""
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client

    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key or api_key == "your_google_api_key_here":
        logger.warning("⚠️  GOOGLE_API_KEY not set — Gemini disabled, using Mock AI")
        return None

    try:
        from google import genai  # type: ignore

        _gemini_client = genai.Client(api_key=api_key)
        logger.info("✅ Gemini 2.0 Flash client initialised (primary classifier)")
        return _gemini_client

    except Exception as exc:
        logger.error(f"❌ Gemini init failed: {exc}")
        return None


def _parse_district(raw: str) -> CityDistrict:
    """Map the district string from AI output to CityDistrict enum."""
    return _DISTRICT_STR_MAP.get(raw.strip(), CityDistrict.UNKNOWN)


def _merchant_lookup(description: str) -> Optional[tuple[CityDistrict, str]]:
    """
    Rule-based lookup. Returns (district, matched_key) if found, else None.
    Uses word-boundary matching to avoid false positives (e.g. 'ica' in 'medication').
    """
    normalized = " " + description.lower().strip() + " "
    for key in sorted(COMMON_MERCHANTS.keys(), key=len, reverse=True):
        pattern = r"\b" + re.escape(key) + r"\b"
        if re.search(pattern, normalized, re.IGNORECASE):
            raw = COMMON_MERCHANTS[key]
            district = _parse_district(raw)
            return (district, key)
    return None


def _build_merchant_result(district: CityDistrict, matched_key: str) -> ClassificationResult:
    """Build a ClassificationResult for rule-based merchant match (100% confidence)."""
    return ClassificationResult(
        district=district,
        confidence=1.0,
        reason=f"Known merchant: {matched_key}",
        icon=DISTRICT_ICON_MAP.get(district, "help-circle"),
        color=DISTRICT_COLOR_MAP.get(district, "#6b7280"),
    )


def _build_result(data: dict) -> ClassificationResult:
    district = _parse_district(data.get("district", "Unknown"))
    return ClassificationResult(
        district=district,
        confidence=float(data.get("confidence", 0.5)),
        reason=data.get("reason", "AI classification"),
        icon=data.get("icon") or DISTRICT_ICON_MAP[district],
        color=data.get("color") or DISTRICT_COLOR_MAP[district],
    )


_RATE_LIMIT_KEYWORDS = ("429", "quota", "rate", "RESOURCE_EXHAUSTED", "Too Many Requests")
_MAX_RETRIES = 1
_RETRY_DELAYS = (2,)
_gemini_quota_exhausted = False  # set True on persistent 429 — skips all future attempts

# ── Batch Gemini system prompt ─────────────────────────────────────────────

_GEMINI_BATCH_SYSTEM = """\
You are the AI core of Aura Finance, classifying bank transactions into 13 districts.

DISTRICTS (name → icon → hex color):
  Food & Cafe       → coffee           → #f59e0b
  Shopping          → shopping-bag     → #ec4899
  Housing & Utility → home             → #3b82f6
  Entertainment     → film             → #8b5cf6
  Transport         → car              → #10b981
  Healthcare        → heart-pulse      → #ef4444
  Education         → graduation-cap   → #06b6d4
  Finance           → landmark         → #fbbf24
  Freelance         → code             → #34d399
  Rental Income     → home             → #a78bfa
  Salary            → briefcase        → #10b981
  Side Income       → zap              → #60a5fa
  Unknown           → help-circle      → #6b7280

RULES:
1. Respond ONLY in English. All output (reason, etc.) must be in English.
2. Understand global AND local brand names (all languages).
3. confidence: 0.0–1.0 (honest — unknown brand = lower).
4. reason: ≤ 10 words, factual English.
4. Return the exact icon and color from the table above.
5. You will receive a JSON array of transactions. Return a JSON array of results,
   one per input, in the SAME ORDER.

INPUT FORMAT:  [{"id":0,"desc":"Starbucks"},{"id":1,"desc":"Netflix"}]
OUTPUT FORMAT: [{"id":0,"district":"Food & Cafe","confidence":0.95,"reason":"Global coffee chain","icon":"coffee","color":"#f59e0b"}, ...]
Output ONLY the JSON array — no markdown, no explanation.
"""


async def _gemini_classify_batch(
    items: list[tuple[str, Optional[float]]]
) -> Optional[list[Optional[ClassificationResult]]]:
    """
    Classify N transactions in a SINGLE Gemini API call.
    Returns list aligned with input, or None on failure.
    This reduces quota usage from N calls to 1 call.
    """
    global _gemini_quota_exhausted
    if _gemini_quota_exhausted:
        return None

    client = _get_gemini_client()
    if client is None:
        return None

    from google.genai import types  # type: ignore

    # Build compact JSON input
    payload = [
        {"id": i, "desc": desc, **({"amount": round(a, 2)} if a else {})}
        for i, (desc, a) in enumerate(items)
    ]
    import json as _json
    prompt = _json.dumps(payload, ensure_ascii=False)

    config = types.GenerateContentConfig(
        system_instruction=_GEMINI_BATCH_SYSTEM,
        response_mime_type="application/json",
        temperature=0.1,
        max_output_tokens=min(512 + len(items) * 80, 4096),
    )

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=prompt,
                config=config,
            )
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            data_list = _json.loads(raw)
            if not isinstance(data_list, list):
                raise ValueError("Expected JSON array from batch Gemini call")

            # Map id → result
            id_to_data = {item["id"]: item for item in data_list if isinstance(item, dict)}
            results: list[Optional[ClassificationResult]] = []
            for i in range(len(items)):
                d = id_to_data.get(i)
                results.append(_build_result(d) if d else None)

            logger.info(
                f"🤖 Gemini batch: {len(items)} transactions → "
                f"{sum(1 for r in results if r)} classified"
                + (f" [retry {attempt}]" if attempt > 0 else "")
            )
            return results

        except _json.JSONDecodeError as exc:
            logger.warning(f"⚠️  Gemini batch JSON error: {exc}")
            return None

        except Exception as exc:
            err = str(exc)
            is_rate_limit = any(kw in err for kw in _RATE_LIMIT_KEYWORDS)
            if is_rate_limit:
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_DELAYS[attempt]
                    logger.warning(f"⚠️  Gemini batch rate limit — retry in {delay}s…")
                    await asyncio.sleep(delay)
                    continue
                else:
                    _gemini_quota_exhausted = True
                    logger.warning("⚠️  Gemini quota exhausted — disabled for session")
            else:
                logger.error(f"❌ Gemini batch error: {exc}")
            return None

    return None


async def _gemini_classify(
    description: str,
    amount: Optional[float],
    few_shot_examples: Optional[list[dict]] = None,
) -> Optional[ClassificationResult]:
    """
    Call Gemini 2.0 Flash via google-genai SDK.
    Retries up to 2 times on rate-limit (429) before returning None.
    Returns None on unrecoverable failure so the caller falls back to Mock AI.
    """
    global _gemini_quota_exhausted
    if _gemini_quota_exhausted:
        return None  # quota already known exhausted — skip instantly

    client = _get_gemini_client()
    if client is None:
        return None

    from google.genai import types  # type: ignore

    prompt_parts = []
    if few_shot_examples:
        prompt_parts.append("User's past manual classifications (follow these preferences):")
        for ex in few_shot_examples[:5]:
            desc = ex.get("description", "")
            district = ex.get("district", "")
            reason = ex.get("reason", "")
            prompt_parts.append(f'  "{desc}" → {district} ({reason})')
        prompt_parts.append("")
    prompt_parts.append(f'Transaction: "{description}"')
    if amount:
        prompt_parts.append(f"  (Amount: ${amount:.2f})")
    prompt = "\n".join(prompt_parts)

    config = types.GenerateContentConfig(
        system_instruction=_GEMINI_SYSTEM,
        response_mime_type="application/json",
        temperature=0.1,
        max_output_tokens=256,
    )

    last_exc: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=prompt,
                config=config,
            )
            raw_text = response.text.strip()

            # Strip accidental markdown fences
            if raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1]
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:]

            data = json.loads(raw_text)
            result = _build_result(data)
            logger.info(
                f"🤖 Gemini: '{description[:35]}' → {result.district.value} "
                f"({result.confidence:.0%})"
                + (f" [retry {attempt}]" if attempt > 0 else "")
            )
            return result

        except json.JSONDecodeError as exc:
            logger.warning(
                f"⚠️  Gemini JSON parse error: {exc} | "
                f"raw: {getattr(locals().get('response'), 'text', '')[:120]}"
            )
            return None  # JSON error won't improve on retry

        except Exception as exc:
            last_exc = exc
            err = str(exc)
            is_rate_limit = any(kw in err for kw in _RATE_LIMIT_KEYWORDS)

            if is_rate_limit:
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_DELAYS[attempt]
                    logger.warning(
                        f"⚠️  Gemini rate limit (attempt {attempt + 1}/{_MAX_RETRIES + 1}) "
                        f"— retrying in {delay}s…"
                    )
                    await asyncio.sleep(delay)
                    continue  # retry
                else:
                    _gemini_quota_exhausted = True
                    logger.warning(
                        "⚠️  Gemini quota exhausted — disabled for this session, using Mock AI"
                    )
            elif "SAFETY" in err or "blocked" in err.lower():
                logger.warning(f"⚠️  Gemini safety block for '{description[:40]}': {exc}")
            else:
                logger.error(f"❌ Gemini unexpected error: {exc}")
            return None

    logger.warning(f"⚠️  Gemini gave up after {_MAX_RETRIES + 1} attempts: {last_exc}")
    return None


# ── OpenAI classifier (optional secondary fallback) ───────────────────────────

_openai_quota_exhausted = False  # set to True on 429 insufficient_quota to skip all future attempts


async def _openai_classify(
    description: str, amount: Optional[float]
) -> Optional[ClassificationResult]:
    """
    Call OpenAI gpt-4o-mini.
    Permanently skips if quota is exhausted (avoids 3×retries waste per transaction).
    Returns None on failure or missing key.
    """
    global _openai_quota_exhausted
    if _openai_quota_exhausted:
        return None  # already known to be out of credits — skip instantly

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        try:
            from openai import OpenAI  # type: ignore
        except ImportError:
            return None

        client = OpenAI(api_key=api_key, max_retries=0)  # no internal retries
        msg = f"Merchant: {description}"
        if amount:
            msg += f"\nAmount: {amount}"

        resp = await asyncio.to_thread(
            client.beta.chat.completions.parse,
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify the financial transaction into one of: "
                        "Food & Cafe, Shopping, Housing & Utility, Entertainment, "
                        "Transport, Healthcare, Education, Finance, "
                        "Freelance, Rental Income, Salary, Side Income, Unknown. "
                        "Return JSON: {district, confidence, reason, icon, color}"
                    ),
                },
                {"role": "user", "content": msg},
            ],
            response_format=ClassificationResult,
        )
        result = resp.choices[0].message.parsed
        if result:
            result.icon = result.icon or DISTRICT_ICON_MAP.get(result.district, "help-circle")
            result.color = result.color or DISTRICT_COLOR_MAP.get(result.district, "#6b7280")
            logger.info(f"🔵 OpenAI: '{description[:35]}' → {result.district.value}")
        return result

    except Exception as exc:
        err = str(exc)
        if "insufficient_quota" in err or "quota" in err.lower():
            _openai_quota_exhausted = True
            logger.warning("⚠️  OpenAI quota exhausted — disabled for this session.")
        elif "proxies" in err or "unexpected keyword" in err:
            _openai_quota_exhausted = True  # SDK incompatibility — disable permanently
            logger.warning("⚠️  OpenAI SDK incompatibility — disabled for this session.")
        else:
            logger.warning(f"⚠️  OpenAI fallback failed: {exc}")
        return None


# ── Mock classifier (always works) ───────────────────────────────────────────

def _mock_classify(
    description: str, amount: Optional[float]
) -> ClassificationResult:
    from services.mock_classifier import mock_classify_transaction  # avoid circular
    result = mock_classify_transaction(description, amount)
    result.reason = f"[Mock] {result.reason}"
    return result


# ── Public API ────────────────────────────────────────────────────────────────

async def classify_transaction(
    description: str,
    amount: Optional[float] = None,
    use_cache: bool = True,
    few_shot_examples: Optional[list[dict]] = None,
) -> ClassificationResult:
    """
    Classify a bank transaction description into a city district.

    Hybrid flow: COMMON_MERCHANTS (rule-based) first → then AI fallback chain:
      Gemini 2.0 Flash → OpenAI gpt-4o-mini → Mock AI (keyword)
    """
    start = time.time()
    key = _cache_key(description, amount)

    # 0. Rule-based: known merchant lookup (no AI call, 100% confidence)
    merchant_match = _merchant_lookup(description)
    if merchant_match:
        district, matched_key = merchant_match
        result = _build_merchant_result(district, matched_key)
        if use_cache:
            _cache_set(key, result)
        elapsed = time.time() - start
        logger.info(
            f"📋 Rule: '{description[:35]}' → {result.district.value} "
            f"(100%, {matched_key}, {elapsed:.3f}s)"
        )
        return result

    # 1. Cache
    if use_cache:
        cached = _cache_get(key)
        if cached:
            logger.debug(f"💾 Cache hit: '{description[:30]}'")
            return cached

    # 2. Force-mock mode
    if os.getenv("USE_MOCK_AI", "false").lower() == "true":
        result = _mock_classify(description, amount)
        if use_cache:
            _cache_set(key, result)
        return result

    # 3. Gemini (primary) — few_shot_examples로 사용자 수동 분류 패턴 학습
    result = await _gemini_classify(description, amount, few_shot_examples)

    # 4. OpenAI (secondary fallback)
    if result is None:
        result = await _openai_classify(description, amount)

    # 5. Mock AI (always-on last resort)
    if result is None:
        logger.warning(f"⚠️  All AI APIs failed for '{description[:40]}' — using Mock AI")
        result = _mock_classify(description, amount)

    if use_cache:
        _cache_set(key, result)

    elapsed = time.time() - start
    logger.info(
        f"✅ '{description[:35]}' → {result.district.value} "
        f"({result.confidence:.0%}, {elapsed:.2f}s)"
    )
    return result


async def batch_classify(
    descriptions: list[str],
    amounts: Optional[list[Optional[float]]] = None,
) -> list[ClassificationResult]:
    """
    Classify multiple transactions efficiently.

    Strategy (quota-aware):
      1. Return cache hits immediately.
      2. For uncached items: if Gemini available, classify ALL in ONE API call.
      3. Mock AI fallback for any remaining failures.

    This reduces N individual Gemini calls to at most 1 call per batch.
    """
    if not descriptions:
        return []

    amounts = amounts or [None] * len(descriptions)
    results: list[Optional[ClassificationResult]] = [None] * len(descriptions)

    # ── 1. Cache + rule-based merchant pass ───────────────────────────────────
    uncached_indices: list[int] = []
    for i, (desc, amt) in enumerate(zip(descriptions, amounts)):
        key = _cache_key(desc, amt)
        cached = _cache_get(key)
        if cached:
            logger.debug(f"💾 Cache hit [{i}]: '{desc[:30]}'")
            results[i] = cached
            continue
        # Rule-based: known merchant (no AI call)
        merchant_match = _merchant_lookup(desc)
        if merchant_match:
            district, matched_key = merchant_match
            r = _build_merchant_result(district, matched_key)
            _cache_set(key, r)
            results[i] = r
            logger.debug(f"📋 Rule [{i}]: '{desc[:30]}' → {district.value}")
        else:
            uncached_indices.append(i)

    if not uncached_indices:
        return [r for r in results if r is not None]

    # ── 2. Force-mock shortcut ───────────────────────────────────────────────
    if os.getenv("USE_MOCK_AI", "false").lower() == "true":
        for i in uncached_indices:
            r = _mock_classify(descriptions[i], amounts[i])
            _cache_set(_cache_key(descriptions[i], amounts[i]), r)
            results[i] = r
        return [r for r in results if r is not None]

    # ── 3. Single batch Gemini call for all uncached items ───────────────────
    items = [(descriptions[i], amounts[i]) for i in uncached_indices]
    batch_results = await _gemini_classify_batch(items)

    if batch_results:
        for idx, (i, gemini_result) in enumerate(zip(uncached_indices, batch_results)):
            if gemini_result:
                key = _cache_key(descriptions[i], amounts[i])
                _cache_set(key, gemini_result)
                results[i] = gemini_result
                logger.info(
                    f"✅ [{i}] '{descriptions[i][:35]}' → "
                    f"{gemini_result.district.value} ({gemini_result.confidence:.0%})"
                )

    # ── 4. Mock AI fallback for any that Gemini missed ───────────────────────
    for i in uncached_indices:
        if results[i] is None:
            r = _mock_classify(descriptions[i], amounts[i])
            _cache_set(_cache_key(descriptions[i], amounts[i]), r)
            results[i] = r

    elapsed_total = 0  # already logged per-item above
    return [r for r in results if r is not None]


def clear_cache() -> int:
    """Clear classification cache. Returns number of entries removed."""
    count = len(_cache)
    _cache.clear()
    logger.info(f"🗑️  Cache cleared ({count} entries)")
    return count
