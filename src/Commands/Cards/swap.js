module.exports = {
  name: "cswap",
  aliases: ["swapcards"],
  exp: 0,
  cool: 4,
  react: "✅",
  category: "card game",
  usage: 'Use :cswap <index1> <imdex2>',
  description: "Swap two cards in your deck",
  async execute(client, arg, M) {
      try {

      let pc = await client.DB.get(`${M.sender}_Deck`) || [];

    const parts = arg.trim().split(/\s+/);
    const p1 = parts[0] || '';
    const p2 = parts[1] || '';

    if (!p1 || isNaN(p1) || p1.includes('-') || p1.includes('+') || parseInt(p1) < 1 || parseInt(p1) > pc.length) {
        M.reply("Please provide a valid first card index.");
        return;
    }

    if (!p2 || isNaN(p2) || p2.includes('-') || p2.includes('+') || parseInt(p2) < 1 || parseInt(p2) > pc.length) {
        M.reply("Please provide a valid second card index.");
        return;
    }

    const index1 = parseInt(p1) - 1;
    const index2 = parseInt(p2) - 1;

    if (index1 === index2) {
        M.reply("The two indices provided cannot be the same.");
        return;
    }

    const newArray = [...pc];
    const temp = newArray[index1];
    newArray[index1] = newArray[index2];
    newArray[index2] = temp;

    await client.DB.delete(`${M.sender}_Deck`);


    for (let i = 0; i < pc.length; i++) {
        await client.DB.push(`${M.sender}_Deck`, newArray[i]);
      }
      

    M.reply(`Cards at index ${index1 + 1} and ${index2 + 1} have been swapped.`);
    
    }catch(err){
      await client.sendMessage(M.from , {image: {url: `${client.utils.errorChan()}`} , caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`})
    }
  },
};
