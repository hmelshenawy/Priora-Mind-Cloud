import os

from openai import AsyncOpenAI
from ragas.llms import llm_factory
from ragas.metrics.collections import (
    ContextPrecision,
    ContextRecall,
)


class RagMetrics:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key="ollama",
            base_url=os.getenv(
                "EVAL_OLLAMA_URL",
                "http://127.0.0.1:11434/v1",
            ),
            timeout=120.0,
        )

        self.llm = llm_factory(
            os.getenv("EVAL_MODEL", "gemma4:31b-cloud"),
            client=self.client,
        )

        self.precision = ContextPrecision(llm=self.llm)
        self.recall = ContextRecall(llm=self.llm)

    async def evaluate(
        self,
        question: str,
        reference: str,
        contexts: list[str],
    ):
        precision = await self.precision.ascore(
            user_input=question,
            reference=reference,
            retrieved_contexts=contexts,
        )

        recall = await self.recall.ascore(
            user_input=question,
            reference=reference,
            retrieved_contexts=contexts,
        )

        return {
            "context_precision": precision.value,
            "context_recall": recall.value,
        }