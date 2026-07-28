'use strict';

/**
 * Wild Pokémon auto-spawner.
 * Every 5 minutes, spawns a wild Pokémon in all registered groups.
 * Groups register with !pg command → stored in DB key 'wild'.
 */

const cron = require('node-cron');
const { spawnWild } = require('../data/pokemon');
const utils = require('../utils');

module.exports = function startSpawner(client) {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const wilds = client.DB.get('wild') || [];
            if (!wilds.length) return;

            const wildData = await spawnWild();

            for (const jid of wilds) {
                try {
                    client.pokemonResponse.set(jid, wildData);
                    const buffer = await utils.getBuffer(wildData.image);
                    await client.sendMessage(jid, {
                        image: buffer,
                        caption:
                            `🌟 *A Wild Pokémon Appeared!* 🌟\n` +
                            `🆔 ID: ${wildData.id}\n` +
                            `🔥 Types: ${wildData.types.map(utils.capitalize).join(', ')}\n` +
                            `🔹 Level: ${wildData.level}\n\n` +
                            `[Use *!catch ${wildData.name}* to catch it!]`,
                    });
                } catch (e) {
                    console.error('[Spawner] send error:', e.message);
                }
            }
        } catch (e) {
            console.error('[Spawner] error:', e.message);
        }
    });

    console.log('[SPAWN] Wild Pokémon scheduler started (every 5 min).');
};
