from uuid import NAMESPACE_URL, uuid5

class Chunker:
    def __init__(self,  chunk_size: int = 500, overlap: int = 50):
        if chunk_size <= 0:
            raise ValueError("chunk_size must be greater than 0")

        if overlap < 0:
            raise ValueError("overlap cannot be negative")

        if overlap >= chunk_size:
            raise ValueError("overlap must be smaller than chunk_size")
        self.chunk_size = chunk_size
        self.overlap = overlap
        
        

    def chunk(self, pages: list[dict],source_id: str):
        
        chunks: list[dict] = []
        index = 0 

        for page in pages:
            page_text = page["page_text"]
            page_no = page["page_no"]
            start = 0
            


            while start < len(page_text):
                end = start + self.chunk_size
                chunk = page_text[start: end].strip()

                if chunk:
                    
                    print("chunck:______________ ",chunk)
                    chunks.append(
                        {
                        "chunk_id": str(uuid5(NAMESPACE_URL, f"{source_id}:{index}")),
                        "chunk_index": index,
                        "source_id": source_id,
                        "source_type": "pdf",
                        "text": chunk,
                        "page_no": page_no  ,

                        }
                    )
                    index +=1

                start = end - self.overlap

        return chunks