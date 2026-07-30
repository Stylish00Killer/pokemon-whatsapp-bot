'use strict';

/**
 * Battle engine — full port from eve-bot/src/Commands/Pokemons/battle.js
 * Manages PVP battle sessions via client.pokemonBattleResponse and
 * client.pokemonBattlePlayerMap (both set up in bot.js).
 *
 * Session shape stored in client.pokemonBattleResponse.get(groupJid):
 * {
 *   player1: { user, ready, move, activePokemon },
 *   player2: { user, ready, move, activePokemon },
 *   turn: 'player1'|'player2',
 *   players: [jid1, jid2]
 * }
 */

const utils = require('../utils');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── helpers ───────────────────────────────────────────────────────────────────

function reply(client, from, msg, text) {
    return client.sendMessage(from, { text }, { quoted: msg });
}

// ── fight sub-command ─────────────────────────────────────────────────────────

async function handleFight(client, msg, from, sender, args) {
    const cha = client.pokemonBattleResponse.get(from);
    if (!cha) return;

    const isTurn = sender === cha[cha.turn].user;
    if (!isTurn) return reply(client, from, msg, 'Not your turn');

    // No number → list moves
    const indexStr = args[0];
    const number   = parseInt(indexStr, 10) - 1;

    if (isNaN(number)) {
        let text = `*Moves | ${utils.capitalize(cha[cha.turn].activePokemon.name)}*`;
        cha[cha.turn].activePokemon.moves.forEach((move, i) => {
            text += `\n\n*#${i + 1}*\n❓ *Move:* ${move.name.split('-').map(utils.capitalize).join(' ')}\n〽 *PP:* ${move.pp} / ${move.maxPp}\n🎗 *Type:* ${utils.capitalize(move.type ?? 'Normal')}\n🎃 *Power:* ${move.power}\n🎐 *Accuracy:* ${move.accuracy}\n🧧 *Description:* ${move.description}\nUse *!battle fight ${i + 1}* to use this move.`;
        });
        return reply(client, from, msg, text);
    }

    if (number < 0 || number >= cha[cha.turn].activePokemon.moves.length)
        return reply(client, from, msg, 'Invalid move number.');

    const datA = client.pokemonBattleResponse.get(from);
    if (!datA) return;

    const pkmn = datA[datA.turn];
    if (pkmn.activePokemon.hp <= 0)
        return reply(client, from, msg, "You can't fight with a fainted Pokémon. Switch to another one.");
    if (pkmn.activePokemon.moves[number].pp <= 0)
        return reply(client, from, msg, "This move has run out of PP.");

    const move = pkmn.activePokemon.moves[number];
    pkmn.move  = move;
    pkmn.activePokemon.moves[number].pp -= 1;
    datA.turn  = datA.turn === 'player1' ? 'player2' : 'player1';
    client.pokemonBattleResponse.set(from, datA);

    const party = client.poke.get(`${sender}_Party`) || [];
    const idx   = party.findIndex(x => x.tag === pkmn.activePokemon.tag);
    if (idx >= 0) {
        party[idx].moves[number].pp -= 1;
        client.poke.set(`${sender}_Party`, party);
    }

    if (datA.turn === 'player2') return continueSelection(client, msg, from);
    return handleBattles(client, msg, from);
}

// ── forfeit sub-command ───────────────────────────────────────────────────────

async function handleForfeit(client, msg, from, sender) {
    const data = client.pokemonBattleResponse.get(from);
    if (!data || !data.players.includes(sender))
        return reply(client, from, msg, "You aren't in a battle here.");

    client.pokemonBattlePlayerMap.delete(data.player2.user);
    client.pokemonBattlePlayerMap.delete(data.player1.user);

    const loser  = sender;
    const winner = data.player1.user === sender ? data.player2.user : data.player1.user;

    // Atomic transaction — no race condition when two battles end concurrently.
    const gold = client.econ.atomicTransfer(winner, loser, (loserGems) => {
        const amount = loserGems > 5000 ? 4500 : loserGems >= 250 ? 250 : loserGems;
        return Math.floor(Math.random() * (amount || 1));
    });

    client.pokemonBattleResponse.delete(from);

    return client.sendMessage(from, {
        text: `🎉 Congrats! *@${winner.split('@')[0]}*, you won and got *${gold}* gold from *@${loser.split('@')[0]}* (forfeit).`,
        mentions: [loser, winner],
    });
}

// ── switch sub-command ────────────────────────────────────────────────────────

async function handleSwitch(client, msg, from, sender, args) {
    const c = client.pokemonBattleResponse.get(from);
    if (!c || !c.players.includes(sender)) return null;

    const isTurn = sender === c[c.turn].user;
    if (!isTurn) return reply(client, from, msg, 'Not your turn');

    const index = parseInt(args[0], 10) - 1;
    const Party = client.poke.get(`${sender}_Party`) || [];

    if (isNaN(index) || index < 0 || index >= Party.length || Party[index].hp <= 0)
        return reply(client, from, msg, "You can't send out a fainted Pokémon.");

    if (Party[index].tag === c[c.turn].activePokemon.tag)
        return reply(client, from, msg, `*${utils.capitalize(c[c.turn].activePokemon.name)}* is already in battle.`);

    const prevName = utils.capitalize(c[c.turn].activePokemon.name);
    const nextName = utils.capitalize(Party[index].name);
    const Text = `*@${sender.split('@')[0]}* ${c[c.turn].activePokemon.hp > 0 ? `withdrew *${prevName}* and` : ''} sent out *${nextName}*!`;

    if (c[c.turn].activePokemon.hp > 0) {
        c.turn         = c.turn === 'player1' ? 'player2' : 'player1';
        c[c.turn].move = 'skipped';
    } else {
        c.turn = 'player1';
    }

    c[c.turn].activePokemon = Party[index];
    client.pokemonBattleResponse.set(from, c);

    await client.sendMessage(from, { mentions: [sender], text: Text });
    return continueSelection(client, msg, from);
}

// ── pokemon sub-command ───────────────────────────────────────────────────────

async function handlePokemonSelection(client, msg, from, sender) {
    const ch = client.pokemonBattleResponse.get(from);
    if (!ch) return;
    const isTurn = sender === ch[ch.turn].user;
    if (!isTurn) return reply(client, from, msg, 'Not your turn');

    const party = client.poke.get(`${sender}_Party`) || [];
    let text = '';
    party.forEach((pkmn, i) => {
        text += `*#${i + 1}*\n🟩 *Pokémon:* ${utils.capitalize(pkmn.name)}\n🟨 *Level:* ${pkmn.level}\n♻ *State:* ${pkmn.hp <= 0 ? 'Fainted' : (pkmn.state?.status || 'Fine')}\n🟢 *HP:* ${pkmn.hp} / ${pkmn.maxHp}\n🟧 *Types:* ${pkmn.types.map(utils.capitalize).join(', ')}\nUse *!battle switch ${i + 1}* to send out.\n\n`;
    });
    return reply(client, from, msg, text.trim());
}

// ── core battle resolution ────────────────────────────────────────────────────

const handleBattles = async (client, msg, from) => {
    try {
        const data = client.pokemonBattleResponse.get(from);
        if (!data) return;

        const { player1, player2 } = data;
        const arr = [player1, player2];

        // speed priority, then accuracy priority
        arr.sort((x, y) => y.activePokemon.speed - x.activePokemon.speed);
        if (arr[0].move !== 'skipped' && arr[1].move !== 'skipped' && arr[0].move !== '' && arr[1].move !== '') {
            arr.sort((x, y) => y.move.accuracy - x.move.accuracy);
        }

        for (let i = 0; i < 2; i++) {
            const current  = arr[i];
            const opponent = arr[i === 0 ? 1 : 0];
            if (current.activePokemon.hp <= 0) continue;

            const move = current.move;
            if (move === 'skipped') continue;

            // Status condition — sleep / paralysis skip turns
            if (['sleeping', 'paralysis'].includes(current.activePokemon.state?.status)) {
                if (current.activePokemon.state.movesUsed > 0) {
                    const trainerKey   = current.user === player1.user ? 'player1' : 'player2';
                    const trainerParty = client.poke.get(`${data[trainerKey].user}_Party`) || [];
                    current.activePokemon.state.movesUsed -= 1;

                    if (current.activePokemon.state.movesUsed < 1) {
                        current.activePokemon.state.status = '';
                        await client.sendMessage(from, {
                            mentions: [current.user],
                            text: `*@${current.user.split('@')[0]}*'s *${utils.capitalize(current.activePokemon.name)}* is ${current.activePokemon.state.status === 'sleeping' ? 'awake now' : 'free from paralysis now'}`,
                        });
                        client.pokemonBattleResponse.set(from, data);
                        const pIdx = trainerParty.findIndex(p => p.tag === current.activePokemon.tag);
                        trainerParty[pIdx] = current.activePokemon;
                        client.poke.set(`${current.user}_Party`, trainerParty);
                    } else {
                        await client.sendMessage(from, {
                            mentions: [current.user],
                            text: current.activePokemon.state.status === 'sleeping'
                                ? `*@${current.user.split('@')[0]}*'s *${utils.capitalize(current.activePokemon.name)}* is fast asleep`
                                : `*@${current.user.split('@')[0]}*'s *${utils.capitalize(current.activePokemon.name)}* can't move — paralyzed!`,
                        });
                        await delay(3000);
                        client.pokemonBattleResponse.set(from, data);
                        continue;
                    }
                }
            }

            await client.sendMessage(from, {
                text: `*@${current.user.split('@')[0]}*'s *${utils.capitalize(current.activePokemon.name)}* used *${utils.capitalize(move.name.replace(/-/g, ' '))}* at *@${opponent.user.split('@')[0]}*'s *${utils.capitalize(opponent.activePokemon.name)}*`,
                mentions: [current.user],
            });
            await delay(5000);

            const moveLanded = move.accuracy === 100 || Math.floor(Math.random() * 100) < move.accuracy;

            if (moveLanded) {
                const party1 = client.poke.get(`${current.user}_Party`)  || [];
                const party2 = client.poke.get(`${opponent.user}_Party`) || [];
                const pokemon = current.activePokemon;
                const pkmn    = opponent.activePokemon;
                const p1Idx   = party1.findIndex(p => p.tag === pokemon.tag);
                const p2Idx   = party2.findIndex(p => p.tag === pkmn.tag);

                // Stat changes
                if (move.stat_change?.length && move.power <= 0) {
                    for (const { target, change } of move.stat_change) {
                        let text = `Due to *${utils.capitalize(move.name.replace(/-/g, ' '))}* by *@${current.user.split('@')[0]}*'s *${utils.capitalize(pokemon.name)}*,`;
                        if (change < 0) {
                            text += ` *${target.toUpperCase()}* of *@${opponent.user.split('@')[0]}*'s *${utils.capitalize(pkmn.name)}* fell by ${Math.abs(change)}`;
                            await client.sendMessage(from, { text, mentions: [opponent.user, current.user] });
                            pkmn[target] += change;
                        } else {
                            text += ` *${target.toUpperCase()}* of itself rose by ${change}`;
                            await client.sendMessage(from, { text, mentions: [current.user] });
                            pokemon[target] += change;
                        }
                        await delay(3000);
                        party1[p1Idx] = pokemon;
                        party2[p2Idx] = pkmn;
                        client.poke.set(`${current.user}_Party`,  party1);
                        client.poke.set(`${opponent.user}_Party`, party2);
                        client.pokemonBattleResponse.set(from, data);
                    }
                    if (move.power <= 0) continue;
                }

                // Drain / healing
                if (move.drain > 0 || move.healing > 0) {
                    if (move.drain > 0) {
                        const drain = Math.min(pkmn.hp, move.drain);
                        pkmn.hp    -= drain;
                        pokemon.hp += drain;
                        await client.sendMessage(from, {
                            text: `*@${current.user.split('@')[0]}*'s *${utils.capitalize(pokemon.name)}* drained *${drain} HP* from *@${opponent.user.split('@')[0]}*'s *${utils.capitalize(pkmn.name)}*`,
                            mentions: [current.user, opponent.user],
                        });
                    } else {
                        const heal  = Math.min(move.healing, pokemon.maxHp - pokemon.hp);
                        pokemon.hp += heal;
                        await client.sendMessage(from, {
                            text: `*@${current.user.split('@')[0]}*'s *${utils.capitalize(pokemon.name)}* restored *${heal} HP*`,
                            mentions: [current.user],
                        });
                    }
                    await delay(3000);
                    party1[p1Idx] = pokemon;
                    party2[p2Idx] = pkmn;
                    client.poke.set(`${current.user}_Party`,  party1);
                    client.poke.set(`${opponent.user}_Party`, party2);
                    client.pokemonBattleResponse.set(from, data);
                }

                // Status effects
                if (['sleep', 'paralysis', 'poison'].includes(move.effect)) {
                    if (pkmn.state?.status === (move.effect === 'sleep' ? 'sleeping' : move.effect === 'poison' ? 'poisoned' : 'paralyzed')) {
                        await client.sendMessage(from, {
                            text: `*@${opponent.user.split('@')[0]}*'s *${utils.capitalize(pkmn.name)}* is already ${pkmn.state.status}`,
                            mentions: [opponent.user],
                        });
                        await delay(5000);
                    } else {
                        if (!pkmn.state) pkmn.state = { status: '', movesUsed: 0 };
                        pkmn.state.status    = move.effect === 'sleep' ? 'sleeping' : move.effect === 'poison' ? 'poisoned' : 'paralyzed';
                        pkmn.state.movesUsed = 5;
                        party2[p2Idx] = pkmn;
                        client.poke.set(`${opponent.user}_Party`, party2);
                        client.pokemonBattleResponse.set(from, data);
                    }
                }

                // Damage calculation
                const typesData = await Promise.all(pkmn.types.map(t => utils.getPokemonWeaknessAndStrongTypes(t)));
                const weakness  = typesData.flatMap(d => d.weakness);
                const strong    = typesData.flatMap(d => d.strong);

                let effect = ((pokemon.attack - pkmn.defense) / 50) * move.power + Math.floor(Math.random() * 25);
                let effectiveness = '';
                if (weakness.includes(move.type)) effectiveness = 's';
                if (strong.includes(move.type) || pkmn.types.includes(move.type)) effectiveness = 'w';
                if (move.type === 'normal') effectiveness = '';

                if (effectiveness === 'w') effect = Math.floor(Math.random() * effect);
                if (effectiveness === 's') effect *= 2;

                const calcDmg = Math.max(Math.floor((move.power + effect) / 2.5), 5);

                if (effectiveness === 'w' || effectiveness === 's') {
                    await client.sendMessage(from, { text: `It's ${effectiveness === 'w' ? 'not ' : 'super '}effective!`, mentions: [current.user] });
                }

                // Clamp to 0 before storing — negative HP must never reach the DB.
                pkmn.hp = Math.max(0, pkmn.hp - calcDmg);
                await client.sendMessage(from, {
                    text: `*@${current.user.split('@')[0]}*'s *${utils.capitalize(pokemon.name)}* dealt *${calcDmg}* damage to *@${opponent.user.split('@')[0]}*'s *${utils.capitalize(pkmn.name)}*`,
                    mentions: [current.user, opponent.user],
                });
                await delay(3000);

                party1[p1Idx] = pokemon;
                party2[p2Idx] = pkmn;
                client.poke.set(`${current.user}_Party`,  party1);
                client.poke.set(`${opponent.user}_Party`, party2);

                if (pkmn.hp <= 0) {
                    pkmn.hp = 0;
                    await client.sendMessage(from, { text: `*@${opponent.user.split('@')[0]}*'s *${utils.capitalize(pkmn.name)}* fainted`, mentions: [opponent.user] });
                    await delay(5000);
                    data.turn = current.user === player1.user ? 'player2' : 'player1';
                    client.poke.set(`${opponent.user}_Party`, party2);
                    client.pokemonBattleResponse.set(from, data);

                    if (pokemon.level < 100) {
                        await handleBattleStats(client, msg, from, pkmn.exp, current.user, pokemon, opponent.user === player1.user ? 'player2' : 'player1');
                    }
                }
            } else {
                await client.sendMessage(from, {
                    text: `*@${current.user.split('@')[0]}*'s *${utils.capitalize(current.activePokemon.name)}* missed!`,
                    mentions: [current.user],
                });
            }
        }

        await continueSelection(client, msg, from);
    } catch (error) {
        console.error('[battle.handleBattles]', error);
    }
};

const continueSelection = async (client, msg, from) => {
    try {
        const data = client.pokemonBattleResponse.get(from);
        if (!data) return;

        const player1Party = client.poke.get(`${data.player1.user}_Party`) || [];
        const player2Party = client.poke.get(`${data.player2.user}_Party`) || [];

        // Try to render battle image
        let image;
        try {
            image = await utils.drawPokemonBattle({
                player1: { activePokemon: data.player1.activePokemon, party: player1Party },
                player2: { activePokemon: data.player2.activePokemon, party: player2Party },
            });
        } catch { image = null; }

        const currentUser = data[data.turn];
        const opponent    = data[data.turn === 'player1' ? 'player2' : 'player1'];

        // Apply poison damage
        const applyPoison = async (pokemon, userKey) => {
            if (pokemon.state?.status === 'poisoned' && pokemon.hp > 0) {
                const damage = Math.max(1, Math.floor(pokemon.hp * 0.1));
                pokemon.hp  -= damage;
                await client.sendMessage(from, { text: `*@${userKey.split('@')[0]}*'s *${utils.capitalize(pokemon.name)}* took *${damage} HP* from poisoning.`, mentions: [userKey] });
                client.pokemonBattleResponse.set(from, data);
                const partyData = client.poke.get(`${userKey}_Party`) || [];
                const pIdx = partyData.findIndex(p => p.tag === pokemon.tag);
                if (pIdx >= 0) { partyData[pIdx] = pokemon; client.poke.set(`${userKey}_Party`, partyData); }
            }
        };
        await applyPoison(currentUser.activePokemon, currentUser.user);
        await applyPoison(opponent.activePokemon, opponent.user);

        // Check faint states
        if (currentUser.activePokemon.hp <= 0) {
            const pData = client.poke.get(`${currentUser.user}_Party`) || [];
            if (!pData.some(p => p.hp > 0)) return endBattle(client, msg, from, opponent.user, currentUser.user);
            await client.sendMessage(from, { text: `*@${currentUser.user.split('@')[0]}*, send out another Pokémon!`, mentions: [currentUser.user] });
            return;
        }
        if (opponent.activePokemon.hp <= 0) {
            const pData = client.poke.get(`${opponent.user}_Party`) || [];
            if (!pData.some(p => p.hp > 0)) return endBattle(client, msg, from, currentUser.user, opponent.user);
            data.turn = data.turn === 'player1' ? 'player2' : 'player1';
            client.pokemonBattleResponse.set(from, data);
            await client.sendMessage(from, { text: `*@${opponent.user.split('@')[0]}*, send out another Pokémon!`, mentions: [opponent.user] });
            return;
        }

        const text = `To fight: *!battle fight*\nTo switch: *!battle switch*\nTo forfeit: *!battle forfeit*`;
        const payload = { text: `Use one of the options below *@${currentUser.user.split('@')[0]}*\n\n${text}`, mentions: [currentUser.user] };
        if (image) { payload.image = image; payload.jpegThumbnail = image.toString('base64'); }
        await client.sendMessage(from, payload);
    } catch (error) {
        console.error('[battle.continueSelection]', error);
    }
};

const endBattle = async (client, msg, from, winner, loser) => {
    try {
        const data = client.pokemonBattleResponse.get(from);
        if (!data) return;

        const p1Party = client.poke.get(`${data.player1.user}_Party`) || [];
        const p2Party = client.poke.get(`${data.player2.user}_Party`) || [];
        try {
            const image = await utils.drawPokemonBattle({
                player1: { activePokemon: data.player1.activePokemon, party: p1Party },
                player2: { activePokemon: data.player2.activePokemon, party: p2Party },
            });
            if (image) await client.sendMessage(from, { image });
        } catch { /* skip */ }

        await delay(3000);
        await client.sendMessage(from, { text: `*@${loser.split('@')[0]}* ran out of Pokémon!`, mentions: [loser] });

        setTimeout(async () => {
            const econWinner = await client.econ.findOne({ userId: winner });
            const econLoser  = await client.econ.findOne({ userId: loser });
            const wWallet    = econWinner ? econWinner.gem : 0;
            const amount     = wWallet > 5000 ? 4500 : wWallet >= 250 ? 250 : wWallet;
            const gold       = Math.floor(Math.random() * (amount || 50)) + 10;

            if (econWinner) { econWinner.gem += gold; await econWinner.save(); }
            if (econLoser)  { econLoser.gem  -= gold; await econLoser.save(); }

            client.pokemonBattleResponse.delete(from);
            client.pokemonBattlePlayerMap.delete(loser);
            client.pokemonBattlePlayerMap.delete(winner);

            await client.sendMessage(from, {
                text: `🎉 Congrats! *@${winner.split('@')[0]}*, you won and received *${gold}* gold from *@${loser.split('@')[0]}*!`,
                mentions: [winner, loser],
            });
        }, 5000);
    } catch (error) {
        console.error('[battle.endBattle]', error);
    }
};

const handleBattleStats = async (client, msg, from, exp, user, pkmn, player) => {
    try {
        const resultExp = Math.round(exp / 5);
        await client.sendMessage(from, {
            text: `*@${user.split('@')[0]}*'s *${utils.capitalize(pkmn.name)}* gained *${resultExp} XP*`,
            mentions: [user],
        });
        await delay(3000);

        pkmn.exp        += resultExp;
        pkmn.displayExp += resultExp;

        const newLevel = utils.getLevelByExp(pkmn.exp);
        if (newLevel > pkmn.level) {
            pkmn.level      = newLevel;
            pkmn.displayExp = pkmn.exp - utils.calculatePokeExp(newLevel);
            // M-shim for handlePokemonStats
            const M = { from, sender: user };
            // Await so stat updates and party writes complete before the caller
            // reads back the updated Pokémon from storage.
            await utils.handlePokemonStats(client, M, pkmn, true, player, user);
        }

        const data = client.pokemonBattleResponse.get(from);
        if (data && data[player].activePokemon.tag === pkmn.tag) {
            data[player].activePokemon = pkmn;
            client.pokemonBattleResponse.set(from, data);
        }

        const party = client.poke.get(`${user}_Party`) || [];
        const i     = party.findIndex(x => x.tag === pkmn.tag);
        if (i >= 0) { party[i] = pkmn; client.poke.set(`${user}_Party`, party); }
    } catch (e) {
        console.error('[battle.handleBattleStats]', e);
    }
};

// ── main exported handler ─────────────────────────────────────────────────────

module.exports = async function battleHandler({ client, msg, from, sender, args, isGroup }) {
    if (!isGroup) return client.sendMessage(from, { text: '❌ Battles can only happen in group chats.' }, { quoted: msg });

    const data = client.pokemonBattleResponse.get(from);
    if (!data || !data.players.includes(sender))
        return reply(client, from, msg, "You aren't in a battle here.");

    const action = args[0]?.toLowerCase();
    if (!action) return reply(client, from, msg, 'Usage: !battle fight|switch|forfeit|pokemon [index]');

    if (action === 'fight')   return handleFight(client, msg, from, sender, args.slice(1));
    if (action === 'forfeit') return handleForfeit(client, msg, from, sender);
    if (action === 'switch')  return handleSwitch(client, msg, from, sender, args.slice(1));
    if (action === 'pokemon') return handlePokemonSelection(client, msg, from, sender);
    return reply(client, from, msg, 'Invalid usage: !battle fight|switch|forfeit|pokemon');
};

// Export internals for challenge.js to use
module.exports.continueSelection = continueSelection;
module.exports.handleBattles     = handleBattles;
