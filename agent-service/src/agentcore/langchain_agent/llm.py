from langchain_ollama import ChatOllama


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