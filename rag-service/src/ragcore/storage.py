from supabase import create_client




class StorageClient:
    def __init__(self, url:str, secret_key: str, bucket: str):
        self.client = create_client(
    url,
    secret_key,
)
        self.bucket = bucket


    def getFile(self, storageKey: str):
        print(storageKey)
        file = self.client.storage.from_(self.bucket).download(storageKey)
        print(file[:5])
        return file