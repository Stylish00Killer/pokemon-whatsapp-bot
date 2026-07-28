'use strict';

/**
 * PokéAPI-backed Pokémon data helpers.
 * All external API results are cached in memory so each species/move is only
 * fetched once per process lifetime — prevents rate-limits and cuts latency
 * on repeated !fight / !catch commands.
 */

const axios             = require('axios');
const { PokemonClient } = require('pokenode-ts');
const utils             = require('../utils');

// ── In-process cache ──────────────────────────────────────────────────────────
// Key: slug / id string  →  Value: raw PokeAPI response data
const _pokeCache    = new Map();   // pokemon endpoint
const _speciesCache = new Map();   // pokemon-species endpoint

/**
 * Fetch https://pokeapi.co/api/v2/pokemon/<slug> with caching.
 */
async function fetchPokemon(slug) {
    const key = String(slug).toLowerCase();
    if (_pokeCache.has(key)) return _pokeCache.get(key);
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${key}`);
    _pokeCache.set(key, data);
    // Also cache by numeric id so id-based lookups hit the cache too
    _pokeCache.set(String(data.id), data);
    return data;
}

/**
 * Fetch https://pokeapi.co/api/v2/pokemon-species/<name> with caching.
 */
async function fetchSpecies(name) {
    const key = String(name).toLowerCase();
    if (_speciesCache.has(key)) return _speciesCache.get(key);
    const server = new PokemonClient();
    const species = await server.getPokemonSpeciesByName(key);
    _speciesCache.set(key, species);
    return species;
}

// ── Starter selection ─────────────────────────────────────────────────────────

const STARTER_SLUGS = ['bulbasaur', 'charmander', 'squirtle'];
const STARTER_EMOJI = { bulbasaur: '🌿', charmander: '🔥', squirtle: '💧' };

/**
 * Fetch a fresh starter Pokémon from PokeAPI at level 5.
 * Results for each species are cached; only the first caller pays the API cost.
 * @param {string} slug  bulbasaur | charmander | squirtle
 * @returns {Promise<object|null>}
 */
async function buildStarter(slug) {
    slug = slug.toLowerCase().trim();
    if (!STARTER_SLUGS.includes(slug)) return null;

    const data  = await fetchPokemon(slug);
    const level = 5;

    const { hp, attack, defense, speed } = await utils.getPokemonStats(data.id, level);
    const { moves, rejectedMoves }       = await utils.assignPokemonMoves(slug, level);

    const { gender_rate } = await fetchSpecies(slug);
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
 * The species data is cached so battling the same Pokémon twice costs only
 * one network round-trip for the base data.
 * @returns {Promise<object>}
 */
async function spawnWild() {
    const id    = utils.getRandomInt(1, 898);
    const level = utils.getRandomInt(5, 15);

    const data = await fetchPokemon(id);
    const { hp, attack, defense, speed } = await utils.getPokemonStats(data.id, level);
    const { moves, rejectedMoves }       = await utils.assignPokemonMoves(data.name, level);
    const exp = utils.calculatePokeExp(level);

    const { gender_rate } = await fetchSpecies(data.name);
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

module.exports = { STARTER_SLUGS, buildStarter, spawnWild, fetchPokemon, fetchSpecies };
