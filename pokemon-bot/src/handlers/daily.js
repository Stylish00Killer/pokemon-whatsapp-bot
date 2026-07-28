'use strict';

/**
 * !daily — Claim daily Pokéballs and gems.
 * Cooldown: 24 hours.
 */

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const POKEBALLS_PER_DAY = 5;
const GEMS_PER_DAY = 100;

module.exports = async function dailyHandler({ client, msg, from, sender }) {
    const econ = await client.econ.findOrCreate({ userId: sender });

    if (econ.lastDaily) {
        const elapsed = Date.now() - new Date(econ.lastDaily).getTime();
        if (elapsed < DAILY_COOLDOWN) {
            const hours = Math.ceil((DAILY_COOLDOWN - elapsed) / 3600000);
            return client.sendMessage(from, {
                text: `⏳ Already claimed today! Come back in *${hours}h*.`,
            }, { quoted: msg });
        }
    }

    econ.pokeball += POKEBALLS_PER_DAY;
    econ.gem      += GEMS_PER_DAY;
    econ.lastDaily = new Date().toISOString();
    await econ.save();

    return client.sendMessage(from, {
        text:
            `🎁 *Daily reward claimed!*\n\n` +
            `⚾ +${POKEBALLS_PER_DAY} Pokéballs (now: ${econ.pokeball})\n` +
            `💎 +${GEMS_PER_DAY} Gems (now: ${econ.gem})\n\n` +
            `Come back tomorrow for more!`,
    }, { quoted: msg });
};
