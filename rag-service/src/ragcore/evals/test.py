from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue

import os
from dotenv import load_dotenv


load_dotenv()

client = QdrantClient(
    url=os.environ["QDRANT_URL"],
    api_key=os.getenv("QDRANT_API_KEY") or None,
)

SOURCE_ID = "2bf0fa22-c5ae-466e-bd4c-a2eefc1eaf13"
COLLECTION = "priora-mind-cloud"

points = []
offset = None

while True:
    batch, offset = client.scroll(
    collection_name=COLLECTION,
    limit=100,
    offset=offset,
    with_payload=True,
    with_vectors=False,
)
    points.extend(batch)

    if offset is None:
        break

print("TOTAL CHUNKS:", len(points))

for point in points:
    payload = point.payload or {}

    if payload.get("source_id") != SOURCE_ID:
        continue

    chunk_text = payload.get("text", "")

    if any(term in chunk_text.lower() for term in [
        "match modules",
        "anhedonia",
        "situational avoidance",
        "overly simplistic",
    ]):
        print("\nFOUND!")
        print("Page:", payload.get("page_no"))
        print("Chunk:", payload.get("chunk_index"))
        print("Text:", chunk_text)