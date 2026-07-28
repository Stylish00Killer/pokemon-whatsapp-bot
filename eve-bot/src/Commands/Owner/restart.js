module.exports = {
    name: 'restart',
    aliases: ['relife'],
    category: 'owner',
    exp: 0,
    cool: 4,
    react: "✅",
    description: 'Restarts the bot',
    async execute(client, arg, M) {
        try {
            await M.reply('Restarting...');
            await client.utils.restart();
        } catch (err) {
            console.error(err);
            await client.sendMessage(M.from , {image: {url: `${client.utils.errorChan()}`}, caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`});
        }
    }
};