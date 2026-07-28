const axios = require('axios');

module.exports = {
    name: "catch",
    aliases: ["catch"],
    exp: 5,
    cool: 4,
    react: "✅",
    usage: 'Use :catch <name>',
    category: "pokemon",
    description: "Catch the spawned Pokémon",
    async execute(client, arg, M) {
        const context = arg;
        try {
            if (!client.pokemonResponse.has(M.from)) {
                return M.reply("🟥 *There aren't any wild pokemons to catch*");
            }

            const data = await client.pokemonResponse.get(M.from);
            if (!context) return M.reply('Provide the name of the pokemon, Baka!');
            
            const pokemon = context.trim().toLowerCase().split(' ')[0].trim();
            if (pokemon !== data.name.toLowerCase()) return M.reply('Wrong Pokemon');

            client.pokemonResponse.delete(M.from);

            let flag = false;
            let party = await client.poke.get(`${M.sender}_Party`) || [];
            let pc = await client.poke.get(`${M.sender}_PSS`) || [];
            const Text = `Well Done. You caught a Level ${data.level} ${client.utils.capitalize(data.name)}. ${
                party.length >= 6 ? 'It has been transferred to your PC' : ''
            }`;

            const filteredParty = party.filter((x) => x.hp > 0);
            if (party.length >= 1) flag = true;

            party.length >= 6 ? pc.push(data) : party.push(data);

            await client.poke.set(`${M.sender}_Party`, party);
            await client.poke.set(`${M.sender}_PSS`, pc);

            await M.reply(Text);

            if (!flag) return;
            if (!filteredParty.length) return;

            const index = party.findIndex((x) => x.tag === filteredParty[0].tag);
            const pkmn = party[index];
            if (pkmn.level >= 100) return;

            const resultExp = Math.round(data.exp / 8);
            pkmn.exp += resultExp;
            pkmn.displayExp += resultExp;

            // Determine new level from exp using local calculation
            const newLevel = client.utils.getLevelByExp(pkmn.exp);
            if (newLevel > pkmn.level) {
                pkmn.level      = newLevel;
                pkmn.displayExp = pkmn.exp - client.utils.calculatePokeExp(newLevel);
            }

            await client.utils.handlePokemonStats(
                client,
                M,
                pkmn,
                false, // inBattle flag set to false
                'player1', // player ID placeholder
                M.sender // user ID from M object
            );

            await client.poke.set(`${M.sender}_Party`, party);

        } catch (err) {
            console.error(err);
            await client.sendMessage(M.from, {
                image: { url: `${client.utils.errorChan()}` },
                caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`
            });
        }
    },
};
