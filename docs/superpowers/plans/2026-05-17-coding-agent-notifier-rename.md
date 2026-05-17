# Coding Agent Notifier Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the project to Coding Agent Notifier without breaking existing Slack/Codex user setups.

**Architecture:** Move reusable Python notifier logic into `coding_agent_notifier`, keep `codex_slack_notifier` as a compatibility shim, and treat Slack and Feishu/Lark as providers. Rename public docs and package metadata to provider-neutral wording while leaving provider-specific entrypoints and credential names intact.

**Tech Stack:** Python 3.12, pytest, ruff, bash entrypoints, OpenCode npm plugin metadata.

---

## Task 1: Python Package Rename And Compatibility

**Files:**
- Rename: `src/codex_slack_notifier/` to `src/coding_agent_notifier/`
- Create: `src/coding_agent_notifier/__init__.py`
- Create: `src/coding_agent_notifier/notifier.py`
- Modify: `src/codex_slack_notifier/__init__.py`
- Modify: `src/coding_agent_notifier/notifier.py`
- Modify: `pyproject.toml`
- Modify: `scripts/notifier/slack_notify.py`
- Modify: `scripts/notifier/lark_notify.py`
- Modify: `tests/notifier/test_slack_notify.py`

- [ ] **Step 1: Add failing import and alias tests**

Add tests that import `coding_agent_notifier`, confirm `NotificationError` exists, and confirm `codex_slack_notifier` still re-exports the same notifier module and exception alias.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/.worktrees/general-agent-notifier-rename/src python -m pytest tests/notifier/test_slack_notify.py -q`

Expected: import failure for `coding_agent_notifier`.

- [ ] **Step 3: Rename package and add shims**

Use `git mv` for the package directory. In the new package, define `NotificationError` as the canonical exception and keep `SlackNotificationError = NotificationError`. In the old package path, re-export from `coding_agent_notifier`.

- [ ] **Step 4: Update metadata and entrypoint imports**

Set `pyproject.toml` project name to `coding-agent-notifier`, description to provider-neutral wording, and setuptools packages to include both `coding_agent_notifier` and `codex_slack_notifier`. Update scripts to import from `coding_agent_notifier`.

- [ ] **Step 5: Run tests and commit**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/.worktrees/general-agent-notifier-rename/src python -m pytest tests/notifier/test_slack_notify.py -q`

Commit: `git commit -m "[notifier] refactor: rename python package to coding agent notifier"`

### Task 2: Hook Wrapper Rename

**Files:**
- Create: `scripts/notifier/agent_notify_wrapper.sh`
- Modify: `scripts/notifier/codex_notify_wrapper.sh`
- Modify: `tests/notifier/test_slack_notify.py`

- [ ] **Step 1: Add failing wrapper compatibility tests**

Add tests that assert `agent_notify_wrapper.sh` exists, calls `slack_notify.py`, references `DEBUG_AGENT_PAYLOAD`, and that `codex_notify_wrapper.sh` delegates to it.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/.worktrees/general-agent-notifier-rename/src python -m pytest tests/notifier/test_slack_notify.py -q`

Expected: missing `agent_notify_wrapper.sh`.

- [ ] **Step 3: Move wrapper logic**

Move the current wrapper implementation to `agent_notify_wrapper.sh`, change debug env lookup to prefer `DEBUG_AGENT_PAYLOAD` with `DEBUG_CODEX_PAYLOAD` fallback, and make `codex_notify_wrapper.sh` exec the new wrapper.

- [ ] **Step 4: Run tests and commit**

Run: `PYTHONPATH=/path/to/coding-agent-notifier/.worktrees/general-agent-notifier-rename/src python -m pytest tests/notifier/test_slack_notify.py -q`

Commit: `git commit -m "[notifier] refactor: add provider-neutral hook wrapper"`

### Task 3: OpenCode Package Rename And Provider-Neutral Plugin

**Files:**
- Modify: `package.json`
- Modify: `opencode-plugin/index.js`
- Modify: `opencode-plugin/index.d.ts`
- Modify: `tests/notifier/test_opencode_plugin.py`

- [ ] **Step 1: Add failing OpenCode metadata and provider tests**

Update tests to expect `opencode-coding-agent-notifier`, `OpenCodeAgentNotifierPlugin`, `OPENCODE_AGENT_NOTIFIER_ENV_FILE`, `agent-notifier.env`, and Feishu/Lark webhook payload support.

- [ ] **Step 2: Run targeted tests and confirm RED**

Run: `python -m pytest tests/notifier/test_opencode_plugin.py -q`

Expected: old Slack-specific package/export/env names.

- [ ] **Step 3: Update OpenCode plugin**

Rename exported plugin symbols to `OpenCodeAgentNotifierPlugin`. Keep `OpenCodeSlackNotifierPlugin` as an alias. Load env files from `OPENCODE_AGENT_NOTIFIER_ENV_FILE`, `OPENCODE_SLACK_ENV_FILE`, `~/.config/opencode/agent-notifier.env`, and `~/.config/opencode/slack-notifier.env`. Send Slack when Slack env is present and send Feishu/Lark when `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL` is present.

- [ ] **Step 4: Run tests and commit**

Run: `python -m pytest tests/notifier/test_opencode_plugin.py -q`

Commit: `git commit -m "[opencode] refactor: rename plugin to coding agent notifier"`

### Task 4: Documentation And Examples

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/guide.md`
- Modify: `docs/integrations.md`
- Modify: `docs/notifier_slack.md`
- Modify: `docs/notifier_lark.md`
- Modify: `docs/opencode_plugin.md`
- Modify: `docs/examples/**`
- Modify: `scripts/notifier/*_example.sh`

- [ ] **Step 1: Update user-facing brand and paths**

Replace project title and neutral path examples with Coding Agent Notifier and `/path/to/coding-agent-notifier`. Use `agent_notify_wrapper.sh` in new examples and mention `codex_notify_wrapper.sh` only as a compatibility wrapper.

- [ ] **Step 2: Update setup names**

Replace conda/env examples with `coding_agent_notifier`, npm package examples with `opencode-coding-agent-notifier`, and env-file examples with `coding-agent-notifier.env` or `agent-notifier.env`.

- [ ] **Step 3: Add migration notes**

Document old package/import/wrapper/env-file names as compatibility aliases, not preferred setup.

- [ ] **Step 4: Run docs checks and commit**

Run: `git diff --check`

Commit: `git commit -m "[docs] docs: rename project to coding agent notifier"`

### Task 5: Full Validation And GitHub Metadata

**Files:**
- Verify all changed files.
- Update remote GitHub metadata via `gh` after local tests pass.

- [ ] **Step 1: Run full validation**

Run:

```bash
PYTHONPATH=/path/to/coding-agent-notifier/.worktrees/general-agent-notifier-rename/src python -m pytest tests/notifier
ruff check .
git diff --check
```

- [ ] **Step 2: Review remaining old-name references**

Run:

```bash
rg -n "vibe-coding-slack-notifier|codex_slack_notifier|codex-slack-notifier|opencode-vibe-coding-slack-notifier|DEBUG_CODEX_PAYLOAD|codex_notify_wrapper" .
```

Only compatibility notes, compatibility shims, provider-specific Slack names, and intentional old-name migration references should remain.

- [ ] **Step 3: Commit validation fixes**

Commit any validation fixes with a focused message.

- [ ] **Step 4: Update GitHub metadata**

Use `gh repo edit` or `gh api` to set the repository name to `coding-agent-notifier`, set the description to provider-neutral wording, and set homepage/about metadata if configured.
