'use strict';

/**
 * !fight <number> — Execute a move in an active PVE session.
 * Works with the pve.js session store.
 */

const utils   = require('../utils');
const { pveSessions, sessionKey } = require('./pve');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = async function fightHandler({ client, msg, from, sender, args, isGroup }) {
    if (!isGroup)
        return client.sendMessage(from, { text: '❌ Battles only happen in group chats.' }, { quoted: msg });

    const key     = sessionKey(from, sender);
    const session = pveSessions.get(key);

    if (!session)
        return client.sendMessage(from, { text: "❌ You don't have an active PVE battle. Use *!pve* to start one." }, { quoted: msg });

    const { player, wild } = session;

    const moveNum = parseInt(args[0], 10) - 1;
    if (isNaN(moveNum) || moveNum < 0) {
        // Show available moves
        let text = `📋 *${utils.capitalize(player.name)}\'s Moves:*\n`;
        player.moves.forEach((m, i) => {
            text += `\n*#${i + 1}* ${m.name.split('-').map(utils.capitalize).join(' ')}\n〽 PP: ${m.pp}/${m.maxPp} | 🎗 Type: ${utils.capitalize(m.type)} | 🎃 Power: ${m.power} | 🎐 Acc: ${m.accuracy}`;
        });
        text += '\n\nUse *!fight <number>* to attack.';
        return client.sendMessage(from, { text }, { quoted: msg });
    }

    if (moveNum >= player.moves.length)
        return client.sendMessage(from, { text: `❌ Invalid move number. You have ${player.moves.length} moves.` }, { quoted: msg });

    const move = player.moves[moveNum];
    if (move.pp <= 0)
        return client.sendMessage(from, { text: `❌ *${move.name.split('-').map(utils.capitalize).join(' ')}* has no PP left!` }, { quoted: msg });

    move.pp -= 1;

    // ── Player attacks wild ───────────────────────────────────────────────────
    const moveLanded = move.accuracy === 100 || Math.floor(Math.random() * 100) < move.accuracy;
    const moveName   = move.name.split('-').map(utils.capitalize).join(' ');

    await client.sendMessage(from, {
        text: `⚔️ *${utils.capitalize(player.name)}* used *${moveName}*!`,
    }, { quoted: msg });
    await delay(2000);

    let playerDmg = 0;
    if (moveLanded) {
        const typesData = await Promise.all(wild.types.map(t => utils.getPokemonWeaknessAndStrongTypes(t)));
        const weakness  = typesData.flatMap(d => d.weakness);
        const strong    = typesData.flatMap(d => d.strong);

        let effect = ((player.attack - wild.defense) / 50) * move.power + Math.floor(Math.random() * 15);
        let effectiveness = '';
        if (weakness.includes(move.type)) effectiveness = 's';
        if (strong.includes(move.type) || wild.types.includes(move.type)) effectiveness = 'w';
        if (move.type === 'normal') effectiveness = '';

        if (effectiveness === 'w') effect = Math.floor(Math.random() * effect);
        if (effectiveness === 's') effect *= 2;
        playerDmg = Math.max(Math.floor((move.power + effect) / 2.5), 5);

        if (effectiveness !== '') {
            await client.sendMessage(from, { text: `It's ${effectiveness === 's' ? 'super' : 'not'} effective!` });
            await delay(1000);
        }

        wild.hp = Math.max(0, wild.hp - playerDmg);
        await client.sendMessage(from, {
            text: `💥 Dealt *${playerDmg}* damage!\n🌿 ${utils.capitalize(wild.name)} HP: *${wild.hp}/${wild.maxHp}*`,
        });
        await delay(2000);
    } else {
        await client.sendMessage(from, { text: `😤 *${utils.capitalize(player.name)}* missed!` });
        await delay(2000);
    }

    // ── Wild fainted ──────────────────────────────────────────────────────────
    if (wild.hp <= 0) {
        pveSessions.delete(key);

        const expGain = Math.round(wild.exp / 5);
        player.exp        += expGain;
        player.displayExp += expGain;

        const newLevel = utils.getLevelByExp(player.exp);
        const leveledUp = newLevel > player.level;
        if (leveledUp) {
            player.level      = newLevel;
            player.displayExp = player.exp - utils.calculatePokeExp(newLevel);
        }

        const party = client.poke.get(`${sender}_Party`) || [];
        const idx   = party.findIndex(p => p.tag === player.tag);
        if (idx >= 0) { party[idx] = player; client.poke.set(`${sender}_Party`, party); }

        let endText =
            `🎉 *${utils.capitalize(wild.name)}* fainted! You won!\n\n` +
            `✨ *${utils.capitalize(player.name)}* gained *${expGain} XP*!`;

        await client.sendMessage(from, { text: endText });

        if (leveledUp) {
            await delay(2000);
            const M = { from, sender };
            utils.handlePokemonStats(client, M, player, false, 'player1', sender);
        }
        return;
    }

    // ── Wild attacks player ───────────────────────────────────────────────────
    if (!wild.moves.length) {
        session.wild = wild;
        pveSessions.set(key, session);
        return client.sendMessage(from, {
            text: `Wild ${utils.capitalize(wild.name)} has no moves and skips its turn.\n❤️ Your ${utils.capitalize(player.name)} HP: *${player.hp}/${player.maxHp}*`,
        });
    }

    const wildMove = wild.moves[Math.floor(Math.random() * wild.moves.length)];
    const wMoveName = wildMove.name.split('-').map(utils.capitalize).join(' ');

    await client.sendMessage(from, {
        text: `🌿 *${utils.capitalize(wild.name)}* used *${wMoveName}*!`,
    });
    await delay(2000);

    const wLanded = wildMove.accuracy === 100 || Math.floor(Math.random() * 100) < wildMove.accuracy;
    if (wLanded) {
        const typesData = await Promise.all(player.types?.map?.(t => utils.getPokemonWeaknessAndStrongTypes(t)) || []);
        const weakness  = typesData.flatMap(d => d.weakness);
        const strong    = typesData.flatMap(d => d.strong);

        let effect = ((wild.attack - player.defense) / 50) * wildMove.power + Math.floor(Math.random() * 10);
        if (weakness.includes(wildMove.type)) effect *= 2;
        if (strong.includes(wildMove.type) || (player.types || []).includes(wildMove.type)) effect = Math.floor(Math.random() * effect);
        const wildDmg = Math.max(Math.floor((wildMove.power + effect) / 2.5), 5);

        player.hp = Math.max(0, player.hp - wildDmg);
        await client.sendMessage(from, {
            text: `💥 Wild ${utils.capitalize(wild.name)} dealt *${wildDmg}* damage!\n❤️ Your ${utils.capitalize(player.name)} HP: *${player.hp}/${player.maxHp}*`,
        });
    } else {
        await client.sendMessage(from, { text: `${utils.capitalize(wild.name)} missed!` });
    }

    // ── Player fainted ────────────────────────────────────────────────────────
    if (player.hp <= 0) {
        pveSessions.delete(key);
        const party = client.poke.get(`${sender}_Party`) || [];
        const idx   = party.findIndex(p => p.tag === player.tag);
        if (idx >= 0) { party[idx].hp = 0; client.poke.set(`${sender}_Party`, party); }

        return client.sendMessage(from, {
            text:
                `💀 *${utils.capitalize(player.name)}* fainted! You lost!\n\n` +
                `Use *!heal* to restore your team, then *!pve* to try again.\n` +
                `Wild *${utils.capitalize(wild.name)}* ran away…`,
        });
    }

    // ── Continue ──────────────────────────────────────────────────────────────
    session.wild   = wild;
    session.player = player;
    pveSessions.set(key, session);

    // Sync HP to party
    const party = client.poke.get(`${sender}_Party`) || [];
    const idx   = party.findIndex(p => p.tag === player.tag);
    if (idx >= 0) { party[idx] = player; client.poke.set(`${sender}_Party`, party); }

    const movesPreview = player.moves.map((m, i) => `${i + 1}. ${m.name.split('-').map(utils.capitalize).join(' ')} (PP: ${m.pp}/${m.maxPp})`).join('\n');
    await client.sendMessage(from, {
        text:
            `🌿 ${utils.capitalize(wild.name)} HP: *${wild.hp}/${wild.maxHp}*\n` +
            `❤️ Your ${utils.capitalize(player.name)} HP: *${player.hp}/${player.maxHp}*\n\n` +
            `Your moves:\n${movesPreview}\n\n` +
            `Use *!fight <number>* to continue.`,
    });
};
