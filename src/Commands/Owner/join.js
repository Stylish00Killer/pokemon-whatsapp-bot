module.exports = {
    name: 'join',
    aliases: ['j'],
    category: 'owner',
    exp: 0,
    cool: 4,
    react: "✅",
    description: 'Join a group using the link. eg group join (gclink)',
    async execute(client, arg, M) {
        try {
            const link = arg;

            if (!link || !link.includes('https://chat.whatsapp.com/')) {
                return M.reply('🚫 Oops! The provided link is not a valid group link.');
            }

            const joinCode = link.split('https://chat.whatsapp.com/')[1];
            client
            .groupAcceptInvite(joinCode) // Fix: Use 'joinCode' instead of 'JoinCode'
            .then((res) => M.reply('🟩 *Joined*'))
            .catch((err) => {
                console.error(err);
                M.reply('🟨 *Something went wrong, please check the link.*');
            });
        } catch (err) {
            console.error(err);
            await client.sendMessage(M.from, {
                image: { url: `${client.utils.errorChan()}` },
                caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`
            });
        }
    }
};
