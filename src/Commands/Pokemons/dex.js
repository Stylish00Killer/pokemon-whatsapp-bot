module.exports = {
    name: "dex",
    aliases: ["dex"],
    exp: 5,
    cool: 4,
    react: "📚",
    category: "pokemon",
    usage: 'Use :dex',
    description: "View your total Pokémon caught by you",
    async execute(client, arg, M) {
        try {
            const pc = await client.poke.get(`${M.sender}_PSS`) || [];
            const party = await client.poke.get(`${M.sender}_Party`) || [];

            if (pc.length === 0 && party.length === 0) {
                return M.reply("📭 Your Pokémon collection is empty!");
            }

            let pushName = M.pushName.trim();
            if (pushName.split(' ').length === 1) {
                pushName = `${pushName} san`;
            }

            let pokemonList = pc.concat(party);
            let response = `*EVE Pokédex*\n⬛ *Username:* *${pushName}*\n🔑 TOTAL POKEMON: ${pokemonList.length}\n\n`;

            if (arg.includes('--sort')) {
                const sortedPokemon = {
                    '1-10': [],
                    '11-20': [],
                    '21-30': [],
                    '31-40': [],
                    '41-50': [],
                    '51-60': [],
                    '61-70': [],
                    '71-80': [],
                    '81-90': [],
                    '91-100': []
                };

                pokemonList.forEach(pokemon => {
                    if (pokemon.level <= 10) {
                        sortedPokemon['1-10'].push(pokemon);
                    } else if (pokemon.level <= 20) {
                        sortedPokemon['11-20'].push(pokemon);
                    } else if (pokemon.level <= 30) {
                        sortedPokemon['21-30'].push(pokemon);
                    } else if (pokemon.level <= 40) {
                        sortedPokemon['31-40'].push(pokemon);
                    } else if (pokemon.level <= 50) {
                        sortedPokemon['41-50'].push(pokemon);
                    } else if (pokemon.level <= 60) {
                        sortedPokemon['51-60'].push(pokemon);
                    } else if (pokemon.level <= 70) {
                        sortedPokemon['61-70'].push(pokemon);
                    } else if (pokemon.level <= 80) {
                        sortedPokemon['71-80'].push(pokemon);
                    } else if (pokemon.level <= 90) {
                        sortedPokemon['81-90'].push(pokemon);
                    } else {
                        sortedPokemon['91-100'].push(pokemon);
                    }
                });

                for (const range in sortedPokemon) {
                    if (sortedPokemon[range].length > 0) {
                        response += `\n🔢 *Level ${range}*\n`;
                        sortedPokemon[range].forEach((pokemon, index) => {
                            response += `${index + 1}) ${pokemon.name} (Level: ${pokemon.level})\n`;
                        });
                    }
                }
            } else {
                pokemonList.forEach((pokemon, index) => {
                    response += `${index + 1}) ${pokemon.name} (Level: ${pokemon.level})\n`;
                });
            }

            const _fs   = require('fs');
            const _path = require('path');
            const _vid  = _path.join(__dirname, '..', '..', '..', 'assets', 'Videos', 'pokemon.mp4');
            const _videoContent = _fs.existsSync(_vid)
                ? { video: _fs.readFileSync(_vid), gifPlayback: true, caption: response }
                : { text: response };

            await client.sendMessage(M.from, _videoContent, { quoted: M });
        } catch (err) {
            console.error(err);
            await client.sendMessage(M.from, {
                text: "An error occurred while retrieving your Pokémon collection."
            });
        }
    },
};
                    
