const axios = require('axios');

module.exports = {
    name: "pokemon",
    aliases: ["pokemon"],
    category: "pokemon",
    description: "Get details of a Pokémon by providing its National Pokédex number.",
    async execute(client, arg, M) {
        try {
            const args = arg.split(" ");
            if (!args[0]) {
                return M.reply("Please provide a National Pokédex number.");
            }
            
            const term = args[0].toLowerCase();
            const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${term}`);
            const res = response.data;

            const party = await client.poke.get(`${M.sender}_Party`) || [];
            const pc = await client.poke.get(`${M.sender}_PSS`) || [];
            const pokemons = [...pc, ...party];
            const ownedAtParty = party.flatMap((x, y) => (x.name === res.name ? y : []));
            const ownedAtPc = pc.flatMap((x, y) => (x.name === res.name ? y : []));
            const owned = pokemons.filter((pokemon) => pokemon.name === res.name);

            const text = `🎈 *Name:* ${client.utils.capitalize(res.name)}\n\n🧧 *Pokedex ID:* ${res.id}\n\n🎗 *${res.types.length > 1 ? 'Types' : 'Type'}:* ${res.types.map((type) => `${client.utils.capitalize(type.type.name)}`).join(', ')}\n\n🎏 *${res.abilities.length > 1 ? 'Abilities' : 'Ability'}:* ${res.abilities.map((ability) => `${client.utils.capitalize(ability.ability.name)}`).join(', ')}\n\n🎐 *Owned:* ${owned.length}\n\n⚗ *Party:* ${ownedAtParty.length < 1 ? 'None' : ownedAtParty.map((x) => x + 1).join(', ')}\n\n💻 *Pc:* ${ownedAtPc.length < 1 ? 'None' : ownedAtPc.map((index) => index + 1).join(', ')}`;

            const imageBuffer = await client.utils.getBuffer(res.sprites.other['official-artwork'].front_default);

            await client.sendMessage(M.from, {
                image: imageBuffer,
                caption: text
            });
        } catch (err) {
            console.error(err);
            await M.reply("An error occurred while fetching the Pokémon details.");
        }
    }
};
