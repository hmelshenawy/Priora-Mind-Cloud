from pydantic import BaseModel
from enum import Enum
from typing import Literal
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    history: list
    accessToken: str
    mindSpaceId: str


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
