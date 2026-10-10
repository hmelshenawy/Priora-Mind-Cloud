from ollama import AsyncClient
from abc import ABC, abstractmethod

class LlmClient(ABC):    
    @abstractmethod
    async def chat(self, message):
        return

    @abstractmethod
    async def stream(self, message):
        return 
# -----------------------
    
class OllamaClient(LlmClient):
    def __init__(self, model_name: str, tools: list, tool_registry: list):
        self.model_name = model_name
        self.tools= tools
        self.tool_registry= tool_registry
        self.client = AsyncClient()

        
    async def stream(self, messages:list, format = None, tools= None):
        # print("LLM CONTEXT: ", messages)
        response =await self.client.chat(stream = True,
                        model = self.model_name,
                        messages=messages,
                        tools= tools,
                        think=False,
                        format = format,
                        )

        return response


    async def chat(self, messages: list, format = None, tools = None):
        response =await self.client.chat(
            model = self.model_name,
            messages=messages,
            tools= tools,
            think=False,
            format= format,
            
        )
        print("CONTENT:", repr(response.message.content))
        print("THINKING:", repr(response.message.thinking))
        print("TOOLS:", response.message.tool_calls)

        messages.append(response.message)
        
        return  response
                    