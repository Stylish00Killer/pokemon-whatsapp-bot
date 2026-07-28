'use strict';

/**
 * !challenge [@user] | --accept | --reject | --cancel
 * Challenge another trainer to a Pokémon battle.
 * Ported from eve-bot/src/Commands/Pokemons/challenge.js
 */

const utils = require('../utils');
const { continueSelection } = require('./battle');

// In-memory pending challenges: groupJid → { challenger, challengee }
const pokemonChallengeResponse = new Map();

module.exports = async function challengeHandler({ client, msg, from, sender, args, isGroup }) {
    if (!isGroup)
        return client.sendMessage(from, { text: '❌ Battles can only happen in group chats.' }, { quoted: msg });

    const sub = args[0]?.toLowerCase();

    // ── Accept ────────────────────────────────────────────────────────────────
    if (sub === '--accept' || sub === '--a') {
        const data = pokemonChallengeResponse.get(from);
        if (!data || data.challengee !== sender)
            return client.sendMessage(from, { text: '❌ No one challenged you.' }, { quoted: msg });

        pokemonChallengeResponse.delete(from);

        const acceptorParty    = (client.poke.get(`${sender}_Party`) || []).filter(p => p.hp > 0);
        const challengerParty  = (client.poke.get(`${data.challenger}_Party`) || []).filter(p => p.hp > 0);

        if (!acceptorParty.length)
            return client.sendMessage(from, { text: '❌ You don\'t have any healthy Pokémon to battle with!' }, { quoted: msg });
        if (!challengerParty.length)
            return client.sendMessage(from, { text: '❌ The challenger has no healthy Pokémon available.' }, { quoted: msg });

        client.pokemonBattleResponse.set(from, {
            player1: { user: data.challenger, ready: false, move: '', activePokemon: challengerParty[0] },
            player2: { user: sender,          ready: false, move: '', activePokemon: acceptorParty[0] },
            turn: 'player1',
            players: [data.challenger, sender],
        });
        client.pokemonBattlePlayerMap.set(sender,          from);
        client.pokemonBattlePlayerMap.set(data.challenger, from);

        let image = null;
        try {
            image = await utils.drawPokemonBattle({
                player1: { activePokemon: challengerParty[0], party: challengerParty },
                player2: { activePokemon: acceptorParty[0],   party: acceptorParty },
            });
        } catch { /* skip */ }

        const caption =
            `🌀 *Pokémon Battle Started!* 🌀\n\n` +
            `*@${data.challenger.split('@')[0]}* — ${utils.capitalize(challengerParty[0].name)} (Lv.${challengerParty[0].level}, HP: ${challengerParty[0].hp}/${challengerParty[0].maxHp})\n` +
            `*@${sender.split('@')[0]}* — ${utils.capitalize(acceptorParty[0].name)} (Lv.${acceptorParty[0].level}, HP: ${acceptorParty[0].hp}/${acceptorParty[0].maxHp})\n\n` +
            `*@${data.challenger.split('@')[0]}* goes first!`;

        const mentions = [data.challenger, sender];
        if (image) {
            await client.sendMessage(from, { image, caption, mentions });
        } else {
            await client.sendMessage(from, { text: caption, mentions });
        }

        return client.sendMessage(from, {
            text: `*@${data.challenger.split('@')[0]}*, it's your turn!\nTo fight: *!battle fight*\nTo switch: *!battle switch*\nTo forfeit: *!battle forfeit*`,
            mentions: [data.challenger],
        });
    }

    // ── Reject ────────────────────────────────────────────────────────────────
    if (sub === '--reject' || sub === '--r') {
        const data = pokemonChallengeResponse.get(from);
        if (!data || data.challengee !== sender)
            return client.sendMessage(from, { text: '❌ No challenge for you to reject.' }, { quoted: msg });
        pokemonChallengeResponse.delete(from);
        return client.sendMessage(from, {
            text: `*@${sender.split('@')[0]}* rejected *@${data.challenger.split('@')[0]}*'s challenge.`,
            mentions: [sender, data.challenger],
        });
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    if (sub === '--cancel' || sub === '--c') {
        const data = pokemonChallengeResponse.get(from);
        if (!data || data.challenger !== sender)
            return client.sendMessage(from, { text: "❌ You don't have an active challenge to cancel." }, { quoted: msg });
        pokemonChallengeResponse.delete(from);
        return client.sendMessage(from, { text: '✅ Your challenge was cancelled.' }, { quoted: msg });
    }

    // ── New challenge ─────────────────────────────────────────────────────────
    if (client.pokemonBattleResponse.has(from))
        return client.sendMessage(from, { text: '❌ A battle is already ongoing in this group.' }, { quoted: msg });

    // Find mentioned user
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
        || msg.message?.conversation?.match(/@\d+/g)?.map(n => n.slice(1) + '@s.whatsapp.net')
        || [];
    const opponentJid = mentions[0];

    if (!opponentJid || opponentJid === sender)
        return client.sendMessage(from, { text: '❌ Tag a player to challenge.\nExample: *!challenge @user*' }, { quoted: msg });

    if (client.pokemonBattlePlayerMap.has(opponentJid))
        return client.sendMessage(from, {
            text: `❌ *@${opponentJid.split('@')[0]}* is already in a battle.`,
            mentions: [opponentJid],
        }, { quoted: msg });

    const myParty  = (client.poke.get(`${sender}_Party`)      || []).filter(p => p.hp > 0);
    const oppParty = (client.poke.get(`${opponentJid}_Party`) || []).filter(p => p.hp > 0);

    if (!myParty.length)
        return client.sendMessage(from, { text: "❌ You don't have any healthy Pokémon to battle!" }, { quoted: msg });
    if (!oppParty.length)
        return client.sendMessage(from, {
            text: `❌ *@${opponentJid.split('@')[0]}* doesn't have healthy Pokémon.`,
            mentions: [opponentJid],
        }, { quoted: msg });

    pokemonChallengeResponse.set(from, { challenger: sender, challengee: opponentJid });

    await client.sendMessage(from, {
        text:
            `⚔️ *@${sender.split('@')[0]}* challenges *@${opponentJid.split('@')[0]}* to a Pokémon battle!\n\n` +
            `${utils.capitalize(myParty[0].name)} Lv.${myParty[0].level} vs ???\n\n` +
            `*@${opponentJid.split('@')[0]}*: Reply *!challenge --accept* or *!challenge --reject*\n` +
            `*(Expires in 6 minutes if ignored)*`,
        mentions: [sender, opponentJid],
    }, { quoted: msg });

    // Auto-expire
    setTimeout(() => {
        if (pokemonChallengeResponse.has(from) && pokemonChallengeResponse.get(from).challenger === sender) {
            pokemonChallengeResponse.delete(from);
            client.sendMessage(from, {
                text: `⏰ *@${sender.split('@')[0]}*'s challenge expired.`,
                mentions: [sender],
            }).catch(() => {});
        }
    }, 6 * 60 * 1000);
};
