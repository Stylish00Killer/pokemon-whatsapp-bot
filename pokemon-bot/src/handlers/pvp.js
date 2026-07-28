'use strict';

/**
 * !pvp @user — Challenge a group member to a Pokémon battle.
 *
 * Usage (in a group):
 *   !pvp @919999999999   → send a PVP challenge
 *
 * The mentioned user must then send *!pvp accept* (or *!pvp yes*) to begin.
 * Either player can send *!pvp cancel* to abort a pending challenge.
 */

const { players } = require('../store/players');
const { hasSession, createPVPChallenge, acceptPVP, clearSession, getSession } = require('../engine/battle');

module.exports = async function pvpHandler({ client, msg, from, sender, args, isGroup }) {
    if (!isGroup) {
        return client.sendMessage(from, { text: '❌ PVP battles can only be started in a group chat.' }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    // ── Accept ────────────────────────────────────────────────────────────────
    if (sub === 'accept' || sub === 'yes') {
        const session = getSession(from, sender);
        if (!session || !session.pending || session.defenderJid !== sender) {
            return client.sendMessage(from, { text: "❌ You don't have a pending PVP challenge to accept." }, { quoted: msg });
        }

        const player = players.get(sender);
        if (!player?.pokemon) {
            return client.sendMessage(from, {
                text: '❌ You need to register first with *!start* and choose a starter Pokémon.',
            }, { quoted: msg });
        }

        const updated = acceptPVP(from, sender, player.pokemon);
        if (!updated) {
            return client.sendMessage(from, { text: '❌ Could not accept the challenge. Try again.' }, { quoted: msg });
        }

        const challenger = players.get(session.attackerJid);
        return client.sendMessage(from, {
            text:
                `⚔️ *PVP Battle Started!*\n\n` +
                `@${session.attackerJid.split('@')[0].split(':')[0]} — ${session.attacker.emoji} ${session.attacker.name}\n` +
                `@${sender.split('@')[0].split(':')[0]} — ${updated.defender.emoji} ${updated.defender.name}\n\n` +
                `🎯 *${session.attacker.name}* goes first! (@${session.attackerJid.split('@')[0].split(':')[0]})\n` +
                `Use *!fight [move]* to attack.\nMoves: ${session.attacker.moves.join(', ')}`,
            mentions: [session.attackerJid, sender],
        }, { quoted: msg });
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    if (sub === 'cancel' || sub === 'no') {
        const session = getSession(from, sender);
        if (!session) {
            return client.sendMessage(from, { text: "❌ You don't have an active or pending battle to cancel." }, { quoted: msg });
        }
        clearSession(from, sender);
        return client.sendMessage(from, { text: '✅ Battle cancelled.' }, { quoted: msg });
    }

    // ── New challenge ─────────────────────────────────────────────────────────
    // Get mentioned user from the message
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
                  || msg.message?.conversation?.match(/@\d+/g)?.map(n => n.slice(1) + '@s.whatsapp.net')
                  || [];
    const opponentJid = mentions[0];

    if (!opponentJid) {
        return client.sendMessage(from, {
            text: '❌ Mention the player you want to challenge.\nExample: *!pvp @user*',
        }, { quoted: msg });
    }

    if (opponentJid === sender) {
        return client.sendMessage(from, { text: "❌ You can't challenge yourself!" }, { quoted: msg });
    }

    // Ensure challenger is registered
    const challenger = players.get(sender);
    if (!challenger?.pokemon) {
        return client.sendMessage(from, {
            text: '❌ You need to register first! Use *!start* to choose your starter Pokémon.',
        }, { quoted: msg });
    }

    // Check neither player is already in a battle
    if (hasSession(from, sender)) {
        return client.sendMessage(from, { text: '❌ You already have an active battle. Finish it or use *!pvp cancel*.' }, { quoted: msg });
    }
    if (hasSession(from, opponentJid)) {
        return client.sendMessage(from, {
            text: `❌ @${opponentJid.split('@')[0].split(':')[0]} is already in a battle.`,
            mentions: [opponentJid],
        }, { quoted: msg });
    }

    createPVPChallenge(from, sender, challenger.pokemon, opponentJid);

    return client.sendMessage(from, {
        text:
            `⚔️ @${sender.split('@')[0].split(':')[0]} challenges @${opponentJid.split('@')[0].split(':')[0]} to a Pokémon battle!\n\n` +
            `${challenger.pokemon.emoji} *${challenger.pokemon.name}* vs ???\n\n` +
            `@${opponentJid.split('@')[0].split(':')[0]}: Reply *!pvp accept* to battle or *!pvp cancel* to decline.\n` +
            `*(Challenge expires if ignored)*`,
        mentions: [sender, opponentJid],
    }, { quoted: msg });
};
