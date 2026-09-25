from agentcore.llm import  OllamaClient
from agentcore.config import Configs


system_prompt = {
    "role": "system",
    "content": (
        """You are an AI agent.

        If the user asks you to perform an action that requires a tool,
        you MUST call the appropriate tool before claiming the action was completed.

        Never say that a task, note, or other action was created, saved, updated,
        or deleted unless the corresponding tool was successfully executed.

        Use all required tools before answering."""
    )
}

class Agent:
    def __init__(self, llm_model: str,   tools:list, tool_registry: list, steps: int = 10):
        self.token = ""
        self.tools = tools
        self.llm_model= llm_model
        self.tool_registry = tool_registry
        self.messages = []
        self.steps = steps
        # self.messages.append(system_prompt)
        self.llm = OllamaClient(
            model_name= self.llm_model,
            tool_registry= self.tool_registry,
            tools= self.tools,
            
        )


    def run(self, message, history):
        step=0
        self.messages.append(system_prompt)
        self.messages += history
        self.messages.append({"role": "user", "content": message})

        print("all history:", self.messages)
        # response = self.llm.chat(self.messages)

        while step < self.steps:
            step+=1
            print("Step: ", step)
            response =self.llm.chat(self.messages)
            # print(self.messages)

            if response.message.tool_calls:
                for call in response.message.tool_calls:
                    tool_name = call.function.name
                    tool_args = call.function.arguments

                    tool = self.tool_registry.get(tool_name)
                    result = tool( **tool_args)

                    self.messages.append( {"role": "tool", "tool_name": tool_name, "content": str(result) })
            else:
                    self.messages.append({"role": "assistant", "content": str(response.message.content)})
                    return  self.messages[-1]
        return  self.messages[-1]

    def clear_history(self):
        self.messages.clear()


