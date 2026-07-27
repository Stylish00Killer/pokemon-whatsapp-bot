module.exports = {
  name: "buycard",
  exp: 0,
  cool: 4,
  react: "✅",
  category: "card game",
  usage: 'buycard <saleID>',
  description: "Buys a card on sale",
  async execute(client, arg, M) {
    try {
      const saleData = await client.DB.get(`${M.from}.sell`);

      if (!saleData) {
        return M.reply("Sale with that ID does not exist or has expired.");
      }

      const shopID = parseInt(arg);
      if (isNaN(shopID) || shopID !== saleData.shopID) {
        return M.reply("Invalid sale ID. Please use a valid sale ID.");
      }

      const seller = saleData.seller;
      const price = saleData.price;
      const index = saleData.cardIndex;

      const buyer = M.sender;
      const sellerDeck = (await client.DB.get(`${seller}_Deck`)) || [];
      const buyerDeck = (await client.DB.get(`${buyer}_Deck`)) || [];

      if (sellerDeck.length <= index) {
        return M.reply("Seller's deck does not contain the specified card.");
      }

      const cardData = sellerDeck[index].split('-');
      const cardName = cardData[0];
      const cardTier = cardData[1];
      const wallet = await client.credit.get(`${buyer}.wallet`) || 0;

      if (wallet < price) {
        return M.reply("Not enough funds to make the purchase.");
      }

      await client.credit.add(`${seller}.wallet`, price);
      await client.credit.sub(`${buyer}.wallet`, price);

      if (buyerDeck.length >= 12) {
        // Deck is full — push new card to collection without touching existing deck
        await client.DB.push(`${buyer}_Collection`, `${cardName}-${cardTier}`);
      } else {
        buyerDeck.push(`${cardName}-${cardTier}`);
        await client.DB.set(`${buyer}_Deck`, buyerDeck);
      }

      sellerDeck.splice(index, 1);

      await client.DB.set(`${seller}_Deck`, sellerDeck);

      await client.DB.delete(`${M.from}.sell`);
      await client.DB.set(`${M.from}.sellInProgress`, false);

      M.reply(`Sale is done. User ${buyer} paid ${price} to ${seller} and bought the card.`);
    } catch (err) {
      console.error(err);
      await client.sendMessage(M.from, {
        image: { url: client.utils.errorChan() },
        caption: `${client.utils.greetings()} EVE BOT\n\nError:\n${err}`,
      });
    }
  },
};
    
