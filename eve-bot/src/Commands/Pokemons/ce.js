module.exports = {
    name: "cancel-evolution",
    aliases: ["cancele"],
    exp: 5,
    cool: 5,
    react: "🟩",
    category: "pokemon",
    usage: 'Use :party',
    description: "Cancel the ongoing evolution of your Pokémon",
    async execute(client, arg, M) {
        try {
            if (!client.pokemonEvolutionResponse.has(M.sender)) {
                return M.reply("🟥 *You don't have any Pokémon which is evolving right now*");
            }

            const data = client.pokemonEvolutionResponse.get(M.sender);

            if (data?.group !== M.from) {
                return M.reply("🟨 *This command can only be used in the group where your Pokémon's evolving*");
            }

            client.pokemonEvolutionResponse.delete(M.sender);

            const chain = await client.utils.getPokemonEvolutionChain(data?.pokemon);
            const currentIndex = chain.findIndex((x) => x === data?.pokemon);
            const nextEvolution = chain[currentIndex + 1];

            if (!nextEvolution) {
                return M.reply("🟥 *No further evolution stage found for your Pokémon*");
            }

            return M.reply(
                `🟩 Evolution of your *${client.utils.capitalize(data?.pokemon)}* to *${client.utils.capitalize(nextEvolution)}* has been cancelled`
            );
        } catch (err) {
            console.error(err);
            return M.reply("An error occurred while cancelling the evolution.");
        }
    }
};
