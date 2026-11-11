from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from agentcore.config import Configs



class LangChainOpenRouter:

    def __init__(self, model_name: str):
        self.model = ChatOpenAI(
            model=model_name,
            api_key=Configs.OPENROUTER_API_KEY,
            base_url="https://openrouter.ai/api/v1",
                temperature=0,
                max_retries=0,
        )

    def get_model(self):
        """Return the LangChain chat model.
        Args:
            None.
        Returns:
            ChatOpenAI: Configured OpenRouter model.
        """
        return self.model


    async def structured_chat(self, messages, schema):
        """Generate structured output using a Pydantic schema.
        Args:
            messages (list): Conversation messages.
            schema (type[BaseModel]): Pydantic model class.
        Returns:
            BaseModel: Validated structured response.
        """
        structured_model = self.model.with_structured_output(
            schema,
            method="json_schema",
        )

        response = await structured_model.ainvoke(messages)

        return response



class LangChainOllama:

    def __init__(self, model_name: str):
        self.model = ChatOllama(
            model=model_name,
            temperature=0,
            reasoning=False,
        )

    def get_model(self):
        return self.model

    async def structured_chat(self, messages, schema):
        structured_model = self.model.with_structured_output(
            schema,
            method="json_schema",
        )

        response=  await structured_model.ainvoke(messages)

        return schema.model_validate(response)