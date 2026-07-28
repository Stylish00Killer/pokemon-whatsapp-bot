const axios = require('axios');

module.exports = {
  name: 'swapmon',
  aliases: ['swapmons'],
  exp: 5,
  cool: 4,
  react: "✅",
  category: 'pokemon',
  usage: 'Use :swapmon <p<index1>> <p<index2>> or <p<index1>> <pc<index2>> or <pc<index1>> <p<index2>> or <p<index>> to transfer from party to PC or <pc<index>> to transfer from PC to party',
  description: 'Swap or transfer Pokémon between party and PC',
  async execute(client, arg, M) {
    try {
      let party = await client.poke.get(`${M.sender}_Party`) || [];
      let pc = await client.poke.get(`${M.sender}_Pss`) || [];

      const args = arg.split(' ');

      if (args.length === 1) {
        const [prefix, index] = [args[0].charAt(0), parseInt(args[0].slice(1)) - 1];

        if (isNaN(index)) {
          return M.reply('❌ Please provide a valid index.');
        }

        if (prefix === 'p') {
          // Transfer from party to PC
          if (index < 0 || index >= party.length) {
            return M.reply('❌ Invalid Pokémon index.');
          }
          const pokemon = party[index];
          party.splice(index, 1);
          pc.push(pokemon);
          await client.poke.set(`${M.sender}_Party`, party);
          await client.poke.set(`${M.sender}_Pss`, pc);
          M.reply(`✔ Pokémon *(${pokemon.name})* has been transferred from party to PC.`);
        } else if (prefix === 'pc') {
          // Transfer from PC to party
          if (index < 0 || index >= pc.length) {
            return M.reply('❌ Invalid Pokémon index.');
          }
          const pokemon = pc[index];
          pc.splice(index, 1);
          party.push(pokemon);
          await client.poke.set(`${M.sender}_Party`, party);
          await client.poke.set(`${M.sender}_Pss`, pc);
          M.reply(`✔ Pokémon *(${pokemon.name})* has been transferred from PC to party.`);
        } else {
          return M.reply('❌ Invalid prefix. Use "p" for party and "pc" for PC.');
        }
      } else if (args.length === 2) {
        const [arg1, arg2] = args;
        const [prefix1, index1] = [arg1.charAt(0), parseInt(arg1.slice(1)) - 1];
        const [prefix2, index2] = [arg2.charAt(0), parseInt(arg2.slice(1)) - 1];

        if (isNaN(index1) || isNaN(index2)) {
          return M.reply('❌ Please provide valid indices.');
        }

        if (prefix1 === 'p' && prefix2 === 'p') {
          // Swap within party
          if (index1 < 0 || index1 >= party.length || index2 < 0 || index2 >= party.length) {
            return M.reply('❌ One or both indices are out of range.');
          }
          [party[index1], party[index2]] = [party[index2], party[index1]];
          await client.poke.set(`${M.sender}_Party`, party);
          const pokemonName1 = party[index1].name;
          const pokemonName2 = party[index2].name;
          M.reply(`✔ Pokémon at index ${index1 + 1} *(${pokemonName1})* and ${index2 + 1} *(${pokemonName2})* have been swapped.`);
        } else if (prefix1 === 'pc' && prefix2 === 'pc') {
          // Swap within PC
          if (index1 < 0 || index1 >= pc.length || index2 < 0 || index2 >= pc.length) {
            return M.reply('❌ One or both indices are out of range.');
          }
          [pc[index1], pc[index2]] = [pc[index2], pc[index1]];
          await client.poke.set(`${M.sender}_Pss`, pc);
          const pokemonName1 = pc[index1].name;
          const pokemonName2 = pc[index2].name;
          M.reply(`✔ Pokémon at index ${index1 + 1} *(${pokemonName1})* and ${index2 + 1} *(${pokemonName2})* have been swapped.`);
        } else if (prefix1 === 'p' && prefix2 === 'pc') {
          // Swap between party and PC
          if (index1 < 0 || index1 >= party.length || index2 < 0 || index2 >= pc.length) {
            return M.reply('❌ One or both indices are out of range.');
          }
          [party[index1], pc[index2]] = [pc[index2], party[index1]];
          await client.poke.set(`${M.sender}_Party`, party);
          await client.poke.set(`${M.sender}_Pss`, pc);
          const pokemonNameParty = party[index1].name;
          const pokemonNamePc = pc[index2].name;
          M.reply(`✔ Pokémon *(${pokemonNameParty})* from party and Pokémon *(${pokemonNamePc})* from PC have been swapped.`);
        } else if (prefix1 === 'pc' && prefix2 === 'p') {
          // Swap between PC and party
          if (index1 < 0 || index1 >= pc.length || index2 < 0 || index2 >= party.length) {
            return M.reply('❌ One or both indices are out of range.');
          }
          [pc[index1], party[index2]] = [party[index2], pc[index1]];
          await client.poke.set(`${M.sender}_Party`, party);
          await client.poke.set(`${M.sender}_Pss`, pc);
          const pokemonNamePc = pc[index1].name;
          const pokemonNameParty = party[index2].name;
          M.reply(`✔ Pokémon *(${pokemonNamePc})* from PC and Pokémon *(${pokemonNameParty})* from party have been swapped.`);
        } else {
          return M.reply('❌ Invalid prefix. Use "p" for party and "pc" for PC.');
        }
      } else {
        return M.reply('❌ Please provide one or two indices with their prefixes (p or pc).');
      }
    } catch (err) {
      console.log(err);
      await client.sendMessage(M.from, { image: { url: `${client.utils.errorChan()}` }, caption: `${client.utils.greetings()} Error-Chan Dis\n\nError:\n${err}` });
    }
  },
};
