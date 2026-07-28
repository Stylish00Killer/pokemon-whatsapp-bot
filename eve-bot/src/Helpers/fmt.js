'use strict';

/**
 * fmt.js — EVE BOT centralized WhatsApp message formatting helpers.
 *
 * Usage:
 *   const fmt = require('../../Helpers/fmt');
 *   await fmt.replySuccess(M, 'Daily Claimed', 'You received 1,000 gems!', 'Come back in 24h');
 *   await fmt.replyError(M, 'Command Failed', 'Pokémon not found.', '-dex pikachu');
 */

const DIV    = '─────────────────────────';
const BRAND  = '⚡ *EVE BOT* — Made by S00K';
const FOOTER = `${DIV}\n${BRAND}`;

// ─── internal ────────────────────────────────────────────────────────────────

function build(...parts) {
    return parts.filter(p => p != null && p !== '').join('\n');
}

// ─── exported helpers ────────────────────────────────────────────────────────

/**
 * ✅ Success message.
 * @param {object} M         - serialised Baileys message
 * @param {string} title     - bold heading
 * @param {string} body      - main content (pre-formatted)
 * @param {string} [tip]     - optional italic tip line
 */
const replySuccess = (M, title, body, tip) =>
    M.reply(build(
        `✅ *${title}*`,
        '',
        body,
        tip ? `\n💡 _${tip}_` : null,
        '',
        FOOTER
    ));

/**
 * ❌ Error message.
 * @param {object} M
 * @param {string} title
 * @param {string} reason    - plain-text reason
 * @param {string} [tip]     - command hint, e.g. "-dex pikachu"
 */
const replyError = (M, title, reason, tip) =>
    M.reply(build(
        `❌ *${title}*`,
        '',
        reason,
        tip ? `\n💡 Try: \`${tip}\`` : null,
        '',
        FOOTER
    ));

/**
 * ℹ️ Info / neutral message.
 */
const replyInfo = (M, title, body) =>
    M.reply(build(
        `ℹ️ *${title}*`,
        '',
        body,
        '',
        FOOTER
    ));

/**
 * ⚠️ Warning message.
 */
const replyWarning = (M, title, body, tip) =>
    M.reply(build(
        `⚠️ *${title}*`,
        '',
        body,
        tip ? `\n💡 _${tip}_` : null,
        '',
        FOOTER
    ));

/**
 * 🕒 Cooldown message.
 * @param {object} M
 * @param {string} remaining  - human-readable time remaining
 */
const replyCooldown = (M, remaining) =>
    M.reply(build(
        `🕒 *Slow down!*`,
        '',
        `Wait *${remaining}* before using this command again.`,
        '',
        FOOTER
    ));

/**
 * 🔒 Permission denied.
 */
const replyNoPermission = (M, reason) =>
    M.reply(build(
        `🔒 *Permission Denied*`,
        '',
        reason,
        '',
        FOOTER
    ));

/**
 * Generic framed block — for custom layouts.
 * @param {object} M
 * @param {string} content   - full pre-formatted body
 */
const replyBlock = (M, content) =>
    M.reply(build(content, '', FOOTER));

module.exports = {
    DIV,
    BRAND,
    FOOTER,
    replySuccess,
    replyError,
    replyInfo,
    replyWarning,
    replyCooldown,
    replyNoPermission,
    replyBlock,
};
