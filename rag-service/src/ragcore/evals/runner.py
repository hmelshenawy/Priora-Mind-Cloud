import json
from pathlib import Path
from ragcore.evals.metrics import RagMetrics

DATASET_PATH = Path(__file__).with_name("dataset.json")


def load_dataset():
    data = json.loads(
        DATASET_PATH.read_text(encoding="utf-8")
    )
    return data["examples"]


import asyncio
import httpx
import os

from dotenv import load_dotenv

load_dotenv(".env.eval")

RAG_URL = os.getenv("EVAL_RAG_URL", "http://127.0.0.1:8900")
MINDSPACE_ID = os.environ["EVAL_MINDSPACE_ID"]
TOP_K = 5



async def retrieve_contexts(client: httpx.AsyncClient, question: str):
    response = await client.post(
        f"{RAG_URL}/v1/search",
        json={
            "query": question,
            "topK": TOP_K,
            "mindSpaceId": MINDSPACE_ID,
        },
    )

    response.raise_for_status()
    return response.json()




async def main():
    cases = load_dataset()[1:2]  # TCBT-09 only
    # cases = load_dataset()      # All tests

    metrics = RagMetrics()
    results = []

    for case in cases:
        if case["id"] == "CBT-13":
            continue

        # 1. Retrieve contexts
        try:
            response = httpx.post(
                f"{RAG_URL}/v1/search",
                json={
                    "query": case["question"],
                    "topK": TOP_K,
                    "mindSpaceId": MINDSPACE_ID,
                },
                timeout=180.0,
            )

            response.raise_for_status()
            data = response.json()

        except httpx.TimeoutException as exc:
            print(f"{case['id']} RETRIEVAL TIMEOUT: {exc}")
            continue

        except httpx.HTTPError as exc:
            print(f"{case['id']} RETRIEVAL ERROR: {exc}")
            continue

        # 2. Extract retrieved contexts
        points = data.get("points", [])

        contexts = [
            point["payload"]["text"]
            for point in points
            if point.get("payload", {}).get("text")
        ]

        if not contexts:
            print(f"{case['id']}: No contexts retrieved")
            continue

        # 3. Debug output
        print("\nQUESTION:")
        print(case["question"])

        print("\nREFERENCE ANSWER:")
        print(case["reference_answer"])

        print("\nRETRIEVED CONTEXTS:")

        for i, point in enumerate(points, start=1):
            payload = point.get("payload", {})

            print(f"\n--- CHUNK {i} ---")
            print("Score:", point.get("score"))
            print("Page:", payload.get("page_no"))
            print("Chunk:", payload.get("chunk_index"))
            print("Text:", payload.get("text", "")[:1500])

        # 4. Evaluate with RAGAS
        try:
            scores = await metrics.evaluate(
                question=case["question"],
                reference=case["reference_answer"],
                contexts=contexts,
            )

            result = {
                "id": case["id"],
                "retrieved_chunks": len(contexts),
                **scores,
            }

            results.append(result)
            print(f"\nEvaluation RAG Result: {result}")

        except Exception as exc:
            print(f"{case['id']} EVALUATION FAILED: {exc}")

    # 5. Calculate averages
    if results:
        print("\nAVERAGE SCORES")

        for metric in ("context_precision", "context_recall"):
            values = [
                result[metric]
                for result in results
                if isinstance(result.get(metric), (int, float))
            ]

            if values:
                average = sum(values) / len(values)
                print(f"{metric}: {average:.3f}")


if __name__ == "__main__":
    asyncio.run(main())