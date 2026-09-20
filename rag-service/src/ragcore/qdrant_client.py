from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from qdrant_client.models import Distance, VectorParams
from ragcore.config import ENV
REQUIRED_CHUNK_FIELDS = (   
    "chunk_id",
    "source_id",
    "source_type",
    "chunk_index",
    "text",
)

class QdClient:
    def __init__(self, url: str, api_key: str, timeout: int):
        self.url = url
        self.api_key = api_key
        self.timeout = timeout

        if timeout <= 0:
            raise ValueError("Qdrant timeout must be greater than zero")
        
        if url == ":memory:":
            self.client =  QdrantClient(location=":memory:")
        else:
            self.client = QdrantClient(url= self.url, api_key= self.api_key, timeout= self.timeout)
        

    def upsert(self, collection_name: str,points: list[any],batch_size: int = 50,):
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than zero")
        
        if any(not isinstance(point, PointStruct) for point in points):
            raise ValueError("upsert_points accepts PointStruct objects only")

        total = len(points)
        print("total points:             ", total)

        for start in range(0, total, batch_size):
            batch = points[start : start + batch_size]
            self.client.upsert(collection_name=collection_name, points=batch, wait=True)
            print(f"Qdrant upsert: {start + len(batch)}/{total}")
        return total


    def ensure_collection(
    self,
    collection_name: str,
    embedding_dimension: int,
):
        """Create a cosine collection or validate an existing collection's vector contract."""
    

        collections = self.client.get_collections()
        names = {collection.name for collection in collections.collections}
        if collection_name not in names:
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=embedding_dimension, distance=Distance.COSINE),
            )
            print("collection created!!")
            return

        vectors = self.client.get_collection(collection_name).config.params.vectors
        vector_config = vectors.get("") if isinstance(vectors, dict) else vectors
        if vector_config is None:
            raise ValueError(f"Qdrant collection '{collection_name}' has no default vector")
        if vector_config.size != embedding_dimension:
            raise ValueError(
                f"Qdrant collection '{collection_name}' vector dimension is "
                f"{vector_config.size}, expected {embedding_dimension}"
            )
        if vector_config.distance != Distance.COSINE:
            raise ValueError(
                f"Qdrant collection '{collection_name}' distance is "
                f"{vector_config.distance}, expected Cosine"
            )
        print("Collection Confirmed!!")


    def validate_chunk(self, chunk: dict[str, object]) -> None:
        """Validate the canonical chunk dictionary and name every invalid field clearly."""
        if not isinstance(chunk, dict):
            raise ValueError("chunk must be a dictionary")
        for field in REQUIRED_CHUNK_FIELDS:
            if field not in chunk:
                raise ValueError(f"chunk is missing required field '{field}'")
        for field in ("chunk_id", "source_id"):
            if not isinstance(chunk[field], str) or not chunk[field].strip():
                raise ValueError(f"chunk field '{field}' must not be empty")
        if chunk["source_type"] != "pdf":
            raise ValueError("chunk field 'source_type' must be 'pdf'")
       

    def map_chunks_to_points(
    self,
    chunks: list[dict[str, object]],
    vectors: list[list[float]],
    embedding_model: str,
    embedding_dimension: int,
    environment: str,
):
        """Map canonical chunks and same-length vectors to deterministic PointStruct values."""
    

        if len(chunks) != len(vectors):
            raise ValueError("chunks and vectors must have the same length")
        points: list[any] = []
        for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True)):
            self.validate_chunk(chunk)
            if len(vector) != embedding_dimension:
                raise ValueError(
                    f"vector at index {index} has dimension {len(vector)}, "
                    f"expected {embedding_dimension}"
                )
            payload = dict(chunk)
            payload.update(
                {

                "active": True,
                "approved": True,
                "embedding_model": embedding_model,
                "embedding_dimension": embedding_dimension,
                "environment": ENV,
                "schema_version": 2,
            }
        )
            points.append(PointStruct(id=chunk["chunk_id"], vector=vector, payload=payload))
        return points


    def search(self, vector: list[float], topk, collection: str):
        response = self.client.query_points(
        collection_name=collection,
        query=vector,
        limit=topk,
        with_payload=True,
    )

        return response