from agentcore.llm import  OllamaClient
from agentcore.config import Configs


system_prompt = {
    "role": "system",
    "content": (
        """You are an AI agent.

        You have access to the user's uploaded documents and stored knowledge
        through the searchKnowledge tool.

        When the user asks a factual question about uploaded documents,
        stored knowledge, files, PDFs, or the current MindSpace,
        you MUST call searchKnowledge before answering.

        Do not say that you cannot access uploaded documents.
        Use searchKnowledge instead.

        If searchKnowledge returns no useful result, then say that the information
        was not found in the stored knowledge."""
    )
}

class Agent:
    def __init__(self, llm_model: str,   tools:list, tool_registry: list, steps: int = 10):
        self.token = ""
        self.tools = tools
        self.llm_model= llm_model
        self.tool_registry = tool_registry
        # self.messages = []
        self.steps = steps
        # self.messages.append(system_prompt)
        self.llm = OllamaClient(
            model_name= self.llm_model,
            tool_registry= self.tool_registry,
            tools= self.tools,
            
        )


    def run(self, message, history):
        step=0
        messages = []
        messages.append(system_prompt)
        messages += history
        messages.append({"role": "user", "content": message})

        print("all history:", messages)
        

        while step < self.steps:
            step+=1
            print("Step: ", step)
            response =self.llm.chat(messages)
           

            if response.message.tool_calls:
                messages.append(response.message)
                for call in response.message.tool_calls:
                    tool_name = call.function.name
                    tool_args = call.function.arguments

                    
                    result = self.call_tool(name=tool_name, args=tool_args)

                    messages.append( {"role": "tool", "tool_name": tool_name, "content": str(result) })
            else:
                    messages.append({"role": "assistant", "content": str(response.message.content)})
                    return  messages[-1]
        return  messages[-1]

    
    def call_tool(self, name: str, args: dict):
        tool = self.tool_registry.get(name)
        if not tool:
            return {
                "ok": False,
                "status": "UNKNOWN TOOL!!"
            }
        
        try:
            result = tool( **args)
        except Exception as e:
            print(str(e))
            result = {"ok": False,
                    "status": "TOOL EXECUTION FAILED!!",
                    }
        return result

