TEST_CASES = [
    {
        "input": "What time is it in Dubai?",
        "expected_tools": ["getDateTime"],
    },
    {
        "input": "Show me my saved tasks",
        "expected_tools": ["getAllTasks"],
    },
    {
        "input": "What is the 45k service for G-Class 465?",
        "expected_tools": ["searchKnowledge", "webSearch"],
        "expected_rag_empty": True,
    },
    {
        "input": "Use the planning skill to create a roadmap for learning Python",
        "expected_tools": ["load_skill"],
    },
    {
        "input": "Explain what machine learning is",
        "expected_tools": ["load_skill"],
    },
    {
        "input": "What is 2 + 2?",
        "expected_tools": [],
    },
]