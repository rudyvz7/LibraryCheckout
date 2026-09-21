"""
Phase 1: RAG chat service.

A small Flask HTTP server that:
  1. Takes a question from the Express backend
  2. Queries all three Chroma collections for relevant chunks
  3. Builds a prompt with those chunks as context
  4. Calls the Anthropic Claude API to generate an answer
  5. Returns the answer as JSON

Run it with:
  python chat_service.py

It listens on http://localhost:5001 by default.
Express calls POST /chat with {"question": "..."} and gets back {"answer": "..."}.
"""

import os
import chromadb
import anthropic
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "chroma_db")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise SystemExit("ANTHROPIC_API_KEY is not set. Add it to your .env file.")

app = Flask(__name__)
chroma_client = chromadb.PersistentClient(path=DB_PATH)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

COLLECTIONS = ["business_rules", "inventory", "condition_notes"]
N_RESULTS = 2  # chunks to retrieve per collection


def retrieve_context(question: str) -> str:
    """
    Query all three Chroma collections and return the top chunks
    as a single formatted context string to inject into the prompt.
    """
    chunks = []

    for name in COLLECTIONS:
        try:
            collection = chroma_client.get_collection(name)
        except Exception:
            continue  # collection doesn't exist yet (e.g. condition_notes is empty)

        results = collection.query(query_texts=[question], n_results=N_RESULTS)
        docs = results["documents"][0]
        metadatas = results["metadatas"][0]

        for doc, meta in zip(docs, metadatas):
            # Label each chunk with its source so Claude knows where it came from
            label = meta.get("title") or meta.get("asset_name") or name
            chunks.append(f"[{name} — {label}]\n{doc}")

    return "\n\n".join(chunks)


def ask_claude(question: str, context: str) -> str:
    """
    Send the question + retrieved context to Claude and return the answer.
    """
    system_prompt = (
        "You are a helpful assistant for the LibraryCheckout system — "
        "a library equipment and room booking system. "
        "Answer the user's question using ONLY the context provided below. "
        "If the context doesn't contain enough information to answer confidently, "
        "say so honestly rather than guessing. "
        "Keep answers concise and practical.\n\n"
        f"CONTEXT:\n{context}"
    )

    message = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=system_prompt,
        messages=[{"role": "user", "content": question}],
    )

    return message.content[0].text


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    if not data or not data.get("question"):
        return jsonify({"error": "Missing 'question' in request body."}), 400

    question = data["question"].strip()

    context = retrieve_context(question)
    if not context:
        return jsonify({"answer": "I don't have enough information to answer that yet."}), 200

    answer = ask_claude(question, context)
    return jsonify({"answer": answer}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    print("LibraryCheckout RAG chat service running on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=False)