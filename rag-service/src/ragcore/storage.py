from ragcore.logging_utils import get_logger, stage

logger = get_logger(__name__)
from supabase import create_client




class StorageClient:
    def __init__(self, url:str, secret_key: str, bucket: str):
        self.client = create_client(
    url,
    secret_key,
)
        self.bucket = bucket


    def getFile(self, storageKey: str):
        with stage(logger, "download", "storage.download.completed") as fields:
            file = self.client.storage.from_(self.bucket).download(storageKey)
            fields["byte_count"] = len(file)
        return file