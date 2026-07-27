module.exports = {
    name: 'disable',
    aliases: ['d'],
    exp: 0,
    cool: 4,
    react: "✅",
    category: 'owner',
    description: 'Disables a certain command.',
    async execute(client, arg, M) {
        try {
            if (!arg || typeof arg !== 'string') {
                return M.reply('You need to provide the name of the command to disable.');
            }

            const [commandName, reason] = arg.split('|').map(part => part.trim().toLowerCase());

            if (!commandName) {
                return M.reply('You need to provide the name of the command to disable.');
            }

            const disabledCommands = await client.DB.get('disable-commands') || [];

            if (disabledCommands.some(disabledCmd => disabledCmd.command === commandName)) {
                return M.reply('This command is already disabled.');
            }

            // Store the reason, time, and user who disabled the command
            const disabledCommandInfo = {
                command: commandName,
                reason: reason || "No reason provided",
                disabledAt: new Date().toISOString(),
                disabledBy: M.pushName
            };

            await client.DB.push('disable-commands', disabledCommandInfo);
            M.reply(`Command "${commandName}" has been disabled successfully by ${M.pushName}.`);
        } catch (error) {
            console.error('Error in disabling command:', error);
            M.reply('An error occurred while disabling the command.');
        }
    }
}
