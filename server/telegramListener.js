/**
 * Long-running worker process. Run this separately from your Next.js app
 * (e.g. as a small always-on service on Railway/Render/Fly, or a VPS with
 * pm2). It must NOT run as a serverless function — it needs a persistent
 * connection to Telegram.
 *
 * Auth model: logs in as a regular Telegram account (yours, or a dedicated
 * account you create) that is simply a MEMBER of Roy's channel. No bot,
 * no admin rights required. If Roy is willing to add a bot as admin later,
 * you can switch to the simpler Bot API + webhook approach instead — ask
 * and I'll swap this out.
 *
 * Env vars required:
 *   TG_API_ID        - from https://my.telegram.org
 *   TG_API_HASH       - from https://my.telegram.org
 *   TG_SESSION        - a saved GramJS StringSession (see login script below)
 *   TG_CHANNEL         - the channel username or id, e.g. "royjoao_signals"
 *   PUSHER_APP_ID / PUSHER_KEY / PUSHER_SECRET / PUSHER_CLUSTER
 *   SITE_USERNAME_FOR_ROY  - the `username` value SignalCard should match, e.g. "RoyJoao"
 */

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const Pusher = require("pusher");
const { parseTradeSignal } = require("../lib/parseSignal");

const apiId = parseInt(process.env.TG_API_ID, 10);
const apiHash = process.env.TG_API_HASH;
const stringSession = new StringSession(process.env.TG_SESSION || "");
const channel = process.env.TG_CHANNEL;
const authorUsername = process.env.SITE_USERNAME_FOR_ROY || "RoyJoao";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

async function main() {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    // Only used the very first time you generate TG_SESSION (see below).
    phoneNumber: async () => process.env.TG_PHONE,
    password: async () => process.env.TG_2FA_PASSWORD || "",
    phoneCode: async () => process.env.TG_LOGIN_CODE,
    onError: (err) => console.error("Login error:", err),
  });

  console.log("Telegram listener connected. Session string (save this):");
  console.log(client.session.save());

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.message) return;

    const signal = parseTradeSignal(message.message, {
      postedAt: new Date(message.date * 1000).toISOString(),
      messageId: message.id,
      authorUsername,
    });

    if (!signal) {
      // Not a trade call (e.g. a text update) — ignore.
      return;
    }

    console.log("Parsed signal:", signal);

    try {
      await pusher.trigger(`signals-${authorUsername}`, "new-signal", signal);
    } catch (err) {
      console.error("Failed to publish signal:", err);
    }

    // Optional: also persist to your DB here so the latest signal survives
    // restarts / is available for first page load, not just live pushes.
    // await db.signals.insert(signal);
  }, new NewMessage({ chats: [channel] }));

  console.log(`Listening for new messages in ${channel}...`);
}

main().catch((err) => {
  console.error("Listener crashed:", err);
  process.exit(1);
});