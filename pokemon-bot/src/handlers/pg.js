'use strict';

/**
 * !pg — Toggle wild Pokémon spawning in this group.
 * Only admins can run this command.
 * Groups registered here receive an auto-spawned wild Pokémon every 5 minutes.
 */

const utils = require('../utils');

module.exports = async function pgHandler({ client, msg, from, sender, isGroup }) {
    if (!isGroup)
        return client.sendMessage(from, { text: '❌ This command can only be used in groups.' }, { quoted: msg });

    // Check if sender is group admin
    try {
        const meta   = await client.groupMetadata(from);
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        if (!admins.includes(sender))
            return client.sendMessage(from, { text: '❌ Only group admins can toggle wild Pokémon spawning.' }, { quoted: msg });
    } catch {
        return client.sendMessage(from, { text: '❌ Could not verify admin status.' }, { quoted: msg });
    }

    const wilds = client.DB.get('wild') || [];
    const alreadyRegistered = wilds.includes(from);

    if (alreadyRegistered) {
        const updated = wilds.filter(jid => jid !== from);
        client.DB.set('wild', updated);
        return client.sendMessage(from, {
            text: '🔴 Wild Pokémon spawning has been *disabled* for this group.',
        });
    } else {
        wilds.push(from);
        client.DB.set('wild', wilds);
        return client.sendMessage(from, {
            text: '🟢 Wild Pokémon spawning has been *enabled* for this group!\nA wild Pokémon will appear every 5 minutes.\nUse *!catch <name>* when one appears.',
        });
    }
};
