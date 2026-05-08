# Integrating Coding Agents with the Slack and Feishu/Lark Notifiers

Most coding-agent CLIs now expose hooks or plugin points that can run shell commands on lifecycle events. Point the completion/stop/session-idle hook at `scripts/notifier/codex_notify_wrapper.sh` to deliver Slack DMs when long tasks finish. For Feishu/Lark custom bot notifications, point hooks at `scripts/notifier/lark_notify.py`.

## General pattern
- Ensure `SLACK_BOT_TOKEN` and `SLACK_USER_ID` are available to the hook command.
- For Feishu/Lark, ensure `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL` is available to the hook command.
- Simple setup: put those values in your user-level agent config. Avoid project-level config files and repo `.env` for real tokens.
- Prefer the agent's native hook system. Use the Slack wrapper for robustness across stdin/file/inline payloads:
  ```bash
  /path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh
  ```
- For Feishu/Lark stdin-based hooks, use:
  ```bash
  /path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py
  ```
- Optionally capture the payload for debugging:
  ```bash
  DEBUG_CODEX_PAYLOAD=/tmp/codex_payload.json
  ```
- If your tool provides a payload file path for Slack, pass it as the first wrapper argument; if it pipes JSON, no args are needed.
- For Feishu/Lark, pass payload files with `--payload-file /path/to/payload.json`.
- If a tool still has no hook event, wrap the agent command and invoke the notifier after the command exits. See `docs/examples/copilot_wrapper.sh` for the fallback shape.
- Secure setup: use an OS keychain, credential helper, or tightly permissioned credential file loaded only by the notifier. That narrows secret exposure but is intentionally not the default here.

## Claude Code
- Supports a hook system; add a hook on events like `Stop` / `SessionEnd`.
- Put notifier env vars in user settings (`~/.claude/settings.json`), not project settings:
  ```json
  {
    "env": {
      "SLACK_BOT_TOKEN": "xoxb-your-token-here",
      "SLACK_USER_ID": "U12345678",
      "LARK_WEBHOOK_URL": "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
    },
    "hooks": {
      "Stop": [
        {
          "matcher": "*",
          "hooks": [
            { "type": "command", "command": "/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh" }
          ]
        }
      ]
    }
  }
  ```
  See `docs/examples/claude/settings.json`.

## Gemini CLI
- Similar hook support; configure in `.gemini/settings.json`.
  ```json
  {
    "hooks": {
      "Stop": [
        {
          "type": "command",
          "command": "/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh"
        }
      ]
    }
  }
  ```
  See `docs/examples/gemini/hooks.json` for a copy/paste starter that matches `.gemini/settings.json`.

## OpenCode
- Preferred: install plugin package via OpenCode's official `plugin` config flow:
  ```bash
  npm install -g opencode-vibe-coding-slack-notifier
  ```
  then create credentials file:
  ```bash
  mkdir -p ~/.config/opencode
  cat > ~/.config/opencode/slack-notifier.env <<'EOF'
  SLACK_BOT_TOKEN=xoxb-your-token-here
  SLACK_USER_ID=U12345678
  EOF
  ```
  then:
  ```json
  {
    "$schema": "https://opencode.ai/config.json",
    "plugin": ["opencode-vibe-coding-slack-notifier"]
  }
  ```
  See `docs/examples/opencode/opencode.json` and `docs/opencode_plugin.md`.
- Alternative (local script plugin): use a custom `.opencode/plugins/slackNotifier.js` that shells out to
  `/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh`.
  See `docs/examples/opencode/slackNotifier.js`.

## Copilot CLI, Cursor, and similar agents
- If your installed version exposes a completion/stop hook, configure that hook to run the Slack wrapper:
  ```bash
  /path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh
  ```
- If your version does not expose a hook, wrap the CLI call and invoke the notifier afterward:
  ```bash
  copilot "$@"
  /path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh
  ```
  See `docs/examples/copilot_wrapper.sh` for a minimal fallback wrapper.

## Codex CLI (reference)
- Example `~/.codex/config.toml` with simple user-level env and the Slack wrapper:
  ```toml
  model = "<YOUR_CODEX_MODEL_ID>"   # replace with your Codex model id
  model_reasoning_effort = "high"
  notify = ["/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh"]

  [shell_environment_policy.set]
  SLACK_BOT_TOKEN = "xoxb-your-token-here"
  SLACK_USER_ID = "U12345678"
  LARK_WEBHOOK_URL = "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
  ```
  See `docs/examples/codex/config.toml` for a full sample. Optional flags: `DEBUG_CODEX_PAYLOAD` (capture payload) and `ENV_FILE` (alternate env path).
- Example Feishu/Lark custom bot config when the hook pipes JSON to stdin:
  ```toml
  notify = ["/path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py"]
  ```
  Set `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL` first. See `docs/notifier_lark.md`.

## Tips
- Keep the notify command short and use absolute paths.
- The wrapper reads the payload from a file path passed as `$1`. If `$1` is an inline JSON string, it's also handled. If no argument is given, it reads from stdin.
- The Feishu/Lark script accepts stdin, `--payload`, or `--payload-file`.
- Set `LOGLEVEL=WARNING` (or use `--log-level WARNING`) when calling `slack_notify.py` directly to avoid chatty stdout/stderr in host tools.
- Agent hook APIs change faster than this repository. When a tool adds a native hook, keep the notifier command the same and only translate the tool-specific hook syntax.
