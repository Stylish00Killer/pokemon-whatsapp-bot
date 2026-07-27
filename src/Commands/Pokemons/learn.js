module.exports = {
    name: "learn",
    aliases: ["learn"],
    exp: 5,
    cool: 5,
    react: "🟩",
    category: "pokemon",
    usage: 'Use :party',
    description: "Learn or replace a move for your Pokémon in your party",
    async execute(client, arg, M) {
        try {
            const flags = arg.split(' ');
            const Data = await client.pokemonMoveLearningResponse.get(`${M.from}${M.sender}`);
            
            if (!flags.length || !Data) {
                return M.reply(!Data ? `You can't use this command yet.` : 'Invalid usage');
            }
            
            let party = await client.poke.get(`${M.sender}_Party`) || [];
            const { data, move } = Data;
            await client.pokemonMoveLearningResponse.delete(`${M.from}${M.sender}`);
            
            const Move = move.name.split('-').map(client.utils.capitalize).join(' ');
            const i = party.findIndex((x) => x.name === data.name && x.level === data.level);
            
            if (flags.includes('--cancel')) {
                party[i].rejectedMoves.push(move.name);
                await client.poke.set(`${M.sender}_Party`, party);
                return M.reply(`Cancelled learning *${Move}*`);
            }
            
            const requestedMove = flags[0].replace('--', '');
            const pkmn = party[i];
            const index = pkmn.moves.findIndex((x) => x.name === requestedMove);
            
            if (index < 0) {
                return M.reply('Invalid move.');
            }
            
            const deletedMove = party[i].moves[index].name.split('-').map(client.utils.capitalize).join(' ');
            party[i].rejectedMoves.push(party[i].moves[index].name);
            party[i].moves[index] = move;
            await client.poke.set(`${M.sender}_Party`, party);

            // Optional: If you have battle logic, uncomment and adjust accordingly
            const c = client.pokemonBattlePlayerMap.get(M.from);
            if (c) {
                const data = client.pokemonBattleResponse.get(c);
                if (data) {
                    const turn = data.player1.user === M.sender.jid ? 'player1' : 'player2';
                    if (party[i].tag === data[turn].activePokemon.tag) {
                        data[turn].activePokemon = party[i];
                        client.pokemonBattleResponse.set(c, data);
                    }
                }
            }

            return M.reply(
                `Your *${client.utils.capitalize(party[i].name)}* forgot the move *${deletedMove}* and learned the move *${Move}*`
            );
        } catch (err) {
            console.error(err);
            return M.reply("An error occurred while learning the move for your Pokémon.");
        }
    },
};
