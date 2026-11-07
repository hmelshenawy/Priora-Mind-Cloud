from fastapi import FastAPI, Header, Request
from ragcore.storage import StorageClient
from ragcore.config import ENV, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET, SUPABASE_URL, EMBEDDING_BATCH_SIZE,EMBEDDING_DIM, EMBEDDING_MODEL, QDRANT_API_KEY,QDRANT_COLLECTION,QDRANT_URL
from ragcore.chunker import Chunker, WordChunker
from ragcore.embedding import Embedding
from ragcore.qdrant_client import QdClient
from ragcore.pdfExtractor import PdfExtractor
from fastapi import FastAPI, Depends
from ragcore.utils.service_verfication import verify_service_key
import logging

from ragcore.logging_utils import configure_logging, get_logger, stage, counts, set_stage, RequestLoggingMiddleware

configure_logging()
logger = get_logger(__name__)

app = FastAPI(title = "Priora Mind Cloud Rag Service")
startup_stage = "download"
try:
    client = StorageClient(SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET)
    chunker = WordChunker(size=275, overlap=15)
    startup_stage = "embed"
    embedding = Embedding(EMBEDDING_MODEL)
    startup_stage = "collection"
    qdClient = QdClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60)
except Exception:
    logger.error("service.start.failed stage=%s error_code=initialization_failed", startup_stage)
    raise


@app.get("/v1/health")
async def health():
    return {
        "status":"Ok",
        }



@app.post("/v1/ingest", dependencies=[Depends(verify_service_key)])
async def ingest(request: Request,):
    set_stage("parse")
    payload = await request.json()
    file_name = payload["fileName"]
    key = payload["storageKey"]
    source_id = payload["source_id"]
    mindSpaceId = payload["mindSpaceId"]

   
    file = client.getFile(key)

    extractor = PdfExtractor()
    text = extractor.extract(file)
    

    counts(page_count=len(text))
    with stage(logger, "chunk", "chunking.completed", size=chunker.size, overlap=chunker.overlap) as fields:
        chunks = chunker.chunk(text, source_id)
        fields["chunk_count"] = len(chunks)
    counts(chunk_count=len(chunks))
    chunks_text = [chunk["text"] for chunk in chunks]

     
    embeds = embedding.embed(chunks_text)


    
    qdClient.ensure_collection(QDRANT_COLLECTION, EMBEDDING_DIM)

    set_stage("map")
    points = qdClient.map_chunks_to_points(mindSpaceId= mindSpaceId, chunks= chunks, vectors= embeds, embedding_dimension= EMBEDDING_DIM, embedding_model= EMBEDDING_MODEL, environment=ENV, file_name = file_name)
    qdClient.upsert(collection_name=QDRANT_COLLECTION,points= points )
    counts(indexed_count=len(points))

    return {
  "status": "Ingestion done",
  "textLength": len(points)
}



@app.post("/v1/search", dependencies=[Depends(verify_service_key)])
async def search(request: Request):
    set_stage("parse")
    payload = await request.json()
    query = payload["query"]
    topK =int( payload["topK"])
    mindSpaceId = payload["mindSpaceId"]

    embeds = embedding.embed([query])[0]

    response = qdClient.search(vector= embeds, topk= topK, mindSpaceId= mindSpaceId, collection=QDRANT_COLLECTION)
    counts(top_k=topK, result_count=len(response.points))
    return response



@app.post("/v1/embed", dependencies=[Depends(verify_service_key)])
async def embed(request: Request):
    set_stage("parse")
    payload = await request.json()
    texts = payload["texts"]


    vectors = embedding.embed(texts)
    counts(input_count=len(texts), vector_count=len(vectors), dimension=len(vectors[0]) if vectors else 0)

    return {
        "vectors": vectors
    }


# Wrap FastAPI outside ServerErrorMiddleware to observe actual 500 responses.
app = RequestLoggingMiddleware(app)
