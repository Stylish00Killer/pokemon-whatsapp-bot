// Transfer Command
module.exports = {
    name: 'setgem',
    aliases: ['sgem'],
    category: 'owner',
    exp: 5,
    cool: 4,
    react: "✅",
    usage: 'Use :transfer <amount> @taguser',
    description: 'Transfer credits to your friend',
    async execute(client, arg, M) {
        const recipient = M.mentions[0] || (M.quoted && M.quoted.participant);

        if (!recipient) return M.reply('You must mention someone to transfer credits to.');

        const amount = parseInt(arg.split(' ')[0]);
        if (isNaN(amount) || amount <= 0) return M.reply('Please provide a valid positive amount.');

        
        const recipientEconomy = await client.econ.findOne({ userId: recipient });


        recipientEconomy.gem = amount;
        await recipientEconomy.save();

        const recipientName = recipient.split('@')[0];

        
        await client.sendMessage(M.from, { text: `money has been fixed`, mentions: [recipient] });
          }
};
