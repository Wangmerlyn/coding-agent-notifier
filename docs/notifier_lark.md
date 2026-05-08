# Feishu/Lark custom bot notifier for Codex

Send Codex completion events to a Feishu/Lark chat using a custom bot incoming webhook.

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

```bash
# Lark global endpoint
export LARK_WEBHOOK_URL=https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here

# Feishu China endpoint
export FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
```

Or use `.env`:

```bash
cp .env.example .env
edit .env
```

The notifier auto-loads `.env` in the current directory, or a file passed with `--env-file`.

## Manual smoke test

```bash
echo '{"status":"success","title":"Codex run","summary":"Finished"}' \
  | python scripts/notifier/lark_notify.py
```

To use a nonstandard env var:

```bash
export MY_LARK_WEBHOOK=https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here
echo '{"status":"success","title":"Codex run"}' \
  | python scripts/notifier/lark_notify.py --webhook-url-env MY_LARK_WEBHOOK
```

To pass the URL directly:

```bash
echo '{"status":"success","title":"Codex run"}' \
  | python scripts/notifier/lark_notify.py \
      --webhook-url "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
```

## Codex notify integration

If your Codex notify command pipes JSON to stdin, configure the Feishu/Lark script directly:

```toml
# ~/.codex/config.toml
notify = ["/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py"]
```

If your hook system passes a payload file, call:

```bash
/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py --payload-file /path/to/payload.json
```

The existing `scripts/notifier/codex_notify_wrapper.sh` is Slack-specific because it forwards to `slack_notify.py`.

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
    "text": "Codex run\nStatus: success\nFinished"
  }
}
```

The text body is generated from the same fields as the Slack notifier: `title`, `status`, `summary`, `duration`, `url`, and `repo`.

## Troubleshooting

- `Missing Feishu/Lark webhook URL`: set `LARK_WEBHOOK_URL`, `FEISHU_WEBHOOK_URL`, `--webhook-url`, or `--webhook-url-env`.
- `bad webhook` or `access token invalid`: check that the full webhook URL was copied.
- Keyword security failures: include the custom keyword in `--title` or in the agent payload text.
- No chat message: confirm the custom bot is installed in the expected chat and that signing is disabled.
- Sparse message: ensure the payload includes fields such as `title`, `status`, `summary`, `duration`, or `url`.
