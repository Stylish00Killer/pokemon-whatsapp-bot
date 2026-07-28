'use strict';

/**
 * !fight [move] — Execute a move in your active battle.
 *
 * Usage:
 *   !fight ember      → use Ember
 *   !fight watergun   → use Water Gun (spaces ignored)
 *   !fight tackle     → use Tackle
 *
 * Works for both PVP and PVE sessions.
 */

const { executeFight } = require('../engine/battle');
const { players } = require('../store/players');

module.exports = async function fightHandler({ client, msg, from, sender, args, isGroup }) {
    if (!isGroup) {
        return client.sendMessage(from, { text: '❌ Battles only happen in group chats.' }, { quoted: msg });
    }

    const moveSlug = args.join('').toLowerCase().replace(/[^a-z]/g, '');

    if (!moveSlug) {
        return client.sendMessage(from, {
            text: '❌ Specify a move.\nExample: *!fight ember*',
        }, { quoted: msg });
    }

    const result = executeFight(from, sender, moveSlug);

    if (!result.ok) {
        return client.sendMessage(from, { text: result.message }, { quoted: msg });
    }

    // Build mention list for PVP turn-swap messages
    const mentions = [];
    const turnMatch = result.message.match(/@(\d+)/g);
    if (turnMatch) {
        turnMatch.forEach(n => mentions.push(n.slice(1) + '@s.whatsapp.net'));
    }

    await client.sendMessage(from, {
        text: result.message,
        mentions: mentions.length ? mentions : undefined,
    }, { quoted: msg });

    // Sync HP changes back to the player store after PVE round
    // (PVP HP is tracked entirely within the engine session)
    if (result.ended) {
        // Nothing extra needed; session already cleared inside executeFight
    }
};
