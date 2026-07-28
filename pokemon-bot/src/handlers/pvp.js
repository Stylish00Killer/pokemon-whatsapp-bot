'use strict';

/**
 * !pvp — Legacy redirect. The full PVP system is now !challenge / !battle.
 * This keeps backwards compatibility for users who try !pvp.
 */

module.exports = async function pvpHandler({ client, msg, from }) {
    return client.sendMessage(from, {
        text:
            '⚔️ *PVP Battle System*\n\n' +
            'To challenge someone:\n' +
            '  *!challenge @user*\n\n' +
            'During a battle:\n' +
            '  *!battle fight* — list your moves\n' +
            '  *!battle fight <number>* — use move #N\n' +
            '  *!battle switch <number>* — switch Pokémon\n' +
            '  *!battle pokemon* — show your party\n' +
            '  *!battle forfeit* — give up\n\n' +
            'Other commands:\n' +
            '  *!challenge --accept* | *--reject* | *--cancel*',
    }, { quoted: msg });
};
