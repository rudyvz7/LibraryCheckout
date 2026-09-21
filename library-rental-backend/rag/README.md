# LibraryCheckout Phase 0 — RAG Data Prep

This folder is everything you need to complete Phase 0: setting up Chroma and
turning your business rules, inventory, and condition notes into embedded,
retrievable chunks. Phase 1 (actually wiring this into a chatbot that calls
Claude) comes after this.

Drop this whole folder in as `library-rental-backend/rag/` — it's backend
logic (Python, separate runtime from your Express server, but conceptually
part of the API layer), and `chroma_db/` will grow on disk as you re-run
the ingest scripts, so it shouldn't live anywhere near the Vercel frontend
or get swept into a frontend build.

## Folder contents

```
rag/
├── business_rules/
│   └── rules.json          # 9 business rules, verified against server.js
├── requirements.txt        # Python dependencies
├── 1_ingest_business_rules.py   # embeds rules.json into Chroma
├── 2_ingest_inventory.py        # pulls items/rooms from Postgres, embeds them
├── 3_ingest_condition_notes.py  # pulls condition notes from Postgres, embeds them
├── 4_query_test.py              # test retrieval across all 3 collections
├── .gitignore                   # keeps venv/, chroma_db/, .env out of git
└── README.md                    # this file
```

## Step-by-step

### 1. Install dependencies

```bash
cd library-rental-backend/rag
python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt
```

This installs `chromadb` (the vector database), `psycopg2-binary` (lets
Python talk to your Postgres/Supabase database), and `python-dotenv` (loads
your `.env` file).

### 2. Ingest the business rules (no database needed for this one)

```bash
python 1_ingest_business_rules.py
```

This reads `business_rules/rules.json` — 9 rules, now verified against your
actual `server.js` logic (7-day booking cap, off-premise rule, the
3-hour on-premise duration cap, no-double-booking guarantee, payment
gating, late fee formula, condition fee tiers, event sourcing, and the
supertype/subtype schema). Each one gets embedded and stored as its own
chunk. You should see output like:

```
Ingested 7 business rule chunks into 'business_rules'.
Vector DB stored at: .../chroma_db
```

A new `chroma_db/` folder appears — that's your actual vector database,
living on disk. Nothing gets sent anywhere; this all runs locally.

**If a rule is wrong or missing** (e.g. if I mis-stated a formula, or you
have more rules I didn't see in the docs), edit `business_rules/rules.json`
directly — add a new `{id, category, title, text}` object per rule — and
re-run the script. It's safe to re-run any time; it overwrites by id
instead of duplicating.

### 3. Connect to your real database

Create a `.env` file in this folder (same folder as the scripts):

```
DATABASE_URL=postgres://...your actual Supabase connection string...
```

Use the exact same connection string your Express backend already uses —
copy it straight from `library-rental-backend/.env`'s own `DATABASE_URL`.

### 4. Ingest inventory (items + rooms)

```bash
python 2_ingest_inventory.py
```

This queries your `items` and `rooms` tables (unioned together), and turns
each row into one natural-language description (e.g. *"Dell Latitude 7420
is an item in the laptop category. This is an off-premise item (requires
payment, leaves the building). Current status: available."*) — that's the
"one item = one chunk" rule from chunking.

This query is now written against your real schema (confirmed from
`server.js`), so it should run as-is. If your live table has grown extra
columns since (e.g. an item `description` field this script doesn't know
about), add them to the `QUERY` and `row_to_text()` in
`2_ingest_inventory.py` to get richer chunks — that's an enhancement, not
a required fix.

### 5. Ingest condition notes

```bash
python 3_ingest_condition_notes.py
```

Same idea, but pulling from `rental_events.condition_notes`, joined out to
`items`/`rooms` the same way `server.js`'s `/api/activity/recent` does —
every past note becomes a searchable chunk (e.g. *"Condition note for Room
204 (recorded at late_return on 2026-08-14): Condition recorded as 'good'.
Projector bulb dim, may need replacing soon."*). If your test data doesn't
have any condition notes yet, this script will just report zero rows —
that's fine, run it again later once there's real data.

### 6. Test that retrieval actually works

```bash
python 4_query_test.py
```

Runs a handful of example questions against all three collections and
shows what comes back, with a similarity score (lower = closer match).
This is the moment you actually see semantic search working — e.g. asking
"can I book a room that's already checked out to someone else?" should
surface the off-premise rule even though the question doesn't use the
words "off-premise" or "checked out" the same way the rule text does.

Try your own questions too:

```bash
python 4_query_test.py "what happens if I damage a room's equipment?"
```

## What "done" looks like for Phase 0

- [ ] `chroma_db/` exists with three collections: `business_rules`,
      `inventory`, `condition_notes`
- [ ] `4_query_test.py` returns sensible top matches for questions in each
      category
- [ ] You've eyeballed a few chunks in each collection and they read
      correctly (no garbled data, no wrong column values)

Once that's true, Phase 0 is done and Phase 1 (building the actual chatbot
that takes a user question, retrieves from these collections, and asks
Claude's API to answer using that context) can start.
