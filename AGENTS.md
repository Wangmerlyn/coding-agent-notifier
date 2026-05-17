# Repository Guidelines

## Project Purpose & Layout
- Goal: A convenient entry point for a coding agent to send the user a message about task completion via Slack or Feishu/Lark.

## Repository Structure (Modify this part when you have learned enough about this repository)
- `scripts/notifier/`: notifier CLIs, agent hook wrapper, and example scripts.
- `src/coding_agent_notifier/`: Python package with notifier logic.
- `tests/notifier/`: Pytest suite covering notifier behavior.
- `docs/`: Usage and setup documentation.
- `pyproject.toml`: Project metadata and dependencies.

## Environment & Tooling
- Python: 3.12+.
- Dev env: `conda activate coding_agent_notifier`; install deps via `pip install -e .[dev]`.
- Hooks: run `pre-commit install` in the same env.
- Lint/format: `ruff check .` (CI also runs ruff).

## Tests
- Docs submodule tests are excluded via `norecursedirs`.

## Workflow
- Branching: new feature/fix -> new branch (e.g., `feature/<name>`); avoid working on main.
- Commit cadence: commit after each logical change; keep commits small and focused.
- Push policy: only push when the user explicitly approves; otherwise let the user push.
- PR titles: format `[modules] type: description` (modules comma-separated, single type).

## Coding Style
- Keep it “Linus” simple—concise, readable, and robust; avoid bloat/over-engineering.
- Review with a critical eye for clarity and correctness.
