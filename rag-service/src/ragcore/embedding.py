from ragcore.config import EMBEDDING_BATCH_SIZE, EMBEDDING_MODEL
from sentence_transformers import SentenceTransformer

class Embedding:
    def __init__(self, model):
        self.model = SentenceTransformer(model)
        

    def embed(self, texts: list[str]):
        vectors = self.model.encode(
            texts,
            normalize_embeddings=True ).tolist()

        
        return [[float(value) for value in vector] for vector in vectors]