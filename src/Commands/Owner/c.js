const path = require('path');

module.exports = {
  name: 'spawn',
  aliases: ['event'],
  category: 'owner',
  exp: 5,
  react: "🔥",
  description: 'spawns cards',
  async execute(client, arg, M) {
    const cardsPath = path.join(__dirname, '../../Helpers/card.json');
    const data = require(cardsPath);
    const dataFilter = data.filter(card => card.tier === "S" || card.tier === "6");

    console.log(dataFilter);

    const { Random } = require("random-js");
    const random = new Random(); // uses the nativeMath engine
    const value = random.integer(0, dataFilter.length - 1); // Adjusted to account for array index
    const obj = dataFilter[value];

    console.log(obj);

    let price;
    switch (obj.tier) {
      case "6":
        price = client.utils.getRandomInt(200000, 500000);
        break;
      case "S":
        price = client.utils.getRandomInt(500000, 1000000);
        break;
    }
    let code = client.utils.getRandomInt(100000, 999999);

    await client.cards.set(`${M.from}.card`, `${obj.title}-${obj.tier}`);
    await client.cards.set(`${M.from}.card_price`, price);
    client.cardMap.set(M.from, {
      price: price,
      code: code,
      card: { name: obj.title, tier: obj.tier, image: obj.url }
    });

    const giif = await client.utils.getBuffer(obj.url);
    const cgif = await client.utils.gifToMp4(giif);

    await client.sendMessage(M.from, {
      video: cgif,
      caption: `🎴 ━『 ANIME-CARD 』━ 🎴\n\n💮 Name: ${obj.title}\n\n💠 Tier: ${obj.tier}\n\n🏮 Price: ${price}\n\n📤 Info: These cards are originally owned by https://shoob.gg, and we are using them with all the required permissions.\n\n🔖 [ Use ${client.prefix}collect to claim the card, ${client.prefix}collection to see your Cards ]`,
      gifPlayback: true,
    });

    setTimeout(() => {
      client.cards.delete(`${M.from}.card`);
      client.cards.delete(`${M.from}.card_price`);
      console.log('card deleted');
    }, 3000);
  }
};
