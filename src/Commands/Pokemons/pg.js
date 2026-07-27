module.exports = {
    name: "pokemongive",
    aliases: ["pg"],
    exp: 3,
    cool: 5,
    react: "🎁",
    category: "pokemon",
    description: "Give a Pokémon from your party to another user.",
    usage: 'pokemongive <index> <@user> | pokemongive confirm | pokemongive reject',
    async execute(client, arg, M) {
        const args = arg.split(' ');
        const action = args[0].toLowerCase();

        // Check if user is confirming or rejecting a pending operation
        if (action === 'confirm' || action === 'reject') {
            return handleConfirmationOrRejection(client, action, M);
        }

        // Otherwise, initiate the Pokémon give process
        return initiatePokemonGive(client, args, M);
    }
};

async function handleConfirmationOrRejection(client, action, M) {
    const confirmationMap = await client.poke.get(`${M.sender}_Confirm`);
    if (!confirmationMap) {
        return M.reply('You have no pending Pokémon give operations.');
    }

    try {
        const { pokemonIndex, mentionedUser, from } = confirmationMap;
        const sender = M.sender;
        const senderParty = await client.poke.get(`${sender}_Party`) || [];
        const targetParty = await client.poke.get(`${mentionedUser}_Party`) || [];

        if (action === 'confirm') {
            if (pokemonIndex < 0 || pokemonIndex >= senderParty.length) {
                await client.pkmn.delete(`${M.sender}_Confirm`);
                return M.reply("The Pokémon index is invalid or the Pokémon is no longer available.");
            }

            const pokemon = senderParty[pokemonIndex];
            if (targetParty.length >= 6) {
                await client.pkmn.delete(`${M.sender}_Confirm`);
                return M.reply('Receiver does not have space in their party.');
            }

            // Remove the Pokémon from sender's party
            senderParty.splice(pokemonIndex, 1);
            await client.poke.set(`${sender}_Party`, senderParty);

            // Add the Pokémon to the target user's party
            targetParty.push(pokemon);
            await client.poke.set(`${mentionedUser}_Party`, targetParty);

            const text = `✔ @${sender.split('@')[0]} has transferred *${pokemon.name}* (Level: ${pokemon.level}) to @${mentionedUser.split('@')[0]}.`;
            await client.sendMessage(from, { text: text, mentions: [sender, mentionedUser] });

            await client.sendMessage(client.groups.adminsGroup, { text: `${text} in ${M.from}`, mentions: [sender, mentionedUser] });

        } else if (action === 'reject') {
            await client.pkmn.delete(`${M.sender}_Confirm`);
            return M.reply("Pokémon give operation has been cancelled.");
        }

        await client.pkmn.delete(`${M.sender}_Confirm`);

    } catch (err) {
        console.error(err);
        await client.sendMessage(M.from, {
            text: "An error occurred while processing the Pokémon give operation."
        });
    }
}

async function initiatePokemonGive(client, args, M) {
    const pendingGive = await client.poke.get(`${M.sender}_Confirm`);
    if (pendingGive) {
        return M.reply('You already have a pending Pokémon give operation. Please confirm or reject it first.');
    }

    try {
        const index = parseInt(args[0]);
        const mentionedUser = M.mentions[0];
        const sender = M.sender;
        const senderParty = await client.poke.get(`${sender}_Party`) || [];

        if (!mentionedUser) {
            return M.reply("Please mention a user to give the Pokémon to.");
        }

        const targetParty = await client.poke.get(`${mentionedUser}_Party`) || [];

        if (senderParty.length === 0) {
            return M.reply("Your Pokémon party is empty!");
        }

        if (isNaN(index) || index <= 0 || index > senderParty.length) {
            return M.reply("❌ Please provide a valid index of the Pokémon you want to give.");
        }

        const pokemon = senderParty[index - 1];
        if (targetParty.length >= 6) {
            return M.reply('Receiver does not have space in their party.');
        }

        // Ask for confirmation
        const confirmText = `Do you want to give *${pokemon.name}* (Level: ${pokemon.level}) to @${mentionedUser.split('@')[0]}? Use :pg confirm to confirm or :pg reject to cancel.`;
        await client.sendMessage(M.from, { text: confirmText, mentions: [sender, mentionedUser] });

        // Save the Pokémon give operation details for confirmation
        await client.poke.set(`${M.sender}_Confirm`, {
            pokemonIndex: index - 1,
            mentionedUser,
            from: M.from
        });

    } catch (err) {
        console.error(err);
        await client.sendMessage(M.from, {
            text: "An error occurred while initiating the Pokémon give operation."
        });
    }
}
