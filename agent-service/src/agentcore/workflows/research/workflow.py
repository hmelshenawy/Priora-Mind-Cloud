from agentcore.workflows.step import BaseStep
from agentcore.llm import LlmClient

class SearchStep(BaseStep):
    def __init__(self, llm: LlmClient):
        super().__init__()
        self.llm = llm


    def run(self, userMessage: str):
        prompt = "use research tool"
        response = self.llm.stream(userMessage)
        return