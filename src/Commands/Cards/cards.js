const axios = require("axios");
const path = require('path');

module.exports = {
  name: "card",
  aliases: ["cards"],
  exp: 0,
  cool: 4,
  react: "⚡",
  category: "card game",
  usage: 'Use :cards --tier/--name',
  description: "View all your cards, mixed from deck and collection",
  async execute(client, arg, M) {
    const collection = await client.DB.get(`${M.sender}_Collection`) || [];
    const deck = await client.DB.get(`${M.sender}_Deck`) || [];
    
    try {
      if (collection.length === 0 && deck.length === 0) {
        return M.reply("Sorry, you don't have any cards in your collection and deck.");
      }

      let tag = M.sender.substring(3, 7);
      let tr = `*🃏 Name:* ${(await client.contact.getContact(M.sender, client)).username} #${tag}*\n\n`;

      // Sorting the cards based on the argument
      if (arg === "--name") {
        collection.sort();
        deck.sort();
        // Displaying cards normally with alphabetical sorting
        [...deck, ...collection].forEach((card, index) => {
          const [name, tier] = card.split("-");
          tr += `${index + 1}. ${name} (Tier: ${tier})\n`;
        });
      } else if (arg === "--tier") {
        // Grouping cards by tier
        const tiers = {};
        [...collection, ...deck].forEach(card => {
          const [name, tier] = card.split("-");
          if (!tiers[tier]) tiers[tier] = [];
          tiers[tier].push(name);
        });

        // Displaying cards tier-wise, sorted from S to 1
        ['S', '6', '5', '4', '3', '2', '1'].forEach(tier => {
          if (tiers[tier]) {
            tr += `Tier ${tier}:\n`;
            tiers[tier].forEach((name, index) => {
              tr += `${index + 1}. ${name}\n`;
            });
            tr += '\n';
          }
        });
      } else {
        // Displaying cards normally without sorting
        [...deck, ...collection].forEach((card, index) => {
          const [name, tier] = card.split("-");
          tr += `${index + 1}. ${name} (Tier: ${tier})\n`;
        });
      }

      // Select the image or link of the first card in deck
      const firstDeckCard = deck.length > 0 ? deck[0].split("-") : null;
      const filePath = path.join(__dirname, '../../Helpers/card.json');
      const data = require(filePath);
      const matchingCards = data.filter(function (cardData) {
        return cardData.tier == firstDeckCard[1] && cardData.title == firstDeckCard[0];
      });
      const imageUrl = matchingCards.length > 0 ? matchingCards[0].url : '';

      if (imageUrl.endsWith(".gif")) {
        return await client.sendMessage(M.from, { video: { url: imageUrl }, caption: tr, gifPlayback: true }, { quoted: M });
      } else if (imageUrl) {
        return await client.sendMessage(M.from, { image: { url: imageUrl }, caption: tr }, { quoted: M });
      } else {
        return M.reply("Error: Unable to find an image for the first card in your deck.");
      }
    } catch(err) {
      await client.sendMessage(M.from , {image: {url: `${client.utils.errorChan()}`} , caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`});
    }
  },
};
