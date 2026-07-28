'use strict';

/**
 * !cancel-evolution — Cancel a pending evolution within the 60-second window.
 */

const utils = require('../utils');

module.exports = async function cancelEvolutionHandler({ client, msg, from, sender }) {
    const pending = client.pokemonEvolutionResponse.get(sender);
    if (!pending)
        return client.sendMessage(from, { text: "❌ You don't have a pending evolution to cancel." }, { quoted: msg });

    client.pokemonEvolutionResponse.delete(sender);
    return client.sendMessage(from, {
        text: `✅ *@${sender.split('@')[0]}*'s evolution was cancelled!`,
        mentions: [sender],
    });
};
