# Vibe Coding Slack Notifier

[![CodeRabbit Reviews](https://img.shields.io/coderabbit/prs/github/Wangmerlyn/vibe-coding-slack-notifier?utm_source=oss&utm_medium=github&utm_campaign=Wangmerlyn%2Fvibe-coding-slack-notifier&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Wangmerlyn/vibe-coding-slack-notifier)

Send coding-agent task completion alerts to Slack DMs or Feishu/Lark chats.
Slack uses the Slack Web API. Feishu/Lark uses custom bot incoming webhooks.

For a detailed, step-by-step guide (setup, config, debugging, FAQs), see `docs/guide.md`.
For Feishu/Lark custom bot setup, see `docs/notifier_lark.md`.

For integrations with coding-agent hooks (Codex CLI, Claude Code, Gemini CLI, OpenCode, Copilot CLI, Cursor, and similar tools), see `docs/integrations.md`.
Sample hook config snippets live under `docs/examples/`; the wrapper example is still available for tools without a hook event.
For OpenCode marketplace/npm-style plugin setup, see `docs/opencode_plugin.md`.

## Why This Slack Notifier
- Most coding-agent CLIs now expose hooks or plugin events, but local editor notifications still vary by tool and environment.
- CLI-local tricks (terminal bells, desktop notifications) often fail over Remote-SSH because the sound/notification doesn’t propagate, leaving remote users uninformed.
- This project gives those hooks a remote-safe notification target: Slack DMs or Feishu/Lark chats that work independently of where the agent runs.

## Slack quick start
1. **Clone & env**
   - `git clone git@github.com:Wangmerlyn/vibe-coding-slack-notifier.git`
   - `cd vibe-coding-slack-notifier`
   - `conda activate codex_slack_notifier` (or create it)
   - `pip install -e '.[dev]'`
   - Optional: `pre-commit install`

2. **Create a Slack app**
   - Go to [api.slack.com/apps](https://api.slack.com/apps) → "Create New App" → "From scratch".
   - Choose a workspace and create a Bot token.
   - Add Bot scopes: `chat:write`, `im:write`, and `users:read` if you need lookups.
   - Install the app to the workspace and copy the **Bot User OAuth Token** (`xoxb-...`).
   - Find your Slack User ID (Profile → ⋯ → Copy member ID).

3. **Configure credentials**
   For agent hooks, the simple setup is to put notifier env vars in your user-level agent config, not in a repo `.env`.

   Codex example:
   ```toml
   # ~/.codex/config.toml
   [shell_environment_policy.set]
   SLACK_BOT_TOKEN = "xoxb-your-token-here"
   SLACK_USER_ID = "U12345678"
   ```

   Claude Code example:
   ```json
   {
     "env": {
       "SLACK_BOT_TOKEN": "xoxb-your-token-here",
       "SLACK_USER_ID": "U12345678"
     }
   }
   ```

   For manual smoke tests, direct shell export is also fine. Repo `.env` is still supported as a fallback for local development, but it is no longer the recommended hook setup.

   This is a simple setup, not secure secret storage. A more secure setup would use an OS keychain, credential helper, or tightly permissioned credential file loaded only by the notifier; this project keeps the default path lightweight.

4. **Send a manual test DM**
   ```bash
   echo '{"status":"success","title":"Agent run","summary":"Finished"}' \
     | python scripts/notifier/slack_notify.py --user-id "$SLACK_USER_ID"
   ```
   - The script opens a DM via `conversations.open` and sends the message via `chat.postMessage`.

5. **Wire up an agent hook**
   Codex hook example (`~/.codex/hooks.json`):
   ```json
   {
     "hooks": {
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "/abs/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh"
             }
           ]
         }
       ]
     }
   }
   ```
   Other agents can point their completion/stop/session-idle hook at the same wrapper. If a tool passes JSON on stdin, via a payload file, or as inline JSON, the wrapper normalizes it before sending Slack. If Codex says the hook needs review, open `/hooks` and approve the command.

6. **Run tests (optional)**
   ```bash
   pytest
   # Lint: ruff check .
   ```

## OpenCode plugin install (official flow)
If you use OpenCode, this repo now exposes an installable plugin package:

```bash
npm install -g opencode-vibe-coding-slack-notifier
```

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-vibe-coding-slack-notifier"]
}
```

Recommended credentials setup (no shell export needed):

```bash
mkdir -p ~/.config/opencode
cat > ~/.config/opencode/slack-notifier.env <<'EOF'
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_USER_ID=U12345678
EOF
```

The plugin auto-loads this file. See `docs/opencode_plugin.md` for full setup and advanced options.

## Feishu/Lark custom bot quick start
1. **Create a custom bot**
   - Add a custom bot to the Feishu/Lark chat that should receive notifications.
   - Copy the webhook URL.
   - Leave signature verification disabled for this first notifier version.
   - Official docs: [Lark](https://open.larksuite.com/document/client-docs/bot-v3/add-custom-bot) / [Feishu](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot).

2. **Configure the webhook**
   ```bash
   # Lark global endpoint
   export LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here

   # Or Feishu China endpoint
   export FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
   ```
   For agent hooks, prefer the same user-level agent config pattern shown above. Repo `.env` remains a local-development fallback.

3. **Send a manual test message**
   ```bash
   echo '{"status":"success","title":"Agent run","summary":"Finished"}' \
     | python scripts/notifier/lark_notify.py
   ```

4. **Wire up an agent hook**
   Codex hook example (`~/.codex/hooks.json`):
   ```json
   {
     "hooks": {
       "Stop": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "/path/to/python /abs/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py"
             }
           ]
         }
       ]
     }
   }
   ```
   Replace `/path/to/python` with the Python 3.12+ interpreter where you installed this package. Keep `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL` in `~/.codex/config.toml` under `[shell_environment_policy.set]`, then approve the hook from `/hooks` if Codex asks for review.
   Feishu/Lark custom bots send to the chat where the bot is installed, not to a specific user DM.

## Payload expectations
- The notifier builds a message from `title`, `status`, `summary`, `duration`, and `url` when present.
- Missing fields default to a simple message using the inferred agent label, such as `Codex task completed.` or `Claude Code task completed.`

## More details
- `docs/notifier_slack.md` contains expanded setup notes and troubleshooting.
- Example Codex wiring: `docs/examples/codex/hooks.json`, `docs/examples/codex/hooks_lark.json`, and `scripts/notifier/codex_notify_example.sh`.

### Debugging agent hooks (optional)
- Use the wrapper that can read payloads from a file argument, inline JSON, or stdin:
  ```bash
  /path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh
  ```
- To capture the final payload for debugging, set an env var before running Codex:
  ```
  export DEBUG_CODEX_PAYLOAD=/path/to/your/codex_payload.json
  ```
  The wrapper will write only the most relevant JSON payload to that path; unset the variable to stop logging.
