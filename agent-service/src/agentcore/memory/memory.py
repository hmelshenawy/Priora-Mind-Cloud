from agentcore.llm import LlmClient
from agentcore.config import Configs
import asyncio
import json
from pydantic import BaseModel
from typing import Literal
import requests
from agentcore.context import access_token, mindSpaceId

MEMORY_EXTRACTION_PROMPT = """
You are a long-term memory extractor.

Extract only information worth storing as long-term memory.

Allowed types:
- FACT
- PREFERENCE
- GOAL
- DECISION

Rules:
1. Extract only information explicitly stated by the user.
2. Never infer or assume information.
3. Do not store temporary information.
4. Do not store questions.
5. Do not answer the user's message.
6. Do not explain your decision.
7. Do not output conversational text.
8. 8. Preserve the user's meaning, but rewrite each memory as a concise,
self-contained, neutral statement.
9. Do not use first-person language or repeatedly prefix memories with "The user".
10. Do not infer, generalize, or add information.
11. Each memory must contain one atomic piece of information only.
12. If there are no memories to extract, return exactly:
   {"memories": []}

Return ONLY valid JSON.

Format:
{
  "memories": [
    {
      "type": "FACT | PREFERENCE | GOAL | DECISION",
      "content": "memory content",
      "confidence": 0.0
    }
  ]
}
"""

class MemoryItem(BaseModel):
    type: Literal["FACT", "PREFERENCE", "GOAL", "DECISION"]
    content: str
    confidence: float

class MemoryResponse(BaseModel):
    memories: list[MemoryItem]

class Memory:
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
        print("sdfsdfdsf",response)
        data = response.memories
        await self.save(data)
        return data

    async def embed(self, text: str):
        url = f"{Configs.RAG_SERVICE_URL}"+"/v1/embed"
        vector = await asyncio.to_thread(requests.post ,url, json={"texts": [text]})

        return vector.json()["vectors"][0]

    async def save(self, memories):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/memory"

        headers = {
        "Authorization": f"Bearer {access_token.get()}",
        'x-mindspace-id': mindSpaceId.get(),
        }
        print(url)
        if not memories:
            return

        print("memory to save: ", memories)

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

            print("STATUS:", response.status_code)
            print("BODY:", response.text)
            print(response.json())
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