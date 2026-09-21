"""
Phase 0, Step 2: Embed catalog/inventory data (items + rooms) into Chroma.

What this does:
  - Connects to your existing Supabase Postgres database (the same one
    LibraryCheckout's backend already uses)
  - Pulls every asset, joined with its subtype table (items or rooms)
  - Turns each asset into ONE plain-English chunk of text (one row = one
    chunk — this is the "one item/room description = one chunk" rule
    from the chunking explanation)
  - Embeds and stores each chunk in a Chroma collection called "inventory"

Before running:
  1. Set your DATABASE_URL environment variable to the same connection
     string your Express backend uses (check your backend's .env file —
     it's whatever you already use to connect to Supabase/Railway).
     Easiest way: create a .env file in this folder with one line:
         DATABASE_URL=postgres://...your connection string...
  2. This query is written against your actual schema, confirmed from
     server.js: a shared `rentable_assets` table (just asset_id) plus
     `items` (PK item_id = asset_id: name, category, current_status,
     current_condition, replacement_value, requires_payment) and `rooms`
     (PK room_id = asset_id: room_number, capacity, current_status).
     If your table has grown extra columns since (e.g. a description
     field), add them to the SELECT and to row_to_text() below — but the
     core columns here should already match.

Run it with:
  python 2_ingest_inventory.py
"""

import os
import chromadb
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "chroma_db")

DATABASE_URL = os.environ.get("DATABASE_URL")

# ---------------------------------------------------------------------------
# One row per asset (item or room), pulled via UNION ALL since items and
# rooms are separate subtype tables sharing rentable_assets.asset_id.
# Mirrors the shape of the /api/items/status endpoint in server.js.
# ---------------------------------------------------------------------------
QUERY = """
SELECT
    i.item_id AS asset_id,
    'item' AS asset_type,
    i.name,
    i.category AS item_category,
    i.current_status,
    i.current_condition,
    i.replacement_value,
    i.requires_payment,
    NULL::text AS room_number,
    NULL::int AS room_capacity
FROM items i

UNION ALL

SELECT
    r.room_id AS asset_id,
    'room' AS asset_type,
    r.room_number AS name,
    NULL AS item_category,
    r.current_status,
    NULL AS current_condition,
    NULL AS replacement_value,
    false AS requires_payment,
    r.room_number,
    r.capacity AS room_capacity
FROM rooms r
"""


def row_to_text(row):
    """Turn one asset row into a natural-language chunk for embedding."""
    if row["asset_type"] == "item":
        parts = [f"{row['name']} is an item"]
        if row.get("item_category"):
            parts[0] += f" in the {row['item_category']} category"
        parts[0] += "."
        parts.append(
            "This is an off-premise item (requires payment, leaves the building)."
            if row.get("requires_payment")
            else "This is an on-premise item (no payment required, stays on-site)."
        )
        if row.get("replacement_value") is not None:
            parts.append(f"Replacement value: ${row['replacement_value']}.")
    else:
        parts = [f"{row['name']} is a room"]
        if row.get("room_capacity"):
            parts[0] += f" with a capacity of {row['room_capacity']} people"
        parts[0] += ". This is an on-premise asset (no payment required)."

    if row.get("current_status"):
        parts.append(f"Current status: {row['current_status']}.")

    if row.get("current_condition"):
        parts.append(f"Current condition: {row['current_condition']}.")

    return " ".join(parts)


def main():
    if not DATABASE_URL:
        raise SystemExit(
            "DATABASE_URL is not set. Create a .env file in this folder "
            "with DATABASE_URL=<your connection string>, or export it "
            "in your shell before running this script."
        )

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(QUERY)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        print("No assets found — check your DATABASE_URL and query.")
        return

    ids = [f"asset_{row['asset_id']}" for row in rows]
    documents = [row_to_text(row) for row in rows]
    metadatas = [
        {
            "asset_id": str(row["asset_id"]),
            "asset_type": row["asset_type"] or "unknown",
            "current_status": row.get("current_status") or "unknown",
        }
        for row in rows
    ]

    client = chromadb.PersistentClient(path=DB_PATH)
    collection = client.get_or_create_collection(name="inventory")
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    print(f"Ingested {len(rows)} inventory chunks into 'inventory'.")
    print(f"Vector DB stored at: {DB_PATH}")

    if documents:
        print("\nExample chunk (first row, sanity check):")
        print(f"  {documents[0]}")


if __name__ == "__main__":
    main()
