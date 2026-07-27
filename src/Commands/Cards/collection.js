const axios = require("axios");
const path = require('path');

module.exports = {
  name: "collection",
  aliases: ["coll"],
  react: '🎉',
  exp: 0,
  cool: 4,
  category: "card game",
  description: "View your collected cards",
  async execute(client, arg, M) {
    try {
      const collection = (await client.DB.get(`${M.sender}_Collection`)) || [];
      if (collection.length === 0) {
        return M.reply("You currently don't have any cards in your collection");
      }
      const uniqueCards = collection.filter((card, index) => collection.indexOf(card) === index);
      let tag = M.sender.substring(3, 7);
      let tr = `*Name:* ${(await client.contact.getContact(M.sender, client)).username}\n*🏷️ Tag:* #${tag}\n\n *🔖 Total claimed Cards in Collection:* ${uniqueCards.length}↯\n\n`;
      for (let i = 0; i < uniqueCards.length; i++) {
        let card = uniqueCards[i].split("-");
        const filePath = path.join(__dirname, '../../Helpers/card.json');
        const data = require(filePath);
        const newArray = data.filter((I) => I.tier == card[1]);
        const obj = newArray.find((cardData) => cardData.title === card[0]);
        tr += `*${i+1}) Name: ${card[0]} (Tier: ${obj.tier})*\n\n`;
      }
      if (arg) { 
        const index = parseInt(arg) - 1; // The index in the array is 0-based
        if (isNaN(index) || index < 0 || index >= collection.length) {
          return M.reply(`Invalid card index. Your collection has ${collection.length} cards.`);
        } else {
          const card = collection[index].split('-');
          const filePath = path.join(__dirname, '../../Helpers/card.json');
          const data = require(filePath);
          const cardData = data.find((cardData) => cardData.title === card[0] && cardData.tier === card[1]);
          const cardUrl = cardData.url;
          let text = `🃏 Total Coll Cards: ${collection.length}\n\n🏮 Username: ${(await client.contact.getContact(M.sender, client)).username}`
          text += `\n*#${index + 1}*\n🃏 *Name:* ${card[0]}\n🪄 *Tier:* ${card[1]}\n`;
          
          const file = await client.utils.getBuffer(cardUrl);
          if (cardUrl.endsWith('.gif')) {
            const giffed = await client.utils.gifToMp4(file);
            await client.sendMessage(M.from, {
              video: giffed,
              gifPlayback: true,
              caption: text
            });
          } else {
            await client.sendMessage(M.from , {image: {url: cardUrl} , caption: text}, {quoted: M});
          }
        }
      } else {
        let cardText = "";
        const cardSet = new Set();
        for (let i = 0; i < collection.length; i++) {
          const card = collection[i].split('-');
          const filePath = path.join(__dirname, '../../Helpers/card.json');
          const data = require(filePath);
          const cardData = data.find((cardData) => cardData.title === card[0] && cardData.tier === card[1]);
          let cardUrl = cardData.url;
          if (!cardSet.has(cardData.title)) {
            cardSet.add(cardData.title);
          }
          cardText += `🔰Card ${i+1}:\n\n🌟Tier: ${card[1]}\n\n💎Name ${card[0]}\n`;
        }
        await client.sendMessage(M.from, { text: tr }, { quoted: M });
    }
    } catch (err) {
      await client.sendMessage(M.from, {image: {url: `${client.utils.errorChan()}`}, caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`});
    }
  },
};
