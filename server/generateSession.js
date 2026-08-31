/**
 * Run this ONCE locally to log in and print a session string:
 *
 *   TG_API_ID=xxx TG_API_HASH=xxx node server/generateSession.js
 *
 * It will prompt for your phone number, the login code Telegram sends you,
 * and your 2FA password if you have one. Copy the printed session string
 * into TG_SESSION in your deployed worker's env vars. Treat it like a
 * password — anyone with it can act as your Telegram account.
 */

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input"); // npm i input

(async () => {
  const apiId = parseInt(process.env.TG_API_ID, 10);
  const apiHash = process.env.TG_API_HASH;

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Phone number: "),
    password: async () => await input.text("2FA password (blank if none): "),
    phoneCode: async () => await input.text("Login code: "),
    onError: (err) => console.error(err),
  });

  console.log("\nSave this as TG_SESSION:\n");
  console.log(client.session.save());
  process.exit(0);
})();