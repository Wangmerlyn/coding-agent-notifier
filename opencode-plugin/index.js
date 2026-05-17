import fs from "node:fs";
import path from "node:path";

const SLACK_API_BASE = "https://slack.com/api";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 2;
const DEFAULT_DEBOUNCE_MS = 5_000;
const LOG_PREFIX = "[opencode-coding-agent-notifier]";

const warned = {
  missingEnv: false,
};

const lastSessionNotifyAt = new Map();
let envInitialized = false;
let loadedEnvFile = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseRetryAfterMs(retryAfterHeader) {
  if (!retryAfterHeader) {
    return 1_000;
  }
  const parsed = Number.parseFloat(retryAfterHeader);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1_000;
  }
  return Math.max(1_000, Math.ceil(parsed * 1_000));
}

function resolveTimeoutMs() {
  return parsePositiveInt(
    process.env.OPENCODE_AGENT_NOTIFIER_TIMEOUT_MS ?? process.env.SLACK_NOTIFY_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
}

function resolveEnvFileCandidates() {
  const candidates = [];
  if (process.env.OPENCODE_AGENT_NOTIFIER_ENV_FILE) {
    candidates.push(process.env.OPENCODE_AGENT_NOTIFIER_ENV_FILE);
  }
  if (process.env.OPENCODE_SLACK_ENV_FILE) {
    candidates.push(process.env.OPENCODE_SLACK_ENV_FILE);
  }

  if (process.env.HOME) {
    candidates.push(path.join(process.env.HOME, ".config", "opencode", "agent-notifier.env"));
    candidates.push(path.join(process.env.HOME, ".config", "opencode", "slack-notifier.env"));
  }

  return candidates;
}

function sanitizeEnvValue(raw) {
  const value = raw.trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFileIfNeeded() {
  if (envInitialized) {
    return;
  }
  envInitialized = true;

  for (const candidate of resolveEnvFileCandidates()) {
    if (!candidate || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
      continue;
    }

    try {
      const content = fs.readFileSync(candidate, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
        const eq = normalized.indexOf("=");
        if (eq <= 0) {
          continue;
        }

        const key = normalized.slice(0, eq).trim();
        const value = sanitizeEnvValue(normalized.slice(eq + 1));
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }

      loadedEnvFile = candidate;
      return;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(
        `${LOG_PREFIX} Failed to read env file ${candidate}: ${detail}`,
      );
    }
  }
}

function shouldNotify(event, debounceMs) {
  if (event?.type !== "session.idle") {
    return false;
  }

  const sessionId = event?.properties?.sessionID;
  if (!sessionId) {
    return true;
  }

  const now = Date.now();
  const last = lastSessionNotifyAt.get(sessionId) ?? 0;
  if (now - last < debounceMs) {
    return false;
  }

  lastSessionNotifyAt.set(sessionId, now);
  return true;
}

function buildMessage(repo, sessionId) {
  if (sessionId) {
    return `OpenCode task completed at repo ${repo}\nSession: ${sessionId}`;
  }
  return `OpenCode task completed at repo ${repo}`;
}

async function slackPost(token, endpoint, payload) {
  const timeoutMs = resolveTimeoutMs();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${SLACK_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        const retryMs = parseRetryAfterMs(response.headers.get("retry-after"));
        await sleep(retryMs);
        continue;
      }

      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(1_000);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Slack HTTP ${response.status}: ${body || "empty response"}`);
      }

      const data = await response.json();
      if (!data?.ok) {
        throw new Error(`Slack API error: ${data?.error || "unknown_error"}`);
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Slack request failed for ${endpoint}`);
}

async function parseOptionalJson(response) {
  const raw = await response.text();
  if (raw.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const preview = raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
    throw new Error(`Feishu/Lark returned a non-JSON response: ${JSON.stringify(preview)}`);
  }
}

function raiseForLarkApiError(data) {
  if (!data || typeof data !== "object") {
    return;
  }

  if (data.code !== undefined && data.code !== 0) {
    throw new Error(`Feishu/Lark API error: ${data.msg || data.message || "unknown_error"}`);
  }

  if (data.StatusCode !== undefined && data.StatusCode !== 0) {
    throw new Error(
      `Feishu/Lark API error: ${data.StatusMessage || data.message || "unknown_error"}`,
    );
  }
}

async function sendLarkTextWebhook(webhookUrl, text) {
  const timeoutMs = resolveTimeoutMs();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          msg_type: "text",
          content: {
            text,
          },
        }),
        signal: controller.signal,
      });

      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        const retryMs = parseRetryAfterMs(response.headers.get("retry-after"));
        await sleep(retryMs);
        continue;
      }

      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        await sleep(1_000);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Feishu/Lark HTTP ${response.status}: ${body || "empty response"}`);
      }

      const data = await parseOptionalJson(response);
      raiseForLarkApiError(data);
      return;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Feishu/Lark request failed");
}

async function sendSlackDm(token, userId, text) {
  const dm = await slackPost(token, "conversations.open", { users: userId });
  const channelId = dm?.channel?.id;
  if (!channelId) {
    throw new Error("Slack did not return DM channel id");
  }
  await slackPost(token, "chat.postMessage", {
    channel: channelId,
    text,
  });
}

function isDebugEnabled() {
  return (
    process.env.OPENCODE_AGENT_NOTIFIER_DEBUG === "1" ||
    process.env.OPENCODE_SLACK_DEBUG === "1"
  );
}

export const OpenCodeAgentNotifierPlugin = async ({ directory, worktree }) => {
  const debounceMs = parsePositiveInt(
    process.env.OPENCODE_AGENT_NOTIFIER_DEBOUNCE_MS ?? process.env.OPENCODE_SLACK_DEBOUNCE_MS,
    DEFAULT_DEBOUNCE_MS,
  );

  return {
    event: async ({ event }) => {
      if (!shouldNotify(event, debounceMs)) {
        return;
      }

      loadEnvFileIfNeeded();
      const token = process.env.SLACK_BOT_TOKEN;
      const userId = process.env.SLACK_USER_ID;
      const larkWebhookUrl = process.env.LARK_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL;
      const hasSlack = Boolean(token && userId);
      const hasLark = Boolean(larkWebhookUrl);
      if (!hasSlack && !hasLark) {
        if (!warned.missingEnv) {
          warned.missingEnv = true;
          const sourceHint = loadedEnvFile
            ? `Loaded env file: ${loadedEnvFile}.`
            : "No env file found.";
          console.warn(
            `${LOG_PREFIX} Missing Slack or Feishu/Lark notification configuration; skipping notification. ${sourceHint} Set env vars directly or provide OPENCODE_AGENT_NOTIFIER_ENV_FILE.`,
          );
        }
        return;
      }

      const repo = worktree || directory || process.cwd();
      const sessionId = event?.properties?.sessionID;
      const message = buildMessage(repo, sessionId);

      if (hasSlack) {
        try {
          await sendSlackDm(token, userId, message);
          if (isDebugEnabled()) {
            console.log(`${LOG_PREFIX} Slack notification sent.`);
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.error(`${LOG_PREFIX} Failed to send Slack notification: ${detail}`);
        }
      }

      if (hasLark) {
        try {
          await sendLarkTextWebhook(larkWebhookUrl, message);
          if (isDebugEnabled()) {
            console.log(`${LOG_PREFIX} Feishu/Lark notification sent.`);
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.error(`${LOG_PREFIX} Failed to send Feishu/Lark notification: ${detail}`);
        }
      }
    },
  };
};

export const OpenCodeSlackNotifierPlugin = OpenCodeAgentNotifierPlugin;

export default OpenCodeAgentNotifierPlugin;
