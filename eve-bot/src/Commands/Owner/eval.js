'use strict';

module.exports = {
    name: 'eval',
    aliases: ['evaluate'],
    category: 'owner',
    exp: 0,
    cool: 4,
    react: '✅',
    description: 'Evaluates JavaScript (dev only)',
    async execute(client, arg, M) {
        try {
            if (!arg) return M.reply('Please provide JavaScript code to evaluate.');
            let out = '';
            try {
                const output = (await eval(arg));  // eslint-disable-line no-eval
                out = output !== undefined ? JSON.stringify(output) : 'Executed successfully.';
            } catch (err) {
                out = `Error: ${err.message}`;
            }
            return await M.reply(out);
        } catch (err) {
            console.error('[eval]', err.message);
            await M.reply(`Error: ${err.message}`).catch(() => {});
        }
    },
};
