# Coding Agent Notifier Rename Design

## Goal

Rename the project from Slack/Codex-specific branding to provider-neutral coding-agent notifier branding across repository identity, package metadata, docs, examples, tests, and GitHub metadata.

## New Identity

- Product name: `Coding Agent Notifier`
- GitHub repo slug: `coding-agent-notifier`
- Python distribution: `coding-agent-notifier`
- Python import package: `coding_agent_notifier`
- OpenCode package: `opencode-coding-agent-notifier`
- Default user env file examples: `~/.codex/coding-agent-notifier.env` and `~/.config/opencode/agent-notifier.env`

## Compatibility

Keep existing user setups working while the public names move:

- Preserve `codex_slack_notifier` as an import shim that re-exports `coding_agent_notifier`.
- Preserve `SlackNotificationError` as an alias for the new `NotificationError`.
- Keep provider credential env vars unchanged: `SLACK_BOT_TOKEN`, `SLACK_USER_ID`, `LARK_WEBHOOK_URL`, and `FEISHU_WEBHOOK_URL`.
- Keep provider-specific CLI entrypoints `slack_notify.py` and `lark_notify.py`.
- Add a provider-neutral hook wrapper `agent_notify_wrapper.sh`; keep `codex_notify_wrapper.sh` as a compatibility wrapper.
- Prefer `DEBUG_AGENT_PAYLOAD`, but keep `DEBUG_CODEX_PAYLOAD` as a deprecated alias.
- Prefer new env-file paths in docs, but mention old paths still work when explicitly configured.

## Implementation Scope

The full rename covers:

- Python package metadata and imports.
- Python exception naming and compatibility aliases.
- Shell entrypoints and wrapper names.
- README, AGENTS, integration docs, focused provider docs, and example configs.
- OpenCode npm package metadata and plugin export naming.
- Tests that assert package names, imports, compatibility aliases, and OpenCode provider behavior.
- GitHub repo name, description, homepage/about metadata after local changes are ready.

## Out Of Scope

- Changing provider API credential names.
- Removing old imports or wrapper names in this release.
- Publishing the renamed PyPI or npm packages.
- Adding signed Feishu/Lark custom bot support.

## Validation

- `PYTHONPATH=/path/to/coding-agent-notifier/.worktrees/general-agent-notifier-rename/src python -m pytest tests/notifier`
- `ruff check .`
- `git diff --check`
- Manual grep for old branding references, allowing only compatibility notes, provider-specific Slack docs/classes, and old GitHub URLs if needed before the GitHub rename lands.
