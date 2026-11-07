
import asyncio
import json
import os
from pathlib import Path
from langchain_core.messages import ToolMessage
from dotenv import load_dotenv
from langsmith import Client
from openai import AsyncOpenAI

from agentcore.config import Configs
from agentcore.context import mindSpaceId, access_token
from agentcore.langchain_agent.agent import Agent
from agentcore.skills.skill_loader import (
    UserSkillProvider,
    BuildinSkillProvider,
    SkillManager,
)
from agentcore.tools.tools import available_tools, tools_registery


ROOT = Path(__file__).resolve().parents[3]

load_dotenv(ROOT / ".env", override=True)
load_dotenv(ROOT / ".env.eval", override=True)

DATASET_NAME = "priora-agent-tool-selection-v1"
EVAL_MODEL = os.getenv("EVAL_MODEL", Configs.OLLAMA_MODEL_NAME)


# Using OpenAI SDK to handle ollama llm model. // can use ollama SDK also.
judge_client = AsyncOpenAI(
    base_url=os.getenv(
        "EVAL_OLLAMA_URL",
        "http://127.0.0.1:11434/v1",
    ),
    api_key="ollama",
    timeout=180.0,
)


def exact_tool_match(outputs: dict, reference_outputs: dict) -> bool:
    expected = set(reference_outputs["expected_tools"])
    actual = set(outputs["called_tools"])

    return expected == actual


async def answer_correctness(
    inputs: dict,
    outputs: dict,
    reference_outputs: dict,
) -> dict:
    """
    Evaluate the agent's answer against a reference answer.

    Uses an LLM judge to measure factual correctness and completeness.
    Skips evaluation when no reference answer is available.

    Args:
        inputs (dict): Test case containing the user's question.
        outputs (dict): Agent output containing the generated answer.
        reference_outputs (dict): Expected output containing the reference answer.

    Returns:
        dict: LangSmith feedback containing:
            - key (str): "answer_correctness".
            - score (float | None): Correctness score from 0 to 1.
            - comment (str): Evaluation reason or skip message.
    """

    reference = (reference_outputs or {}).get("reference_answer")


    if not reference:
        return {
            "key": "answer_correctness",
            "score": None,
            "comment": "Skipped: no reference answer",
        }


    response = await judge_client.chat.completions.create(
        model=EVAL_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": """
You are an impartial AI answer evaluator.

Compare the generated answer with the reference answer.

Evaluate factual correctness and completeness.
Accept different wording with the same meaning.
Penalize missing facts and incorrect claims.

Return valid JSON only:
{
    "score": 0.0,
    "reason": "Brief explanation"
}

Scoring:
1.0 = Fully correct and complete
0.5 = Partially correct
0.0 = Incorrect

You may use intermediate scores.
""",
            },
            {
                "role": "user",
                "content": json.dumps({
                    "question": inputs["input"],
                    "reference_answer": reference,
                    "generated_answer": outputs.get("answer", ""),
                }),
            },
        ],
    )


    raw = response.choices[0].message.content.strip()


    print("JUDGE RAW RESPONSE:", repr(raw))
    print("FINISH REASON:", response.choices[0].finish_reason)


    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()


    evaluation = json.loads(raw)


    score = float(evaluation["score"])


    if not 0 <= score <= 1:
        raise ValueError("Score must be between 0 and 1")


    return {
        "key": "answer_correctness",
        "score": score,
        "comment": evaluation.get("reason", ""),
    }



async def faithfulness(inputs: dict, outputs: dict) -> dict:
    """
    Measure how many factual claims are supported by retrieved RAG context.

    Uses an LLM judge to compare factual claims in the agent's answer
    against retrieved knowledge. Skips when no context is available.

    Args:
        inputs (dict): Test case containing the user's question.
        outputs (dict): Agent output containing the answer and RAG contexts.

    Returns:
        dict: LangSmith feedback containing:
            - key (str): "faithfulness".
            - score (float | None): Supported claims ratio from 0 to 1.
            - comment (str): Evaluation reason or skip message.
    """
    contexts = outputs.get("contexts", [])

    if not contexts:
        return {"key": "faithfulness", "score": None, "comment": "No retrieved context"}

    response = await judge_client.chat.completions.create(
        model=EVAL_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Evaluate faithfulness to the retrieved context. "
                    "Identify factual claims in the answer and determine "
                    "which are supported by the context. "
                    "Score = supported claims / total factual claims. "
                    "Return JSON only: {\"score\": 0.0, \"reason\": \"...\"}. "
                    "Score must be between 0 and 1."
                ),
            },
            {
                "role": "user",
                "content": json.dumps({
                    "question": inputs["input"],
                    "contexts": contexts,
                    "answer": outputs["answer"],
                }),
            },
        ],
    )


    raw = response.choices[0].message.content.strip()


    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()


    result = json.loads(raw)


    return {
        "key": "faithfulness",
        "score": result["score"],
        "comment": result["reason"],
    }



async def groundedness(inputs: dict, outputs: dict) -> dict:
    """
    Evaluate whether the overall answer is grounded in retrieved RAG context.

    Uses an LLM judge to check whether the main conclusions and explanations
    are supported by the retrieved sources without unsupported information.
    Skips when no context is available.

    Args:
        inputs (dict): Test case containing the user's question.
        outputs (dict): Agent output containing the answer and RAG contexts.

    Returns:
        dict: LangSmith feedback containing:
            - key (str): "groundedness".
            - score (float | None): Overall grounding score from 0 to 1.
            - comment (str): Evaluation reason or skip message.
    """

    contexts = outputs.get("contexts", [])


    if not contexts:
        return {"key": "groundedness", "score": None, "comment": "No retrieved context"}


    response = await judge_client.chat.completions.create(
        model=EVAL_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "Evaluate whether the answer as a whole is grounded "
                    "in the retrieved context. Consider whether its main "
                    "conclusions and explanations are supported by the source "
                    "and whether it introduces unsupported information. "
                    "Score from 0 (ungrounded) to 1 (fully grounded). "
                    "Return JSON only: {\"score\": 0.0, \"reason\": \"...\"}."
                ),
            },
            {
                "role": "user",
                "content": json.dumps({
                    "question": inputs["input"],
                    "contexts": contexts,
                    "answer": outputs["answer"],
                }),
            },
        ],
    )


    raw = response.choices[0].message.content.strip()


    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()


    result = json.loads(raw)


    return {
        "key": "groundedness",
        "score": result["score"],
        "comment": result["reason"],
    }



async def run_agent(inputs: dict) -> dict:
    """
    Run custom agent with a test input and collect evaluation data.
    Executes the agent within the evaluation MindSpace, then extracts
    the tools called, the final answer, and retrieved RAG contexts.

    Args:
        inputs (dict): Test input containing the user's message
            under the "input" key.

    Returns:
        dict: Evaluation results containing:
            - called_tools (list[str]): Names of invoked tools.
            - answer (str): Agent's final response.
            - contexts (list[str]): Raw results from searchKnowledge.
    """

    # ContextVar to manage access token and mindSpaceId as agent not allowed to handle them.
    mindspace_token = mindSpaceId.set(os.environ["EVAL_MINDSPACE_ID"])
    jwt_token = access_token.set(os.environ["EVAL_JWT"])

    try:
        # Keep message builder inside the try to handle contextVar in case of failure.
        messages = agent._build_messages(
            user_message=inputs["input"],
             history=[],   # not required in that custom agent
            memories=[],   # not required in that custom agent
        )

        result = await agent.agent.ainvoke({
            "messages": messages
        })

        called_tools = [
            call["name"]
            for message in result["messages"]
            for call in getattr(message, "tool_calls", [])
        ]

        answer = result["messages"][-1].content
        search_ids = {
        call["id"]
        for message in result["messages"]
        for call in getattr(message, "tool_calls", [])
        if call["name"] == "searchKnowledge"
    }

        contexts = [
            str(message.content)
            for message in result["messages"]
            if isinstance(message, ToolMessage)
            and message.tool_call_id in search_ids
            ]
        return {
            "called_tools": called_tools,
            "answer": str(answer),
            "contexts": contexts,
        }

    finally:
        mindSpaceId.reset(mindspace_token)
        access_token.reset(jwt_token)



def update_dataset(client: Client, dataset: str):
    """
    Sync local JSON test cases with LangSmith.
    - Create the dataset if it doesn't exist.
    - Add new test cases.
    - Update existing cases if their outputs changed.
    - Skip unchanged cases.

    Args:
        client (Client): LangSmith API client.
        dataset (str): Name of the target dataset.

    Returns:
        None: Updates the dataset directly in LangSmith.
    """
    path = Path(__file__).with_name("dataset.json")
    examples = json.loads(path.read_text(encoding="utf-8"))


    # Check if dataset exist on LangSmith.
    if not client.has_dataset(dataset_name=dataset):
        client.create_dataset(dataset_name=dataset)
        print("CREATED DATASET:", dataset)
    else:
        print(f"Dataset {dataset} is already exist.")


    # Get all examples saved on Langsmith dataset
    existing = {
        example.inputs["input"]: example
        for example in client.list_examples(dataset_name=dataset)
    }


    # Loop on JSON items and compare to LangSmith dataset
    # Update dataset if exist & Create if not Exists.
    for item in examples:
        question = item["inputs"]["input"]

        if question in existing:
            example = existing[question]

            if example.outputs != item["outputs"]:
                client.update_example(
                    example.id,
                    outputs=item["outputs"],
                )
                print("UPDATED:", question)
        else:
            client.create_example(
                dataset_name=dataset,
                inputs=item["inputs"],
                outputs=item["outputs"],
            )
            print("ADDED:", question)




async def main():
    global agent

    skill_manager = SkillManager(
        BuildinSkillProvider(),
        UserSkillProvider(),
        available_tools,
        tools_registery,
    )

    agent = Agent(
        Configs.OLLAMA_MODEL_NAME,
        skills=skill_manager,
    )

    client = Client()

    update_dataset(client, DATASET_NAME)

    await client.aevaluate(
        run_agent,
        data=DATASET_NAME,
        evaluators=[
            exact_tool_match,
            answer_correctness,
            faithfulness,
            groundedness,
        ],
        experiment_prefix="priora-agent-quality-v1",
        max_concurrency=1,
    )



if __name__ == "__main__":
    asyncio.run(main())
