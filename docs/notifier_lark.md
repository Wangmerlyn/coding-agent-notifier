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

For agent hooks, the simple setup is user-level agent config or a user-level env file loaded by the hook command. Keep real webhook URLs out of project-level config and repo `.env` files.

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

For Codex hooks, an explicit user-level env file avoids stale-session issues where a running Codex process has not loaded a new `shell_environment_policy.set` value yet:

```bash
mkdir -p ~/.codex
install -m 600 /dev/null ~/.codex/vibe-coding-slack-notifier.env
cat > ~/.codex/vibe-coding-slack-notifier.env <<'EOF'
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
EOF
```

This is simple secret handling, not a full credential manager. A more hardened setup would use an OS keychain or credential helper, but that is intentionally outside the default quick path.

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
            "command": "/path/to/python /abs/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py --env-file /home/you/.codex/vibe-coding-slack-notifier.env --webhook-url-env FEISHU_WEBHOOK_URL"
          }
        ]
      }
    ]
  }
}
```

Save that as `~/.codex/hooks.json`. Replace `/path/to/python` with the Python 3.12+ interpreter where you installed this package, and replace `/home/you/.codex/vibe-coding-slack-notifier.env` with your user-level env file. Keeping the webhook URL in `~/.codex/config.toml` under `[shell_environment_policy.set]` also works after Codex has loaded that config, but `--env-file` keeps the hook command self-contained. Run Codex and approve the hook from `/hooks` if Codex says it needs review.
See `docs/examples/codex/hooks_lark.json` for a copy/paste starter.

If you keep the webhook in Codex config instead of an env file, you can omit `--env-file` and keep only the explicit env-var name:

```json
{
  "type": "command",
  "command": "/path/to/python /abs/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py --webhook-url-env FEISHU_WEBHOOK_URL"
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
  "/path/to/python",
  "/abs/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py",
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
- Hook does not run in Codex: open `/hooks`, review the command, and make sure it is enabled/trusted. If scripting this, query the Codex app-server RPC method `hooks/list`, read the hook entry's `currentHash`, and trust that exact value.
- Manual test succeeds but the Codex hook sends nothing: the hook process may not have the webhook env var. Add `--env-file /home/you/.codex/vibe-coding-slack-notifier.env --webhook-url-env FEISHU_WEBHOOK_URL` to the hook command, then re-open Codex or re-approve the modified hook from `/hooks`.
- `bad webhook` or `access token invalid`: check that the full webhook URL was copied.
- Keyword security failures: include the custom keyword in `--title` or in the agent payload text.
- No chat message: confirm the custom bot is installed in the expected chat and that signing is disabled.
- Sparse message: ensure the payload includes fields such as `title`, `status`, `summary`, `duration`, or `url`.
