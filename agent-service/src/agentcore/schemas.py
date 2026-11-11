from pydantic import BaseModel, Field, field_validator, model_validator
from uuid import UUID
from enum import Enum
from typing import Literal, Any
from datetime import datetime


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=10000)

class ChatRequest(BaseModel):
    type: Literal["message", "HITL"] = "message"
    message: str | None = Field(default=None, min_length=1, max_length=10000)
    decision: Literal["approve", "reject"] | None = None
    history: list[ChatHistoryItem] = Field(default_factory=list, max_length=50)
    accessToken: str
    mindSpaceId: UUID
    executionId: UUID


    @model_validator(mode="after")
    def validate_request(self):
        if self.type == "message":
            if not self.message or not self.message.strip():
                raise ValueError("Message is required")
            if self.decision is not None:
                raise ValueError("Decision is not allowed for messages")

        elif self.type == "HITL":
            if self.decision is None:
                raise ValueError("Decision is required for HITL")
            if self.message is not None:
                raise ValueError("Message is not allowed for HITL")

        return self


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


class AgentStreamEvent(BaseModel):
    type: Literal["text", "HITL", "error"]
    content: str | dict[str, Any]



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
