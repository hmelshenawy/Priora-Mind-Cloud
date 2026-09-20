from ollama import chat
from agentcore.tools import registered_tools, tools_registery
from abc import ABC, abstractmethod

class LlmClient(ABC):    
    @abstractmethod
    def chat(self, message):
        return

# -----------------------
    
class OllamaClient(LlmClient):
    def __init__(self, model_name: str):
        self.model_name = model_name
        


    def chat(self, message):
        print("chat")
        messages= [{"role": "system", "content": "Your Are Stupid AI Agent"}]
        messages.append({"role": "user", "content":message})
        
        response = chat(
            model = self.model_name,
            messages=messages,
            tools= registered_tools
        )
        if response.message.tool_calls:
            agent_reply = response.message.tool_calls

            tool_name = agent_reply[0].function.name
            tool_args = agent_reply[0].function.arguments

            tool = tools_registery.get(tool_name)
            response = tool(**tool_args)
            print(response)
            return {"tool":response}
        
        agent_reply = response.message.content
        print(agent_reply)
        return agent_reply