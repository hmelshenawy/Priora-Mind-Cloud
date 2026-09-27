from io import BytesIO
from pypdf import PdfReader

class PdfExtractor:
    def __init__(self):
        pass    
        
    def extract(self, file_bytes):    
        self.pdf = PdfReader(BytesIO(file_bytes))
        text = []
        for index, page in enumerate(self.pdf.pages):
            # print(page.extract_text())
            # text += page.extract_text()+"\n"
            text.append({
                "page_text": page.extract_text(),
                 "page_no": index,
            })

        return text