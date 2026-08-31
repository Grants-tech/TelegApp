/**
 * Parses a raw Telegram trade-call message into a structured object.
 *
 * Handles messages shaped like:
 *
 *   XAUUSD BUY NOW
 *
 *   @4593- 4589
 *
 *   SL:4583
 *
 *   TP:4600
 *   TP:4610
 *   TP:4620
 *   TP:Open
 *
 *   Apply proper risk management
 *
 * Returns null if the text doesn't look like a trade call (so you can
 * safely run every incoming channel message through this and ignore
 * chit-chat / announcements).
 */

const SYMBOL_DIRECTION_RE = /^([A-Z]{3,10}(?:\/[A-Z]{2,5})?)\s+(BUY|SELL)\s*(NOW|LIMIT|STOP)?/im;
const ENTRY_RE = /@\s*([\d.]+)\s*[-–—]?\s*([\d.]*)/;
const SL_RE = /SL[:\s]+([\d.]+)/i;
const TP_RE = /TP\s*\d*\s*[:\-]\s*([\d.]+|open)/gi;
const NOTE_RE = /(apply proper risk management|manage your risk|trade at your own risk)/i;

function toNumber(str) {
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

function parseTradeSignal(rawText, meta = {}) {
  if (!rawText || typeof rawText !== "string") return null;

  const text = rawText.trim();
  const symbolMatch = text.match(SYMBOL_DIRECTION_RE);
  if (!symbolMatch) return null; // not a trade call — e.g. a plain announcement

  const symbol = symbolMatch[1].toUpperCase();
  const direction = symbolMatch[2].toUpperCase(); // BUY | SELL
  const orderType = (symbolMatch[3] || "NOW").toUpperCase();

  const entryMatch = text.match(ENTRY_RE);
  let entry = null;
  if (entryMatch) {
    const a = toNumber(entryMatch[1]);
    const b = toNumber(entryMatch[2]);
    if (a !== null && b !== null) {
      entry = { low: Math.min(a, b), high: Math.max(a, b) };
    } else if (a !== null) {
      entry = { low: a, high: a };
    }
  }

  const slMatch = text.match(SL_RE);
  const sl = slMatch ? toNumber(slMatch[1]) : null;

  const tps = [];
  let tpMatch;
  TP_RE.lastIndex = 0;
  while ((tpMatch = TP_RE.exec(text)) !== null) {
    const raw = tpMatch[1];
    tps.push(raw.toLowerCase() === "open" ? "Open" : toNumber(raw));
  }

  const noteMatch = text.match(NOTE_RE);

  // Basic sanity check — require at least a symbol+direction and either an
  // entry or an SL, otherwise it's probably not a real signal.
  if (!entry && sl === null && tps.length === 0) return null;

  return {
    symbol,
    direction,
    orderType,
    entry,
    sl,
    tps,
    note: noteMatch ? noteMatch[0] : null,
    raw: text,
    postedAt: meta.postedAt || new Date().toISOString(),
    messageId: meta.messageId ?? null,
    authorUsername: meta.authorUsername || null,
  };
}

module.exports = { parseTradeSignal };