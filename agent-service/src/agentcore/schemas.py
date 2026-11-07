from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from enum import Enum
from typing import Literal
from datetime import datetime

class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=10000)

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)
    history: list[ChatHistoryItem] = Field(max_length=50)
    accessToken: str
    mindSpaceId: UUID


    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        """Reject messages containing only whitespace.
        Args:
            value (str): Incoming user message.
        Returns:
            str: Validated and trimmed message.
        """
        value = value.strip()

        if not value:
            raise ValueError("Message cannot be empty")

        return value

class AgentRequest(BaseModel):
    message: str
    history: list
    accessToken: str

class TaskExecutor(str, Enum):
    user= "user"
    agent= "agent"


# -------------------------------------------
class MemoryItem(BaseModel):
    type: Literal["FACT", "PREFERENCE", "GOAL", "DECISION"]
    content: str
    confidence: float

class MemoryResponse(BaseModel):
    memories: list[MemoryItem]



# --------------------------------------------
class EventItem(BaseModel):
    summary: str
    occurredAt: datetime | None = None
    entities: list
    participants: list
    concepts: list
    salience: float  | None = None
    embedding: list[float] | None = None

class SalienceResponse(BaseModel):
    scores: list[float] 

class EventResponse(BaseModel):
    events: list[EventItem]
