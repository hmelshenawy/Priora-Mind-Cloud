from fastapi import FastAPI, Header, HTTPException, Request
from ragcore.storage import StorageClient
from ragcore.config import ENV, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET, SUPABASE_URL, EMBEDDING_BATCH_SIZE,EMBEDDING_DIM, EMBEDDING_MODEL, QDRANT_API_KEY,QDRANT_COLLECTION,QDRANT_URL
from ragcore.chunker import Chunker
from ragcore.embedding import Embedding
from ragcore.qdrant_client import QdClient
from ragcore.pdfExtractor import PdfExtractor


app = FastAPI(title = "Priora Mind Cloud Rag Service")

@app.get("/v1/health")
async def health():
    return {
        "status":"Ok",
        }


@app.post("/v1/ingest")
async def ingest(request: Request,):
    payload = await request.json()
    key = payload["storageKey"]
    source_id = payload["source_id"]

    client = StorageClient(SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET)
    file = client.getFile(key)

    extractor = PdfExtractor()
    text = extractor.extract(file)
    print(text)

    chunker = Chunker(100, 20)
    chunks = chunker.chunk(text, source_id)
    chunks_text = [chunk["text"] for chunk in chunks]
    print("chunks lenght is:", len(chunks))

    embedding = Embedding(EMBEDDING_MODEL)  
    embeds = embedding.embed(chunks_text)
    print("dimension:", len(embeds[0]) if embeds else 0)

    client = QdClient(url= QDRANT_URL, api_key=QDRANT_API_KEY, timeout= 60)
    client.ensure_collection(QDRANT_COLLECTION, EMBEDDING_DIM)

    points = client.map_chunks_to_points(chunks= chunks, vectors= embeds, embedding_dimension= EMBEDDING_DIM, embedding_model= EMBEDDING_MODEL, environment=ENV)
    client.upsert(collection_name=QDRANT_COLLECTION,points= points )

    return {
  "status": "extracted",
  "textLength": len(file)
}