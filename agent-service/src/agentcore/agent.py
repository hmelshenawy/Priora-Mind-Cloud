from agentcore.llm import  OllamaClient
from agentcore.config import Configs

system_prompt = {
    "role": "system",
    "content": (
        "You are an AI agent. "
        "When the user asks for multiple pieces of information, "
        "use all required tools before answering. "
        "Do not skip any requested part."
    )
}

class Agent:
    def __init__(self, llm_model: str,   tools:list, tool_registry: list, steps: int = 10):
        self.tools = tools
        self.llm_model= llm_model
        self.tool_registry = tool_registry
        self.messages = []
        self.steps = steps
        self.messages.append(system_prompt)
        self.llm = OllamaClient(
            model_name= self.llm_model,
            tool_registry= self.tool_registry,
            tools= self.tools,
            
        )


    def run(self, message):
        step=0
        self.messages.append({"role": "user", "content": message})
        response = self.llm.chat(self.messages)

        while step < self.steps:
            step+=1
            print("Step: ", step)
            result =self.llm.chat(self.messages)
            print(self.messages)

            if result["tool_call"] == False:
                return self.messages[-1]

            return self.messages[-1]

    def clear_history(self):
        self.messages.clear()