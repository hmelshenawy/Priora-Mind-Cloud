from ollama import AsyncClient
from abc import ABC, abstractmethod
from openai import AsyncOpenAI
from agentcore.config import Configs
class LlmClient(ABC):    
    @abstractmethod
    async def chat(self, message):
        return

    @abstractmethod
    async def stream(self, message):
        return 

    @abstractmethod
    async def structured_chat(self, messages, schema):
        return
        
# -----------------------
    


class Openrouter(LlmClient):
    def __init__(self):
        self.client = AsyncOpenAI( 
                            base_url="https://openrouter.ai/api/v1",
                            api_key=Configs.OPENROUTER_API_KEY,
                                    )


    async def chat(self, messages: list, format=None, tools=None):
        """
        Generate a chat completion using OpenRouter.
        Args:
            messages (list): Conversation messages.
            format (dict | None): Optional JSON schema.
            tools (list | None): Available tools.
        Returns:
            ChatCompletion: OpenAI chat response.
        """
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            tools=tools or None,
            response_format=(
                {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "response",
                        "schema": format,
                    },
                }
                if format else None
            ),
        )

        messages.append(
            response.choices[0].message.model_dump(
                exclude_none=True
            )
        )

        return response



    async def stream(self, messages: list, format=None, tools=None):
            """
            Stream chat completions using OpenRouter.

            Args:
                messages (list): Conversation messages.
                format (dict | None): Optional JSON schema.
                tools (list | None): Available tools.

            Returns:
                AsyncStream: Streaming completion chunks.
            """
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                tools=tools or None,
                stream=True,
            )

            return response



    async def structured_chat(self, messages: list, schema):
        """
        Generate and validate structured output.
        Args:
            messages (list): Conversation messages.
            schema (BaseModel): Pydantic response model.
        Returns:
            BaseModel: Validated structured response.
        """
        response = await self.client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    "schema": schema.model_json_schema(),
                },
            },
        )

        return schema.model_validate_json(
            response.choices[0].message.content
        )


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


    async def structured_chat(self, messages, schema):
        response = await self.client.chat(
            model=self.model_name,
            messages=messages,
            format=schema.model_json_schema(),
            think=False,
        )

        return schema.model_validate_json(
            response.message.content
        )