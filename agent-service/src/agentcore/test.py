from agentcore.llm import OllamaClient
from agentcore.tools.tools import tools_registery, available_tools
from agentcore.config import Configs


messages = [{"role": "system", "content": "your are helpful assistant",
             "role": "user", "content": "what is the weather in dubai today",
             }]
client = OllamaClient(Configs.OLLAMA_MODEL_NAME, available_tools, tools_registery)

response = client.stream(messages)

for chunk in response:
    print(chunk.message.content)