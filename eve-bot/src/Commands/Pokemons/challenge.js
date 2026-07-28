const pokemonChallengeResponse = new Map();

module.exports = {
    name: "challenge",
    aliases: ["ch"],
    exp: 5,
    cool: 5,
    react: "🟩",
    category: "pokemon",
    usage: 'Use :party',
    description: "Challenge another trainer for a Pokemon battle",
    async execute(client, arg, M) {

        if (client.pokemonBattleResponse.has(M.from)) {
            return M.reply('A battle in this group is ongoing at the moment');
        }

        if (!arg.length) {
            const rawPartyData = await client.poke.get(`${M.sender}_Party`);
            const rawParty = rawPartyData ? rawPartyData : [];
            if (!rawParty || rawParty.length === 0) {
                return M.reply("You don't have any Pokemon in your party.");
            }

            const party = rawParty.filter((pkmn) => pkmn.hp > 0);
            if (party.length === 0) {
                return M.reply("You don't have any Pokemon capable of battling right now as all of them have fainted.");
            }

            const users = M.mentions ? [...M.mentions] : [];
            if (M.quoted && M.quoted.participant && !users.includes(M.quoted.participant)) {
                users.push(M.quoted.participant);
            }

            if (users.length === 0 || users[0] === M.sender) {
                return M.reply('Tag or quote a person to challenge for a match.');
            }

            const jid = users[0];
            if (client.pokemonBattlePlayerMap.has(jid)) {
                return M.reply(
                    `*@${jid.split('@')[0]}* is currently in a battle right now. You can't challenge them at the moment.`,
                    'text',
                    undefined,
                    undefined,
                    undefined,
                    [jid]
                );
            }

            const opponentPartyData = await client.poke.get(`${jid}_Party`);
            const opponentPartyRaw = opponentPartyData ? opponentPartyData : [];
            if (!opponentPartyRaw || opponentPartyRaw.length === 0) {
                return M.reply("The trainer you challenged doesn't have any active Pokemon.");
            }

            const opponentParty = opponentPartyRaw.filter((pkmn) => pkmn.hp > 0);
            if (opponentParty.length === 0) {
                return M.reply("The trainer you challenged doesn't have any active Pokemon capable of battling.");
            }

            pokemonChallengeResponse.set(M.from, {
                challenger: M.sender,
                challengee: jid
            });

            const text = `*@${M.sender.split('@')[0]}* has challenged *@${jid.split('@')[0]}* for a Pokemon battle. Use *${client.prefix}challenge --accept* to start this battle. Or you can use *${client.prefix}challenge --reject* to reject this challenge.`;
            await client.sendMessage(M.from, {
                text,
                mentions: [M.sender, jid],
                quoted: M
            });

            setTimeout(async () => {
                if (!pokemonChallengeResponse.has(M.from)) return null;
                pokemonChallengeResponse.delete(M.from);
                return M.reply("Challenge cancelled as the challenged user didn't respond.");
            }, 6 * 1000 * 60);
        } else {
          

            if (arg == '--accept' || arg == '--a') {
                const data = pokemonChallengeResponse.get(M.from);
                if (!data || data.challengee !== M.sender) {
                    return M.reply('No one challenged you for a Pokemon battle.');
                }

                pokemonChallengeResponse.delete(M.from);

                const acceptorPartyData = await client.poke.get(`${M.sender}_Party`);
                const acceptorPartyRaw = acceptorPartyData ? acceptorPartyData : [];
                if (!acceptorPartyRaw || acceptorPartyRaw.length === 0) {
                    return M.reply("🟥 *Pokemon challenge cancelled as you don't have any Pokemon capable of battling right now as all of them have fainted.*");
                }

                const acceptorParty = acceptorPartyRaw.filter((pkmn) => pkmn.hp > 0);
                if (acceptorParty.length === 0) {
                    return M.reply("🟥 *Pokemon challenge cancelled as you don't have any Pokemon capable of battling right now as all of them have fainted.*");
                }

                const challengerPartyData = await client.poke.get(`${data.challenger}_Party`);
                const challengerPartyRaw = challengerPartyData ? challengerPartyData : [];
                const challengerParty = (challengerPartyRaw || []).filter((pkmn) => pkmn.hp > 0);

                client.pokemonBattleResponse.set(M.from, {
                    player1: {
                        user: data.challenger,
                        ready: false,
                        move: '',
                        activePokemon: challengerParty[0]
                    },
                    player2: {
                        user: M.sender,
                        ready: false,
                        move: '',
                        activePokemon: acceptorParty[0]
                    },
                    turn: 'player1',
                    players: [data.challenger, M.sender]
                });

                client.pokemonBattlePlayerMap.set(M.sender, M.from);
                client.pokemonBattlePlayerMap.set(data.challenger, M.from);

                const image = await client.utils.drawPokemonBattle({
                    player1: { activePokemon: challengerParty[0], party: challengerParty },
                    player2: { activePokemon: acceptorParty[0], party: acceptorParty }
                });

                await client.sendMessage(M.from, {
                    image: image,
                    caption: `🌀 *Pokemon Battle Started!* 🌀\n\n*@${data.challenger.split('@')[0]} - ${client.utils.capitalize(challengerParty[0].name)} (HP: ${challengerParty[0].hp} / ${challengerParty[0].maxHp} | Level: ${challengerParty[0].level} | Moves: ${challengerParty[0].moves.length} | Type: ${client.utils.capitalize(challengerParty[0].types[0])})*\n\n*@${M.sender.split('@')[0]} - ${client.utils.capitalize(acceptorParty[0].name)} (HP: ${acceptorParty[0].hp} / ${acceptorParty[0].maxHp} | Level: ${acceptorParty[0].level} | Moves: ${acceptorParty[0].moves.length} | Type: ${client.utils.capitalize(acceptorParty[0].types[0])})*`,
                    mentions: [M.sender, data.challenger]
                });

                const text = `To fight use *${client.prefix}battle fight*\n\nTo switch pokemon use  *${client.prefix}battle switch*\n\nTo forfeit this battle use *${client.prefix}battle forfeit*`;
                return await client.sendMessage(M.from, {
                    text: `Use one of the options given below *@${data.challenger.split('@')[0]}*\n\n${text}`,
                    mentions: [data.challenger]
                });

            } else if (arg == '--reject' || arg == '--r') {
                const rejectData = pokemonChallengeResponse.get(M.from);
                if (!rejectData || rejectData.challengee !== M.sender) {
                    return M.reply('No one challenged you for a Pokemon battle.');
                }

                pokemonChallengeResponse.delete(M.from);
                return M.reply(
                    `You have rejected *@${rejectData.challenger.split('@')[0]}* challenge`,
                    'text',
                    undefined,
                    undefined,
                    undefined,
                    [rejectData.challenger]
                );

            } else if (arg == '--cancel' || arg == '--c') {
                const cancelData = pokemonChallengeResponse.get(M.from);
                if (!cancelData || cancelData.challenger !== M.sender) {
                    return M.reply("You didn't challenge anyone.");
                }

                pokemonChallengeResponse.delete(M.from);
                return M.reply('You cancelled your own challenge.');

            } else {
                return M.reply('Invalid Usage');
            }
        }
    }
};
