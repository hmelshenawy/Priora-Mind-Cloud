from agentcore.llm import LlmClient
from agentcore.config import Configs
from abc import ABC, abstractmethod 
import asyncio
from agentcore.schemas import MemoryResponse, EventResponse, SalienceResponse, EventItem
from agentcore.prompts import MEMORY_EXTRACTION_PROMPT, EVENT_EXTRACTION_PROMPT, EVENT_SALIENCE_PROMPT
import requests
from agentcore.context import access_token, mindSpaceId
import json
from langsmith import traceable
from contextvars import ContextVar
from functools import wraps
from time import perf_counter
import logging


request_id = ContextVar("agent_request_id", default="-")


class RequestLogger(logging.LoggerAdapter):
    """Correlate metadata-only logs, including inherited background contexts."""

    def process(self, msg, kwargs):
        correlation = self.extra.get("request_id", request_id.get())
        return f"request_id={correlation} {msg}", kwargs


logger = RequestLogger(logging.getLogger(__name__), {})


def memory_operation(kind, stage):
    """Observe an async memory boundary without changing its result or errors."""
    def decorate(function):
        @wraps(function)
        async def observed(*args, **kwargs):
            started = perf_counter()
            logger.debug("memory.%s.started kind=%s", stage, kind)
            try:
                result = await function(*args, **kwargs)
            except asyncio.CancelledError:
                logger.debug("memory.%s.cancelled kind=%s", stage, kind)
                raise
            except requests.RequestException:
                logger.warning("memory.%s.failed kind=%s error_code=dependency_failed", stage, kind)
                raise
            except Exception:
                logger.error("memory.%s.failed kind=%s error_code=memory_operation_failed", stage, kind)
                raise
            logger.debug("memory.%s.completed kind=%s duration_ms=%d",
                         stage, kind, (perf_counter() - started) * 1000)
            return result
        return observed
    return decorate

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



    @memory_operation("profile", "extract")
    @traceable(name="memory-extraction")
    async def gather(self, user_message: str):
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

        response = await asyncio.create_task(self.llm.structured_chat( messages, MemoryResponse))
        # response = self.response_normalize(response.message.content)
        data = response.memories
        await self.save(data)
        return data



    async def embed(self, text: str) -> list[float]:
        """Generate an embedding for memory text.
        Args:
            text (str): Memory content to embed.
        Returns:
            list[float]: Generated embedding vector.
        """


        url = f"{Configs.RAG_SERVICE_URL}/v1/embed"
        response = await asyncio.to_thread(
            requests.post,
            url,
            json={"texts": [text]},
            headers={
                "X-Internal-Service-Key": Configs.RAG_SECRET_KEY,
                "X-Request-ID": request_id.get(),
            },
            timeout=(10, 60),
        )

        response.raise_for_status()

        return response.json()["vectors"][0]



    async def save(self, memories):
        url = f"{Configs.BACKEND_SERVICE_URL}"+"/memory"

        headers = {
        "Authorization": f"Bearer {access_token.get()}",
        'x-mindspace-id': mindSpaceId.get(),
        }
        if not memories:
            return

        saved = duplicates = 0
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
                duplicates += 1
                continue

            response.raise_for_status()
            saved += 1
        logger.debug("memory.persist.completed kind=profile saved_count=%d duplicate_count=%d", saved, duplicates)


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



    @memory_operation("profile", "retrieve")
    @traceable(name="profile-memory-retrieval", run_type="retriever")
    async def retrieve (self, userMessage):
        vector = await self.embed(userMessage)
        memories =await self.search(vector)

        logger.debug("memory.retrieve.count kind=profile result_count=%d", len(memories))
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



    @memory_operation("event", "extract")
    @traceable(name="event-extraction")
    async def gather(self, user_message: str, chat_history: list[str], salience_threshold: float= 0.40):
        messages = self.input_builder(user_message, chat_history)
        events =await self.llm.structured_chat(messages, EventResponse)
        # events = self.response_normalize(response.message.content, EventResponse)
        if not events.events:
            return []
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
        {"role":"user", "content": f"""<EVENT_RESPONSE>{events.model_dump_json()}</EVENT_RESPONSE> """}
        ]

        response =await self.llm.structured_chat(messages, SalienceResponse)
        # response = response.message.content
        # response = self.response_normalize(response, SalienceResponse)

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



    async def embed(self, text: str) -> list[float]:
        """Generate an embedding vector for memory text.
        Args:
            text (str): Text to embed.
        Returns:
            list[float]: Generated embedding vector.
        """

        url = f"{Configs.RAG_SERVICE_URL}/v1/embed"

        response = await asyncio.to_thread(
            requests.post,
            url,
            json={"texts": [text]},
            headers={
                "X-Internal-Service-Key": Configs.RAG_SECRET_KEY,
                "X-Request-ID": request_id.get(),
            },
            timeout=(10, 60),
        )

        response.raise_for_status()

        return response.json()["vectors"][0]



    async def save(self, events: list[EventItem]):
        if not events:
            return

        url = f"{Configs.BACKEND_SERVICE_URL}/memory/event"

        headers = {
            "Authorization": f"Bearer {access_token.get()}",
            "x-mindspace-id": mindSpaceId.get(),
        }

        saved = duplicates = 0
        for index, event in enumerate(events, start=1):
            payload = event.model_dump(mode="json")

            response = await asyncio.to_thread(
                requests.post,
                url,
                json=payload,
                headers=headers,
                timeout=15,
            )

            if response.status_code == 409:
                duplicates += 1
                continue

            response.raise_for_status()
            saved += 1
        logger.debug("memory.persist.completed kind=event saved_count=%d duplicate_count=%d", saved, duplicates)


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



    @memory_operation("event", "retrieve")
    @traceable(name="event-retrieval", run_type="retriever")
    async def retrieve(self, userMessage: str):
        vector = await self.embed(userMessage)
        events =await self.search(vector)

        relevant_events = [
        event for event in events
        if event.get("similarity", 0) >= 0.50
    ]

        logger.debug("memory.retrieve.count kind=event candidate_count=%d result_count=%d", len(events), len(relevant_events))
        return relevant_events



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
