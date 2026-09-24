from pydantic import BaseModel
from enum import Enum


class ChatRequest(BaseModel):
    message: str
    history: list
    accessToken: str


class AgentRequest(BaseModel):
    message: str
    history: list
    accessToken: str

class TaskExecutor(str, Enum):
    user= "user"
    agent= "agent"
