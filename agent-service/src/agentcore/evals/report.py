import json
from pathlib import Path
from datetime import datetime, timezone


def calculate_exact_match(results):
    matches = 0

    for result in results:
        expected = set(result["expected_tools"])
        actual = set(result["called_tools"])

        if expected == actual:
            matches += 1

    return matches / len(results) if results else 0



def save_report(results, model_name: str):

    total = len(results)
    passed = sum(1 for result in results if result["passed"])

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": model_name,
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "accuracy": passed / total if total else 0,
        "exact_match_accuracy": calculate_exact_match(results),
        "results": results,
    }

    output_dir = Path(__file__).parent / "reports"
    output_dir.mkdir(exist_ok=True)

    output_file = output_dir / "baseline.json"

    output_file.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return report