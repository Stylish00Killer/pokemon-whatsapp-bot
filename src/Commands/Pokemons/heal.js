'use strict';

// Heal command – fixed: client.pkmn → client.poke
module.exports = {
    name: 'heal',
    aliases: ['heal'],
    exp: 5,
    cool: 5,
    react: '🟩',
    category: 'pokemon',
    usage: 'Use :heal',
    description: 'Heal all Pokémon in your party',
    async execute(client, arg, M) {
        try {
            const cd          = client.DB.get(`${M.sender}_heal_cd`) || 0;
            const cooldownTime = 45 * 6 * 10000; // 45 minutes

            if (cd && Date.now() - cd < cooldownTime) {
                const timeLeft = client.utils.convertMs(
                    cooldownTime - (Date.now() - cd),
                    'minutes'
                );
                return M.reply(
                    `You have healed your Pokémon recently. Come back again in *${timeLeft}* ${
                        timeLeft >= 2 ? 'minutes' : 'minute'
                    }.`
                );
            }

            let party = client.poke.get(`${M.sender}_Party`) || [];
            if (!party.length)
                return M.reply("You don't have any Pokémon in your party.");

            for (let i = 0; i < party.length; i++) {
                party[i].hp      = party[i].maxHp;
                party[i].attack  = party[i].maxAttack;
                party[i].defense = party[i].maxDefense;
                party[i].speed   = party[i].maxSpeed;
                party[i].state   = { status: '', movesUsed: 0 };
                for (let j = 0; j < party[i].moves.length; j++) {
                    party[i].moves[j].pp = party[i].moves[j].maxPp;
                }
            }

            // Fixed: was client.pkmn.set (typo) → client.poke.set
            client.poke.set(`${M.sender}_Party`, party);
            client.DB.set(`${M.sender}_heal_cd`, Date.now());

            return M.reply('All your Pokémon have been healed!');
        } catch (err) {
            console.error('[heal]', err);
            await M.reply('An error occurred while healing your Pokémon.');
        }
    },
};
