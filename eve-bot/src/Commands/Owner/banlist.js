module.exports = {
  name: 'banlist',
  aliases: ['bannedlist'],
  exp: 0,
  cool: 4,
  react: "✅",
  category: 'owner',
  description: 'List of all banned users',
  async execute(client, arg, M) {
      try {
          const banned = (await client.DB.get('banned')) || [];
          if (!banned.length) {
              return M.reply('There are no banned users.');
          }
          
          const userList = await Promise.all(banned.map(async (user) => {
              try {
                  const userInfo = await client.getContact(user);
                  return `*@${userInfo.name.split(' ')[0]}*`;
              } catch (error) {
                  return `*@${user.split('@')[0]}*`;
              }
          }));
          
          await client.sendMessage(
              M.from,
              { text: `List of banned users:\n${userList.join('\n')}`, mentions: userList },
              { quoted: M }
          );
      } catch (err) {
          console.error(err);
          await client.sendMessage(M.from, {
              image: { url: `${client.utils.errorChan()}` },
              caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`
          });
      }
  },
};