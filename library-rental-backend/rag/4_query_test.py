"""
Phase 0, Step 4: Test retrieval across all three collections.

This is NOT the chatbot (that's Phase 1, where Claude's API generates an
actual answer). This is just proof that retrieval — the "R" in RAG — is
working: given a question, does Chroma return the right chunks?

Run it with:
  python 4_query_test.py "your question here"

Or with no argument, it runs a few example questions covering all three
data sources (business rules, inventory, condition notes).
"""

import sys
import chromadb
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "chroma_db")

COLLECTIONS = ["business_rules", "inventory", "condition_notes"]


def search_all(client, query, n_results=2):
    print(f"\n{'=' * 70}\nQUERY: {query}\n{'=' * 70}")
    for name in COLLECTIONS:
        try:
            collection = client.get_collection(name)
        except Exception:
            print(f"\n[{name}] — collection doesn't exist yet, skipping.")
            continue

        results = collection.query(query_texts=[query], n_results=n_results)
        print(f"\n[{name}]")
        docs = results["documents"][0]
        distances = results["distances"][0]
        if not docs:
            print("  (no results — collection may be empty)")
        for doc, dist in zip(docs, distances):
            preview = doc if len(doc) < 140 else doc[:137] + "..."
            print(f"  (score {dist:.3f}) {preview}")


def main():
    client = chromadb.PersistentClient(path=DB_PATH)

    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        search_all(client, query)
        return

    example_queries = [
        "how much will I be charged if I return something late?",
        "can I book a room that's already checked out to someone else?",
        "what laptops do you have available?",
        "has this asset had any damage reported before?",
    ]
    for q in example_queries:
        search_all(client, q)


if __name__ == "__main__":
    main()
