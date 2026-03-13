"""
🤖 Aura Finance — Mock AI Classifier  (2026 Financial AI Edition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Architecture inspired by 2026 financial industry AI best practices:

  ┌─────────────────────────────────────────────────────────────────┐
  │  Layer 1 · NLP Preprocessing                                    │
  │    • Bank code normalisation  (POS*, SQ*, AMZN*, TFL*, etc.)   │
  │    • Noise token removal                                        │
  │    • Unicode / case normalisation                               │
  ├─────────────────────────────────────────────────────────────────┤
  │  Layer 2 · Multi-Feature Extraction  (XGBoost / GBM style)     │
  │    • F1 Keyword score   – 700+ merchants, length-weighted       │
  │    • F2 Amount bracket  – 7-tier classification                 │
  │    • F3 Pattern signal  – 20+ regex patterns (subscription,     │
  │                           ATM, toll, airline code, RX, …)       │
  ├─────────────────────────────────────────────────────────────────┤
  │  Layer 3 · Ensemble Voting  (weak-learner aggregation)          │
  │    • keyword_score  × 0.60  (highest information value)         │
  │    • pattern_score  × 0.25  (intent-level signals)              │
  │    • amount_score   × 0.15  (contextual prior)                  │
  ├─────────────────────────────────────────────────────────────────┤
  │  Layer 4 · Meta-Labeling / Confidence Calibration               │
  │    • Multi-feature agreement → confidence boost (+0.04 each)    │
  │    • Feature conflict        → confidence penalty (−0.06 each)  │
  │    • Sigmoid-like clamp to  [0.28, 0.97]                        │
  ├─────────────────────────────────────────────────────────────────┤
  │  Layer 5 · XAI Reasoning  (Explainable AI)                      │
  │    • Primary driver + supporting evidence                        │
  │    • Human-readable, ≤ 120 chars                                │
  └─────────────────────────────────────────────────────────────────┘

Coverage: 700+ global merchants  ·  Korean · Swedish · UK · US · Global
"""

import re
from typing import Optional

from schemas.transaction import ClassificationResult, CityDistrict
from services.ai_classifier import DISTRICT_COLOR_MAP, DISTRICT_ICON_MAP

# ─────────────────────────────────────────────────────────────────────────────
# Layer 1 · NLP Preprocessing
# ─────────────────────────────────────────────────────────────────────────────

# Bank-code prefix patterns → stripped or replaced with a cleaner token
_BANK_CODE_SUBS: list[tuple[str, str]] = [
    (r"sq\s*\*",              ""),            # Square POS
    (r"sqr?\*",               ""),
    (r"amzn\s*\*",            "amazon "),     # Amazon Marketplace
    (r"amazon\.com/",         "amazon "),
    (r"pp\s*\*",              "paypal "),     # PayPal
    (r"paypal\s*\*",          "paypal "),
    (r"stripe\s*\*",          ""),            # Stripe gateway
    (r"tst\s*\*",             ""),            # Toast POS
    (r"clover\s*\*",          ""),            # Clover POS
    (r"goog\s*\*",            "google "),     # Google Payments
    (r"google\s*\*",          "google "),
    (r"apple\.com/bill",      "apple subscription"),
    (r"apple\s*pay\s*\*",     ""),
    (r"uber\s*\*",            "uber "),
    (r"lyft\s*\*",            "lyft "),
    (r"ddb\s*\*",             "doordash "),   # DoorDash
    (r"grubhub\s*\*",         "grubhub "),
    (r"tfl\.gov\.uk",         "tfl "),        # Transport for London
    (r"\*?recurring\*?",      "subscription "),
    (r"#\s*\d{4,}",           " "),           # Store numbers  #1234
    (r"\b\d{5,}\b",           " "),           # Long standalone numbers
    (r"\b(pos|trf|ref|auth|chq|bacs|fpo|ach|dda|eft|bpay)\b", " "),
    (r"\s{2,}",               " "),           # Collapse whitespace
]
_COMPILED_BANK = [(re.compile(p, re.I), r) for p, r in _BANK_CODE_SUBS]

_NOISE = frozenset({
    "payment", "purchase", "transaction", "debit", "credit", "charge",
    "to", "from", "at", "via", "by", "the", "a", "an", "for",
    "ref", "id", "no", "num", "ltd", "inc", "llc", "corp", "co", "plc",
    "online", "card", "contactless", "tap", "nfc", "tap&go",
    "recurring", "autopay", "autodebit",
})


def _preprocess(description: str) -> tuple[str, str]:
    """
    Returns (normalised, original_lower).
    normalised: bank-code stripped, noise tokens removed.
    original_lower: unchanged lowercased input (for fallback matching).
    """
    original = description.lower().strip()
    text = original
    for pattern, repl in _COMPILED_BANK:
        text = pattern.sub(repl, text)
    tokens = [t for t in text.split() if t not in _NOISE and len(t) > 1]
    return " ".join(tokens).strip(), original


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2A · Keyword Feature Database  (700+ merchants)
# ─────────────────────────────────────────────────────────────────────────────

CLASSIFICATION_RULES: dict[CityDistrict, list[str]] = {

    # ── FOOD & CAFE ──────────────────────────────────────────────────────────
    CityDistrict.FOOD_CAFE: [
        # Global coffee chains
        "starbucks", "costa coffee", "costa", "dunkin donuts", "dunkin",
        "tim hortons", "peet's coffee", "peet's", "blue bottle coffee",
        "gregorys coffee", "coffee bean & tea", "coffee bean",
        "lavazza", "illy caffe", "caribou coffee", "dutch bros coffee",
        "biggby coffee", "second cup", "gloria jeans", "the coffee club",
        "nespresso", "nescafe", "cafe nero", "caffe nero",
        # Fast food – global
        "mcdonald's", "mcdonalds", "burger king", "wendy's", "wendy",
        "taco bell", "kfc", "popeyes", "popeye's",
        "chick-fil-a", "five guys", "in-n-out", "whataburger",
        "jack in the box", "sonic drive-in", "sonic drive",
        "dairy queen", "carl's jr", "hardee's", "culver's",
        "shake shack", "smashburger", "habit burger",
        "del taco", "checkers", "rally's", "steak n shake",
        # Pizza / Italian
        "domino's pizza", "dominos", "pizza hut", "papa john's", "papa johns",
        "little caesars", "sbarro", "cicis pizza", "cici's",
        "olive garden", "carrabba's", "macaroni grill", "fazoli's",
        "vapiano", "il forno", "pizza express",
        # Sandwich / subs
        "subway", "jimmy john's", "jersey mike's", "firehouse subs",
        "quiznos", "potbelly sandwich", "which wich", "jason's deli",
        # Asian fast food & casual
        "panda express", "chipotle", "qdoba", "moe's southwest grill",
        "wingstop", "raising cane's", "portillo's", "pei wei",
        "yoshinoya", "matsuya", "sukiya", "nakau",
        "jollibee", "max's restaurant",
        # Casual dining
        "applebee's", "chili's grill", "chili's", "friday's", "tgi fridays",
        "denny's", "ihop", "perkins", "cracker barrel",
        "red lobster", "longhorn steakhouse", "outback steakhouse",
        "texas roadhouse", "ruth's chris", "morton's steakhouse",
        "cheesecake factory", "p.f. chang's", "noodles & company",
        "panera bread", "panera", "einstein bros",
        "bob evans", "waffle house", "first watch",
        # US Grocery / supermarkets
        "whole foods market", "whole foods", "trader joe's", "trader joes",
        "safeway", "kroger", "publix", "wegmans", "stop & shop",
        "harris teeter", "giant food", "meijer", "hy-vee",
        "food lion", "winn-dixie", "fresh market", "sprouts farmers",
        "natural grocers", "earth fare", "fresh thyme",
        "albertsons", "vons", "pavilions", "randalls", "tom thumb",
        "jewel-osco", "acme markets", "stater bros", "winco foods",
        "smart & final", "grocery outlet", "save-a-lot",
        # UK grocery
        "tesco express", "tesco extra", "tesco", "sainsbury's", "sainsburys",
        "waitrose", "asda", "morrisons", "marks & spencer food", "m&s food",
        "co-op food", "co-op", "lidl", "aldi uk", "ocado", "iceland foods",
        # Swedish grocery (Tink sandbox)
        "ica supermarket", "ica maxi", "ica nara", "ica kvantum", "ica",
        "coop forum", "coop extra", "coop konsum", "coop",
        "willys", "hemkop", "city gross", "netto sweden",
        "mathem", "matsmart", "linas matkasse",
        # Food delivery
        "doordash", "uber eats", "ubereats", "grubhub", "postmates",
        "deliveroo", "just eat", "hungry panda", "wolt delivery", "wolt",
        "rappi", "glovo", "delivery.com", "seamless", "gopuff",
        # Korean food & delivery
        "스타벅스", "투썸플레이스", "이디야커피", "할리스커피",
        "컴포즈커피", "빽다방", "매머드커피", "파스쿠찌", "폴바셋",
        "맥도날드", "버거킹", "롯데리아", "맘스터치", "kfc코리아",
        "파리바게뜨", "뚜레쥬르", "성심당", "신라명과", "뚜레주르",
        "편의점", "cu편의점", "gs25", "세븐일레븐", "이마트24", "미니스톱",
        "배달의민족", "요기요", "쿠팡이츠", "배민",
        "이마트", "홈플러스", "롯데마트", "코스트코코리아", "코스트코",
        # Generic food terms
        "restaurant", "cafe", "coffee shop", "coffee", "bakery",
        "bistro", "diner", "eatery", "brasserie", "trattoria", "osteria",
        "tavern", "pub", "bar & grill", "grill", "barbeque", "bbq",
        "sushi bar", "ramen", "pho", "noodle house", "noodle",
        "burrito bar", "taqueria", "steakhouse", "seafood grill",
        "grocery", "supermarket", "food market", "organic market",
        "food hall", "food court", "canteen", "cafeteria",
        "takeaway", "take-away", "meal kit", "food delivery",
        # User-requested keywords
        "ubereats", "doordash", "burger", "dining", "meal", "food",
    ],

    # ── SHOPPING ─────────────────────────────────────────────────────────────
    CityDistrict.SHOPPING: [
        # E-commerce
        "amazon marketplace", "amazon", "ebay", "etsy", "wish.com",
        "aliexpress", "temu", "shein", "asos", "boohoo",
        "prettylittlething", "missguided", "nasty gal", "revolve clothing",
        "net-a-porter", "farfetch", "ssense", "mytheresa", "matches fashion",
        # Global fast fashion
        "zara", "h&m", "hm.com", "uniqlo", "gap", "old navy",
        "banana republic", "abercrombie & fitch", "abercrombie",
        "hollister co", "forever 21", "urban outfitters", "anthropologie",
        "free people", "j.crew", "madewell", "topshop", "primark",
        "matalan", "next retail", "monsoon", "white house black market",
        "express clothing", "american eagle",
        "victoria's secret", "pink victoria's",
        # Luxury
        "louis vuitton", "gucci", "prada", "chanel", "hermes", "hermes paris",
        "burberry", "versace", "fendi", "balenciaga", "bottega veneta",
        "saint laurent", "ysl", "givenchy", "dior", "armani exchange",
        "michael kors", "kate spade", "coach leather", "tory burch",
        # Footwear
        "nike", "adidas", "puma", "reebok", "new balance", "converse",
        "vans", "timberland", "ugg", "skechers", "clarks shoes",
        "dr. martens", "dr martens", "steve madden",
        "foot locker", "finish line", "jd sports",
        # Electronics & tech retail
        "apple store", "apple.com", "best buy", "currys pc world", "currys",
        "mediamarkt", "saturn electronics", "elgiganten", "power dk",
        "fnac", "darty", "newegg", "microcenter", "micro center",
        "b&h photo", "adorama", "samsung store",
        # Home & furniture
        "ikea", "wayfair", "williams-sonoma", "pottery barn",
        "crate & barrel", "crate and barrel", "restoration hardware",
        "west elm", "bed bath & beyond", "home depot", "lowe's", "lowes",
        "b&q", "homebase", "dunelm", "habitat furniture",
        # Department stores
        "walmart", "target", "costco warehouse", "costco",
        "sam's club", "bj's wholesale",
        "nordstrom rack", "nordstrom", "macy's", "macys",
        "bloomingdale's", "neiman marcus", "saks fifth avenue", "saks",
        "john lewis", "debenhams", "selfridges", "harrods",
        "marks & spencer clothing",
        # Beauty & personal care
        "sephora", "ulta beauty", "ulta", "mac cosmetics",
        "lush cosmetics", "the body shop", "bath & body works",
        "nyx cosmetics", "benefit cosmetics", "fenty beauty",
        "charlotte tilbury", "glossier", "kiehl's", "origins",
        # Sports & outdoor
        "rei co-op", "rei", "academy sports", "dick's sporting goods",
        "sports direct", "decathlon", "patagonia", "the north face",
        "under armour", "columbia sportswear",
        # Korean shopping
        "쿠팡", "11번가", "지마켓", "옥션", "위메프", "티몬",
        "네이버쇼핑", "카카오선물하기", "올리브영", "무신사",
        "현대백화점", "롯데백화점", "신세계백화점", "갤러리아백화점",
        "다이소", "이케아코리아",
        # Generic
        "store", "boutique", "outlet mall", "retail store",
        "online store", "merchandise", "gifts shop", "jewelry store",
        "clothing store", "apparel", "fashion store",
        # User-requested keywords
        "clothes", "mall", "grocery", "supermarket", "electronics",
        "apple store", "shoes", "market",
    ],

    # ── HOUSING & UTILITIES ───────────────────────────────────────────────────
    CityDistrict.HOUSING: [
        # Rent / mortgage
        "rent payment", "apartment rent", "monthly rent",
        "mortgage payment", "home loan", "lease payment",
        "landlord", "property management", "real estate agent",
        "zillow", "redfin", "trulia", "opendoor",
        # US utilities
        "electric bill", "electricity", "power company",
        "natural gas bill", "gas company", "water bill",
        "sewage fee", "trash collection", "waste management",
        "comcast xfinity", "xfinity", "spectrum", "cox communications",
        "at&t internet", "att internet", "verizon fios",
        "centurylink", "lumen technologies", "frontier communications",
        "suddenlink", "windstream",
        # UK utilities
        "bt broadband", "bt internet", "virgin media", "sky broadband", "talktalk",
        "british gas", "e.on energy", "eon energy", "npower", "sse energy",
        "octopus energy", "bulb energy", "edf energy",
        "thames water", "united utilities", "anglian water",
        # Nordic utilities
        "telia sweden", "tele2 sweden", "telenor", "vodafone home",
        "ellevio", "vattenfall", "e.on sweden", "fortum",
        # Mobile / home phone
        "t-mobile home", "sprint", "metro pcs", "boost mobile",
        "cricket wireless", "straight talk",
        # Home services
        "home insurance", "renters insurance", "homeowners insurance",
        "hoa fee", "condo fee", "strata fee", "maintenance fee",
        "pest control", "cleaning service", "maid service",
        "lawn care", "landscaping", "snow removal", "home repair",
        "airbnb host", "vrbo",
        # Korean utilities
        "월세", "관리비", "전기요금", "수도요금", "가스요금",
        "통신비", "kt인터넷", "sk브로드밴드", "lgu+", "kt올레",
        # Generic
        "utilities", "housing", "broadband", "internet service",
        "cable tv", "satellite tv", "property tax", "ground rent",
        "insurance premium",
        # User-requested keywords
        "rent", "mortgage", "lease", "electricity", "water", "gas",
        "internet", "utility", "trash", "maintenance", "apartment",
    ],

    # ── ENTERTAINMENT ─────────────────────────────────────────────────────────
    CityDistrict.ENTERTAINMENT: [
        # Streaming video
        "netflix", "hulu", "disney+", "disney plus", "hbo max", "max streaming",
        "peacock premium", "paramount+", "apple tv+", "apple tv plus",
        "amazon prime video", "crunchyroll", "funimation",
        "mubi", "shudder", "discovery+", "starz", "showtime streaming",
        "channel 4 streaming", "britbox", "acorn tv",
        # Streaming audio
        "spotify", "apple music", "tidal hi-fi", "tidal",
        "deezer", "amazon music unlimited", "pandora premium",
        "soundcloud go", "youtube music premium", "youtube premium",
        "qobuz", "napster music",
        # Gaming platforms & purchases
        "steam games", "steam", "playstation store", "psn store",
        "xbox game pass ultimate", "xbox game pass", "xbox live gold",
        "nintendo eshop", "nintendo", "epic games store", "epic games",
        "ea play", "ea games", "ubisoft connect", "ubisoft",
        "activision", "blizzard battle.net", "battle.net",
        "riot games", "roblox", "twitch prime", "twitch",
        "discord nitro", "discord",
        # Tickets & live events
        "ticketmaster", "stubhub", "eventbrite", "viagogo",
        "seatgeek", "axs tickets", "live nation", "bandsintown",
        "fandango", "regal cinemas", "amc theatres",
        "odeon cinema", "cineworld", "vue entertainment",
        "filmstaden", "sf bio", "cinemark", "landmark theatres",
        # Books / audiobooks
        "audible", "kindle unlimited", "scribd", "storytel", "nextory",
        # Korean entertainment
        "넷플릭스", "왓챠", "웨이브", "시즌", "티빙",
        "카카오게임즈", "스팀게임", "플레이스테이션스토어",
        "멜론", "지니뮤직", "바이브", "플로뮤직",
        "네이버시리즈", "리디북스", "카카오페이지",
        "cgv", "메가박스", "롯데시네마",
        # Generic
        "streaming service", "entertainment subscription", "movie ticket",
        "cinema ticket", "concert ticket", "festival pass",
        "gaming subscription", "esports tournament",
        # User-requested keywords
        "cinema", "movie", "theater", "theatre", "ticket",
    ],

    # ── TRANSPORT ────────────────────────────────────────────────────────────
    CityDistrict.TRANSPORT: [
        # Rideshare
        "uber technologies", "uber trip", "uber", "lyft ride", "lyft",
        "bolt ride", "bolt.eu", "cabify", "grab taxi", "didi chuxing",
        "gett taxi", "curb taxi", "via rideshare",
        "freenow", "mytaxi", "kapten", "heetch",
        # Public transit
        "transport for london", "tfl oyster", "tfl",
        "oyster card", "contactless tfl",
        "mta new york", "bart san francisco", "cta chicago",
        "mbta boston", "wmata dc", "septa philly", "muni sf",
        "sl stockholm", "sj rail", "mtrx train", "snälltåget",
        "vy group", "flixbus", "megabus",
        "deutsche bahn", "db bahn", "sncf", "eurostar",
        "thalys", "ice train", "avlo", "ouigo",
        "korail", "ktx korea",
        "metro pass", "transit pass", "commuter pass",
        # Airlines
        "united airlines", "delta air lines", "delta air",
        "american airlines", "southwest airlines",
        "jetblue airways", "alaska airlines",
        "spirit airlines", "frontier airlines",
        "british airways", "virgin atlantic", "easyjet",
        "ryanair", "lufthansa", "air france", "klm royal",
        "sas airlines", "norwegian air", "wizz air",
        "transavia", "iberia", "tap air portugal",
        "turkish airlines", "emirates airline", "qatar airways",
        "singapore airlines", "cathay pacific", "ana airlines",
        "대한항공", "아시아나항공",
        # Fuel & gas stations
        "shell fuel", "shell", "bp petrol", "bp",
        "exxon mobil", "exxon", "chevron", "mobil fuel",
        "texaco", "sunoco", "circle k fuel", "circle k",
        "casey's general", "speedway fuel", "marathon petroleum",
        "wawa", "sheetz fuel", "sheetz",
        "preem", "ingo fuel", "ok petroleum", "st1 fuel",
        # Car rental & sharing
        "hertz car rental", "hertz", "avis car", "enterprise rent-a-car",
        "budget car rental", "national car rental",
        "zipcar", "turo", "getaround", "sixt car rental", "sixt",
        # Parking
        "parkwhiz", "spothero", "parkmobile", "lazypark",
        "premium parking", "republic parking",
        "ncp parking", "q-park", "apcoa parking",
        # Tolls
        "e-zpass", "fastrak", "sunpass", "ipass toll", "peach pass", "pikepass",
        # Korean transport
        "카카오택시", "티머니", "교통카드", "지하철요금",
        "버스요금", "택시요금", "주유소", "sk에너지",
        "gs칼텍스", "s-oil", "현대오일뱅크",
        # Generic
        "transport", "transit fare", "railway ticket", "railroad",
        "airport transfer", "airline ticket", "flight booking",
        "parking fee", "toll charge", "fuel station",
        "petrol station", "gas station",
        # User-requested keywords
        "train", "bus", "subway", "transit", "toll", "airline", "flight",
    ],

    # ── HEALTHCARE ───────────────────────────────────────────────────────────
    CityDistrict.HEALTHCARE: [
        # Pharmacy chains
        "cvs pharmacy", "cvs", "walgreens", "rite aid",
        "duane reade", "bartell drugs",
        "boots pharmacy", "boots", "lloyds pharmacy", "superdrug",
        "apotek hjartat", "apoteket", "kronans apotek",
        # Hospitals & health systems
        "cedars-sinai", "mayo clinic", "cleveland clinic",
        "kaiser permanente", "adventhealth", "ascension health",
        "hca healthcare", "tenet health", "dignity health",
        # Dental
        "aspen dental", "pacific dental", "western dental",
        "smile direct club", "clear correct", "invisalign",
        # Vision
        "warby parker", "lenscrafters", "pearle vision",
        "america's best eyecare", "national vision",
        # Health insurance
        "blue cross blue shield", "blue cross", "aetna",
        "cigna health", "cigna", "humana", "united healthcare",
        "oscar health", "molina healthcare", "anthem", "centene",
        # Telehealth & digital health
        "teladoc", "mdlive", "doctor on demand",
        "nurx", "hims & hers", "hims", "roman health",
        "noom", "calm", "headspace",
        # Fitness
        "planet fitness", "la fitness", "equinox gym",
        "24 hour fitness", "anytime fitness",
        "sats gym", "friskis & svettis", "core power yoga",
        "peloton", "mirror fitness", "lifetime fitness",
        "ymca", "gold's gym", "orangetheory fitness",
        # Korean healthcare
        "병원비", "약국", "의원", "한의원", "치과", "안과",
        "삼성서울병원", "서울아산병원", "세브란스병원",
        # Generic
        "medical", "medicine", "prescription", "pharmacy",
        "doctor visit", "physician", "health insurance",
        "dental insurance", "vision care", "wellness",
        "therapy session", "counseling session",
        "lab test", "diagnostic", "blood test", "x-ray", "mri",
        # User-requested keywords
        "pharmacy", "hospital", "clinic", "doctor", "dentist",
        "medicine", "health", "fitness", "gym", "therapy",
    ],

    # ── EDUCATION ────────────────────────────────────────────────────────────
    CityDistrict.EDUCATION: [
        # Universities / formal education
        "university", "college tuition", "school tuition",
        "enrollment fee", "student loan", "student services",
        "community college",
        # Online learning platforms
        "udemy", "coursera", "edx", "skillshare",
        "linkedin learning", "masterclass", "pluralsight",
        "treehouse", "codecademy", "brilliant.org",
        "khan academy", "datacamp", "udacity",
        "o'reilly learning", "manning publications",
        # Test prep & tutoring
        "chegg", "tutor.com", "wyzant", "varsity tutors",
        "kaplan test prep", "princeton review",
        "sat prep", "gmat prep", "gre prep",
        # Language learning
        "duolingo", "babbel", "rosetta stone", "busuu",
        "pimsleur", "italki", "cambly", "lingoda",
        # Bookstores & references
        "amazon books", "barnes & noble", "waterstones",
        "book depository", "thriftbooks", "abebooks",
        # Academic publishers / subscriptions
        "jstor", "elsevier", "springer", "ieee xplore",
        "proquest", "lexisnexis",
        # Korean education
        "학원비", "인강수강료", "교재비", "수강료",
        "교보문고", "yes24", "알라딘", "영풍문고",
        "수능", "toeic", "ielts",
        # Generic
        "education", "learning platform", "course fee",
        "training", "certification exam", "workshop registration",
        "library fee", "textbook", "school supplies", "stationery",
        "seminar registration",
    ],

    # ── FINANCE ──────────────────────────────────────────────────────────────
    CityDistrict.FINANCE: [
        # Cloud & SaaS (B2B / subscription)
        "amazon web services", "aws", "microsoft azure", "azure",
        "google cloud platform", "gcp", "digitalocean",
        "heroku", "linode", "vultr", "cloudflare",
        "fastly", "vercel", "netlify", "render.com",
        "github", "gitlab", "bitbucket",
        "atlassian", "jira software", "confluence",
        "salesforce", "hubspot", "zendesk", "intercom", "freshdesk",
        "monday.com", "asana", "notion", "airtable",
        "slack", "microsoft 365", "office 365", "google workspace",
        # Banking – Nordic
        "nordea bank", "seb bank", "swedbank",
        "handelsbanken", "danske bank", "dnb bank",
        # Banking – UK
        "barclays", "hsbc", "lloyds bank", "natwest",
        "santander uk", "nationwide", "halifax",
        "monzo", "revolut", "starling bank",
        # Banking – US
        "chase bank", "jpmorgan chase", "bank of america",
        "wells fargo", "citibank", "capital one bank",
        "td bank", "us bank", "regions bank",
        "pnc bank", "truist", "fifth third bank",
        # Korean banks
        "신한은행", "국민은행", "하나은행", "우리은행",
        "기업은행", "농협은행", "sc제일은행",
        "카카오뱅크", "케이뱅크", "토스뱅크",
        # Payment platforms & fintech
        "paypal", "stripe", "square inc", "venmo", "cash app",
        "zelle", "klarna", "afterpay", "affirm", "sezzle",
        "swish", "mobilepay", "vipps", "trustly",
        "wise money transfer", "transferwise", "remitly",
        "western union", "moneygram",
        # Investment & brokerage
        "robinhood", "fidelity investments", "charles schwab",
        "td ameritrade", "e*trade", "vanguard funds",
        "betterment", "wealthfront", "sofi invest", "webull",
        "m1 finance", "interactive brokers", "ibkr",
        # ETF / Index funds
        "vanguard s&p 500 etf", "vanguard etf", "vanguard",
        "ishares etf", "ishares", "spdr etf",
        "invesco etf", "ark invest",
        # Crypto exchanges
        "coinbase", "binance", "kraken exchange", "gemini exchange",
        "crypto.com", "bitstamp", "ftx",
        # Insurance
        "geico", "state farm", "progressive insurance",
        "allstate", "usaa", "travelers insurance",
        "nationwide insurance", "liberty mutual", "farmers insurance",
        "lemonade insurance",
        # Tax services
        "turbotax", "h&r block", "taxact",
        # ATM / fees
        "atm withdrawal", "atm fee",
        "bankgiro", "plusgiro", "autogiro",
        "wire transfer fee", "overdraft fee", "late fee",
        # Generic
        "bank", "finance", "financial services",
        "investment", "savings account", "loan payment",
        "insurance", "bank transfer", "deposit", "withdrawal",
        "brokerage", "portfolio", "mutual fund",
        "crypto exchange", "cloud computing", "saas",
        "software license", "software subscription",
        # User-requested keywords
        "transfer", "bank", "fee", "interest", "atm", "loan",
        "credit", "tax", "insurance", "investment",
    ],

    # ── FREELANCE ────────────────────────────────────────────────────────────
    CityDistrict.FREELANCE: [
        "upwork", "fiverr", "toptal", "contra", "flexjobs",
        "client payment", "freelance", "contract work", "project fee",
        "design project", "consulting", "contractor payment",
        # User-requested
        "contract", "project", "design", "consulting",
    ],

    # ── RENTAL INCOME ────────────────────────────────────────────────────────
    CityDistrict.RENTAL_INCOME: [
        "tenant", "airbnb", "booking.com", "vrbo", "rental income",
        "property rental", "guest payment", "short term rental",
        "rent payment received", "lease income",
        # User-requested
        "rental", "property", "guest",
    ],

    # ── SALARY ───────────────────────────────────────────────────────────────
    CityDistrict.SALARY: [
        "payroll", "salary", "wage", "employer", "paycheck",
        "company salary", "direct deposit salary", "income salary",
        "adp", "gusto", "bamboohr", "paychex",
        # User-requested
        "company", "income",
    ],

    # ── SIDE INCOME ──────────────────────────────────────────────────────────
    CityDistrict.SIDE_INCOME: [
        "dividend", "refund", "bonus", "cashback", "survey",
        "reward", "sold", "gig", "side hustle", "passive income",
        "interest income", "referral bonus", "affiliate",
        "swagbucks", "rakuten", "honey", "rebate",
        # User-requested
    ],
}

# Sort keywords by length descending → longer (more specific) keywords match first
_SORTED_RULES: dict[CityDistrict, list[str]] = {
    d: sorted(kws, key=len, reverse=True)
    for d, kws in CLASSIFICATION_RULES.items()
}


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2B · Amount Feature  (GBM weak learner — contextual prior)
# ─────────────────────────────────────────────────────────────────────────────

def _amount_feature(amount: Optional[float]) -> tuple[CityDistrict, float, str]:
    """Map transaction amount → (likely district, confidence, label)."""
    if amount is None:
        return (CityDistrict.UNKNOWN, 0.0, "no amount data")
    a = abs(float(amount))
    if a < 5:
        return (CityDistrict.FOOD_CAFE,     0.42, f"micro ${a:.2f} → coffee/transit")
    if a < 15:
        return (CityDistrict.FOOD_CAFE,     0.38, f"small ${a:.2f} → food/drink")
    if a < 35:
        return (CityDistrict.FOOD_CAFE,     0.32, f"${a:.2f} → typical meal")
    if a < 70:
        return (CityDistrict.SHOPPING,      0.28, f"${a:.2f} → retail/dining range")
    if a < 200:
        return (CityDistrict.SHOPPING,      0.32, f"${a:.2f} → medium shopping")
    if a < 800:
        return (CityDistrict.SHOPPING,      0.35, f"${a:.2f} → large purchase/travel")
    return     (CityDistrict.FINANCE,       0.40, f"${a:.2f} → high-value financial")


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2C · Pattern Feature  (Regex intent signals — highest specificity)
# ─────────────────────────────────────────────────────────────────────────────

_RAW_PATTERNS: list[tuple[str, CityDistrict, float, str]] = [
    # High-confidence (>0.85) — very specific intent signals
    (r"\batm\s*(cash|withdrawal|dispenser)?\b", CityDistrict.FINANCE,       0.93, "ATM cash withdrawal"),
    (r"\b(wire|wired)\s+transfer\b",            CityDistrict.FINANCE,       0.91, "wire transfer"),
    (r"\binterest\s+(payment|charge)\b",        CityDistrict.FINANCE,       0.90, "interest charge"),
    (r"\b(mortgage|home loan)\s+payment\b",     CityDistrict.HOUSING,       0.90, "mortgage payment"),
    (r"\brx\b|\bprescription\b",               CityDistrict.HEALTHCARE,    0.90, "prescription drug"),
    (r"\b(uber|lyft)\s+trip\b",                CityDistrict.TRANSPORT,     0.92, "rideshare trip"),
    (r"\bflight\s+[a-z]{2}\d{3,4}\b",          CityDistrict.TRANSPORT,     0.88, "airline booking code"),
    (r"\b(e-zpass|fastrak|sunpass|ipass)\b",   CityDistrict.TRANSPORT,     0.92, "toll charge"),
    # Medium-confidence (0.65–0.85)
    (r"\b(monthly|annual|yearly)\s+(fee|subscription|plan|billing)\b",
                                               CityDistrict.ENTERTAINMENT, 0.74, "recurring subscription"),
    (r"\bstreaming\b",                         CityDistrict.ENTERTAINMENT, 0.72, "streaming service"),
    (r"\brent\s+payment\b",                    CityDistrict.HOUSING,       0.82, "rent payment"),
    (r"\b(hotel|motel|hostel|inn)\b",          CityDistrict.HOUSING,       0.70, "accommodation"),
    (r"\b(dental|dentist|orthodont)\b",        CityDistrict.HEALTHCARE,    0.84, "dental treatment"),
    (r"\b(gym|fitness center|yoga|pilates)\b", CityDistrict.HEALTHCARE,    0.74, "fitness membership"),
    (r"\binsurance\s+(premium|payment|bill)\b",CityDistrict.FINANCE,       0.78, "insurance premium"),
    (r"\b(tuition|school fee|course fee)\b",   CityDistrict.EDUCATION,     0.80, "tuition/course fee"),
    (r"\b(parking fee|car park)\b",            CityDistrict.TRANSPORT,     0.82, "parking charge"),
    (r"\b(petrol|diesel|fuel pump)\b",         CityDistrict.TRANSPORT,     0.84, "vehicle fuel"),
    (r"\b(grocery|groceries|supermarket)\b",   CityDistrict.FOOD_CAFE,     0.76, "grocery shopping"),
    (r"\b(cloud\s+(service|compute)|saas)\b",  CityDistrict.FINANCE,       0.72, "cloud/SaaS service"),
    (r"\b(dividend|portfolio\s+gain)\b",       CityDistrict.FINANCE,       0.76, "investment income"),
    (r"\b(salary|payroll|payslip)\b",          CityDistrict.FINANCE,       0.82, "salary credit"),
    (r"\bpharmacy\b",                          CityDistrict.HEALTHCARE,    0.85, "pharmacy purchase"),
    (r"\b(toll|motorway charge)\b",            CityDistrict.TRANSPORT,     0.80, "road toll"),
]

_COMPILED_PATTERNS = [
    (re.compile(pat, re.I), district, conf, label)
    for pat, district, conf, label in _RAW_PATTERNS
]


def _pattern_feature(text: str) -> tuple[CityDistrict, float, str]:
    """Return first matching regex pattern signal."""
    for pattern, district, confidence, label in _COMPILED_PATTERNS:
        if pattern.search(text):
            return (district, confidence, label)
    return (CityDistrict.UNKNOWN, 0.0, "no pattern signal")


# ─────────────────────────────────────────────────────────────────────────────
# Layer 2A helper · Keyword scoring
# ─────────────────────────────────────────────────────────────────────────────

def _keyword_feature(
    normalised: str,
    original: str,
) -> tuple[CityDistrict, float, str]:
    """
    Scan all keyword rules.
    Score = Σ len(matched_keyword)  (longer = more specific = higher trust).
    Returns (best_district, normalised_confidence, top_keyword).
    """
    best_district = CityDistrict.UNKNOWN
    best_score = 0
    best_kw = ""

    for district, keywords in _SORTED_RULES.items():
        score = 0
        top_kw = ""
        for kw in keywords:
            if kw in normalised or kw in original:
                score += len(kw)
                if not top_kw:
                    top_kw = kw
        if score > best_score:
            best_score = score
            best_district = district
            best_kw = top_kw

    # Piecewise confidence calibration (GBM leaf output style)
    # Longer keyword → more specific brand match → higher confidence
    if best_score >= 18:
        conf = min(0.97, 0.88 + (best_score - 18) * 0.003)  # specific brand
    elif best_score >= 8:
        conf = 0.70 + (best_score - 8) * 0.022              # known brand (8–18 chars)
    elif best_score >= 4:
        conf = 0.52 + (best_score - 4) * 0.045              # short brand / generic
    elif best_score > 0:
        conf = 0.35 + best_score * 0.042                     # very short / partial
    else:
        conf = 0.0

    return (best_district, min(conf, 0.97), best_kw)


# ─────────────────────────────────────────────────────────────────────────────
# Layer 3 · Ensemble Weights  (XGBoost-style feature importance)
# ─────────────────────────────────────────────────────────────────────────────

_W_KEYWORD = 0.60   # strongest signal: exact brand match
_W_PATTERN = 0.25   # intent-level regex
_W_AMOUNT  = 0.15   # contextual prior


# ─────────────────────────────────────────────────────────────────────────────
# Layer 4 · Meta-Labeling Confidence Calibration
# ─────────────────────────────────────────────────────────────────────────────

def _calibrate(raw: float, agreements: int, conflicts: int) -> float:
    """
    Meta-labeling inspired calibration:
      +4 % for each additional feature that agrees (diminishing return).
      −6 % for each feature that votes for a different class.
    Output clamped to [0.28, 0.97].
    """
    conf = raw
    conf += agreements * 0.04 * (1.0 - conf)   # diminishing return
    conf -= conflicts  * 0.06
    return max(0.28, min(0.97, conf))


# ─────────────────────────────────────────────────────────────────────────────
# Layer 5 · XAI Reasoning  (Explainable AI)
# ─────────────────────────────────────────────────────────────────────────────

def _build_reason(
    kw_d: CityDistrict, kw_kw: str,
    pat_d: CityDistrict, pat_label: str,
    amt_d: CityDistrict, amt_label: str,
    final: CityDistrict,
) -> str:
    parts: list[str] = []

    if kw_kw and kw_d == final:
        parts.append(f"Brand '{kw_kw}'")
    if pat_d == final and pat_label != "no pattern signal":
        parts.append(pat_label)
    if amt_d == final and amt_label != "no amount data":
        parts.append(amt_label)

    if not parts:
        if pat_d == final and pat_label != "no pattern signal":
            parts.append(f"Pattern: {pat_label}")
        elif kw_kw:
            parts.append(f"Keyword '{kw_kw}'")
        else:
            parts.append(f"Best-fit category: {final.value}")

    return ("; ".join(parts))[:120]


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def mock_classify_transaction(
    description: str,
    amount: Optional[float] = None,
) -> ClassificationResult:
    """
    2026 Financial AI Edition — 5-layer ensemble classifier.

    Pipeline:
      L1 NLP preprocessing
      L2 Feature extraction  (keyword · pattern · amount)
      L3 Ensemble voting     (weighted sum per district)
      L4 Confidence calibration  (meta-labeling)
      L5 XAI reason generation

    Always returns a result — no exceptions, no None.
    """
    # ── L1: Preprocess ───────────────────────────────────────────────────────
    normalised, original = _preprocess(description)

    # ── L2: Extract features ─────────────────────────────────────────────────
    kw_d,  kw_c,  kw_kw   = _keyword_feature(normalised, original)
    pat_d, pat_c, pat_lbl  = _pattern_feature(original)
    amt_d, amt_c, amt_lbl  = _amount_feature(amount)

    # ── L3: Ensemble voting ───────────────────────────────────────────────────
    votes: dict[CityDistrict, float] = {}
    if kw_d != CityDistrict.UNKNOWN:
        votes[kw_d]  = votes.get(kw_d,  0.0) + kw_c  * _W_KEYWORD
    if pat_d != CityDistrict.UNKNOWN:
        votes[pat_d] = votes.get(pat_d, 0.0) + pat_c * _W_PATTERN
    if amt_d != CityDistrict.UNKNOWN:
        votes[amt_d] = votes.get(amt_d, 0.0) + amt_c * _W_AMOUNT

    if votes:
        final_d = max(votes, key=lambda d: votes[d])
        # Confidence = strongest individual signal for the winning district
        # (ensemble votes are used only for SELECTION, not confidence deflation)
        winning_confs = [
            c for d, c in ((kw_d, kw_c), (pat_d, pat_c), (amt_d, amt_c))
            if d == final_d and c > 0
        ]
        raw_conf = max(winning_confs) if winning_confs else votes[final_d]
    else:
        # Zero signal → Finance (safe financial default)
        final_d  = CityDistrict.FINANCE
        raw_conf = 0.28

    # ── L4: Calibrate confidence ──────────────────────────────────────────────
    supporting = sum(
        1 for d in (kw_d, pat_d, amt_d)
        if d == final_d and d != CityDistrict.UNKNOWN
    )
    conflicting = sum(
        1 for d in (kw_d, pat_d, amt_d)
        if d not in (final_d, CityDistrict.UNKNOWN)
    )
    final_conf = _calibrate(raw_conf, max(0, supporting - 1), conflicting)

    # ── L5: XAI reason ───────────────────────────────────────────────────────
    reason = _build_reason(
        kw_d, kw_kw,
        pat_d, pat_lbl,
        amt_d, amt_lbl,
        final_d,
    )

    return ClassificationResult(
        district=final_d,
        confidence=final_conf,
        reason=reason,
        icon=DISTRICT_ICON_MAP.get(final_d, "help-circle"),
        color=DISTRICT_COLOR_MAP.get(final_d, "#6b7280"),
    )
