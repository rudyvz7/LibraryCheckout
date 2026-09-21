"""
Phase 0, Step 3: Embed past condition notes into Chroma (semantic search
over rental_events.condition_notes).

What this does:
  - Connects to the same Supabase Postgres database
  - Pulls every rental_events row that has a non-empty condition_notes field
  - Turns each note into one chunk of text, tagged with which asset it
    belongs to and when it was written
  - Embeds and stores each chunk in a Chroma collection called
    "condition_notes"

This is what lets the chatbot answer things like "has this laptop had
screen problems before?" — a keyword search for "screen" would miss a
note that says "display flickers intermittently," but semantic search
catches it because the *meaning* is close even though the words differ.

Before running:
  Same setup as step 2 — DATABASE_URL must be set (via .env or your
  shell environment). Query is written against your real schema
  (rental_events.event_id / created_at, joined out to items or rooms
  via LEFT JOIN + COALESCE — the same pattern server.js itself uses in
  /api/activity/recent).

Run it with:
  python 3_ingest_condition_notes.py
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

QUERY = """
SELECT
    e.event_id,
    e.asset_id,
    COALESCE(i.name, r.room_number) AS asset_name,
    e.event_type,
    e.condition_before,
    e.condition_after,
    e.condition_notes,
    e.created_at
FROM rental_events e
LEFT JOIN items i ON i.item_id = e.asset_id
LEFT JOIN rooms r ON r.room_id = e.asset_id
WHERE e.condition_notes IS NOT NULL
  AND e.condition_notes <> ''
ORDER BY e.created_at DESC
"""


def row_to_text(row):
    date_str = row["created_at"].strftime("%Y-%m-%d") if row["created_at"] else "unknown date"
    condition_bit = f" Condition recorded as '{row['condition_after']}'." if row.get("condition_after") else ""
    return (
        f"Condition note for {row['asset_name']} "
        f"(recorded at {row['event_type']} on {date_str}):"
        f"{condition_bit} {row['condition_notes']}"
    )


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
        print(
            "No condition notes found. This is normal if your test data "
            "doesn't include any notes yet — this script will just be a "
            "no-op until there's real data to embed."
        )
        return

    ids = [f"note_{row['event_id']}" for row in rows]
    documents = [row_to_text(row) for row in rows]
    metadatas = [
        {
            "asset_id": str(row["asset_id"]),
            "asset_name": row["asset_name"] or "unknown",
            "event_type": row["event_type"] or "unknown",
        }
        for row in rows
    ]

    client = chromadb.PersistentClient(path=DB_PATH)
    collection = client.get_or_create_collection(name="condition_notes")
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    print(f"Ingested {len(rows)} condition note chunks into 'condition_notes'.")
    print(f"Vector DB stored at: {DB_PATH}")

    if documents:
        print("\nExample chunk (most recent note, sanity check):")
        print(f"  {documents[0]}")


if __name__ == "__main__":
    main()
