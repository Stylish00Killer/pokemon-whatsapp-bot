'use strict';

/**
 * Pokémon utility functions — ported from eve-bot/src/Structures/Functions.js
 * Only the Pokémon-related helpers are included here.
 */

const axios      = require('axios');
const { join }   = require('path');
const { readFile } = require('fs').promises;
const workerpool = require('workerpool');
const { MoveClient } = require('pokenode-ts');

// One shared pool — workers are reused across calls.
const _canvasPool = workerpool.pool(join(__dirname, 'workers', 'canvas.worker.js'), { maxWorkers: 2 });
process.on('exit', () => _canvasPool.terminate());
const delay      = (ms) => new Promise(r => setTimeout(r, ms));
const maxLevel   = 100;

const capitalize = (s = '') => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomUniqueTag = (n = 4) => {
    const maxDigits = 11;
    if (n > maxDigits) return `${generateRandomUniqueTag(maxDigits)}${generateRandomUniqueTag(n - maxDigits)}`;
    const max = Math.pow(10, n);
    const min = Math.pow(10, n - 1);
    return (Math.floor(Math.random() * (max - min)) + min).toString();
};

const calculatePokeExp = (level) => {
    if (level <= 0 || level > maxLevel) return Infinity;
    return level <= 10  ? 100 + (level - 1) * 100
         : level <= 50  ? 1000 + (level - 10) * 200
         : 9000 + (level - 50) * 300;
};

const getLevelByExp = (exp) => {
    if (exp < 100)  return 0;
    if (exp < 1000) return Math.floor((exp - 100) / 100) + 1;
    if (exp < 9000) return Math.floor((exp - 1000) / 200) + 10;
    return Math.min(Math.floor((exp - 9000) / 300) + 50, maxLevel);
};

const getExpByLevel = (level) => calculatePokeExp(level);

const convertMs = (ms, to = 'seconds') => {
    let seconds = parseInt(Math.floor(ms / 1000));
    let minutes = parseInt(Math.floor(seconds / 60));
    let hours   = parseInt(Math.floor(minutes / 60));
    let days    = parseInt(Math.floor(hours / 24));
    if (to === 'seconds') return seconds;
    if (to === 'minutes') return minutes;
    if (to === 'hours')   return hours;
    if (to === 'days')    return days;
    return { days, hours: hours % 24, minutes: minutes % 60, seconds: seconds % 60 };
};

const getBuffer = async (url) => (await axios.get(url, { responseType: 'arraybuffer' })).data;

/**
 * Fetch base stats from PokeAPI and scale to given level.
 */
const getPokemonStats = async (pokemon, level) => {
    const id = typeof pokemon === 'string' ? pokemon.toLowerCase() : String(pokemon).trim();
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const wanted = ['hp', 'attack', 'defense', 'speed'];
    const stats  = { hp: 0, attack: 0, defense: 0, speed: 0 };
    data.stats.filter(s => wanted.includes(s.stat.name)).forEach(s => {
        stats[s.stat.name] = Math.floor(s.base_stat + level * (s.base_stat / 50));
    });
    return stats;
};

/**
 * Get up to 2 level-up moves learned at or before level 5 (starter moves).
 */
const getStarterPokemonMoves = async (pokemon) => {
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const eligible = data.moves.filter(m =>
        m.version_group_details[0].move_learn_method.name === 'level-up' &&
        m.version_group_details[0].level_learned_at <= 5
    );
    const client = new MoveClient();
    const result = [];
    for (const { move } of eligible) {
        if (result.length >= 2) break;
        const md = await client.getMoveByName(move.name);
        result.push(buildMoveObj(md));
    }
    return result;
};

const shuffleArray = (arr) => {
    let c = arr.length;
    while (c > 0) { const i = Math.floor(Math.random() * c); c--; [arr[c], arr[i]] = [arr[i], arr[c]]; }
    return arr;
};

/**
 * Assign up to 4 random level-up moves for a wild/caught Pokémon.
 */
const assignPokemonMoves = async (pokemon, level) => {
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const eligible = shuffleArray(data.moves.filter(m =>
        m.version_group_details[0].move_learn_method.name === 'level-up' &&
        m.version_group_details[0].level_learned_at <= level
    ));
    const moveClient    = new MoveClient();
    const result        = [];
    const rejectedMoves = [];
    for (const { move } of eligible) {
        if (result.length >= 4) { rejectedMoves.push(move.name); continue; }
        const md = await moveClient.getMoveByName(move.name);
        result.push(buildMoveObj(md));
    }
    return { moves: result, rejectedMoves };
};

/**
 * Find a move this Pokémon can learn at its current level that it hasn't learned yet.
 */
const getPokemonLearnableMove = async (pokemon, level, learntMoves, rejectedMoves = []) => {
    const known = learntMoves.map(m => m.name);
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const eligible = data.moves.filter(m =>
        m.version_group_details[0].move_learn_method.name === 'level-up' &&
        m.version_group_details[0].level_learned_at <= level &&
        !known.includes(m.move.name) &&
        !rejectedMoves.includes(m.move.name)
    );
    if (!eligible.length) return null;
    const moveClient = new MoveClient();
    const md = await moveClient.getMoveByName(eligible[0].move.name);
    return buildMoveObj(md);
};

/**
 * Build a standardised move object from pokenode-ts MoveClient result.
 */
function buildMoveObj(md) {
    const stat_change  = md.stat_changes.map(({ change, stat }) => ({ target: stat.name, change }));
    const effect       = md.meta?.ailment?.name || '';
    const descriptions = md.flavor_text_entries.filter(x => x.language.name === 'en');
    return {
        name: md.name,
        accuracy:  md.accuracy  || 0,
        pp:        md.pp        || 5,
        maxPp:     md.pp        || 5,
        id:        md.id,
        power:     md.power     || 0,
        priority:  md.priority,
        type:      md.type.name,
        stat_change,
        effect,
        drain:   md.meta ? md.meta.drain   : 0,
        healing: md.meta ? md.meta.healing : 0,
        description: descriptions[0] ? descriptions[0].flavor_text : '',
    };
}

/**
 * Load type effectiveness from local JSON.
 */
const getPokemonWeaknessAndStrongTypes = async (...types) => {
    if (!types.length) return { weakness: [], strong: [] };
    const typesData = JSON.parse(
        await readFile(join(__dirname, '..', 'assets', 'json', 'types.json'), 'utf8')
    );
    const strong   = new Set();
    const weakness = new Set();
    for (const type of types) {
        const td = typesData[type.toLowerCase()];
        if (td) {
            td.weakness.forEach(x => weakness.add(x));
            td.strong.forEach(x   => strong.add(x));
        }
    }
    return { weakness: Array.from(weakness), strong: Array.from(strong) };
};

/**
 * Draw a Pokémon battle scene in a worker thread (non-blocking).
 * Returns a Buffer or null on failure.
 */
const drawPokemonBattle = async (data) => {
    try {
        const base64 = await _canvasPool.exec('drawPokemonBattle', [data]);
        if (!base64) return null;
        return Buffer.from(base64, 'base64');
    } catch {
        return null;
    }
};

/**
 * Handle Pokémon stat update and move learning on level-up.
 */
const handlePokemonStats = async (client, M, pkmn, inBattle, player, user) => {
    const learnableMove = await getPokemonLearnableMove(pkmn.name, pkmn.level, pkmn.moves, pkmn.rejectedMoves);
    await client.sendMessage(M.from, { mentions: [user], text: `*@${user.split('@')[0]}*'s ${capitalize(pkmn.name)} grew to Level ${pkmn.level}` });
    await delay(2500);
    if (!learnableMove) return handlePokemonEvolution(client, M, pkmn, inBattle, player, user);

    const party = (await client.poke.get(`${user}_Party`)) || [];
    const i     = party.findIndex(x => x.tag === pkmn.tag);
    const { hp, speed, defense, attack } = await getPokemonStats(pkmn.id, pkmn.level);
    // Clamp so a large defense stat on the new level never drives current HP below 0.
    pkmn.hp      = Math.max(0, pkmn.hp + (hp - pkmn.maxHp));
    pkmn.maxHp = hp; pkmn.maxAttack = attack; pkmn.maxSpeed = speed; pkmn.maxDefense = defense;
    pkmn.attack = attack; pkmn.defense = defense; pkmn.speed = speed;
    party[i] = pkmn;
    await client.poke.set(`${user}_Party`, party);

    if (inBattle) {
        const bdata = client.pokemonBattleResponse.get(M.from);
        if (bdata && bdata[player].activePokemon.tag === pkmn.tag) {
            bdata[player].activePokemon = pkmn;
            client.pokemonBattleResponse.set(M.from, bdata);
        }
    }

    const moveName = learnableMove.name.split('-').map(capitalize).join(' ');

    if (pkmn.moves.length < 4) {
        pkmn.moves.push(learnableMove);
        party[i] = pkmn;
        if (inBattle) {
            const bdata = client.pokemonBattleResponse.get(M.from);
            if (bdata && bdata[player].activePokemon.tag === pkmn.tag) {
                bdata[player].activePokemon = pkmn;
                client.pokemonBattleResponse.set(M.from, bdata);
            }
        }
        await client.poke.set(`${user}_Party`, party);
        await client.sendMessage(M.from, { text: `*@${user.split('@')[0]}*'s *${capitalize(pkmn.name)}* learnt *${moveName}*`, mentions: [user] });
        await delay(3000);
        return handlePokemonEvolution(client, M, pkmn, inBattle, player, user);
    } else {
        let movesText = `*Moves | ${capitalize(pkmn.name)}*`;
        for (let mi = 0; mi < pkmn.moves.length; mi++) {
            const m = pkmn.moves[mi];
            movesText += `\n\n*#${mi + 1}*\n❓ *Move:* ${m.name.split('-').map(capitalize).join(' ')}\n〽 *PP:* ${m.maxPp}\n🎗 *Type:* ${capitalize(m.type || 'Normal')}\n🎃 *Power:* ${m.power}\n🎐 *Accuracy:* ${m.accuracy}\nUse *!learn --${m.name}* to replace this move.`;
        }
        movesText += `\n\nUse *!learn --cancel* to skip learning ${moveName}.`;
        client.pokemonMoveLearningResponse.set(`${M.from}${user}`, { move: learnableMove, data: pkmn });
        await client.sendMessage(M.from, { text: `*@${user.split('@')[0]}*, your *${capitalize(pkmn.name)}* wants to learn *${moveName}* but already knows 4 moves.\n\n*[Reply within 60s or it is auto-cancelled]*`, mentions: [user] });
        await delay(1500);
        await client.sendMessage(M.from, { text: movesText });
        setTimeout(async () => {
            if (client.pokemonMoveLearningResponse.has(`${M.from}${user}`)) {
                client.pokemonMoveLearningResponse.delete(`${M.from}${user}`);
                party[i].rejectedMoves.push(learnableMove.name);
                await client.poke.set(`${user}_Party`, party);
                await client.sendMessage(M.from, { text: `*@${user.split('@')[0]}*'s *${capitalize(pkmn.name)}* did not learn *${moveName}*`, mentions: [user] });
            }
            return handlePokemonEvolution(client, M, pkmn, inBattle, player, user);
        }, 60 * 1000);
    }
};

const handlePokemonEvolution = async (client, M, pkmn, inBattle, player, user) => {
    try {
        const speciesRes = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${pkmn.name}`);
        const chainRes   = await axios.get(speciesRes.data.evolution_chain.url);
        const rootNode   = chainRes.data.chain;
        const findNode   = (node, name) => {
            if (node.species.name === name) return node;
            for (const c of node.evolves_to) { const f = findNode(c, name); if (f) return f; }
            return null;
        };
        const currentNode = findNode(rootNode, pkmn.name);
        if (!currentNode || !currentNode.evolves_to.length) return;
        const nextNode  = currentNode.evolves_to[0];
        const details   = nextNode.evolution_details[0];
        if (!details || details.trigger?.name !== 'level-up') return;
        if (details.min_level && details.min_level > pkmn.level) return;
        if (client.pokemonEvolutionResponse.has(user)) return;

        const evolved = nextNode.species.name;
        const party   = (await client.poke.get(`${user}_Party`)) || [];
        const i       = party.findIndex(x => x.tag === pkmn.tag);
        client.pokemonEvolutionResponse.set(user, { group: M.from, pokemon: pkmn.name });
        await client.sendMessage(M.from, {
            text: `*@${user.split('@')[0]}*, your *${capitalize(pkmn.name)}* is evolving to *${capitalize(evolved)}*!\nUse *!cancel-evolution* within 60s to cancel.`,
            mentions: [user],
        });
        setTimeout(async () => {
            if (!client.pokemonEvolutionResponse.has(user)) return;
            client.pokemonEvolutionResponse.delete(user);
            const { data: pData } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${evolved}`);
            pkmn.id    = pData.id;
            pkmn.image = pData.sprites.other['official-artwork'].front_default;
            pkmn.name  = pData.name;
            const { hp, attack, defense, speed } = await getPokemonStats(pkmn.id, pkmn.level);
            // Clamp HP so evolution stat gain never produces negative current HP.
            pkmn.hp = Math.max(0, pkmn.hp + (hp - pkmn.maxHp));
            pkmn.maxHp = hp; pkmn.maxAttack = attack; pkmn.maxSpeed = speed; pkmn.maxDefense = defense;
            pkmn.attack = attack; pkmn.defense = defense; pkmn.speed = speed;
            if (pkmn.tag === '0') await client.poke.set(`${user}_Companion`, pData.name);
            if (inBattle) {
                const bdata = client.pokemonBattleResponse.get(M.from);
                if (bdata && bdata[player]?.activePokemon.tag === pkmn.tag) {
                    bdata[player].activePokemon = pkmn;
                    client.pokemonBattleResponse.set(M.from, bdata);
                }
            }
            party[i] = pkmn;
            await client.poke.set(`${user}_Party`, party);
            // getBuffer can fail if the sprite URL is unavailable — fall back to text.
            const buf = await getBuffer(pkmn.image).catch(() => null);
            if (buf) {
                await client.sendMessage(M.from, {
                    image: buf,
                    caption: `🎉 *@${user.split('@')[0]}*'s *${capitalize(pkmn.name.replace(evolved, ''))}* evolved into *${capitalize(evolved)}*!`,
                    mentions: [user],
                });
            } else {
                await client.sendMessage(M.from, {
                    text: `🎉 *@${user.split('@')[0]}*'s Pokémon evolved into *${capitalize(evolved)}*!`,
                    mentions: [user],
                });
            }
        }, 60 * 1000);
    } catch (e) {
        console.error('[handlePokemonEvolution]', e.message);
    }
};

module.exports = {
    capitalize, getRandomInt, generateRandomUniqueTag,
    calculatePokeExp, getLevelByExp, getExpByLevel, convertMs, getBuffer,
    getPokemonStats, getStarterPokemonMoves, assignPokemonMoves,
    getPokemonLearnableMove, getPokemonWeaknessAndStrongTypes,
    drawPokemonBattle, handlePokemonStats, handlePokemonEvolution,
    buildMoveObj, delay,
};
