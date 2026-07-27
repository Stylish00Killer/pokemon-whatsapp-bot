const path = require('path');

module.exports = {
  name: "auction",
  aliases: ["auction"],
  exp: 0,
  cool: 5,
  react: "✅",
  category: "card game",
  description: "Starts or ends a card auction",
  async execute(client, arg, M) {
    try {
      if (arg.startsWith('start')) {
        const auctionInProgress = await client.DB.get(`${M.from}.auctionInProgress`);
        if (auctionInProgress) {
          return M.reply("An auction is already in progress. You cannot start a new one.");
        }
        
        const splitArgs = arg.split('|');
        if (splitArgs.length !== 3) {
          return M.reply("Please provide both the card index and the starting price separated by '|' (e.g., start|1|100).");
        }

        const deck = await client.DB.get(`${M.sender}_Deck`) || [];
        if (deck.length === 0) {
          return M.reply("You do not have any cards in your deck to auction.");
        }

        const cardIndex = parseInt(splitArgs[1]) - 1;
        if (isNaN(cardIndex) || cardIndex < 0 || cardIndex >= deck.length) {
          return M.reply("Please provide a valid card index.");
        }

        const startingPrice = parseInt(splitArgs[2]);
        if (isNaN(startingPrice) || startingPrice <= 0) {
          return M.reply("Please provide a valid starting price.");
        }
        
        const cardToSell = deck[cardIndex].split('-');
        const filePath = path.join(__dirname, '../../Helpers/card.json');
        const cardDataJson = require(filePath);
        const cardsInTier = cardDataJson.filter((card) => card.tier === cardToSell[1]);
        const cardData = cardsInTier.find((card) => card.title === cardToSell[0]);
        if (!cardData) {
          return M.reply("The card data could not be found.");
        }

        const imageUrl = cardData.url;
        const text = `💎 *Card on Auction* 💎\n\n🌊 *Name:* ${cardData.title}\n\n🌟 *Tier:* ${cardData.tier}\n\n📝 *Price:* ${startingPrice}\n\n🎉 *Highest bidder gets the card* 🎉\n\n🔰 Use :bid <amount> to bid`;

        const file = await client.utils.getBuffer(imageUrl);
        const isGif = imageUrl.endsWith('.gif');

        if (isGif) {
          const giffed = await client.utils.gifToMp4(file);
          await client.sendMessage(M.from, { video: giffed, gifPlayback: true, caption: text, quoted: M });
        } else {
          await client.sendMessage(M.from, { image: file, caption: text, quoted: M });
        }

        await client.DB.set(`${M.from}.bid`, startingPrice);
        await client.DB.set(`${M.from}.auctionSeller`, M.sender);
        await client.DB.set(`${M.from}.auctionInProgress`, true);
        await client.DB.set(`${M.from}.auctionCardIndex`, cardIndex);
        return;
      }

      if (arg === 'end') {
        const bid    = await client.DB.get(`${M.from}.bid`) || 0;
        const seller = await client.DB.get(`${M.from}.auctionSeller`) || M.sender;
        const winner = await client.DB.get(`${M.from}.auctionWinner`);
        if (!winner) {
          return M.reply('No one bid, so the auction is won by mods.');
        } else {
          const cardIndex = await client.DB.get(`${M.from}.auctionCardIndex`);
          // Use the stored seller's deck, not the command caller's deck
          const deck = await client.DB.get(`${seller}_Deck`) || [];
          const cardToSell = deck[cardIndex].split('-');
          const filePath = path.join(__dirname, '../../Helpers/card.json');
          const cardDataJson = require(filePath);
          const cardsInTier = cardDataJson.filter((card) => card.tier === cardToSell[1]);
          const cardData = cardsInTier.find((card) => card.title === cardToSell[0]);

          // Give card to winner (deck if space, otherwise collection)
          const winnerDeck = await client.DB.get(`${winner}_Deck`) || [];
          if (winnerDeck.length < 12) {
            await client.DB.push(`${winner}_Deck`, `${cardData.title}-${cardData.tier}`);
          } else {
            await client.DB.push(`${winner}_Collection`, `${cardData.title}-${cardData.tier}`);
          }

          // Deduct bid from winner and pay seller via economy model
          if (bid > 0) {
            const winnerEcon = await client.econ.findOne({ userId: winner });
            if (winnerEcon) { winnerEcon.gem -= bid; await winnerEcon.save(); }
            const sellerEcon = await client.econ.findOne({ userId: seller });
            if (sellerEcon) { sellerEcon.gem += bid; await sellerEcon.save(); }
          }

          await client.DB.delete(`${M.from}.auctionWinner`);
          await client.DB.delete(`${M.from}.bid`);
          await client.DB.delete(`${M.from}.auctionSeller`);
          await client.DB.delete(`${M.from}.auctionInProgress`);
          await client.DB.delete(`${M.from}.auctionCardIndex`);

          M.reply(`*The auction for ${cardData.title} of tier ${cardData.tier} is won by @${winner.split('@')[0]} with a bid of ${bid}. It has been added to the winner's ${winnerDeck.length < 12 ? 'deck' : 'collection'}.*`);
        }
      }
    } catch (err) {
      console.log(err);
      await client.sendMessage(M.from, { image: { url: client.utils.errorChan() }, caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}`, quoted: M });
    }
  }
};
