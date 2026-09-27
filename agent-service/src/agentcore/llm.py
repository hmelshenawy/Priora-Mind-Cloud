from ollama import chat
from abc import ABC, abstractmethod

class LlmClient(ABC):    
    @abstractmethod
    def chat(self, message):
        return

# -----------------------
    
class OllamaClient(LlmClient):
    def __init__(self, model_name: str, tools: list, tool_registry: list):
        self.model_name = model_name
        self.tools= tools
        self.tool_registry= tool_registry
        


    def chat(self, messages: list):
        response =chat(
            model = self.model_name,
            messages=messages,
            tools= self.tools,
            think=False,
        )
        print("CONTENT:", repr(response.message.content))
        print("THINKING:", repr(response.message.thinking))
        print("TOOLS:", response.message.tool_calls)

        messages.append(response.message)
        
        return  response
                    