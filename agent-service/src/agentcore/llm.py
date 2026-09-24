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
        if response.message.tool_calls:
            
            messages.append(response.message)
            for call in response.message.tool_calls:
                tool_name = call.function.name
                tool_args = call.function.arguments

                tool = self.tool_registry.get(tool_name)
                result = tool(**tool_args)

                messages.append( {"role": "tool", "tool_name": tool_name, "content": str(result) })
            
                return {"tool_call": True,
                    "response" : messages
                    }
        
        messages.append({"role": "assistant", "content": str(response.message.content)})
        
        return {
            "tool_call": False,
                    "response" : messages
                    }