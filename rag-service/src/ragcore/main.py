from fastapi import FastAPI, Header, HTTPException, Request
from ragcore.storage import StorageClient
from ragcore.config import ENV, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET, SUPABASE_URL, EMBEDDING_BATCH_SIZE,EMBEDDING_DIM, EMBEDDING_MODEL, QDRANT_API_KEY,QDRANT_COLLECTION,QDRANT_URL
from ragcore.chunker import Chunker
from ragcore.embedding import Embedding
from ragcore.qdrant_client import QdClient
from ragcore.pdfExtractor import PdfExtractor


app = FastAPI(title = "Priora Mind Cloud Rag Service")
client = StorageClient(SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET)
chunker = Chunker(100, 20)
embedding = Embedding(EMBEDDING_MODEL) 
qdClient = QdClient(url= QDRANT_URL, api_key=QDRANT_API_KEY, timeout= 60)

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
    mindSpaceId = payload["mindSpaceId"]

   
    file = client.getFile(key)

    extractor = PdfExtractor()
    text = extractor.extract(file)
    print(text)

    chunks = chunker.chunk(text, source_id)
    chunks_text = [chunk["text"] for chunk in chunks]
    print("chunks lenght is:", len(chunks))
     
    embeds = embedding.embed(chunks_text)
    print("dimension:", len(embeds[0]) if embeds else 0)

    
    qdClient.ensure_collection(QDRANT_COLLECTION, EMBEDDING_DIM)

    points = qdClient.map_chunks_to_points(mindSpaceId= mindSpaceId, chunks= chunks, vectors= embeds, embedding_dimension= EMBEDDING_DIM, embedding_model= EMBEDDING_MODEL, environment=ENV)
    qdClient.upsert(collection_name=QDRANT_COLLECTION,points= points )

    return {
  "status": "Ingestion done",
  "textLength": len(points)
}


@app.post("/v1/search")
async def search(request: Request):
    payload = await request.json()
    query = payload["query"]
    topK =int( payload["topK"])
    mindSpaceId = payload["mindSpaceId"]

    embeds = embedding.embed([query])[0]

    print(embeds)

    response = qdClient.search(vector= embeds, topk= topK, mindSpaceId= mindSpaceId, collection=QDRANT_COLLECTION)
    print(response)
    return response