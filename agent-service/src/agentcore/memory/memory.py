from agentcore.llm import LlmClient
from agentcore.config import Configs
from abc import ABC, abstractmethod 
import asyncio
from agentcore.schemas import MemoryResponse, EventResponse, SalienceResponse, EventItem
from agentcore.prompts import MEMORY_EXTRACTION_PROMPT, EVENT_EXTRACTION_PROMPT, EVENT_SALIENCE_PROMPT
import requests
from agentcore.context import access_token, mindSpaceId
import json


class Memory(ABC):
    def __init__(self):
        super().__init__()


    @abstractmethod
    def gather(self):
        pass


    @abstractmethod
    def embed(self):
        pass


    @abstractmethod
    def save(self):
        pass


    @abstractmethod
    def search(self):
        pass


    @abstractmethod
    def retrieve(self):
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

        response = await asyncio.create_task(self.llm.chat( messages, MemoryResponse.model_json_schema()))
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
        print(f"RETREIVED MEMORIES {len(memories)}")

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



class EventMemory(Memory):
    def __init__(self, llm: LlmClient):
        super().__init__()
        self.llm = llm


    async def gather(self, user_message: str, chat_history: list[str], salience_threshold: float= 0.40):
        print("EXTRACTING EVENTS")
        messages = self.input_builder(user_message, chat_history)
        print(messages)
        response =await self.llm.chat(messages, EventResponse.model_json_schema())
        events = self.response_normalize(response.message.content, EventResponse)
        # print("------------------", events)
        if not events:
            return events
        events =await self.get_salience(events)

        events = [
                    event for event in events.events
                    if event.salience is not None and event.salience >= salience_threshold
]
        embedding_text = [self.build_embedding_text(event) for event in events]
        embeddings = [await self.embed(text) for text in embedding_text]

        for event, vector in zip(events, embeddings):
            if len(vector) != 1024:
                raise ValueError("Invalid embedding dimensions")

            event.embedding = vector
        await self.save(events)
        return events


    async def get_salience(self, events: EventResponse):
        messages = [{
            "role":"system", "content": EVENT_SALIENCE_PROMPT
        },
        {"role":"user", "content": f"""<EVENT_RESPONSE>{events}</EVENT_RESPONSE> """}
        ]

        response =await self.llm.chat(messages, SalienceResponse.model_json_schema())
        response = response.message.content
        response = self.response_normalize(response, SalienceResponse)

        if len(response.scores) != len(events.events):
            raise ValueError("Salience scores count mismatch")

        for event, score in zip(events.events, response.scores):
            event.salience = score

        return events

    
    def response_normalize(self, content, response: any):
            content = content.strip()
            if content.startswith("```"):
                content = content.removeprefix("```json")
                content = content.removeprefix("```")
                content = content.removesuffix("```")
                content = content.strip()
    
            result = response.model_validate_json(content)
            return result


    def build_embedding_text(self, event: EventItem) -> str:
        entities = ", ".join(
            f"{e['name']} ({e['type']})"
            for e in event.entities
        )

        participants = ", ".join(
            f"{p['entity']} ({p['role']})"
            for p in event.participants
        )

        concepts = ", ".join(event.concepts)

        return (
            f"Event: {event.summary}\n"
            f"Entities: {entities}\n"
            f"Participants: {participants}\n"
            f"Concepts: {concepts}"
        )

    async def embed(self, text: str):
        print("EMBEDDING MEMORY REQUEST")
        url = f"{Configs.RAG_SERVICE_URL}"+"/v1/embed"
        vector = await asyncio.to_thread(requests.post ,url, json={"texts": [text]})

        return vector.json()["vectors"][0]

    async def save(self, events: list[EventItem]):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/memory/event"
        headers = {
        "Authorization": f"Bearer {access_token.get()}",
        'x-mindspace-id': mindSpaceId.get(),
        }
        if not events:
            return
        for event in events:
            print(f"SAVING EVENTS IN PROGRESS")
            print(f"SAVE EVENT NUMBER: {events.index(event)}")
            payload = event.model_dump(mode = "json")
            response = await asyncio.to_thread(requests.post,
                                               url, 
                                               json=payload,
                                               headers=headers)
            print(f"SAVE RESPONSE STATUS", response.json())
            response.raise_for_status

    async def search(self, vector):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/memory/event/search"

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


    async def retrieve(self, userMessage: str):
        print("RETREIVE EVENT")
        vector = await self.embed(userMessage)
        events =await self.search(vector)
        print(f"SIMILAR EVENTS: {len(events)}")

        return events

    def input_builder(self, user_message:str, chat_history:list[str]):
        from datetime import datetime
        from zoneinfo import ZoneInfo
        current_time = datetime.now(ZoneInfo(Configs.TIMEZONE)).isoformat()
        history = json.dumps(chat_history, ensure_ascii=False)
        return [{
            "role" : "system", "content": EVENT_EXTRACTION_PROMPT,
        },
        {
            "role": "user", "content": f"""
        <REFERENCE_TIME>{current_time}</REFERENCE_TIME>
        <CONVERSATION_HISTORY>{history}</CONVERSATION_HISTORY>
        <CURRENT_USER_MESSAGE>{user_message}</CURRENT_USER_MESSAGE>
        """
        }
        ]
        