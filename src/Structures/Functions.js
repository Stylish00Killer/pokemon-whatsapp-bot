'use strict';

const axios          = require('axios').default;
const { tmpdir }     = require('os');
const { promisify }  = require('util');
const moment         = require('moment-timezone');
const FormData       = require('form-data');
const { load }       = require('cheerio');
const cheerio        = require('cheerio');
const { exec }       = require('child_process');
const { createCanvas, loadImage } = require('canvas');
const Canvas         = require('canvas');
const { join }       = require('path');
const { sizeFormatter } = require('human-readable');
const { readFile, unlink, writeFile } = require('fs-extra');
const { removeBackgroundFromImageBase64 } = require('remove.bg');
const { MoveClient } = require('pokenode-ts');
const path           = require('path');

const baseUrl   = 'https://www.myinstants.com';
const searchUrl = 'https://www.myinstants.com/search/?name=';
const delay     = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const maxLevel  = 100;

// ─── Canvas drawing helpers ───────────────────────────────────────────────────

/**
 * Draws a Hangman image based on the number of mistakes.
 * @param {number} mistakes
 * @returns {Promise<Buffer>}
 */
const drawHangMan = async (mistakes) => {
    const canvasSize = 400;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(120, 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(120, 20);
    ctx.lineTo(120, 100);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(120, 20);
    ctx.lineTo(canvasSize / 2, 20);
    ctx.stroke();

    if (mistakes >= 1) {
        ctx.beginPath();
        ctx.arc(canvasSize / 2, 120, 40, 0, Math.PI * 2);
        ctx.stroke();
    }
    if (mistakes >= 2) {
        ctx.beginPath();
        ctx.moveTo(canvasSize / 2, 160);
        ctx.lineTo(canvasSize / 2, 280);
        ctx.stroke();
    }
    if (mistakes >= 3) {
        ctx.beginPath();
        ctx.moveTo(canvasSize / 2, 180);
        ctx.lineTo(canvasSize / 2 - 50, 240);
        ctx.stroke();
    }
    if (mistakes >= 4) {
        ctx.beginPath();
        ctx.moveTo(canvasSize / 2, 180);
        ctx.lineTo(canvasSize / 2 + 50, 240);
        ctx.stroke();
    }
    if (mistakes >= 5) {
        ctx.beginPath();
        ctx.moveTo(canvasSize / 2, 280);
        ctx.lineTo(canvasSize / 2 - 40, 360);
        ctx.stroke();
    }
    if (mistakes >= 6) {
        ctx.beginPath();
        ctx.moveTo(canvasSize / 2, 280);
        ctx.lineTo(canvasSize / 2 + 40, 360);
        ctx.stroke();
    }

    return canvas.toBuffer();
};

/**
 * Draws a Tic Tac Toe board.
 * @returns {Buffer}
 */
const drawTTTBoard = () => {
    const canvasSize = 300;
    const cellSize   = canvasSize / 3;
    const canvas     = createCanvas(canvasSize, canvasSize);
    const ctx        = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;

    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvasSize, i * cellSize);
        ctx.stroke();
    }

    for (let j = 1; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, canvasSize);
        ctx.stroke();
    }

    return canvas.toBuffer();
};

/**
 * Formats the URL for an instant sound effect on Myinstants.com.
 * @param {string} url
 * @returns {string}
 */
const getFormattedUrl = (url) => {
    return baseUrl.concat(url.split("'")[1]);
};

/**
 * Searches Myinstants.com for a sound effect.
 * @param {string} term
 * @returns {Promise<string|null>}
 */
const search = async (term) => {
    try {
        const { data: html } = await axios.get(`${searchUrl}${encodeURIComponent(term)}`);
        const $             = cheerio.load(html);
        const resultDiv     = $('#instants_container');
        const attrs         = resultDiv
            .find('.instant')
            .first()
            .find('.small-button')
            .first()
            .attr();
        if (!attrs) return null;
        return getFormattedUrl(attrs.onclick);
    } catch {
        return null;
    }
};

/**
 * Downloads a URL as a Buffer.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
const getBuffer = async (url) =>
    (await axios.get(url, { responseType: 'arraybuffer' })).data;

/**
 * @param {string} content
 * @param {boolean} all
 * @returns {string}
 */
const capitalize = (content, all = false) => {
    if (!all) return `${content.charAt(0).toUpperCase()}${content.slice(1)}`;
    return content
        .split('')
        .map((text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`)
        .join('');
};

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const getRandomInt = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Generates a fake credit card image.
 * @param {string} cardName
 * @param {string} expiryDate
 * @returns {Promise<Buffer>}
 */
const generateCreditCardImage = async (cardName, expiryDate) => {
    const canvas = createCanvas(800, 500);
    const ctx    = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#eee';
    ctx.fillRect(60, 190, 680, 110);

    ctx.fillStyle = '#000';
    ctx.font = '42px Arial, sans-serif';
    const cardNumber      = '1234 5678 9012 3456';
    const cardNumberWidth = ctx.measureText(cardNumber).width;
    ctx.fillText(cardNumber, (canvas.width - cardNumberWidth) / 2, 250);

    ctx.fillStyle = '#eee';
    ctx.fillRect(60, 320, 340, 70);

    ctx.fillStyle = '#000';
    ctx.font = '20px Arial, sans-serif';
    const cardNameLabel      = 'Card Holder';
    const cardNameLabelWidth = ctx.measureText(cardNameLabel).width;
    ctx.fillText(cardNameLabel, 80, 360);
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(cardName.toUpperCase(), 80 + cardNameLabelWidth + 10, 360);

    ctx.fillStyle = '#eee';
    ctx.fillRect(430, 320, 200, 70);

    ctx.fillStyle = '#000';
    ctx.font = '20px Arial, sans-serif';
    const expDateLabel      = 'Expires';
    const expDateLabelWidth = ctx.measureText(expDateLabel).width;
    ctx.fillText(expDateLabel, 450, 360);
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(expiryDate, 450 + expDateLabelWidth + 10, 360);

    try {
        const cardLogo = await loadImage(
            'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Visa.svg/1200px-Visa.svg.png'
        );
        ctx.drawImage(cardLogo, canvas.width - 120, canvas.height - 80, 80, 50);
    } catch { /* ignore if image fails */ }

    for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }

    return canvas.toBuffer();
};

const greetings = () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 12) return '🌅 Ohayou gozaimasu';
    if (hour >= 12 && hour < 18) return '🌞 Konnichiwa';
    return '🌇 Konbanwa';
};

const errorChan = () =>
    'https://i.ibb.co/Htdgs0w/c8f67a2f49ebc5f6d7293e7649bc5ebd.jpg';

const generateRandomHex = () =>
    `#${(~~(Math.random() * (1 << 24))).toString(16).padStart(6, '0')}`;

/**
 * @param {string} content
 * @returns {number[]}
 */
const extractNumbers = (content) => {
    const search = content.match(/(-\d+|\d+)/g);
    if (search !== null) return search.map((s) => parseInt(s)) || [];
    return [];
};

/**
 * Extract URLs from a string (simple regex fallback — linkify removed as it caused runtime errors).
 * @param {string} content
 * @returns {string[]}
 */
const extractUrls = (content) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (content.match(urlRegex) || []);
};

/**
 * Fetch URL content as text/data (returns parsed JSON or raw text).
 * @param {string} url
 * @returns {Promise<any>}
 */
const fetch = async (url) => (await axios.get(url)).data;

/**
 * @param {Buffer} webp
 * @returns {Promise<Buffer>}
 */
const webpToPng = async (webp) => {
    const filename = `${tmpdir()}/${Math.random().toString(36)}`;
    await writeFile(`${filename}.webp`, webp);
    await execute(`dwebp "${filename}.webp" -o "${filename}.png"`);
    const buffer = await readFile(`${filename}.png`);
    Promise.all([unlink(`${filename}.png`), unlink(`${filename}.webp`)]);
    return buffer;
};

/**
 * @param {Buffer} webp
 * @returns {Promise<Buffer>}
 */
const webpToMp4 = async (webp) => {
    const responseFile = async (form, buffer = '') => {
        return axios.post(
            buffer
                ? `https://ezgif.com/webp-to-mp4/${buffer}`
                : 'https://ezgif.com/webp-to-mp4',
            form,
            {
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${form._boundary}`,
                },
            }
        );
    };
    return new Promise(async (resolve, reject) => {
        const form = new FormData();
        form.append('new-image-url', '');
        form.append('new-image', webp, { filename: 'blob' });
        responseFile(form)
            .then(({ data }) => {
                const datafrom = new FormData();
                const $        = load(data);
                const file     = $('input[name="file"]').attr('value');
                datafrom.append('file', file);
                datafrom.append('convert', 'Convert WebP to MP4!');
                responseFile(datafrom, file)
                    .then(async ({ data }) => {
                        const $ = load(data);
                        const rawSrc = $('div#output > p.outfile > video > source').attr('src') || '';
                        const result = await getBuffer(
                            rawSrc.startsWith('http') ? rawSrc : `https:${rawSrc}`
                        );
                        resolve(result);
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
};

/**
 * @param {Buffer} gif
 * @param {boolean} write
 * @returns {Promise<Buffer|string>}
 */
const gifToMp4 = async (gif, write = false) => {
    const filename = `${tmpdir()}/${Math.random().toString(36)}`;
    await writeFile(`${filename}.gif`, gif);
    await execute(
        `ffmpeg -f gif -i ${filename}.gif -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${filename}.mp4`
    );
    if (write) return `${filename}.mp4`;
    const buffer = await readFile(`${filename}.mp4`);
    Promise.all([unlink(`${filename}.gif`), unlink(`${filename}.mp4`)]);
    return buffer;
};

const execute = promisify(exec);

const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

const calculatePing = (timestamp, now) => (now - timestamp) / 1000;

const formatSize = sizeFormatter({
    std: 'JEDEC',
    decimalPlaces: '2',
    keepTrailingZeroes: false,
    render: (literal, symbol) => `${literal} ${symbol}B`,
});

const term = (param) =>
    new Promise((resolve, reject) => {
        console.log('Run terminal =>', param);
        exec(param, (error, stdout, stderr) => {
            if (error) { console.log(error.message); resolve(error.message); }
            if (stderr) { console.log(stderr); resolve(stderr); }
            console.log(stdout);
            resolve(stdout);
        });
    });

const restart = () => {
    console.log('[BOT] Restart requested — exiting process...');
    setTimeout(() => process.exit(0), 500);
};

const convertMs = (ms, to = 'seconds') => {
    let seconds = parseInt(Math.floor(ms / 1000).toString().split('.')[0]);
    let minutes = parseInt(Math.floor(seconds / 60).toString().split('.')[0]);
    let hours   = parseInt(Math.floor(minutes / 60).toString().split('.')[0]);
    let days    = parseInt(Math.floor(hours / 24).toString().split('.')[0]);
    if (to === 'seconds') return seconds;
    if (to === 'minutes') return minutes;
    if (to === 'hours')   return hours;
    if (to === 'days')    return days;
    seconds = parseInt((seconds % 60).toString().split('.')[0]);
    minutes = parseInt((minutes % 60).toString().split('.')[0]);
    hours   = parseInt((hours % 24).toString().split('.')[0]);
    return { days, seconds, minutes, hours };
};

/**
 * Converts first frame of a GIF to PNG.
 * @param {Buffer} gif
 * @returns {Promise<Buffer>}
 */
const gifToPng = async (gif) => {
    const filename = `${tmpdir()}/${Math.random().toString(36)}`;
    await writeFile(`${filename}.gif`, gif);
    await execute(`ffmpeg -i "${filename}.gif" -vframes 1 "${filename}.png"`);
    const buffer = await readFile(`${filename}.png`);
    await Promise.all([unlink(`${filename}.gif`), unlink(`${filename}.png`)]);
    return buffer;
};

// ─── Pokémon helpers ──────────────────────────────────────────────────────────

/**
 * @param {string|number} pokemon
 * @param {number} level
 * @returns {Promise<{hp:number, attack:number, defense:number, speed:number}>}
 */
const getPokemonStats = async (pokemon, level) => {
    pokemon =
        typeof pokemon === 'string'
            ? pokemon.toLowerCase()
            : pokemon.toString().trim();
    const response    = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const pokemonData = response.data;

    const wantedStatsNames = ['hp', 'attack', 'defense', 'speed'];
    const wantedStats = pokemonData.stats.filter((stat) =>
        wantedStatsNames.includes(stat.stat.name)
    );

    const pokemonStats = { hp: 0, attack: 0, defense: 0, speed: 0 };
    wantedStats.forEach((stat) => {
        pokemonStats[stat.stat.name] = Math.floor(
            stat.base_stat + level * (stat.base_stat / 50)
        );
    });

    return pokemonStats;
};

/**
 * @param {string} pokemon
 * @returns {Promise<string[]>}
 */
const getPokemonEvolutionChain = async (pokemon) => {
    const response1 = await axios.get(
        `https://pokeapi.co/api/v2/pokemon-species/${pokemon}`
    );
    const data      = response1.data;
    const response2 = await axios.get(data.evolution_chain.url);
    const res       = response2.data;
    const { chain } = res;

    const line       = [];
    const evolutions = [];

    line.push(chain.species.name);

    if (chain.evolves_to.length) {
        const second = chain.evolves_to.map((pkm) => pkm.species.name);
        if (second.length === 1) line.push(second[0]);
        else line.push(second);

        if (chain.evolves_to[0].evolves_to.length) {
            const third = chain.evolves_to[0].evolves_to.map((pkm) => pkm.species.name);
            if (third.length === 1) line.push(third[0]);
            else line.push(third);
        }
    }

    for (const pokemon of line) {
        if (Array.isArray(pokemon)) {
            pokemon.forEach((x) => evolutions.push(x));
            continue;
        }
        evolutions.push(pokemon);
    }

    return evolutions;
};

/**
 * @param {string} pokemon
 * @returns {Promise<object[]>}
 */
const getStarterPokemonMoves = async (pokemon) => {
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const data     = response.data;
    const moves    = data.moves.filter(
        (move) =>
            move.version_group_details[0].move_learn_method.name === 'level-up' &&
            move.version_group_details[0].level_learned_at <= 5
    );

    const result = [];
    const client = new MoveClient();

    for (const move of moves) {
        if (result.length >= 2) break;
        const moveData   = await client.getMoveByName(move.move.name);
        const stat_change = moveData.stat_changes.map(({ change, stat }) => ({
            target: stat.name,
            change,
        }));
        const effect       = moveData.meta?.ailment?.name || '';
        const descriptions = moveData.flavor_text_entries.filter(
            (x) => x.language.name === 'en'
        );

        result.push({
            name: moveData.name,
            accuracy: moveData.accuracy || 0,
            pp: moveData.pp || 5,
            maxPp: moveData.pp || 5,
            id: moveData.id,
            power: moveData.power || 0,
            priority: moveData.priority,
            type: moveData.type.name,
            stat_change,
            effect,
            drain: moveData.meta ? moveData.meta.drain : 0,
            healing: moveData.meta ? moveData.meta.healing : 0,
            description: descriptions[0] ? descriptions[0].flavor_text : '',
        });
    }

    return result;
};

/**
 * @param {...string} types
 * @returns {Promise<{weakness:string[], strong:string[]}>}
 */
const getPokemonWeaknessAndStrongTypes = async (...types) => {
    if (!types.length) return { weakness: [], strong: [] };

    const strong    = new Set();
    const weakness  = new Set();
    const typesDataPath = path.join(__dirname, '..', '..', 'assets', 'json', 'types.json');
    const typesData     = JSON.parse(await readFile(typesDataPath, 'utf8'));

    for (const type of types) {
        const typeData = typesData[type.toLowerCase()];
        if (typeData) {
            typeData.weakness.forEach((x) => weakness.add(x));
            typeData.strong.forEach((x) => strong.add(x));
        }
    }

    return {
        weakness: Array.from(weakness),
        strong: Array.from(strong),
    };
};

/**
 * @param {string} pokemon
 * @param {number} level
 * @param {object[]} learntMoves
 * @param {string[]} [rejectedMoves=[]]
 * @returns {Promise<object|null>}
 */
const getPokemonLearnableMove = async (
    pokemon,
    level,
    learntMoves,
    rejectedMoves = []
) => {
    const shouldDenyMoves = learntMoves.map((move) => move.name);

    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const data     = response.data;

    const moves = data.moves.filter(
        (move) =>
            move.version_group_details[0].move_learn_method.name === 'level-up' &&
            move.version_group_details[0].level_learned_at <= level &&
            !rejectedMoves.includes(move.move.name) &&
            !shouldDenyMoves.includes(move.move.name)
    );

    if (!moves.length) return null;

    const client    = new MoveClient();
    const moveData  = await client.getMoveByName(moves[0].move.name);
    const stat_change = moveData.stat_changes.map(({ stat, change }) => ({
        target: stat.name,
        change,
    }));
    const effect       = moveData.meta?.ailment?.name || '';
    const descriptions = moveData.flavor_text_entries.filter(
        (x) => x.language.name === 'en'
    );

    return {
        name: moveData.name,
        accuracy: moveData.accuracy || 0,
        pp: moveData.pp || 5,
        maxPp: moveData.pp || 5,
        id: moveData.id,
        power: moveData.power || 0,
        priority: moveData.priority,
        type: moveData.type.name,
        stat_change,
        effect,
        drain: moveData.meta ? moveData.meta.drain : 0,
        healing: moveData.meta ? moveData.meta.healing : 0,
        description: descriptions[0] ? descriptions[0].flavor_text : '',
    };
};

/**
 * @param {string} pokemon
 * @param {string|number} move
 * @returns {Promise<boolean>}
 */
const PokemonMoveIsLearnable = async (pokemon, move) => {
    const client   = new MoveClient();
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    const { name } = response.data;

    try {
        const res = typeof move === 'string'
            ? await client.getMoveByName(move)
            : await client.getMoveById(move);
        const pokemons = res.learned_by_pokemon.map((p) => p.name);
        return pokemons.includes(name);
    } catch {
        return false;
    }
};

/**
 * @param {Array} array
 * @returns {Array}
 */
const shuffleArray = (array) => {
    let counter = array.length;
    while (counter > 0) {
        const index = Math.floor(Math.random() * counter);
        counter--;
        const temp         = array[counter];
        array[counter]     = array[index];
        array[index]       = temp;
    }
    return array;
};

/**
 * @param {string} pokemon
 * @param {number} level
 * @returns {Promise<{moves:object[], rejectedMoves:string[]}>}
 */
const assignPokemonMoves = async (pokemon, level) => {
    const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
    let moves = shuffleArray(
        response.data.moves.filter(
            (move) =>
                move.version_group_details[0].move_learn_method.name === 'level-up' &&
                move.version_group_details[0].level_learned_at <= level
        )
    );

    const client        = new MoveClient();
    const result        = [];
    const rejectedMoves = [];

    for (const { move } of moves) {
        if (result.length >= 4) {
            rejectedMoves.push(move.name);
            continue;
        }
        const data        = await client.getMoveByName(move.name);
        const effect      = data.meta?.ailment?.name || '';
        const stat_change = [];
        const descriptions = data.flavor_text_entries.filter(
            (x) => x.language.name === 'en'
        );
        for (const change of data.stat_changes) {
            stat_change.push({ target: change.stat.name, change: change.change });
        }
        result.push({
            name: data.name,
            accuracy: data.accuracy || 0,
            pp: data.pp || 5,
            maxPp: data.pp || 5,
            id: data.id,
            power: data.power || 0,
            priority: data.priority,
            type: data.type.name,
            stat_change,
            effect,
            drain: data.meta ? data.meta.drain : 0,
            healing: data.meta ? data.meta.healing : 0,
            description: descriptions[0] ? descriptions[0].flavor_text : '',
        });
    }

    return { moves: result, rejectedMoves };
};

/**
 * @param {number} n
 * @returns {string}
 */
const generateRandomUniqueTag = (n = 4) => {
    const maxDigits = 11;
    if (n > maxDigits) {
        return `${generateRandomUniqueTag(maxDigits)}${generateRandomUniqueTag(n - maxDigits)}`;
    }
    const max = Math.pow(10, n);
    const min = Math.pow(10, n - 1);
    return (Math.floor(Math.random() * (max - min)) + min).toString();
};

/**
 * @param {number} level
 * @returns {number}
 */
const calculatePokeExp = (level) => {
    if (level <= 0 || level > maxLevel) return Infinity;
    return level <= 10
        ? 100 + (level - 1) * 100
        : level <= 50
        ? 1000 + (level - 10) * 200
        : 9000 + (level - 50) * 300;
};

/**
 * @param {number} exp
 * @returns {number}
 */
const getLevelByExp = (exp) => {
    if (exp < 100) return 0;
    if (exp < 1000) return Math.floor((exp - 100) / 100) + 1;
    if (exp < 9000) return Math.floor((exp - 1000) / 200) + 10;
    return Math.min(Math.floor((exp - 9000) / 300) + 50, maxLevel);
};

/** @param {number} level @returns {number} */
const getExpByLevel = (level) => calculatePokeExp(level);

/**
 * @param {number} currentExp
 * @returns {number}
 */
const getRequiredExp = (currentExp) => {
    const currentLevel = getLevelByExp(currentExp);
    const nextLevelExp = calculatePokeExp(currentLevel + 1);
    return nextLevelExp - currentExp;
};

/**
 * Handles Pokemon stats upon leveling up.
 */
const handlePokemonStats = async (client, M, pkmn, inBattle, player, user) => {
    const learnableMove = await getPokemonLearnableMove(
        pkmn.name,
        pkmn.level,
        pkmn.moves,
        pkmn.rejectedMoves
    );
    const jid = user;
    await client.sendMessage(M.from, {
        mentions: [jid],
        text: `*@${jid.split('@')[0]}*'s ${capitalize(pkmn.name)} grew to Level ${pkmn.level}`,
    });
    await delay(2500);
    if (!learnableMove)
        return await handlePokemonEvolution(client, M, pkmn, inBattle, player, user);

    const party = (await client.poke.get(`${jid}_Party`)) || [];
    const i     = party.findIndex((x) => x.tag === pkmn.tag);
    const { hp, speed, defense, attack } = await getPokemonStats(pkmn.id, pkmn.level);
    pkmn.hp      += hp - pkmn.maxHp;
    pkmn.speed   += speed - pkmn.speed;
    pkmn.defense += defense - pkmn.defense;
    pkmn.attack  += attack - pkmn.attack;
    pkmn.maxAttack  = attack;
    pkmn.maxSpeed   = speed;
    pkmn.maxHp      = hp;
    pkmn.maxDefense = defense;
    party[i] = pkmn;
    // Write back to the Pokémon owner's party (jid == user), not M.sender
    await client.poke.set(`${jid}_Party`, party);

    if (inBattle) {
        const data = client.pokemonBattleResponse.get(M.from);
        if (data && data[player].activePokemon.tag === pkmn.tag) {
            data[player].activePokemon = pkmn;
            client.pokemonBattleResponse.set(M.from, data);
        }
    }

    const move = learnableMove.name
        .split('-')
        .map((m) => capitalize(m))
        .join(' ');

    if (pkmn.moves.length < 4) {
        pkmn.moves.push(learnableMove);
        party[i] = pkmn;
        if (inBattle) {
            const data = client.pokemonBattleResponse.get(M.from);
            if (data && data[player].activePokemon.tag === pkmn.tag) {
                data[player].activePokemon = pkmn;
                client.pokemonBattleResponse.set(M.from, data);
            }
        }
        await client.poke.set(`${M.sender}_Party`, party);
        await client.sendMessage(M.from, {
            text: `*@${jid.split('@')[0]}*'s *${capitalize(pkmn.name)}* learnt *${move}*`,
            mentions: [jid],
        });
        await delay(3000);
        return await handlePokemonEvolution(client, M, pkmn, inBattle, player, user);
    } else {
        let Text = `*Moves | ${capitalize(pkmn.name)}*`;
        for (const m of pkmn.moves) {
            const idx = pkmn.moves.findIndex((x) => x.name === m.name);
            Text += `\n\n*#${idx + 1}*\n❓ *Move:* ${m.name
                .split('-')
                .map((n) => capitalize(n))
                .join(' ')}\n〽 *PP:* ${m.maxPp}\n🎗 *Type:* ${capitalize(
                m.type || 'Normal'
            )}\n🎃 *Power:* ${m.power}\n🎐 *Accuracy:* ${m.accuracy}\n🧧 *Description:* ${
                m.description
            }\nUse *${client.prefix}learn --${m.name}* to delete this move and learn the new one.`;
        }
        Text += `\n\nUse *${client.prefix}learn --cancel* if you don't want to learn ${move}.`;

        client.pokemonMoveLearningResponse.set(`${M.from}${jid}`, {
            move: learnableMove,
            data: pkmn,
        });

        const text = `*@${jid.split('@')[0]}*, your Pokemon *${capitalize(
            pkmn.name
        )}* is trying to learn *${move}*.\nBut a Pokemon can't learn more than 4 moves.\nDelete a move to learn this move.\n\n*[This will automatically be cancelled if you don't continue within 60 seconds]*`;

        await client.sendMessage(M.from, { text, mentions: [jid] });
        await delay(1500);
        await client.sendMessage(M.from, {
            text: `📝 *Move Details*\n\n❓ *Move:* ${move}\n〽 *PP:* ${
                learnableMove.maxPp
            }\n🎗 *Type:* ${capitalize(learnableMove.type)}\n🎃 *Power:* ${
                learnableMove.power
            }\n🎐 *Accuracy:* ${learnableMove.accuracy}\n🧧 *Description:* ${
                learnableMove.description
            }`,
        });
        await delay(1500);
        await client.sendMessage(M.from, { text: Text });

        setTimeout(async () => {
            if (client.pokemonMoveLearningResponse.has(`${M.from}${jid}`)) {
                client.pokemonMoveLearningResponse.delete(`${M.from}${jid}`);
                party[i].rejectedMoves.push(learnableMove.name);
                await client.poke.set(`${M.sender}_Party`, party);
                await client.sendMessage(M.from, {
                    text: `*@${jid.split('@')[0]}*'s *${capitalize(
                        pkmn.name
                    )}* Cancelled learning *${move}*`,
                    mentions: [jid],
                });
            }
            return await handlePokemonEvolution(client, M, pkmn, inBattle, player, user);
        }, 60 * 1000);
    }
};

/**
 * Handles Pokemon evolution triggers.
 */
const handlePokemonEvolution = async (client, M, pkmn, inBattle, player, user) => {
    try {
        // Fetch species + evolution chain directly from PokeAPI — no external dependency
        const speciesRes = await axios.get(
            `https://pokeapi.co/api/v2/pokemon-species/${pkmn.name}`
        );
        const chainRes = await axios.get(speciesRes.data.evolution_chain.url);
        const rootNode = chainRes.data.chain;

        // Walk the chain tree to find the node for the current pokemon
        const findNode = (node, name) => {
            if (node.species.name === name) return node;
            for (const child of node.evolves_to) {
                const found = findNode(child, name);
                if (found) return found;
            }
            return null;
        };

        const currentNode = findNode(rootNode, pkmn.name);
        if (!currentNode || currentNode.evolves_to.length === 0) return;

        const nextNode    = currentNode.evolves_to[0];
        const details     = nextNode.evolution_details[0];
        if (!details) return;
        if (details.trigger?.name !== 'level-up') return;
        if (details.min_level && details.min_level > pkmn.level) return;
        if (client.pokemonEvolutionResponse.has(user)) return;

        const evolutions = [pkmn.name, nextNode.species.name];
        const index      = 1; // next evolution is always index 1 from current

        const text = `*@${user.split('@')[0]}*, your Pokemon *${capitalize(
            pkmn.name
        )}* is evolving to *${capitalize(evolutions[index])}*. Use *${
            client.prefix
        }cancel-evolution* to cancel this evolution (within 60s)`;

        // Read and update the owner's party (user), not the command sender (M.sender)
        let party = (await client.poke.get(`${user}_Party`)) || [];
        const i   = party.findIndex((x) => x.tag === pkmn.tag);

        await client.sendMessage(M.from, { text });
        client.pokemonEvolutionResponse.set(user, {
            group:   M.from,
            pokemon: pkmn.name,
        });

        setTimeout(async () => {
            if (!client.pokemonEvolutionResponse.has(user)) return;
            client.pokemonEvolutionResponse.delete(user);

            const pDataResponse = await axios.get(
                `https://pokeapi.co/api/v2/pokemon/${evolutions[index]}`
            );
            const pData = pDataResponse.data;

            pkmn.id    = pData.id;
            pkmn.image = pData.sprites.other['official-artwork'].front_default;
            pkmn.name  = pData.name;

            const { hp, attack, defense, speed } = await getPokemonStats(
                pkmn.id,
                pkmn.level
            );
            pkmn.hp      += hp - pkmn.maxHp;
            pkmn.speed   += speed - pkmn.speed;
            pkmn.defense += defense - pkmn.defense;
            pkmn.attack  += attack - pkmn.attack;
            pkmn.maxAttack  = attack;
            pkmn.maxSpeed   = speed;
            pkmn.maxHp      = hp;
            pkmn.maxDefense = defense;

            if (pkmn.tag === '0')
                await client.poke.set(`${M.sender}_Companion`, pData.name);
            party[i] = pkmn;

            if (inBattle) {
                const data = client.pokemonBattleResponse.get(M.from);
                if (data && data[player].activePokemon.tag === pkmn.tag) {
                    data[player].activePokemon = pkmn;
                    client.pokemonBattleResponse.set(M.from, data);
                }
            }

            await client.poke.set(`${M.sender}_Party`, party);

            const buffer = await getBuffer(pkmn.image);
            await client.sendMessage(M.from, {
                image: buffer,
                jpegThumbnail: buffer.toString('base64'),
                caption: `Congrats! *@${user.split('@')[0]}*, your ${capitalize(
                    evolutions[index - 1]
                )} has evolved to ${capitalize(pkmn.name)}`,
                mentions: [user],
            });
        }, 60 * 1000);
    } catch (error) {
        console.error(`[handlePokemonEvolution] Error: ${error.message}`);
    }
};

/**
 * Draws a Pokemon battle scene on a canvas.
 * @param {object} data
 * @returns {Promise<Buffer>}
 */
const drawPokemonBattle = async (data) => {
    const background  = await Canvas.loadImage(
        await readFile(join(__dirname, '..', '..', 'assets', 'Images', 'battle.png'))
    );
    const pokeball    = await Canvas.loadImage(
        await readFile(join(__dirname, '..', '..', 'assets', 'Images', 'pokeball.png'))
    );
    const greyPokeball = await Canvas.loadImage(
        await readFile(join(__dirname, '..', '..', 'assets', 'Images', 'greyPokeball.png'))
    );
    const canvas = Canvas.createCanvas(background.width, background.height);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(background, 0, 0);

    const pokemonSize   = 128;
    const pokemonStyles = await getPokemonStyles(pokemonSize);
    const boxPadding    = 12;

    for (let i = 0; i < 2; i++) {
        const style  = pokemonStyles[`player${i + 1}`];
        const player = data[`player${i + 1}`];

        const pokemonPos   = { x: 1, y: 1 };
        const spriteBase   = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
        const spriteUrl    = i === 1
            ? `${spriteBase}/${data[`player${i + 1}`].activePokemon.id}.png`
            : `${spriteBase}/back/${data[`player${i + 1}`].activePokemon.id}.png`;

        const pokemonImage = await Canvas.loadImage(spriteUrl);
        const clipY        = style.pokemon.clipY;
        const size         = style.pokemon.size;

        if (player.activePokemon.hp > 0) {
            ctx.drawImage(
                pokemonImage,
                pokemonPos.x,
                pokemonPos.y,
                96,
                96 - clipY,
                style.pokemon.x,
                style.pokemon.y,
                size,
                size - clipY
            );
        }

        const boxCanvas = Canvas.createCanvas(150, 60);
        const boxCtx    = boxCanvas.getContext('2d');
        boxCtx.fillStyle   = 'rgb(24,24,24)';
        boxCtx.strokeStyle = 'rgb(36,36,36)';
        roundRect(boxCtx, 0, 0, boxCanvas.width, boxCanvas.height, 16);

        boxCtx.font      = 'bold 12px Sans-Serif';
        boxCtx.fillStyle = '#ffffff';

        boxCtx.textAlign = 'left';
        boxCtx.fillText(
            `${capitalize(player.activePokemon.name)}${
                player.activePokemon.name.length <= 6 ? '\t\t' : '\t'
            }Lv. ${player.activePokemon.level}`,
            boxPadding,
            boxCanvas.height - boxPadding
        );

        boxCtx.textAlign = 'right';
        boxCtx.fillText(
            `HP: ${player.activePokemon.hp} / ${player.activePokemon.maxHp}`,
            boxCanvas.width - boxPadding,
            boxPadding * 2
        );

        const pokeballGap  = 2;
        const pokeballSize = 7;
        const pokeballPos  = { x: boxPadding, y: boxPadding };
        const length       = Math.min(player.party.length, 6);

        for (let j = 0; j < length; j++) {
            const pokeballX = pokeballPos.x + (pokeballSize + pokeballGap) * j;
            boxCtx.drawImage(
                player.party[j].hp > 0 ? pokeball : greyPokeball,
                pokeballX,
                pokeballPos.y,
                pokeballSize,
                pokeballSize
            );
        }

        ctx.drawImage(boxCanvas, style.box.x, style.box.y);
    }

    return canvas.toBuffer();
};

const getPokemonStyles = (pokemonSize) => ({
    player1: {
        pokemon: { x: 100 - pokemonSize / 2, y: 138, size: 128, showBack: true, clipY: 45 },
        box: { x: 25, y: 60 },
        moves: { x: 0, y: 225 },
    },
    player2: {
        pokemon: { x: 300 - pokemonSize / 2, y: 60, size: 100, showBack: false, clipY: 0 },
        box: { x: 230, y: 150 },
        moves: { x: 0, y: 5 },
    },
});

const roundRect = (ctx, x, y, width, height, radius = 5) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
};

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    drawHangMan,
    drawTTTBoard,
    calculatePing,
    capitalize,
    execute,
    extractNumbers,
    extractUrls,
    fetch,
    formatSize,
    generateCreditCardImage,
    generateRandomHex,
    getBuffer,
    errorChan,
    getRandomItem,
    gifToMp4,
    gifToPng,
    restart,
    term,
    webpToMp4,
    webpToPng,
    greetings,
    getRandomInt,
    getFormattedUrl,
    search,
    convertMs,
    getPokemonStats,
    getPokemonEvolutionChain,
    getStarterPokemonMoves,
    getPokemonWeaknessAndStrongTypes,
    getPokemonLearnableMove,
    PokemonMoveIsLearnable,
    shuffleArray,
    assignPokemonMoves,
    generateRandomUniqueTag,
    calculatePokeExp,
    getLevelByExp,
    getExpByLevel,
    getRequiredExp,
    handlePokemonStats,
    handlePokemonEvolution,
    drawPokemonBattle,
};
