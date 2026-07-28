const axios = require("axios");
const path = require('path');

module.exports = {
  name: "t2coll",
  aliases: ["tocoll", "2coll"],
  exp: 0,
  cool: 4,
  react: "✅",
  category: "card game",
  usage: 'Use :t2coll <card_index>',
  description: "Transfer a card from your deck to your collection",
  async execute(client, arg, M) {
    try {

      const collection = await client.DB.get(`${M.sender}_Collection`) || [];
      const deck = await client.DB.get(`${M.sender}_Deck`) || [];
      const rawArg  = (arg.split(' ')[0] || '').trim();
      const indexOF = parseInt(rawArg, 10);

      if (!rawArg) {
        return M.reply("Please provide the index or name of the card you wish to transfer.");
      }

      // When rawArg is a name (non-numeric), compare against the raw string — not the NaN result of parseInt
      const position = isNaN(indexOF)
        ? deck.findIndex((card) => card.split('-')[0].toLowerCase() === rawArg.toLowerCase())
        : indexOF - 1;

      if (position < 0 || position >= deck.length) {
        return M.reply("Invalid card index or name.");
      }

      const card = deck[position];
      collection.push(card);
      deck.splice(position, 1);

      await client.DB.set(`${M.sender}_Collection`, collection);
      await client.DB.set(`${M.sender}_Deck`, deck);

      const cardData = require('../../Helpers/card.json').find((cardData) => cardData.title === card.split("-")[0] && cardData.tier === card.split("-")[1]);

      const replyMsg = cardData ? `Sent "${indexOF}" from your deck to your collection!\n\nCard Details:\nName: ${cardData.title}\nTier: ${cardData.tier}` : `Card transferred from deck to collection.`;

      M.reply(replyMsg);
    } catch (err) {
      await client.sendMessage(M.from, { image: { url: `${client.utils.errorChan()}` }, caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}` });
    }
  }
};
