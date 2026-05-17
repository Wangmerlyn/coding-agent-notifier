# Feishu/Lark Webhook Notifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Feishu/Lark custom bot webhook support with a tested CLI and install documentation.

**Architecture:** Keep the shared payload formatter in `coding_agent_notifier.notifier`. Add a small Feishu/Lark webhook client beside the existing Slack client, then expose it through a new `scripts/notifier/lark_notify.py` entrypoint and focused docs/examples.

**Tech Stack:** Python 3.12, `requests`, pytest, ruff, shell examples, Markdown docs.

---

## File Structure

- Modify `src/coding_agent_notifier/notifier.py`: add `LarkNotifier`, webhook response validation, CLI args, and `lark_main()`.
- Modify `tests/notifier/test_slack_notify.py`: add webhook client and CLI tests using the existing fake session pattern.
- Create `scripts/notifier/lark_notify.py`: executable Python entrypoint calling `lark_main()`.
- Create `scripts/notifier/lark_notify_example.sh`: manual example matching the Slack example style.
- Modify `.env.example`: add Feishu/Lark webhook variables.
- Modify `README.md`, `docs/guide.md`, `docs/integrations.md`: reference Feishu/Lark setup.
- Create `docs/notifier_lark.md`: focused install and troubleshooting guide.

## Task 1: Feishu/Lark Webhook Client

**Files:**
- Modify: `tests/notifier/test_slack_notify.py`
- Modify: `src/coding_agent_notifier/notifier.py`

- [ ] **Step 1: Write failing client tests**

Add tests that call `LarkNotifier("https://example.test/hook", session=session).send_text("hello")` and assert the POST body is `{"msg_type": "text", "content": {"text": "hello"}}`. Add failure tests for response bodies `{"code": 19001, "msg": "bad webhook"}` and `{"StatusCode": 19001, "StatusMessage": "bad webhook"}`.

- [ ] **Step 2: Run client tests to verify red**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/src python -m pytest tests/notifier/test_slack_notify.py -k 'lark or feishu' -q`

Expected: tests fail because `LarkNotifier` does not exist.

- [ ] **Step 3: Implement client**

Add a `LarkNotifier` class that posts text messages to a webhook URL with `Content-Type: application/json; charset=utf-8`, handles request exceptions, raises `SlackNotificationError` for HTTP errors and nonzero response codes, and treats empty 2xx bodies as success.

- [ ] **Step 4: Run client tests to verify green**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/src python -m pytest tests/notifier/test_slack_notify.py -k 'lark or feishu' -q`

Expected: selected tests pass.

- [ ] **Step 5: Commit**

Run: `git add src/coding_agent_notifier/notifier.py tests/notifier/test_slack_notify.py && git commit -m "feat: add lark webhook client"`

## Task 2: Feishu/Lark CLI

**Files:**
- Modify: `tests/notifier/test_slack_notify.py`
- Modify: `src/coding_agent_notifier/notifier.py`
- Create: `scripts/notifier/lark_notify.py`

- [ ] **Step 1: Write failing CLI tests**

Add tests for `lark_main(["--env-file", str(env_file), "--payload", "{\"status\":\"ok\"}"])` using `LARK_WEBHOOK_URL`, plus fallback to `FEISHU_WEBHOOK_URL` when `LARK_WEBHOOK_URL` is absent.

- [ ] **Step 2: Run CLI tests to verify red**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/src python -m pytest tests/notifier/test_slack_notify.py -k 'lark_main or feishu' -q`

Expected: tests fail because `lark_main()` and/or the script entrypoint do not exist.

- [ ] **Step 3: Implement CLI**

Add `lark_main()` with `--webhook-url`, `--webhook-url-env`, `--env-file`, `--payload`, `--payload-file`, `--title`, and `--log-level`. Add `scripts/notifier/lark_notify.py` that imports and calls `lark_main()`.

- [ ] **Step 4: Run CLI tests to verify green**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/src python -m pytest tests/notifier/test_slack_notify.py -k 'lark_main or feishu' -q`

Expected: selected tests pass.

- [ ] **Step 5: Commit**

Run: `git add src/coding_agent_notifier/notifier.py tests/notifier/test_slack_notify.py scripts/notifier/lark_notify.py && git commit -m "feat: add lark notify cli"`

## Task 3: Docs And Examples

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/guide.md`
- Modify: `docs/integrations.md`
- Create: `docs/notifier_lark.md`
- Create: `scripts/notifier/lark_notify_example.sh`

- [ ] **Step 1: Write docs and examples**

Add copy/paste setup instructions for creating a Feishu/Lark custom bot, setting `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL`, sending a manual test, and wiring Codex notify to `scripts/notifier/lark_notify.py`.

- [ ] **Step 2: Validate docs references**

Run: `rg -n "lark_notify.py|LARK_WEBHOOK_URL|FEISHU_WEBHOOK_URL|notifier_lark" README.md docs .env.example scripts/notifier`

Expected: references appear in README, focused docs, integration docs, `.env.example`, and the example script.

- [ ] **Step 3: Commit**

Run: `git add .env.example README.md docs/guide.md docs/integrations.md docs/notifier_lark.md scripts/notifier/lark_notify_example.sh && git commit -m "docs: add lark notifier setup guide"`

## Task 4: Final Verification And CodeRabbit

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full tests**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/src python -m pytest tests/notifier`

Expected: all notifier tests pass.

- [ ] **Step 2: Run lint**

Run: `ruff check .`

Expected: no ruff violations.

- [ ] **Step 3: Inspect branch diff**

Run: `git status --short --branch` and `git log --oneline origin/main..HEAD`

Expected: clean worktree and logical commits.

- [ ] **Step 4: Run CodeRabbit**

Run: `coderabbit review --agent --base origin/main -c AGENTS.md`

Expected: either 0 issues or actionable issues to fix with follow-up commits.
