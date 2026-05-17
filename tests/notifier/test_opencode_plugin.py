import json
import os
import subprocess
import textwrap
from pathlib import Path


def test_package_json_exposes_opencode_plugin_entrypoint() -> None:
    package_json = Path("package.json")
    assert package_json.exists()

    data = json.loads(package_json.read_text(encoding="utf-8"))

    assert data["name"] == "opencode-coding-agent-notifier"
    assert (
        data["description"]
        == "OpenCode plugin: send coding agent notifications when OpenCode sessions become idle/completed."
    )
    assert data["main"] == "./opencode-plugin/index.js"
    assert data["types"] == "./opencode-plugin/index.d.ts"
    assert data["exports"]["."]["import"] == "./opencode-plugin/index.js"
    assert (
        data["repository"]["url"] == "git+https://github.com/Wangmerlyn/coding-agent-notifier.git"
    )
    assert data["bugs"]["url"] == "https://github.com/Wangmerlyn/coding-agent-notifier/issues"
    assert data["homepage"] == "https://github.com/Wangmerlyn/coding-agent-notifier#readme"


def test_opencode_plugin_files_exist() -> None:
    plugin_js = Path("opencode-plugin/index.js")
    plugin_dts = Path("opencode-plugin/index.d.ts")

    assert plugin_js.exists()
    assert plugin_dts.exists()

    js_source = plugin_js.read_text(encoding="utf-8")
    assert "session.idle" in js_source
    assert "conversations.open" in js_source
    assert "chat.postMessage" in js_source
    assert "sendLarkTextWebhook" in js_source
    assert "LARK_WEBHOOK_URL" in js_source
    assert "FEISHU_WEBHOOK_URL" in js_source
    assert "export const OpenCodeAgentNotifierPlugin" in js_source
    assert "export const OpenCodeSlackNotifierPlugin = OpenCodeAgentNotifierPlugin" in js_source
    assert "export default OpenCodeAgentNotifierPlugin" in js_source
    assert "OPENCODE_AGENT_NOTIFIER_ENV_FILE" in js_source
    assert "OPENCODE_SLACK_ENV_FILE" in js_source
    assert '.config", "opencode", "agent-notifier.env' in js_source
    assert '.config", "opencode", "slack-notifier.env' in js_source
    assert "OPENCODE_AGENT_NOTIFIER_DEBOUNCE_MS" in js_source
    assert "OPENCODE_SLACK_DEBOUNCE_MS" in js_source
    assert "OPENCODE_AGENT_NOTIFIER_TIMEOUT_MS" in js_source
    assert "SLACK_NOTIFY_TIMEOUT_MS" in js_source
    assert "OPENCODE_AGENT_NOTIFIER_DEBUG" in js_source
    assert "OPENCODE_SLACK_DEBUG" in js_source

    dts_source = plugin_dts.read_text(encoding="utf-8")
    assert "OpenCodeAgentNotifierPlugin" in dts_source
    assert "OpenCodeSlackNotifierPlugin" in dts_source
    assert "export default OpenCodeAgentNotifierPlugin" in dts_source


def test_opencode_plugin_sends_slack_and_lark_when_both_are_configured(tmp_path: Path) -> None:
    script = tmp_path / "exercise-opencode-plugin.mjs"
    plugin_path = (Path.cwd() / "opencode-plugin/index.js").resolve().as_uri()
    script.write_text(
        textwrap.dedent(
            f"""
            const calls = [];
            globalThis.fetch = async (url, options) => {{
              calls.push({{ url, body: JSON.parse(options.body) }});
              if (String(url).endsWith("/conversations.open")) {{
                return {{
                  ok: true,
                  status: 200,
                  headers: {{ get: () => null }},
                  json: async () => ({{ ok: true, channel: {{ id: "D123" }} }}),
                  text: async () => "",
                }};
              }}

              return {{
                ok: true,
                status: 200,
                headers: {{ get: () => null }},
                json: async () => ({{ ok: true }}),
                text: async () => "",
              }};
            }};

            const pluginModule = await import("{plugin_path}");
            const plugin = await pluginModule.OpenCodeAgentNotifierPlugin({{
              directory: "/tmp/repo",
              worktree: "/tmp/worktree",
            }});

            await plugin.event({{
              event: {{
                type: "session.idle",
                properties: {{ sessionID: "session-123" }},
              }},
            }});

            console.log(JSON.stringify({{
              defaultIsCanonical: pluginModule.default === pluginModule.OpenCodeAgentNotifierPlugin,
              aliasIsCanonical:
                pluginModule.OpenCodeSlackNotifierPlugin === pluginModule.OpenCodeAgentNotifierPlugin,
              calls,
            }}));
            """
        ),
        encoding="utf-8",
    )

    env = {
        **os.environ,
        "SLACK_BOT_TOKEN": "xoxb-test",
        "SLACK_USER_ID": "U123",
        "LARK_WEBHOOK_URL": "https://open.feishu.example/webhook",
        "OPENCODE_AGENT_NOTIFIER_DEBOUNCE_MS": "1",
    }
    result = subprocess.run(
        ["node", str(script)],
        check=True,
        capture_output=True,
        env=env,
        text=True,
    )
    output = json.loads(result.stdout)

    assert output["defaultIsCanonical"] is True
    assert output["aliasIsCanonical"] is True
    assert [call["url"] for call in output["calls"]] == [
        "https://slack.com/api/conversations.open",
        "https://slack.com/api/chat.postMessage",
        "https://open.feishu.example/webhook",
    ]
    assert output["calls"][1]["body"]["channel"] == "D123"
    assert output["calls"][1]["body"]["text"] == (
        "OpenCode task completed at repo /tmp/worktree\nSession: session-123"
    )
    assert output["calls"][2]["body"] == {
        "msg_type": "text",
        "content": {
            "text": "OpenCode task completed at repo /tmp/worktree\nSession: session-123",
        },
    }


def test_opencode_plugin_reports_lark_api_error(tmp_path: Path) -> None:
    script = tmp_path / "exercise-opencode-lark-error.mjs"
    plugin_path = (Path.cwd() / "opencode-plugin/index.js").resolve().as_uri()
    script.write_text(
        textwrap.dedent(
            f"""
            globalThis.fetch = async () => ({{
              ok: true,
              status: 200,
              headers: {{ get: () => null }},
              json: async () => ({{ code: 19001, msg: "bad webhook" }}),
              text: async () => "",
            }});

            const errors = [];
            console.error = (message) => errors.push(String(message));

            const pluginModule = await import("{plugin_path}");
            const plugin = await pluginModule.OpenCodeAgentNotifierPlugin({{
              directory: "/tmp/repo",
              worktree: "",
            }});

            await plugin.event({{
              event: {{
                type: "session.idle",
                properties: {{ sessionID: "session-456" }},
              }},
            }});

            console.log(JSON.stringify({{ errors }}));
            """
        ),
        encoding="utf-8",
    )

    env = {
        **os.environ,
        "SLACK_BOT_TOKEN": "",
        "SLACK_USER_ID": "",
        "LARK_WEBHOOK_URL": "https://open.feishu.example/webhook",
    }
    result = subprocess.run(
        ["node", str(script)],
        check=True,
        capture_output=True,
        env=env,
        text=True,
    )
    output = json.loads(result.stdout)

    assert output["errors"] == [
        "[opencode-coding-agent-notifier] Failed to send Feishu/Lark notification: "
        "Feishu/Lark API error: bad webhook"
    ]
