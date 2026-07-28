'use strict';

/**
 * PokéAPI-backed Pokémon data helpers.
 * Replaces the old hardcoded fake pool — all data is live from pokeapi.co.
 */

const axios          = require('axios');
const { PokemonClient } = require('pokenode-ts');
const utils          = require('../utils');

// ── Starter selection ────────────────────────────────────────────────────────

const STARTER_SLUGS = ['bulbasaur', 'charmander', 'squirtle'];
const STARTER_EMOJI = { bulbasaur: '🌿', charmander: '🔥', squirtle: '💧' };

/**
 * Fetch a fresh starter Pokémon from PokeAPI at level 5.
 * @param {string} slug  bulbasaur | charmander | squirtle
 * @returns {Promise<object|null>}
 */
async function buildStarter(slug) {
    slug = slug.toLowerCase().trim();
    if (!STARTER_SLUGS.includes(slug)) return null;

    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    const level    = 5;

    const { hp, attack, defense, speed } = await utils.getPokemonStats(data.id, level);
    const { moves, rejectedMoves }       = await utils.assignPokemonMoves(slug, level);

    const server = new PokemonClient();
    const { gender_rate } = await server.getPokemonSpeciesByName(slug);
    let female = false;
    if (gender_rate >= 8) female = true;
    else if (gender_rate > 0) female = Math.random() < 0.5;

    const exp = utils.calculatePokeExp(level);

    return {
        name:       data.name,
        id:         data.id,
        emoji:      STARTER_EMOJI[slug] || '⭐',
        image:      data.sprites.other['official-artwork'].front_default,
        types:      data.types.map(t => t.type.name),
        level,
        exp,
        displayExp: 0,
        female,
        hp,  maxHp:      hp,
        attack, maxAttack: attack,
        defense, maxDefense: defense,
        speed, maxSpeed:   speed,
        moves,
        rejectedMoves,
        state: { status: '', movesUsed: 0 },
        tag:   utils.generateRandomUniqueTag(10),
    };
}

/**
 * Spawn a wild Pokémon at a random level 5–15.
 * @returns {Promise<object>}
 */
async function spawnWild() {
    const id    = utils.getRandomInt(1, 898);
    const level = utils.getRandomInt(5, 15);

    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const { hp, attack, defense, speed } = await utils.getPokemonStats(data.id, level);
    const { moves, rejectedMoves }       = await utils.assignPokemonMoves(data.name, level);
    const exp = utils.calculatePokeExp(level);

    const server = new PokemonClient();
    const { gender_rate } = await server.getPokemonSpeciesByName(data.name);
    let female = false;
    if (gender_rate >= 8) female = true;
    else if (gender_rate > 0) female = Math.random() < 0.5;

    const image = data.sprites.other['official-artwork'].front_default;

    return {
        name:       data.name,
        id:         data.id,
        image,
        types:      data.types.map(t => t.type.name),
        level,
        exp,
        displayExp: 0,
        female,
        hp,  maxHp:      hp,
        attack, maxAttack: attack,
        defense, maxDefense: defense,
        speed, maxSpeed:   speed,
        moves,
        rejectedMoves,
        state: { status: '', movesUsed: 0 },
        tag:   utils.generateRandomUniqueTag(10),
    };
}

module.exports = { STARTER_SLUGS, buildStarter, spawnWild };
