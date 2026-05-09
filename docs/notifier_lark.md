# Feishu/Lark custom bot notifier for coding-agent hooks

Send coding-agent completion events to a Feishu/Lark chat using a custom bot incoming webhook.

Custom bots post to the chat where the bot is installed. This is not a direct-message API and does not target a specific user.

## Create a custom bot

1. Open the Feishu/Lark chat that should receive notifications.
2. Add a custom bot from the chat settings.
3. Copy the webhook URL.
4. If you enable keyword security, make sure your notification text includes the configured keyword.
5. If you enable signature verification, this first notifier version does not support signing; leave signing disabled.

Official setup docs:

- Lark: <https://open.larksuite.com/document/client-docs/bot-v3/add-custom-bot>
- Feishu: <https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot>

## Environment variables

Use either variable name. `LARK_WEBHOOK_URL` wins when both are set.

For agent hooks, the simple setup is user-level agent config. Keep real webhook URLs out of project-level config and repo `.env` files.

Codex:
```toml
# ~/.codex/config.toml
[shell_environment_policy.set]
LARK_WEBHOOK_URL = "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
# or:
# FEISHU_WEBHOOK_URL = "https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here"
```

Claude Code:
```json
{
  "env": {
    "LARK_WEBHOOK_URL": "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
  }
}
```

For manual tests:
```bash
# Lark global endpoint
export LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here

# Feishu China endpoint
export FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
```

Repo `.env` remains supported as a local-development fallback:

```bash
cp .env.example .env
edit .env
```

The notifier auto-loads `.env` in the current directory, or a file passed with `--env-file`.

This is a simple setup, not secure secret storage. A secure setup would use an OS keychain, credential helper, or tightly permissioned credential file loaded only by the notifier, but that is intentionally outside the default quick path.

## Manual smoke test

```bash
echo '{"status":"success","title":"Agent run","summary":"Finished"}' \
  | python scripts/notifier/lark_notify.py
```

To use a nonstandard env var:

```bash
export MY_LARK_WEBHOOK=https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here
echo '{"status":"success","title":"Agent run"}' \
  | python scripts/notifier/lark_notify.py --webhook-url-env MY_LARK_WEBHOOK
```

To pass the URL directly:

```bash
echo '{"status":"success","title":"Agent run"}' \
  | python scripts/notifier/lark_notify.py \
      --webhook-url "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
```

## Hook integration

Prefer your agent's native hook system. Codex uses a user-level `hooks.json` file for this:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py"
          }
        ]
      }
    ]
  }
}
```

Save that as `~/.codex/hooks.json`. Keep the webhook URL in `~/.codex/config.toml` under `[shell_environment_policy.set]`, then run Codex and approve the hook from `/hooks` if Codex says it needs review.
See `docs/examples/codex/hooks_lark.json` for a copy/paste starter.

If you use `FEISHU_WEBHOOK_URL` and want to make the env var explicit, add the flag:

```json
{
  "type": "command",
  "command": "/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py --webhook-url-env FEISHU_WEBHOOK_URL"
}
```

Other agents can run the same command from their completion, stop, or session-idle hook when they pipe JSON to stdin.

If your hook system passes a payload file instead of stdin, call:

```bash
/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py \
  --payload-file /path/to/payload.json
```

If your hook system passes inline JSON as an argument, call:

```bash
/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py \
  --payload '{"status":"success","title":"Agent run"}'
```

The existing `scripts/notifier/codex_notify_wrapper.sh` is Slack-specific because it forwards to `slack_notify.py`.

### Codex `notify` compatibility note

Codex's native top-level `notify = [...]` setting is not the same as a Codex hook. Recent Codex versions append the completion payload as a positional argument, so direct Feishu/Lark usage must include `--payload`:

```toml
notify = [
  "/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py",
  "--payload"
]
```

For new installs, prefer `~/.codex/hooks.json` instead. It matches Codex's hook review/trust flow and avoids confusing stdin-based hook examples with `notify` argv behavior.

## CLI flags

- `--webhook-url`: Feishu/Lark webhook URL.
- `--webhook-url-env`: env var holding the webhook URL, default `LARK_WEBHOOK_URL`.
- `--env-file`: path to a `.env` file.
- `--payload` / `--payload-file`: JSON payload source.
- `--title`: optional title override.
- `--log-level`: logging level, default `WARNING`.

## Message format

The notifier sends a text custom bot payload:

```json
{
  "msg_type": "text",
  "content": {
    "text": "Agent run\nStatus: success\nFinished"
  }
}
```

The text body is generated from the same fields as the Slack notifier: `title`, `status`, `summary`, `duration`, `url`, and `repo`.

## Troubleshooting

- `Missing Feishu/Lark webhook URL`: set `LARK_WEBHOOK_URL`, `FEISHU_WEBHOOK_URL`, `--webhook-url`, or `--webhook-url-env`.
- `unrecognized arguments: {"type":"agent-turn-complete",...}`: the Codex native `notify` command is passing inline JSON as an argv value. Use `~/.codex/hooks.json`, or add `--payload` before the payload in the `notify` command.
- Hook does not run in Codex: open `/hooks`, review the command, and make sure it is enabled/trusted. If scripting this, read the current hook hash from `hooks/list`; do not guess the trusted hash.
- `bad webhook` or `access token invalid`: check that the full webhook URL was copied.
- Keyword security failures: include the custom keyword in `--title` or in the agent payload text.
- No chat message: confirm the custom bot is installed in the expected chat and that signing is disabled.
- Sparse message: ensure the payload includes fields such as `title`, `status`, `summary`, `duration`, or `url`.
