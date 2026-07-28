module.exports = {
    name: 'result',
    aliases: ['result'],
    category: 'owner',
    exp: 0,
    cool: 4,
    description: 'Get the result of the vote or list of register',
    async execute(client, arg, M) {

        if (arg === 'Votes') {
            const option1Votes = await client.DB.get(`option1vote`) || [];
            const option2Votes = await client.DB.get(`option2vote`) || [];
            const option3Votes = await client.DB.get(`option3vote`) || [];
            const option4Votes = await client.DB.get(`option4vote`) || [];
            
            const totalVotes = option1Votes.length + option2Votes.length + option3Votes.length + option4Votes.length;
            
            const results = {
                Option1: option1Votes.length,
                Option2: option2Votes.length,
                Option3: option3Votes.length,
                Option4: option4Votes.length
            };
    
            const winner = Object.keys(results).reduce((a, b) => results[a] > results[b] ? a : b);
    
            return M.reply(`
                Voting Results:
                Option 1: ${results.Option1} votes
                Option 2: ${results.Option2} votes
                Option 3: ${results.Option3} votes
                Option 4: ${results.Option4} votes
                Total Votes: ${totalVotes}
                Winner: ${winner}
            `);
        } else if (arg === 'register') {
            const list = await client.DB.get('tournament-users');
            if (list && list.length > 0) {
                const reply = list.map((user, index) => `${index + 1}. ${user}`).join('\n');
                return M.reply(reply);
            } else {
                return M.reply('No users are registered for the tournament yet.');
            }
        } else {
            return M.reply('Invalid argument. Please use `Votes` or `register`.');
        }
    }
};