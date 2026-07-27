const { Sets } = require('@pkmn/sets');
const { Screens } = require('pkmn-screens');
const { summaryScreen, partyScreen } = require('@shineiichijo/team-preview');

module.exports = {
    name: "party",
    aliases: ["party"],
    exp: 5,
    cool: 5,
    react: "🟩",
    category: "pokemon",
    usage: 'Use :party',
    description: "View your caught Pokémon in your party",
    async execute(client, arg, M) {
        try {
            const party = await client.poke.get(`${M.sender}_Party`) || [];
            if (party.length === 0) {
                return M.reply("📭 Your Pokémon party is empty!");
            }

            if (arg) {
                const index = parseInt(arg);
                if (isNaN(index) || index <= 0 || index > party.length) {
                    return M.reply("Invalid index. Please provide a valid index within your party range.");
                }
                const pokemon = party[index - 1];

                const image = await client.utils.getBuffer(pokemon.image);
                const k = pokemon.level + 1;
                const required = await client.utils.getExpByLevel(k);
                let text = `🟩 *Name:* ${client.utils.capitalize(pokemon.name)} (${pokemon.tag})\n\n🌿 *Gender:* ${
                    pokemon.female ? 'Female' : 'Male'
                }\n\n🟧 *Types:* ${pokemon.types.map(client.utils.capitalize).join(', ')}\n\n🟨 *Level:* ${
                    pokemon.level
                }\n\n🟦 *XP:* ${pokemon.displayExp} / ${required}\n\n♻ *State:* ${
                    pokemon.hp <= 0
                        ? 'Fainted'
                        : pokemon.state.status === ''
                        ? 'Fine'
                        : client.utils.capitalize(pokemon.state.status)
                }\n\n🟢 *HP:* ${pokemon.hp} / ${pokemon.maxHp}\n\n⬜ *Speed:* ${pokemon.speed} / ${
                    pokemon.maxSpeed
                }\n\n🛡 *Defense:* ${pokemon.defense} / ${pokemon.maxDefense}\n\n🟥 *Attack:* ${pokemon.attack} / ${
                    pokemon.maxAttack
                }\n\n⬛ *Moves:* ${pokemon.moves
                    .map(x => x.name.split('-').map(client.utils.capitalize).join(' '))
                    .join(', ')}\n\n*[Use ${client.prefix}party ${
                    index
                } --moves to see all of the moves of the pokemon with details]*`;

                await client.sendMessage(M.from, {
                    image: image,
                    caption: text
                });

                if (arg.includes('--moves')) {
                    const moves = pokemon.moves.map(move => ({
                        name: move.name,
                        pp: move.pp,
                        maxPp: move.maxPp,
                        type: move.type
                    }));

                    const summaryGif = await summaryScreen({
                        pokemon: { name: pokemon.name, moves, level: pokemon.level, female: pokemon.female },
                        pokeball: 'pokeball'
                    });
                    const buffer1 = await client.utils.gifToMp4(summaryGif);

                    let movesText = `*Moves | ${client.utils.capitalize(pokemon.name)}*`;
                    for (let i = 0; i < pokemon.moves.length; i++) {
                        movesText += `\n\n*#${i + 1}*\n❓ *Move:* ${pokemon.moves[i].name
                            .split('-')
                            .map(client.utils.capitalize)
                            .join(' ')}\n〽 *PP:* ${pokemon.moves[i].pp} / ${pokemon.moves[i].maxPp}\n🎗 *Type:* ${
                            client.utils.capitalize(pokemon.moves[i].type)
                        }\n🎃 *Power:* ${pokemon.moves[i].power}\n🎐 *Accuracy:* ${pokemon.moves[i].accuracy}\n🧧 *Description:* ${pokemon.moves[i].description}`;
                    }
                    await client.sendMessage(
                        M.from,
                        {
                            video: buffer1,
                            caption: movesText,
                            gifPlayback: true,
                            quoted: M
                        }
                    );
                }
            } else {
                let text = `⚗ *Party*\n\n🎴 *ID:*\n\t🏮 *Username:* ${M.pushName}`;

                const data = party.map((x, y) => ({
                    name: x.name,
                    hp: x.hp,
                    maxHp: x.maxHp,
                    female: x.female,
                    level: x.level
                }));
                party.forEach((x, y) => {
                    text += `\n\n*#${y + 1}*\n🎈 *Name:* ${client.utils.capitalize(x.name)}\n🔮 *Level:* ${
                        x.level
                    }\n🪄 *XP:* ${x.displayExp}`;
                });
                const partyGif = await partyScreen(data);
                const buffer = await client.utils.gifToMp4(partyGif);
                text += `\n\n*[Use ${client.prefix}party <index_number> to see the stats of a pokemon in your party]*`;

                await client.sendMessage(
                    M.from,
                    {
                        video: buffer,
                        caption: text,
                        gifPlayback: true,
                        quoted: M
                    }
                );
            }
        } catch (err) {
            console.error(err);
            await client.sendMessage(M.from, {
                text: "An error occurred while retrieving your Pokémon party."
            });
        }
    },
};
