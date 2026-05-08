# Vibe Coding Slack Notifier – Full Guide

This guide walks through setup, configuration, usage, debugging, and development for sending coding-agent task notifications to Slack DMs or Feishu/Lark chats.

## What it does
- Opens a DM channel to a target Slack user.
- Posts to a Feishu/Lark chat through a custom bot webhook.
- Posts a concise summary using fields from the agent hook payload (`title`, `status`, `summary`, `duration`, `url`).
- Works with stdin, inline JSON, or a payload file, which covers the common hook styles used by coding-agent CLIs.
- Optional debug capture of the payload used.

## Requirements
- Python 3.12+
- Slack app with bot token (`xoxb-...`) and scopes: `chat:write`, `im:write` (or `conversations:write`). `users:read` is handy if you need to look up IDs.
- Your Slack User ID (Profile → ⋯ → Copy member ID).
- For Feishu/Lark: a custom bot webhook URL from the chat that should receive notifications.

## Install
```bash
git clone git@github.com:Wangmerlyn/vibe-coding-slack-notifier.git
cd vibe-coding-slack-notifier
conda activate codex_slack_notifier  # or your preferred env
pip install -e '.[dev]'
# optional
pre-commit install
```

## Configure credentials
For agent hooks, the simple setup is to keep notifier values in your user-level agent config. This keeps secrets out of the project tree and avoids having every repo carry a local `.env`.

Codex:
```toml
# ~/.codex/config.toml
[shell_environment_policy.set]
SLACK_BOT_TOKEN = "xoxb-your-token"
SLACK_USER_ID = "U12345678"
LARK_WEBHOOK_URL = "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
# or:
# FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here"
```

Claude Code:
```json
{
  "env": {
    "SLACK_BOT_TOKEN": "xoxb-your-token",
    "SLACK_USER_ID": "U12345678",
    "LARK_WEBHOOK_URL": "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
  }
}
```

Use user-level files (`~/.codex/config.toml` and `~/.claude/settings.json`). Do not put real tokens in project-level `.codex/config.toml`, `.claude/settings.json`, or shell commands checked into a repo.

For one-off manual tests, direct export is still fine:
```bash
export SLACK_BOT_TOKEN=xoxb-your-token
export SLACK_USER_ID=U12345678
export LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here
# or
export FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
```

Repo `.env` remains supported as a local-development fallback:
```bash
cp .env.example .env
edit .env
```

The simple setup is not secure secret storage. A secure setup would use an OS keychain, a credential helper, or a tightly permissioned credential file loaded only by the notifier. Those approaches reduce exposure, but they add complexity, so this guide keeps them as an advanced path rather than the default.

## Wire an agent hook to Slack
Use the portable wrapper so payloads from stdin, inline JSON, or a file all work:
```toml
# ~/.codex/config.toml
notify = ["/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh"]
```
Options:
- Override env file location for local `.env` fallback: `ENV_FILE=/path/to/.env`.
- Capture the payload used: `DEBUG_CODEX_PAYLOAD=/path/to/codex_payload.json` (unset to disable).

For Claude Code, Gemini CLI, OpenCode, Copilot CLI, Cursor, and other agents, configure the equivalent completion/stop/session-idle hook to run the same wrapper command. See `docs/integrations.md` for examples and fallback wrapper guidance.

## Wire an agent hook to Feishu/Lark
Custom bots send to the chat where the bot is installed, not to a user DM.
If your notify hook pipes JSON to stdin, configure:
```toml
# ~/.codex/config.toml
notify = [
  "/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py"
]
```

For full setup and troubleshooting, see `docs/notifier_lark.md`.

## Manual Slack send (smoke test)
```bash
echo '{"status":"success","title":"Test ping","summary":"Hello"}' \
  | python scripts/notifier/slack_notify.py --user-id "$SLACK_USER_ID"
```

## Manual Feishu/Lark send (smoke test)
```bash
echo '{"status":"success","title":"Test ping","summary":"Hello"}' \
  | python scripts/notifier/lark_notify.py
```

## Wrapper behavior
- Accepts `$1` as a payload file path or falls back to stdin.
- Validates readability; if not readable, waits briefly then falls back to stdin (logs a warning).
- Loads env from `${ENV_FILE:-$REPO_ROOT/.env}` as a fallback if you use an env file.
- Writes the selected payload to `DEBUG_CODEX_PAYLOAD` if set.
- Forwards payload to `slack_notify.py` with `--env-file`.

## Troubleshooting
- `missing_scope`: ensure Slack app has `chat:write` and `im:write`/`conversations:write`; reinstall the app and use the updated token.
- `Missing Slack token/user ID`: set env vars through your agent config, export them in the shell, or ensure `.env` is loaded; wrapper’s `ENV_FILE` can point elsewhere.
- No DM received: set `DEBUG_CODEX_PAYLOAD` and inspect the payload; verify `SLACK_USER_ID` is correct.
- Rate limited: the notifier retries once on HTTP 429/5xx.
- Empty payload: notifier still sends a default message using the inferred agent label.
- Feishu/Lark keyword security: include the configured keyword in the message title or payload.
- Feishu/Lark signing: leave signature verification disabled; this first version does not sign custom bot requests.

## Development
- Format/lint: `pre-commit run --all-files` (uses ruff).
- Tests: `pytest` (mocks Slack API).
- CI: GitHub Actions runs pre-commit on push/PR.

## File map (docs)
- `README.md` – quick start and essential snippets.
- `docs/guide.md` – this detailed guide.
- `docs/notifier_slack.md` – focused setup notes for Slack + coding-agent hooks.
- `docs/notifier_lark.md` – focused setup notes for Feishu/Lark custom bots.
- `scripts/notifier/codex_notify_wrapper.sh` – Slack hook entrypoint for common agent payload styles.
- `scripts/notifier/slack_notify.py` – CLI entry to the notifier logic.
- `scripts/notifier/lark_notify.py` – CLI entry for Feishu/Lark custom bot webhooks.
