# Feishu/Lark Webhook Notifier Design

## Goal

Add first-class Feishu/Lark custom bot webhook support for coding-agent completion alerts, with install guidance and copy/paste examples that match the existing Slack notifier workflow.

## Scope

This version targets custom bot incoming webhooks only. It sends notifications to the chat where the custom bot is installed. It does not implement tenant app authentication, direct messages, user lookup, chat lookup, or rich interactive cards.

The supported names are both Feishu and Lark because the custom bot API shape is shared. User-facing docs should mention both names, and environment variables should accept either `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL`.

## Architecture

The existing `build_message()` function remains the single formatter for coding-agent payloads. A new webhook notifier class will live in `src/codex_slack_notifier/notifier.py` beside `SlackNotifier` to keep the public surface small and avoid a package split for this narrow feature.

The new client will POST a text message body to the configured webhook:

```json
{
  "msg_type": "text",
  "content": {
    "text": "formatted message"
  }
}
```

The CLI entrypoint will be `scripts/notifier/lark_notify.py`. It mirrors the Slack script's payload flags and `.env` loading behavior, but it reads a webhook URL instead of a Slack token and user ID.

## Data Flow

1. Agent hook passes JSON by stdin, inline argument, or payload file.
2. `lark_notify.py` loads `.env` or the path passed with `--env-file`.
3. The CLI resolves the webhook URL from `--webhook-url` or from the configured environment variable, defaulting to `LARK_WEBHOOK_URL` and falling back to `FEISHU_WEBHOOK_URL`.
4. `load_payload()` parses the payload.
5. `build_message()` formats the message.
6. The Feishu/Lark webhook client sends the text message.

## Error Handling

The webhook client raises the existing notification error type for request failures, HTTP failures, invalid JSON response bodies, and non-success API responses.

Success responses can appear as either `{"code": 0, "msg": "success"}` or `{"StatusCode": 0, "StatusMessage": "success"}`. Both are treated as success. If the response body is empty but the HTTP status is 2xx, the send is treated as success.

The first version does not retry. Feishu/Lark webhook delivery is one HTTP call, and adding retry/backoff can wait until there is evidence of transient failures in actual use.

## CLI And Configuration

`scripts/notifier/lark_notify.py` will support:

- `--webhook-url`: direct webhook URL override.
- `--webhook-url-env`: environment variable holding the webhook URL, default `LARK_WEBHOOK_URL`.
- `--env-file`: `.env` file path, with auto-load of repo-local `.env` matching the Slack CLI.
- `--payload` and `--payload-file`: same payload loading semantics as Slack.
- `--title`: optional message title override.
- `--log-level`: same choices and defaults as Slack.

If `--webhook-url-env` is left at the default and `LARK_WEBHOOK_URL` is not set, the CLI falls back to `FEISHU_WEBHOOK_URL`.

## Documentation

Docs will include:

- README quick start notes for choosing Slack or Feishu/Lark.
- `.env.example` sample values for `LARK_WEBHOOK_URL` and `FEISHU_WEBHOOK_URL`.
- A focused `docs/notifier_lark.md` setup guide.
- Integration docs showing the direct script path and the existing wrapper limitations.
- A Codex example script for Feishu/Lark.

The docs should be explicit that custom bots send to a chat, not to a specific user DM.

## Testing

Tests will cover:

- Successful webhook payload shape.
- Empty 2xx response bodies.
- `code != 0` and `StatusCode != 0` failures.
- HTTP failures and request exceptions.
- CLI env-file loading and fallback from `LARK_WEBHOOK_URL` to `FEISHU_WEBHOOK_URL`.
- Existing Slack notifier behavior remains unchanged.

## Non-Goals

- Feishu/Lark tenant app APIs.
- Direct user DMs.
- Signing support for custom bot secret verification.
- Rich card formatting.
- A generic multi-provider wrapper that chooses Slack vs Feishu/Lark automatically.
