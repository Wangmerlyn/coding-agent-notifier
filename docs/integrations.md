# Integrating Coding Agents with the Slack and Feishu/Lark Notifiers

Most coding-agent CLIs now expose hooks or plugin points that can run shell commands on lifecycle events. Point the completion/stop/session-idle hook at `scripts/notifier/codex_notify_wrapper.sh` to deliver Slack DMs when long tasks finish. For Feishu/Lark custom bot notifications, point hooks at `scripts/notifier/lark_notify.py`.

## General pattern
- Ensure `SLACK_BOT_TOKEN` and `SLACK_USER_ID` are available to the hook command.
- For Feishu/Lark, ensure `LARK_WEBHOOK_URL` or `FEISHU_WEBHOOK_URL` is available to the hook command.
- Simple setup: put those values in your user-level agent config, or put them in a user-level env file loaded with `--env-file`. Avoid project-level config files and repo `.env` for real tokens.
- Prefer the agent's native hook system. Use the Slack wrapper for robustness across stdin/file/inline payloads:
  ```bash
  /path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh
  ```
- For Feishu/Lark stdin-based hooks, use:
  ```bash
  /path/to/vibe-coding-slack-notifier/scripts/notifier/lark_notify.py
  ```
- Codex hook config belongs in `~/.codex/hooks.json`. Keep credentials in `~/.codex/config.toml` under `[shell_environment_policy.set]`, or in a 0600 user-level env file that the hook command loads explicitly.
- Optionally capture the payload for debugging:
  ```bash
  DEBUG_CODEX_PAYLOAD=/tmp/codex_payload.json
  ```
- If your tool provides a payload file path for Slack, pass it as the first wrapper argument; if it pipes JSON, no args are needed.
- For Feishu/Lark, pass payload files with `--payload-file /path/to/payload.json`.
- If a tool still has no hook event, wrap the agent command and invoke the notifier after the command exits. See `docs/examples/copilot_wrapper.sh` for the fallback shape.
- Hardened setup: use an OS keychain or credential helper. That narrows secret exposure further but is intentionally not the default here.

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
- Put credentials in `~/.codex/config.toml`:
  ```toml
  model = "<YOUR_CODEX_MODEL_ID>"   # replace with your Codex model id
  model_reasoning_effort = "high"

  [shell_environment_policy.set]
  SLACK_BOT_TOKEN = "xoxb-your-token-here"
  SLACK_USER_ID = "U12345678"
  LARK_WEBHOOK_URL = "https://open.larksuite.com/open-apis/bot/v2/hook/your-token-here"
  ```
  See `docs/examples/codex/config.toml` for a full env sample. Optional env vars: `DEBUG_CODEX_PAYLOAD` (capture payload) and `ENV_FILE` (alternate env path).
- For Feishu/Lark hooks, a user-level env file is often more deterministic because the hook command loads the webhook URL itself:
  ```bash
  umask 077
  cat > ~/.codex/vibe-coding-slack-notifier.env <<'EOF'
  FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token-here
  EOF
  ```
- Add the hook command in `~/.codex/hooks.json`.

  Slack wrapper:
  ```json
  {
    "hooks": {
      "Stop": [
        {
          "hooks": [
            {
              "type": "command",
              "command": "/path/to/vibe-coding-slack-notifier/scripts/notifier/codex_notify_wrapper.sh"
            }
          ]
        }
      ]
    }
  }
  ```

  Feishu/Lark custom bot:
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
  Replace `/path/to/python` with the Python 3.12+ interpreter where you installed this package, and replace `/home/you/.codex/vibe-coding-slack-notifier.env` with your user-level env file. If you rely only on `~/.codex/config.toml`, make sure the running Codex process has loaded the updated config. See `docs/examples/codex/hooks.json`, `docs/examples/codex/hooks_lark.json`, and `docs/notifier_lark.md`.
- After editing `~/.codex/hooks.json`, Codex may require hook review. Open `/hooks`, review the command, and enable/trust it. For scripted setup, query the Codex app-server RPC method `hooks/list`, read the hook entry's `currentHash`, and trust that exact value; do not hand-calculate or reuse an old hash.
- Avoid using Codex top-level `notify` for new installs. If you must use it, remember that recent Codex versions append the payload as a positional argument; direct Feishu/Lark `notify` commands therefore need `--payload`.

## Tips
- Keep hook commands short and use absolute paths.
- The wrapper reads the payload from a file path passed as `$1`. If `$1` is an inline JSON string, it's also handled. If no argument is given, it reads from stdin.
- The Feishu/Lark script accepts stdin, `--payload`, or `--payload-file`.
- Set `LOGLEVEL=WARNING` (or use `--log-level WARNING`) when calling `slack_notify.py` directly to avoid chatty stdout/stderr in host tools.
- Agent hook APIs change faster than this repository. When a tool adds a native hook, keep the notifier command the same and only translate the tool-specific hook syntax.
