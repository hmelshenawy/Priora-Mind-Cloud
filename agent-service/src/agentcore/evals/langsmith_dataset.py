from langsmith import Client

from agentcore.evals.dataset import TEST_CASES

import os
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parents[3] / ".env"

load_dotenv(ENV_FILE, override=True)

print("ENV exists:", ENV_FILE.exists())
print("API Key loaded:", bool(os.getenv("LANGSMITH_API_KEY")))
print("API Key prefix valid:",
      os.getenv("LANGSMITH_API_KEY", "").startswith("lsv2_"))

DATASET_NAME = "priora-agent-tool-selection-v1"


def create_eval_dataset():
    client = Client()

    if client.has_dataset(dataset_name=DATASET_NAME):
        print(f"Dataset already exists: {DATASET_NAME}")
        return

    dataset = client.create_dataset(
        dataset_name=DATASET_NAME,
        description="Priora MindCloud agent tool selection evaluation",
    )

    client.create_examples(
        dataset_id=dataset.id,
        inputs=[
            {"input": case["input"]}
            for case in TEST_CASES
        ],
        outputs=[
            {"expected_tools": case["expected_tools"]}
            for case in TEST_CASES
        ],
    )

    print(f"Dataset created: {DATASET_NAME}")


if __name__ == "__main__":
    create_eval_dataset()