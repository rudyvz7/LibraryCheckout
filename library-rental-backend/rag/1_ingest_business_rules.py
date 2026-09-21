"""
Phase 0, Step 1: Embed the business rules into Chroma.

What this does:
  - Reads business_rules/rules.json (one JSON object per rule = one chunk)
  - Embeds each rule's text using Chroma's built-in local embedding model
    (all-MiniLM-L6-v2 — free, runs on your machine, no API key needed)
  - Stores each embedding + the original text + metadata (category, title)
    in a local Chroma collection called "business_rules"

Run it with:
  python 1_ingest_business_rules.py

This creates/updates a folder called chroma_db/ in the same directory —
that folder IS your vector database. It persists between runs, so you can
re-run this script any time the rules change and it will just overwrite
the existing entries (upsert), not duplicate them.
"""

import json
import os
import chromadb

HERE = os.path.dirname(os.path.abspath(__file__))
RULES_PATH = os.path.join(HERE, "business_rules", "rules.json")
DB_PATH = os.path.join(HERE, "chroma_db")


def main():
    with open(RULES_PATH, "r") as f:
        rules = json.load(f)

    # PersistentClient writes to disk at DB_PATH so the data survives
    # between script runs / server restarts.
    client = chromadb.PersistentClient(path=DB_PATH)

    # get_or_create_collection: makes the collection the first time,
    # reuses it on later runs. No embedding_function is passed, so Chroma
    # uses its default local model (all-MiniLM-L6-v2) automatically.
    collection = client.get_or_create_collection(name="business_rules")

    ids = [r["id"] for r in rules]
    documents = [r["text"] for r in rules]
    metadatas = [
        {"category": r["category"], "title": r["title"]} for r in rules
    ]

    # upsert = insert new / overwrite existing by id, so this script is
    # safe to re-run whenever rules.json changes.
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    print(f"Ingested {len(rules)} business rule chunks into '{collection.name}'.")
    print(f"Vector DB stored at: {DB_PATH}")

    # Quick sanity check: run one test query so you can see retrieval working.
    test_query = "how much do I get charged if I return a room late?"
    results = collection.query(query_texts=[test_query], n_results=2)
    print(f"\nSanity check — top matches for: {test_query!r}")
    for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
        print(f"  - [{meta['category']}] {meta['title']}")


if __name__ == "__main__":
    main()
