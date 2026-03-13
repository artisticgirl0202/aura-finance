"""
Real-time transaction simulator.
Generates random expense (70%), income (20%), and investment (10%) transactions.
"""

import random
from typing import Dict, Any


# ── Expense transactions (70%) ────────────────────────────────────────────────
EXPENSE_TRANSACTIONS = [
    # Food & Cafe
    {"description": "Starbucks Seoul Gangnam",   "amount_range": (3.5,   12.0),   "type": "expense", "category": "food"},
    {"description": "McDonald's Times Square",   "amount_range": (5.0,   15.0),   "type": "expense", "category": "food"},
    {"description": "Subway Sandwiches",         "amount_range": (6.0,   10.0),   "type": "expense", "category": "food"},
    {"description": "Domino's Pizza Downtown",   "amount_range": (15.0,  35.0),   "type": "expense", "category": "food"},
    {"description": "7-Eleven Store #4521",      "amount_range": (2.0,   20.0),   "type": "expense", "category": "food"},
    {"description": "Whole Foods Market",        "amount_range": (30.0, 120.0),   "type": "expense", "category": "food"},
    {"description": "Dunkin' Donuts",            "amount_range": (3.0,    8.0),   "type": "expense", "category": "food"},
    {"description": "KFC Restaurant",            "amount_range": (10.0,  25.0),   "type": "expense", "category": "food"},
    # Shopping
    {"description": "Apple Store Fifth Ave",     "amount_range": (50.0, 1200.0),  "type": "expense", "category": "shopping"},
    {"description": "Amazon.com Purchase",       "amount_range": (15.0,  500.0),  "type": "expense", "category": "shopping"},
    {"description": "Zara Fashion Store",        "amount_range": (30.0,  150.0),  "type": "expense", "category": "shopping"},
    {"description": "Nike Store Manhattan",      "amount_range": (40.0,  200.0),  "type": "expense", "category": "shopping"},
    {"description": "Target Retail",             "amount_range": (20.0,  100.0),  "type": "expense", "category": "shopping"},
    {"description": "Best Buy Electronics",      "amount_range": (50.0,  800.0),  "type": "expense", "category": "shopping"},
    {"description": "IKEA Furniture",            "amount_range": (30.0,  500.0),  "type": "expense", "category": "shopping"},
    # Entertainment
    {"description": "Netflix Subscription",      "amount_range": (9.99,  19.99),  "type": "expense", "category": "entertainment"},
    {"description": "Spotify Premium",           "amount_range": (9.99,  14.99),  "type": "expense", "category": "entertainment"},
    {"description": "Steam Game Purchase",       "amount_range": (5.0,   60.0),   "type": "expense", "category": "entertainment"},
    {"description": "Disney+ Streaming",         "amount_range": (7.99,  13.99),  "type": "expense", "category": "entertainment"},
    {"description": "Cinema Movie Ticket",       "amount_range": (12.0,  18.0),   "type": "expense", "category": "entertainment"},
    # Transport
    {"description": "Uber Trip - Downtown",      "amount_range": (8.0,   45.0),   "type": "expense", "category": "transport"},
    {"description": "Lyft Ride Share",           "amount_range": (7.0,   40.0),   "type": "expense", "category": "transport"},
    {"description": "Shell Gas Station",         "amount_range": (35.0,  80.0),   "type": "expense", "category": "transport"},
    {"description": "Metro Transit Pass",        "amount_range": (2.5,  120.0),   "type": "expense", "category": "transport"},
    {"description": "Airport Parking Fee",       "amount_range": (15.0,  60.0),   "type": "expense", "category": "transport"},
    # Housing & Utility
    {"description": "Comcast Internet Service",  "amount_range": (60.0, 120.0),   "type": "expense", "category": "housing"},
    {"description": "Electric Company Bill",     "amount_range": (50.0, 200.0),   "type": "expense", "category": "housing"},
    {"description": "Water Utility Payment",     "amount_range": (30.0,  80.0),   "type": "expense", "category": "housing"},
    # Healthcare
    {"description": "CVS Pharmacy",              "amount_range": (10.0, 150.0),   "type": "expense", "category": "healthcare"},
    {"description": "Walgreens Drugstore",       "amount_range": (8.0,  100.0),   "type": "expense", "category": "healthcare"},
    # Finance / Tech
    {"description": "AWS Cloud Services",        "amount_range": (20.0, 500.0),   "type": "expense", "category": "finance"},
    {"description": "Google Cloud Platform",     "amount_range": (15.0, 300.0),   "type": "expense", "category": "finance"},
    {"description": "GitHub Pro Subscription",   "amount_range": (4.0,   21.0),   "type": "expense", "category": "finance"},
]

# ── Income transactions (20%) ─────────────────────────────────────────────────
INCOME_TRANSACTIONS = [
    {"description": "Salary - Tech Corp",          "amount_range": (3000.0, 8000.0),  "type": "income", "category": "salary"},
    {"description": "Salary - Monthly Payroll",    "amount_range": (2500.0, 7000.0),  "type": "income", "category": "salary"},
    {"description": "Freelance - Upwork Project",  "amount_range": (200.0,  2000.0),  "type": "income", "category": "freelance"},
    {"description": "Freelance - Client Payment",  "amount_range": (150.0,  1500.0),  "type": "income", "category": "freelance"},
    {"description": "Quarterly Performance Bonus", "amount_range": (500.0,  5000.0),  "type": "income", "category": "bonus"},
    {"description": "Year-End Bonus",              "amount_range": (1000.0, 8000.0),  "type": "income", "category": "bonus"},
    {"description": "Rental Income - Apt 4B",      "amount_range": (800.0,  2500.0),  "type": "income", "category": "rental"},
    {"description": "Rental Income - Studio",      "amount_range": (600.0,  1800.0),  "type": "income", "category": "rental"},
    {"description": "Fiverr Gig Payment",          "amount_range": (50.0,   400.0),   "type": "income", "category": "side"},
    {"description": "YouTube Ad Revenue",          "amount_range": (30.0,   500.0),   "type": "income", "category": "side"},
]

# ── Investment transactions (10%) ─────────────────────────────────────────────
INVESTMENT_TRANSACTIONS = [
    {"description": "AAPL Stock Purchase",         "amount_range": (100.0,  3000.0), "type": "investment", "category": "stocks"},
    {"description": "TSLA Stock - Robinhood",      "amount_range": (100.0,  4000.0), "type": "investment", "category": "stocks"},
    {"description": "NVDA Stock Buy",              "amount_range": (200.0,  5000.0), "type": "investment", "category": "stocks"},
    {"description": "Bitcoin Purchase - Coinbase", "amount_range": (100.0,  5000.0), "type": "investment", "category": "crypto"},
    {"description": "Ethereum - Kraken",           "amount_range": (50.0,   2000.0), "type": "investment", "category": "crypto"},
    {"description": "Solana Purchase",             "amount_range": (50.0,   1500.0), "type": "investment", "category": "crypto"},
    {"description": "Vanguard S&P 500 ETF",        "amount_range": (200.0,  5000.0), "type": "investment", "category": "etf"},
    {"description": "iShares World ETF",           "amount_range": (150.0,  3000.0), "type": "investment", "category": "etf"},
    {"description": "Real Estate Fund - Fundrise", "amount_range": (500.0, 10000.0), "type": "investment", "category": "realestate"},
]

# ── Static classification maps (bypasses AI for non-expenses) ────────────────
INCOME_CLASSIFICATIONS: Dict[str, Dict[str, Any]] = {
    "salary":    {"district": "Salary",        "color": "#10b981", "icon": "briefcase",  "confidence": 0.95, "reason": "Salary or payroll deposit"},
    "freelance": {"district": "Freelance",     "color": "#34d399", "icon": "code",        "confidence": 0.90, "reason": "Freelance client payment"},
    "bonus":     {"district": "Bonus",         "color": "#fbbf24", "icon": "star",        "confidence": 0.95, "reason": "Performance or seasonal bonus"},
    "rental":    {"district": "Rental Income", "color": "#a78bfa", "icon": "home",        "confidence": 0.90, "reason": "Rental property income"},
    "side":      {"district": "Side Income",   "color": "#60a5fa", "icon": "zap",         "confidence": 0.85, "reason": "Side hustle income"},
}

INVESTMENT_CLASSIFICATIONS: Dict[str, Dict[str, Any]] = {
    "stocks":      {"district": "Stocks",      "color": "#3b82f6", "icon": "trending-up", "confidence": 0.92, "reason": "Stock market investment"},
    "crypto":      {"district": "Crypto",      "color": "#8b5cf6", "icon": "zap",         "confidence": 0.90, "reason": "Cryptocurrency purchase"},
    "etf":         {"district": "ETF/Fund",    "color": "#06b6d4", "icon": "pie-chart",   "confidence": 0.93, "reason": "ETF or index fund investment"},
    "realestate":  {"district": "Real Estate", "color": "#f59e0b", "icon": "home",        "confidence": 0.90, "reason": "Real estate investment"},
}

CURRENCIES = ["USD", "EUR", "GBP", "KRW", "JPY"]


def generate_random_transaction() -> Dict[str, Any]:
    """
    Returns a random transaction dict.
    Distribution: 70% expense, 20% income, 10% investment.
    Non-expense transactions include a pre-computed `classification` dict.
    """
    rand = random.random()

    if rand < 0.70:
        pool = EXPENSE_TRANSACTIONS
    elif rand < 0.90:
        pool = INCOME_TRANSACTIONS
    else:
        pool = INVESTMENT_TRANSACTIONS

    template = random.choice(pool)
    lo, hi = template["amount_range"]
    amount = round(random.uniform(lo, hi), 2)
    currency = "USD" if random.random() < 0.9 else random.choice(CURRENCIES)
    tx_type = template["type"]
    category = template["category"]

    result: Dict[str, Any] = {
        "description": template["description"],
        "amount": amount,
        "currency": currency,
        "type": tx_type,
        "category": category,
    }

    # Attach static classification for income/investment so the WS handler
    # can skip the AI call entirely.
    if tx_type == "income":
        result["static_classification"] = INCOME_CLASSIFICATIONS.get(
            category, INCOME_CLASSIFICATIONS["side"]
        )
    elif tx_type == "investment":
        result["static_classification"] = INVESTMENT_CLASSIFICATIONS.get(
            category, INVESTMENT_CLASSIFICATIONS["stocks"]
        )

    return result


def generate_transaction_burst(count: int = 5) -> list:
    return [generate_random_transaction() for _ in range(count)]
