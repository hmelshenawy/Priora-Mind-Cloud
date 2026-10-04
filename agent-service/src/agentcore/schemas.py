from pydantic import BaseModel
from enum import Enum
from typing import Literal


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


class MemoryItem(BaseModel):
    type: Literal["FACT", "PREFERENCE", "GOAL", "DECISION"]
    content: str
    confidence: float

class MemoryResponse(BaseModel):
    memories: list[MemoryItem]