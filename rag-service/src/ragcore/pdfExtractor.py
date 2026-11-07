from time import perf_counter
from ragcore.logging_utils import get_logger, set_stage

logger = get_logger(__name__)
from io import BytesIO
from pypdf import PdfReader

class PdfExtractor:
    def __init__(self):
        pass    
        
    def extract(self, file_bytes):    
        set_stage("extract")
        started = perf_counter()
        self.pdf = PdfReader(BytesIO(file_bytes))
        text = []
        for index, page in enumerate(self.pdf.pages):
            # text += page.extract_text()+"\n"
            text.append({
                "page_text": page.extract_text(),
                 "page_no": index,
            })

        logger.debug("document.extract.completed page_count=%d duration_ms=%d", len(text), (perf_counter() - started) * 1000)
        return text