'use strict';

// Battle command – fixed:
//   1. economy.coin → economy.gem (the field is called gem throughout)
//   2. client.econ.create() used where create was called
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const { get } = require('axios');

module.exports = {
    name: 'battle',
    aliases: ['bt'],
    exp: 5,
    cool: 5,
    react: '🟩',
    category: 'pokemon',
    usage: 'Use :battle fight|switch|forfeit|pokemon [index]',
    description: 'Fight in an ongoing Pokémon battle',
    async execute(client, arg, M) {
        const context = arg.trim().toLowerCase();
        const data    = client.pokemonBattleResponse.get(M.from);

        if (!data || !data.players.includes(M.sender))
            return M.reply("You aren't battling anyone here.");

        if (!context) return M.reply('Invalid Usage!');

        const [action, indexStr] = context.split(' ');
        const number             = parseInt(indexStr, 10) - 1;

        // ── fight ──────────────────────────────────────────────────────────────
        if (action === 'fight') {
            const cha = client.pokemonBattleResponse.get(M.from);
            if (!cha) return;

            const isTurn = M.sender === cha[cha.turn].user;
            if (!isTurn) return M.reply('Not your turn');

            if (isNaN(number)) {
                let texT = `*Moves | ${client.utils.capitalize(
                    cha[cha.turn].activePokemon.name
                )}*`;
                for (let i = 0; i < cha[cha.turn].activePokemon.moves.length; i++) {
                    const move = cha[cha.turn].activePokemon.moves[i];
                    texT += `\n\n*#${i + 1}*\n❓ *Move:* ${move.name
                        .split('-')
                        .map(client.utils.capitalize)
                        .join(' ')}\n〽 *PP:* ${move.pp} / ${move.maxPp}\n🎗 *Type:* ${client.utils.capitalize(
                        move.type ?? 'Normal'
                    )}\n🎃 *Power:* ${move.power}\n🎐 *Accuracy:* ${
                        move.accuracy
                    }\n🧧 *Description:* ${
                        move.description
                    }\nUse *${client.prefix}battle fight ${i + 1}* to use this move.`;
                }
                return M.reply(texT);
            }

            if (number < 0 || number >= cha[cha.turn].activePokemon.moves.length)
                return M.reply('Invalid move number.');

            const datA = client.pokemonBattleResponse.get(M.from);
            if (!datA) return;

            const pkmn = datA[datA.turn];
            if (pkmn.activePokemon.hp <= 0)
                return M.reply(
                    "You can't fight with a fainted Pokemon. Switch to another Pokemon."
                );
            if (pkmn.activePokemon.moves[number].pp <= 0)
                return M.reply(
                    "You can't use this move now as it has run out of PP."
                );

            const move = pkmn.activePokemon.moves[number];
            pkmn.move  = move;
            pkmn.activePokemon.moves[number].pp -= 1;
            datA.turn = datA.turn === 'player1' ? 'player2' : 'player1';
            client.pokemonBattleResponse.set(M.from, datA);

            const party = client.poke.get(`${M.sender}_Party`) || [];
            const idx   = party.findIndex(
                (x) => x.tag === pkmn.activePokemon.tag
            );
            if (idx >= 0) {
                party[idx].moves[number].pp -= 1;
                client.poke.set(`${M.sender}_Party`, party);
            }

            if (datA.turn === 'player2') return await continueSelection(client, M);
            return await handleBattles(client, M);

        // ── forfeit ────────────────────────────────────────────────────────────
        } else if (action === 'forfeit') {
            client.pokemonBattlePlayerMap.delete(data.player2.user);
            client.pokemonBattlePlayerMap.delete(data.player1.user);

            const loser  = M.sender;
            const winner =
                data.player1.user === M.sender
                    ? data.player2.user
                    : data.player1.user;

            // Fixed: gem (not coin)
            const econLoser  = await client.econ.findOne({ userId: loser });
            const econWinner = await client.econ.findOne({ userId: winner });

            const loserWallet  = econLoser  ? econLoser.gem  : 0;
            const amount       = loserWallet > 5000 ? 4500 : loserWallet >= 250 ? 250 : loserWallet;
            const gold         = Math.floor(Math.random() * amount);

            if (econLoser)  { econLoser.gem  -= gold; await econLoser.save(); }
            if (econWinner) { econWinner.gem += gold; await econWinner.save(); }

            client.pokemonBattleResponse.delete(M.from);

            return client.sendMessage(M.from, {
                text: `🎉 Congrats! *@${winner.split('@')[0]}*, you won this battle and got *${gold}* gold from *@${loser.split('@')[0]}* as they forfeited.`,
                mentions: [loser, winner],
            });

        // ── switch ─────────────────────────────────────────────────────────────
        } else if (action === 'switch') {
            const c = client.pokemonBattleResponse.get(M.from);
            if (!c || !c.players.includes(M.sender)) return null;

            const turn = M.sender === c[c.turn].user;
            if (!turn) return M.reply('Not your turn');

            const index = number;
            const Party = client.poke.get(`${M.sender}_Party`) || [];

            if (index < 0 || index >= Party.length || Party[index].hp <= 0)
                return M.reply(
                    "You can't send out a fainted Pokémon to battle."
                );
            if (
                Party[index].name === c[c.turn].activePokemon.name &&
                Party[index].rejectedMoves.length ===
                    c[c.turn].activePokemon.rejectedMoves.length
            )
                return M.reply(
                    `*${client.utils.capitalize(
                        c[c.turn].activePokemon.name
                    )}* is already out here.`
                );

            const Text = `*@${M.sender.split('@')[0]}* ${
                c[c.turn].activePokemon.hp > 0
                    ? `withdrew *${client.utils.capitalize(
                          c[c.turn].activePokemon.name
                      )}* from the battle and`
                    : ''
            } sent out *${client.utils.capitalize(Party[index].name)}* for the battle.`;

            if (c[c.turn].activePokemon.hp > 0) {
                c.turn             = c.turn === 'player1' ? 'player2' : 'player1';
                c[c.turn].move     = 'skipped';
            } else {
                c.turn = 'player1';
            }

            c[c.turn].activePokemon = Party[index];
            client.pokemonBattleResponse.set(M.from, c);

            await client.sendMessage(M.from, {
                mentions: [M.sender],
                text: Text,
            });
            return continueSelection(client, M);

        // ── pokemon ────────────────────────────────────────────────────────────
        } else if (action === 'pokemon') {
            return handlePokemonSelection(client, M);
        } else {
            return M.reply('Invalid Usage');
        }
    },
};

const handlePokemonSelection = async (client, M) => {
    try {
        const ch = client.pokemonBattleResponse.get(M.from);
        if (!ch) return;

        const isTurn = M.sender === ch[ch.turn].user;
        if (!isTurn) return M.reply('Not your turn');

        const party = client.poke.get(`${M.sender}_Party`) || [];
        let text    = '';

        for (let i = 0; i < party.length; i++) {
            const pkmn = party[i];
            text += `*#${i + 1}*\n🟩 *Pokémon:* ${client.utils.capitalize(
                pkmn.name
            )}\n🟨 *Level:* ${pkmn.level}\n♻ *State:* ${
                pkmn.hp <= 0
                    ? 'Fainted'
                    : pkmn.state?.status === ''
                    ? 'Fine'
                    : client.utils.capitalize(pkmn.state?.status)
            }\n🟢 *HP:* ${pkmn.hp} / ${pkmn.maxHp}\n🟧 *Types:* ${pkmn.types
                .map(client.utils.capitalize)
                .join(', ')}\nUse *${client.prefix}battle switch ${
                i + 1
            }* to send out this Pokémon.`;
            if (i < party.length - 1) text += '\n\n';
        }
        await M.reply(text);
    } catch (error) {
        console.error('[battle.handlePokemonSelection]', error);
    }
};

const handleBattles = async (client, M) => {
    try {
        const data = client.pokemonBattleResponse.get(M.from);
        if (!data) return;

        const { player1, player2 } = data;
        const arr = [player1, player2];

        arr.sort((x, y) => y.activePokemon.speed - x.activePokemon.speed);
        if (
            arr[0].move !== 'skipped' &&
            arr[1].move !== 'skipped' &&
            arr[0].move !== '' &&
            arr[1].move !== ''
        ) {
            arr.sort((x, y) => y.move.accuracy - x.move.accuracy);
        }

        for (let i = 0; i < 2; i++) {
            const current  = arr[i];
            const opponent = arr[i === 0 ? 1 : 0];

            if (current.activePokemon.hp <= 0) continue;

            const move = current.move;
            if (move === 'skipped') continue;

            let moveLanded =
                move.accuracy === 100 ||
                Math.floor(Math.random() * 100) < move.accuracy;

            // Status conditions
            if (
                ['sleeping', 'paralysis'].includes(
                    current.activePokemon.state?.status
                )
            ) {
                if (current.activePokemon.state.movesUsed > 0) {
                    const trainerKey =
                        current.user === player1.user ? 'player1' : 'player2';
                    const trainerParty =
                        client.poke.get(`${data[trainerKey].user}_Party`) || [];
                    current.activePokemon.state.movesUsed -= 1;

                    if (current.activePokemon.state.movesUsed < 1) {
                        await client.sendMessage(M.from, {
                            mentions: [current.user],
                            text: `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(
                                current.activePokemon.name
                            )}* is ${
                                current.activePokemon.state.status === 'sleeping'
                                    ? 'awake now'
                                    : 'free from paralysis now'
                            }`,
                        });
                        await delay(3000);
                        current.activePokemon.state.status = '';
                        client.pokemonBattleResponse.set(M.from, data);

                        const pIdx = trainerParty.findIndex(
                            (p) => p.tag === current.activePokemon.tag
                        );
                        trainerParty[pIdx] = current.activePokemon;
                        client.poke.set(
                            `${current.user}_Party`,
                            trainerParty
                        );
                    } else {
                        const statusMsg =
                            current.activePokemon.state.status === 'sleeping'
                                ? `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(current.activePokemon.name)}* is fast asleep`
                                : `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(current.activePokemon.name)}* can't move as it's paralyzed`;

                        await client.sendMessage(M.from, {
                            mentions: [current.user],
                            text: statusMsg,
                        });
                        await delay(3000);
                        client.pokemonBattleResponse.set(M.from, data);
                        continue;
                    }
                }
            }

            await client.sendMessage(M.from, {
                text: `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(
                    current.activePokemon.name
                )}* used *${client.utils.capitalize(
                    move.name.replace(/-/g, ' ')
                )}* at *${client.utils.capitalize(opponent.activePokemon.name)}*`,
                mentions: [current.user],
            });
            await delay(5000);

            if (moveLanded) {
                const party1  = client.poke.get(`${current.user}_Party`)  || [];
                const party2  = client.poke.get(`${opponent.user}_Party`) || [];
                const pokemon = current.activePokemon;
                const pkmn    = opponent.activePokemon;
                const p1Idx   = party1.findIndex((p) => p.tag === pokemon.tag);
                const p2Idx   = party2.findIndex((p) => p.tag === pkmn.tag);

                if (move.stat_change?.length && move.power <= 0) {
                    for (const { target, change } of move.stat_change) {
                        let text = `Due to *${client.utils.capitalize(
                            move.name.replace(/-/g, ' ')
                        )}* by *@${current.user.split('@')[0]}*'s *${client.utils.capitalize(pokemon.name)}*,`;
                        if (change < 0) {
                            text += ` *${target.toUpperCase()}* of *@${opponent.user.split('@')[0]}*'s *${client.utils.capitalize(pkmn.name)}* fell by ${Math.abs(change)}`;
                            await client.sendMessage(M.from, {
                                text,
                                mentions: [opponent.user, current.user],
                            });
                            await delay(3000);
                            pkmn[target] += change;
                        } else {
                            text += ` *${target.toUpperCase()}* of itself rose by ${change}`;
                            await client.sendMessage(M.from, {
                                text,
                                mentions: [current.user],
                            });
                            pokemon[target] += change;
                        }
                        party1[p1Idx] = pokemon;
                        party2[p2Idx] = pkmn;
                        client.poke.set(`${current.user}_Party`,  party1);
                        client.poke.set(`${opponent.user}_Party`, party2);
                        client.pokemonBattleResponse.set(M.from, data);
                    }
                    if (move.power <= 0) continue;
                }

                if (move.drain > 0 || move.healing > 0) {
                    if (move.drain > 0) {
                        const drain = Math.min(pkmn.hp, move.drain);
                        pkmn.hp    -= drain;
                        pokemon.hp += drain;
                        await client.sendMessage(M.from, {
                            text: `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(pokemon.name)}* drained *${drain} HP* from *@${opponent.user.split('@')[0]}*'s *${client.utils.capitalize(pkmn.name)}*`,
                            mentions: [current.user, opponent.user],
                        });
                    } else {
                        const heal  = Math.min(move.healing, pokemon.maxHp - pokemon.hp);
                        pokemon.hp += heal;
                        await client.sendMessage(M.from, {
                            text: `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(pokemon.name)}* restored *${heal} HP*`,
                            mentions: [current.user],
                        });
                    }
                    await delay(3000);
                    party1[p1Idx] = pokemon;
                    party2[p2Idx] = pkmn;
                    client.poke.set(`${current.user}_Party`,  party1);
                    client.poke.set(`${opponent.user}_Party`, party2);
                    client.pokemonBattleResponse.set(M.from, data);
                }

                if (['sleep', 'paralysis', 'poison'].includes(move.effect)) {
                    if (pkmn.state?.status === move.effect) {
                        await client.sendMessage(M.from, {
                            text: `*@${opponent.user.split('@')[0]}*'s *${client.utils.capitalize(pkmn.name)}* is already ${
                                move.effect === 'poison'
                                    ? 'Poisoned'
                                    : move.effect === 'sleep'
                                    ? 'Sleeping'
                                    : 'Paralyzed'
                            }`,
                            mentions: [opponent.user],
                        });
                        await delay(5000);
                    } else {
                        if (!pkmn.state) pkmn.state = { status: '', movesUsed: 0 };
                        pkmn.state.status    =
                            move.effect === 'sleep'
                                ? 'sleeping'
                                : move.effect === 'poison'
                                ? 'poisoned'
                                : 'paralyzed';
                        pkmn.state.movesUsed = 5;
                        party2[p2Idx]        = pkmn;
                        client.poke.set(`${opponent.user}_Party`, party2);
                        client.pokemonBattleResponse.set(M.from, data);
                    }
                }

                const attack    = pokemon.attack;
                const defense   = pkmn.defense;
                const typesData = await Promise.all(
                    pkmn.types.map((t) =>
                        client.utils.getPokemonWeaknessAndStrongTypes(t)
                    )
                );
                const weakness     = typesData.flatMap((d) => d.weakness);
                const strong       = typesData.flatMap((d) => d.strong);

                let effect        = ((attack - defense) / 50) * move.power + Math.floor(Math.random() * 25);
                let effectiveness = '';
                if (weakness.includes(move.type))  effectiveness = 's';
                if (strong.includes(move.type) || pkmn.types.includes(move.type)) effectiveness = 'w';
                if (move.type === 'normal') effectiveness = '';

                if (effectiveness === 'w') effect = Math.floor(Math.random() * effect);
                if (effectiveness === 's') effect *= 2;

                const calcDamage = Math.floor((move.power + effect) / 2.5);
                const result     = Math.max(calcDamage, 5);

                if (effectiveness === 'w' || effectiveness === 's') {
                    await client.sendMessage(M.from, {
                        text: `It's ${effectiveness === 'w' ? 'not' : 'super'} effective`,
                        mentions: [current.user],
                    });
                }

                pkmn.hp -= result;
                await client.sendMessage(M.from, {
                    text: `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(pokemon.name)}* dealt *${result}* damage to *@${opponent.user.split('@')[0]}*'s *${client.utils.capitalize(pkmn.name)}*`,
                    mentions: [current.user, opponent.user],
                });
                await delay(3000);

                party1[p1Idx] = pokemon;
                party2[p2Idx] = pkmn;
                client.poke.set(`${current.user}_Party`,  party1);
                client.poke.set(`${opponent.user}_Party`, party2);

                if (pkmn.hp <= 0) {
                    pkmn.hp = 0;
                    await client.sendMessage(M.from, {
                        text: `*@${opponent.user.split('@')[0]}*'s *${client.utils.capitalize(pkmn.name)}* fainted`,
                        mentions: [opponent.user],
                    });
                    await delay(5000);
                    data.turn =
                        current.user === player1.user ? 'player2' : 'player1';
                    client.poke.set(`${opponent.user}_Party`, party2);
                    client.pokemonBattleResponse.set(M.from, data);

                    if (pokemon.level < 100) {
                        await handleStats(
                            client,
                            M,
                            pkmn.exp,
                            current.user,
                            pokemon,
                            opponent.user === player1.user ? 'player2' : 'player1'
                        );
                    }
                }
            } else {
                await client.sendMessage(M.from, {
                    text: `*@${current.user.split('@')[0]}*'s *${client.utils.capitalize(
                        current.activePokemon.name
                    )}* missed the attack`,
                    mentions: [current.user],
                });
            }
        }

        await continueSelection(client, M);
    } catch (error) {
        console.error('[battle.handleBattles]', error);
    }
};

const continueSelection = async (client, M) => {
    try {
        const data = client.pokemonBattleResponse.get(M.from);
        if (!data) return;

        const player1Party = client.poke.get(`${data.player1.user}_Party`) || [];
        const player2Party = client.poke.get(`${data.player2.user}_Party`) || [];

        let image;
        try {
            image = await client.utils.drawPokemonBattle({
                player1: {
                    activePokemon: data.player1.activePokemon,
                    party:         player1Party,
                },
                player2: {
                    activePokemon: data.player2.activePokemon,
                    party:         player2Party,
                },
            });
        } catch { image = null; }

        const currentUser  = data[data.turn];
        const opponent     = data[data.turn === 'player1' ? 'player2' : 'player1'];
        const userPokemon  = currentUser.activePokemon;
        const opponentPokemon = opponent.activePokemon;

        const applyPoison = async (pokemon, userKey) => {
            if (pokemon.state?.status === 'poisoned' && pokemon.hp > 0) {
                const damage = Math.max(1, Math.floor(pokemon.hp * 0.1));
                pokemon.hp  -= damage;
                await client.sendMessage(M.from, {
                    text: `*@${userKey.split('@')[0]}*'s *${client.utils.capitalize(
                        pokemon.name
                    )}* took *${damage} HP* from poisoning.`,
                    mentions: [userKey],
                });
                client.pokemonBattleResponse.set(M.from, data);
                const partyData = client.poke.get(`${userKey}_Party`) || [];
                const pIdx      = partyData.findIndex((p) => p.tag === pokemon.tag);
                if (pIdx >= 0) {
                    partyData[pIdx] = pokemon;
                    client.poke.set(`${userKey}_Party`, partyData);
                }
            }
        };

        await applyPoison(userPokemon,      currentUser.user);
        await applyPoison(opponentPokemon,  opponent.user);

        if (userPokemon.hp <= 0) {
            const playerData  = client.poke.get(`${currentUser.user}_Party`) || [];
            const alivePkmn   = playerData.filter((p) => p.hp > 0);
            if (alivePkmn.length === 0)
                return endBattle(client, M, opponent.user, currentUser.user);

            await client.sendMessage(M.from, {
                text: `*@${currentUser.user.split('@')[0]}*, send out a Pokémon from your party.`,
                mentions: [currentUser.user],
            });
            const orig = M.sender;
            M.sender   = currentUser.user;
            await handlePokemonSelection(client, M);
            M.sender = orig;
            return;
        }

        if (opponentPokemon.hp <= 0) {
            const oppData   = client.poke.get(`${opponent.user}_Party`) || [];
            const alivePkmn = oppData.filter((p) => p.hp > 0);
            if (alivePkmn.length === 0)
                return endBattle(client, M, currentUser.user, opponent.user);

            await client.sendMessage(M.from, {
                text: `*@${opponent.user.split('@')[0]}*, send out a Pokémon from your party.`,
                mentions: [opponent.user],
            });
            data.turn = data.turn === 'player1' ? 'player2' : 'player1';
            client.pokemonBattleResponse.set(M.from, data);

            const orig = M.sender;
            M.sender   = opponent.user;
            await handlePokemonSelection(client, M);
            M.sender = orig;
            return;
        }

        const text = `To fight: *${client.prefix}battle fight*\nTo switch: *${client.prefix}battle switch*\nTo forfeit: *${client.prefix}battle forfeit*`;
        const msgPayload = {
            text: `Use one of the options below *@${currentUser.user.split('@')[0]}*\n\n${text}`,
            mentions: [currentUser.user],
        };
        if (image) {
            msgPayload.image           = image;
            msgPayload.jpegThumbnail   = image.toString('base64');
        }
        await client.sendMessage(M.from, msgPayload);
    } catch (error) {
        console.error('[battle.continueSelection]', error);
    }
};

const endBattle = async (client, M, winner, loser) => {
    try {
        const data = client.pokemonBattleResponse.get(M.from);
        if (!data) return;

        const player1Party = client.poke.get(`${data.player1.user}_Party`) || [];
        const player2Party = client.poke.get(`${data.player2.user}_Party`) || [];

        try {
            const image = await client.utils.drawPokemonBattle({
                player1: { activePokemon: data.player1.activePokemon, party: player1Party },
                player2: { activePokemon: data.player2.activePokemon, party: player2Party },
            });
            await client.sendMessage(M.from, { image });
        } catch { /* skip if image fails */ }

        await delay(3000);
        await client.sendMessage(M.from, {
            text: `*@${loser.split('@')[0]}* ran out of Pokémon for battle.`,
            mentions: [loser],
        });

        setTimeout(async () => {
            // Fixed: gem (not coin)
            const econWinner = await client.econ.findOne({ userId: winner });
            const econLoser  = await client.econ.findOne({ userId: loser });

            const wWallet = econWinner ? econWinner.gem : 0;
            const amount  = wWallet > 5000 ? 4500 : wWallet >= 250 ? 250 : wWallet;
            const gold    = Math.floor(Math.random() * amount);

            if (econWinner) { econWinner.gem += gold; await econWinner.save(); }
            if (econLoser)  { econLoser.gem  -= gold; await econLoser.save(); }

            client.pokemonBattleResponse.delete(M.from);
            client.pokemonBattlePlayerMap.delete(loser);
            client.pokemonBattlePlayerMap.delete(winner);

            await client.sendMessage(M.from, {
                text: `🎉 Congrats! *@${winner.split('@')[0]}*, you won and received *${gold}* gold from *@${loser.split('@')[0]}*!`,
                mentions: [winner, loser],
            });
        }, 5000);
    } catch (error) {
        console.error('[battle.endBattle]', error);
    }
};

const handleStats = async (client, M, exp, user, pkmn, player) => {
    try {
        const resultExp = Math.round(exp / 5);
        await client.sendMessage(M.from, {
            text: `*@${user.split('@')[0]}*'s *${client.utils.capitalize(
                pkmn.name
            )}* gained *${resultExp} XP*`,
            mentions: [user],
        });
        await delay(3000);

        pkmn.exp        += resultExp;
        pkmn.displayExp += resultExp;

        try {
            // Use local exp calculation — no external API needed
            const newLevel = client.utils.getLevelByExp(pkmn.exp);
            if (newLevel > pkmn.level) {
                pkmn.level      = newLevel;
                pkmn.displayExp = pkmn.exp - client.utils.calculatePokeExp(newLevel);
                client.utils.handlePokemonStats(client, M, pkmn, true, player, user);
            }
        } catch { /* ignore level errors */ }

        const data = client.pokemonBattleResponse.get(M.from);
        if (data && data[player].activePokemon.tag === pkmn.tag) {
            data[player].activePokemon = pkmn;
            client.pokemonBattleResponse.set(M.from, data);
        }

        const party = client.poke.get(`${user}_Party`) || [];
        const i     = party.findIndex((x) => x.tag === pkmn.tag);
        if (i >= 0) {
            party[i] = pkmn;
            client.poke.set(`${user}_Party`, party);
        }
    } catch (error) {
        console.error('[battle.handleStats]', error);
    }
};
