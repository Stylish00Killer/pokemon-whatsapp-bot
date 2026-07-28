module.exports = {
    name: 'leave',
    aliases: ['l'],
    category: 'owner',
    exp: 0,
    cool: 4,
    react: "✅",
    description: 'Leave the current group',
    async execute(client, arg, M) {
        try {
            client.groupLeave(M.from)
                .then(() => M.reply('✅ Successfully left the group!'))
                .catch(() => M.reply('🚫 Something went wrong while leaving the group.'));
        } catch (err) {
            console.error(err);
            await client.sendMessage(M.from, {
                image: { url: `${client.utils.errorChan()}` },
                caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`
            });
        }
    }
};
