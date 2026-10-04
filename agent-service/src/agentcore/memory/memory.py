from agentcore.llm import LlmClient
from agentcore.config import Configs
from abc import ABC, abstractmethod 
import asyncio
from agentcore.schemas import MemoryResponse
from agentcore.prompts import MEMORY_EXTRACTION_PROMPT
import requests
from agentcore.context import access_token, mindSpaceId


class Memory(ABC):
    def __init__(self):
        super().__init__()


    @abstractmethod
    def gather(self):
        pass


    @abstractmethod
    def embed():
        pass


    @abstractmethod
    def save():
        pass


    @abstractmethod
    def search():
        pass


    @abstractmethod
    def retrieve():
        pass



class UserProfileMemory(Memory):
    def __init__(self, llm: LlmClient):
        self.llm = llm


    async def gather(self, user_message: str):
        print("GATHERING MEMORIES!!")
        messages = [
        {
            "role": "system",
            "content": MEMORY_EXTRACTION_PROMPT
        },
        {
            "role": "user",
            "content": user_message
        }
    ]

        response = await asyncio.to_thread(self.llm.chat, messages, MemoryResponse.model_json_schema())
        response = self.response_normalize(response.message.content)
        data = response.memories
        await self.save(data)
        return data


    async def embed(self, text: str):
        print("EMBEDDING MEMORY REQUEST")
        url = f"{Configs.RAG_SERVICE_URL}"+"/v1/embed"
        vector = await asyncio.to_thread(requests.post ,url, json={"texts": [text]})

        return vector.json()["vectors"][0]


    async def save(self, memories):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/memory"

        headers = {
        "Authorization": f"Bearer {access_token.get()}",
        'x-mindspace-id': mindSpaceId.get(),
        }
        if not memories:
            return

        for memory in memories:
            vector = await self.embed(memory.content)
            payload = {
            "type": memory.type,
            "content": memory.content,
            "confidence": memory.confidence,
            "embedding": vector
        }
            response = await asyncio.to_thread(requests.post, url, json=payload, headers=headers)
            if response.status_code == 409:
                print("Memory already exists, skipping:", memory.content)
                continue

            print("MEMORY SAVED: ", memories)
            print("STATUS:", response.status_code)
            print("BODY:", response.text)
            response.raise_for_status()


    async def search(self, vector):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/memory/search"

        headers = {
        "Authorization": f"Bearer {access_token.get()}",
        "x-mindspace-id": mindSpaceId.get(),
    }
        
        response =await asyncio.to_thread( requests.post, url,
                                     json={"embedding": vector},
                                     headers=headers
                                     )

        response.raise_for_status()
        
        return response.json()


    async def retrieve (self, userMessage):
        print("RETREIVE MEMORY")
        vector = await self.embed(userMessage)
        memories =await self.search(vector)

        return memories


    def response_normalize(self, content):
        content = content.strip()
        if content.startswith("```"):
            content = content.removeprefix("```json")
            content = content.removeprefix("```")
            content = content.removesuffix("```")
            content = content.strip()

        result = MemoryResponse.model_validate_json(content)
        return result