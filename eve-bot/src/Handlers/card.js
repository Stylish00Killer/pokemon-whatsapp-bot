'use strict';

const { shizobtn1img, shizobtn1gif } = require('./shizofunc.js');
const cron = require('node-cron');
const path = require('path');

module.exports = async function CardHandler(client) {
    try {
        // Schedule card spawns every 20 minutes
        cron.schedule('*/20 * * * *', async () => {
            try {
                // Refresh group list each tick so changes take effect
                const activeGroups = client.DB.get('cards') || [];
                if (!Array.isArray(activeGroups) || activeGroups.length === 0) return;

                const jid = activeGroups[Math.floor(Math.random() * activeGroups.length)];

                // Load card data
                const filePath = path.join(__dirname, '../Helpers/card.json');
                // Clear require cache so updated card.json is always fresh
                delete require.cache[require.resolve(filePath)];
                const data = require(filePath);

                if (!Array.isArray(data) || data.length === 0) return;

                // Determine spawn type — every Nth spawn is rare
                const spawnCount = (client._cardSpawnCount = (client._cardSpawnCount || 0) + 1);
                const isRareSpawn = spawnCount % 6 === 0;

                let obj;
                if (isRareSpawn) {
                    const rare = data.filter((c) => c.tier === 'S' || c.tier === '6');
                    if (rare.length > 0) {
                        obj = rare[Math.floor(Math.random() * rare.length)];
                    }
                }

                if (!obj) {
                    const normal = data.filter((c) => !['S', '6'].includes(c.tier));
                    if (normal.length === 0) obj = data[Math.floor(Math.random() * data.length)];
                    else obj = normal[Math.floor(Math.random() * normal.length)];
                }

                let price;
                switch (obj.tier) {
                    case '1': price = client.utils.getRandomInt(2000, 4000);     break;
                    case '2': price = client.utils.getRandomInt(4000, 5000);     break;
                    case '3': price = client.utils.getRandomInt(4000, 5000);     break;
                    case '4': price = client.utils.getRandomInt(8000, 10000);    break;
                    case '5': price = client.utils.getRandomInt(25000, 40000);   break;
                    case '6': price = client.utils.getRandomInt(70000, 90000);   break;
                    case 'S': price = client.utils.getRandomInt(100000, 500000); break;
                    default:  price = client.utils.getRandomInt(2000, 4000);     break;
                }

                console.log(`[CARD] Spawning tier ${obj.tier} "${obj.title}" | ${price} gems | ${jid}`);

                // Register in memory so -collect can find it
                client.cardMap.set(jid, { card: `${obj.title}-${obj.tier}`, price });

                // Auto-expire after 5 minutes
                setTimeout(() => {
                    if (client.cardMap.has(jid)) {
                        client.cardMap.delete(jid);
                        console.log(`[CARD] Card in ${jid} expired after 5 min.`);
                    }
                }, 5 * 60 * 1000);

                const isRare  = ['S', '6'].includes(obj.tier);
                const caption = `*┌─🄴🅅🄴────────❀̥˚─┈ ⳹*
*└──🄲🄰🅁🄳 🅂🄿🅆🄰🄽──┈ ⳹*
*│▱▱▱▱▱▱▱▱▱▱▱▱▱▱*
*│𓊈 ${isRare ? 'ᴀ ʀᴀʀᴇ ᴄᴀʀᴅ ʜᴀꜱ ꜱᴘᴀᴡɴᴇᴅ' : 'ᴀ ɴᴇᴡ ᴄᴀʀᴅ ʜᴀꜱ ꜱᴘᴀᴡɴᴇᴅ'} 𓊉*
*│🏮 ɴᴀᴍᴇ: 𓆩 ${obj.title} 𓆪*
*│🔰 ᴛɪᴇʀ: 【 ${obj.tier} 】*
*│💰 Price: ░░ ${price} ░░*
*│░░░░░░░░░░░░░░░░░░░░*
*│📤 ɪɴғᴏ: ꜱʜᴏᴏʙ ᴄᴀʀᴅ'ꜱ 🎏*
*│░▒ EVE BOT — Made by S00K ▒░*
*│░░░░░░░░░░░░░░░░░░░░*
*│🔮 ᴜꜱᴇ ᴄᴏʟʟᴇᴄᴛ ᴛᴏ ᴄʟᴀɪᴍ 📢*
*│▱▱▱▱▱▱▱▱▱▱▱▱▱▱*
*┌──🄲🄰🅁🄳 🅂🄿🅆🄰🄽──┈ ⳹*
*└❀̥˚───────────🄴🅅🄴─┈ ⳹*`;

                const footer = '𒉢 EVE BOT — say collect to claim';

                if (isRare) {
                    const gif = await client.utils.getBuffer(obj.url);
                    const mp4 = await client.utils.gifToMp4(gif);
                    return shizobtn1gif(client, jid, caption, mp4, ' Collect 🔖', `${client.prefix}collect`, footer);
                } else {
                    return shizobtn1img(client, jid, caption, obj.url, ' Collect 🔖', `${client.prefix}collect`, footer);
                }
            } catch (err) {
                console.error('[CARD] Spawn error:', err.message);
            }
        });

        console.log('[CARD] Spawn scheduler started (every 20 min).');
    } catch (error) {
        console.error('[CARD] Handler init error:', error.message);
    }
};
