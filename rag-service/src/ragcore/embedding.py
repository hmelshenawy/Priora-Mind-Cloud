from sentence_transformers import SentenceTransformer
import logging
from ragcore.logging_utils import get_logger, stage

logger = get_logger(__name__)


class Embedding:
    def __init__(self, model):
        # A fixed alias avoids exposing configured local paths or private model IDs.
        with stage(logger, "embed", "embedding.model.loaded", logging.INFO, model="configured"):
            self.model = SentenceTransformer(model)

    def embed(self, texts: list[str]):
        with stage(logger, "embed", "embedding.completed", model="configured", input_count=len(texts)) as fields:
            vectors = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()
            result = [[float(value) for value in vector] for vector in vectors]
            fields.update(vector_count=len(result), dimension=len(result[0]) if result else 0)
            return result
