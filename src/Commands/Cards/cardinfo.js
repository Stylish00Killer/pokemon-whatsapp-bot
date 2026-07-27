//viewcard
const axios = require("axios");
const path = require('path');

module.exports = {
  name: "aboutcard",
  aliases: ["acard"],
  exp: 0,
  react: "✅",
  category: "card game",
  usage: 'Use :aboutcard <cardName>',
  description: "Views any card from the bot",
  async execute(client, args, M) {
    const [cardName, cardTier] = args.trim().split("-"); // Accept card name and tier as input

    const filePath = path.join(__dirname, '../../Helpers/card.json');
    const data = require(filePath);
    
    let cardData;
    if (cardTier) {
      cardData = data.find((cardData) => cardData.title === cardName && cardData.tier === cardTier); // Search by card name and tier
    } else {
      cardData = data.find((cardData) => cardData.title === cardName); // Search by card name only
    }

    if (!cardData) {
      return M.reply("❗ Card data not found.");
    }

    const cardUrl = cardData.url;
    const imageUrl = cardUrl;
    const isGif = imageUrl.endsWith('.gif');
    const file = await client.utils.getBuffer(imageUrl);
    const text = `💎 Card Details 💎\n\n🌊 Name: ${cardName}\n\n🌟 Tier: ${cardData.tier}\n\n${cardData.description}`;

    if (isGif) {
      const giffed = await client.utils.gifToMp4(file);
      await client.sendMessage(M.from, {
        video: giffed,
        gifPlayback: true,
        caption: text
      }, { quoted: M });
    } else {
      await client.sendMessage(M.from, {
        image: file,
        caption: text
      }, { quoted: M });
    }
  }
                               }
