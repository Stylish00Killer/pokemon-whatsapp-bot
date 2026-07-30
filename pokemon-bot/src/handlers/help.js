'use strict';

/**
 * !help — List all available bot commands.
 */

module.exports = async function helpHandler({ client, msg, from }) {
    const text = `
🤖 *Pokémon Bot — Command List*

━━━━━━━━━━ 🌟 *Onboarding* ━━━━━━━━━━
▸ *!start* — Register as a trainer & receive a starter Pokémon.

━━━━━━━━ 🎒 *Economy & Items* ━━━━━━━━
▸ *!daily* — Claim your daily reward (Pokéballs & gems).
▸ *!heal* — Heal all Pokémon in your party.
▸ *!pg* — View your trainer profile & wallet.

━━━━━━━━ 🐾 *Catching & Party* ━━━━━━━━
▸ *!catch* — Throw a Pokéball at the active wild spawn.
▸ *!party* — View your current Pokémon party.
▸ *!pss* — Access Pokémon Storage (box).
▸ *!dex <name|id>* — Look up a Pokémon in the Pokédex.

━━━━━━━━━ ⚔️ *PVE Battle* ━━━━━━━━━━
▸ *!pve* — Encounter a wild Pokémon for battle.
▸ *!fight <number>* — Use a move in your active PVE battle.

━━━━━━━━━ 🏆 *PVP Battle* ━━━━━━━━━━
▸ *!challenge @user* — Challenge another trainer.
▸ *!challenge --accept* — Accept an incoming challenge.
▸ *!challenge --reject* — Reject an incoming challenge.
▸ *!challenge --cancel* — Cancel your pending challenge.
▸ *!battle fight <number>* — Use a move in a PVP battle.
▸ *!battle switch <number>* — Swap your active Pokémon.
▸ *!battle forfeit* — Surrender the current PVP battle.
▸ *!battle pokemon* — View your party during a battle.

━━━━━━━━━ 📚 *Moves & Growth* ━━━━━━━━
▸ *!learn --<move>* — Replace a move on level-up.
▸ *!learn --cancel* — Skip learning the offered move.
▸ *!cancel-evolution* — Cancel an in-progress evolution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 All commands require the *!* prefix.
⚠️ Battle commands only work inside group chats.
`.trim();

    return client.sendMessage(from, { text }, { quoted: msg });
};
