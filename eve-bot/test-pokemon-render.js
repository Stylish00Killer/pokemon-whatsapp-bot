'use strict';
/**
 * Test render for EVE Bot Pokémon commands.
 * Saves output images to ./test-renders/
 * Run from eve-bot/ with LD_LIBRARY_PATH already set:
 *   bash start-render-test.sh
 */

const Canvas   = require('canvas');
const { join } = require('path');
const { readFile, writeFile, mkdirs } = require('fs-extra');
const axios    = require('axios').default;

const OUT = join(__dirname, 'test-renders');

// ── helpers ───────────────────────────────────────────────────────────────────
const capitalize = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

const getPokemonStyles = () => ({
    player1: {
        pokemon: { x: 36,  y: 138, size: 128, clipY: 45 },
        box:     { x: 25,  y: 60  },
    },
    player2: {
        pokemon: { x: 236, y: 80,  size: 128, clipY: 0  },
        box:     { x: 195, y: 160 },
    },
});

async function fetchSprite(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    return Canvas.loadImage(Buffer.from(res.data));
}

async function drawBattleScene(data) {
    const [bgBuf, pokeballBuf, greyBuf] = await Promise.all([
        readFile(join(__dirname, 'assets', 'Images', 'battle.png')),
        readFile(join(__dirname, 'assets', 'Images', 'pokeball.png')),
        readFile(join(__dirname, 'assets', 'Images', 'greyPokeball.png')),
    ]);
    const [background, pokeball, greyPokeball] = await Promise.all([
        Canvas.loadImage(bgBuf),
        Canvas.loadImage(pokeballBuf),
        Canvas.loadImage(greyBuf),
    ]);

    const canvas = Canvas.createCanvas(background.width, background.height);
    const ctx    = canvas.getContext('2d');
    ctx.drawImage(background, 0, 0);

    const styles     = getPokemonStyles();
    const spriteBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
    const boxPadding = 12;

    for (let i = 0; i < 2; i++) {
        const style  = styles[`player${i + 1}`];
        const player = data[`player${i + 1}`];
        const url    = i === 1
            ? `${spriteBase}/${player.activePokemon.id}.png`
            : `${spriteBase}/back/${player.activePokemon.id}.png`;

        const sprite = await fetchSprite(url);
        const { clipY, size } = style.pokemon;

        if (player.activePokemon.hp > 0) {
            ctx.drawImage(sprite, 0, 0, 96, 96 - clipY,
                style.pokemon.x, style.pokemon.y, size, size - clipY);
        }

        // Info box
        const bx = Canvas.createCanvas(150, 60);
        const bc = bx.getContext('2d');
        bc.fillStyle   = 'rgb(24,24,24)';
        bc.strokeStyle = 'rgb(36,36,36)';
        roundRect(bc, 0, 0, bx.width, bx.height, 16);
        bc.font      = 'bold 12px Sans-Serif';
        bc.fillStyle = '#ffffff';
        bc.textAlign = 'left';
        bc.fillText(
            `${capitalize(player.activePokemon.name)}${player.activePokemon.name.length <= 6 ? '\t\t' : '\t'}Lv. ${player.activePokemon.level}`,
            boxPadding, bx.height - boxPadding
        );
        bc.textAlign = 'right';
        bc.fillText(`HP: ${player.activePokemon.hp} / ${player.activePokemon.maxHp}`,
            bx.width - boxPadding, boxPadding * 2);

        const pbSize = 7, pbGap = 2;
        for (let j = 0; j < Math.min(player.party.length, 6); j++) {
            bc.drawImage(
                player.party[j].hp > 0 ? pokeball : greyPokeball,
                boxPadding + (pbSize + pbGap) * j, boxPadding, pbSize, pbSize
            );
        }
        ctx.drawImage(bx, style.box.x, style.box.y);
    }
    return canvas.toBuffer();
}

async function drawWildCard(pokemonId, pokemonName) {
    const spriteBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
    const sprite     = await fetchSprite(`${spriteBase}/${pokemonId}.png`);

    const canvas = Canvas.createCanvas(300, 200);
    const ctx    = canvas.getContext('2d');

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 15px Sans-Serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ A Wild Pokémon Appeared!', canvas.width / 2, 26);

    const scale = 120 / Math.max(sprite.width, sprite.height);
    const sw    = sprite.width  * scale;
    const sh    = sprite.height * scale;
    ctx.drawImage(sprite, (canvas.width - sw) / 2, 38, sw, sh);

    ctx.fillStyle = '#ffd700';
    ctx.font      = 'bold 18px Sans-Serif';
    ctx.fillText(capitalize(pokemonName), canvas.width / 2, 185);

    return canvas.toBuffer();
}

// ── run tests ─────────────────────────────────────────────────────────────────
(async () => {
    await mkdirs(OUT);
    console.log(`\n🎨  EVE Bot — Pokémon Render Tests\n${'─'.repeat(40)}`);

    // Battle scene
    process.stdout.write('  [1/4] Battle: Bulbasaur vs Charizard… ');
    const battleBuf = await drawBattleScene({
        player1: {
            activePokemon: { id: 1, name: 'bulbasaur', hp: 45, maxHp: 45, level: 12 },
            party: [{ hp: 45 }, { hp: 0 }, { hp: 30 }],
        },
        player2: {
            activePokemon: { id: 6, name: 'charizard', hp: 12, maxHp: 78, level: 36 },
            party: [{ hp: 12 }, { hp: 55 }, { hp: 55 }, { hp: 0 }],
        },
    });
    await writeFile(join(OUT, 'battle.png'), battleBuf);
    console.log(`✓  (${battleBuf.length} B)`);

    // Wild spawn cards
    const wilds = [{ id: 25, name: 'pikachu' }, { id: 150, name: 'mewtwo' }, { id: 133, name: 'eevee' }];
    for (let i = 0; i < wilds.length; i++) {
        const { id, name } = wilds[i];
        process.stdout.write(`  [${i + 2}/4] Wild card: ${capitalize(name)}… `);
        const buf = await drawWildCard(id, name);
        await writeFile(join(OUT, `wild-${name}.png`), buf);
        console.log(`✓  (${buf.length} B)`);
    }

    console.log(`\n✅  Renders saved to eve-bot/test-renders/\n`);
})().catch(e => { console.error('\n❌  Render failed:', e.message, e.stack); process.exit(1); });
