'use strict';

/**
 * canvas.worker.js — runs in a dedicated worker thread via workerpool.
 * Keeps all Canvas operations off the main event loop.
 */

const workerpool = require('workerpool');
const Canvas     = require('canvas');
const { join }   = require('path');
const { readFile } = require('fs').promises;

const ASSETS = join(__dirname, '..', '..', 'assets');

const capitalize = (s = '') => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

function roundRect(ctx, x, y, w, h, r = 5) {
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

/**
 * Render a battle scene and return a base64-encoded PNG string.
 * Returns null on any failure so callers can fall back to text.
 */
async function drawPokemonBattle(data) {
    try {
        const background   = await Canvas.loadImage(await readFile(join(ASSETS, 'Images', 'battle.png')));
        const pokeball     = await Canvas.loadImage(await readFile(join(ASSETS, 'Images', 'pokeball.png')));
        const greyPokeball = await Canvas.loadImage(await readFile(join(ASSETS, 'Images', 'greyPokeball.png')));

        const canvas = Canvas.createCanvas(background.width, background.height);
        const ctx    = canvas.getContext('2d');
        ctx.drawImage(background, 0, 0);

        const pokemonSize = 128;
        const boxPadding  = 12;
        const styles = {
            player1: { pokemon: { x: 100 - pokemonSize / 2, y: 138, size: 128, clipY: 45 }, box: { x: 25,  y: 60  } },
            player2: { pokemon: { x: 300 - pokemonSize / 2, y: 60,  size: 100, clipY: 0  }, box: { x: 230, y: 150 } },
        };

        const spriteBase = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

        for (let i = 0; i < 2; i++) {
            const key    = `player${i + 1}`;
            const style  = styles[key];
            const player = data[key];
            const spriteUrl = i === 1
                ? `${spriteBase}/${player.activePokemon.id}.png`
                : `${spriteBase}/back/${player.activePokemon.id}.png`;

            if (player.activePokemon.hp > 0) {
                const pokemonImage = await Canvas.loadImage(spriteUrl);
                const { x, y, size, clipY } = style.pokemon;
                ctx.drawImage(pokemonImage, 1, 1, 96, 96 - clipY, x, y, size, size - clipY);
            }

            const boxCanvas = Canvas.createCanvas(150, 60);
            const boxCtx    = boxCanvas.getContext('2d');
            boxCtx.fillStyle   = 'rgb(24,24,24)';
            boxCtx.strokeStyle = 'rgb(36,36,36)';
            roundRect(boxCtx, 0, 0, 150, 60, 16);
            boxCtx.font      = 'bold 12px Sans-Serif';
            boxCtx.fillStyle = '#ffffff';
            boxCtx.textAlign = 'left';
            boxCtx.fillText(
                `${capitalize(player.activePokemon.name)}${player.activePokemon.name.length <= 6 ? '\t\t' : '\t'}Lv. ${player.activePokemon.level}`,
                boxPadding, boxCanvas.height - boxPadding
            );
            boxCtx.textAlign = 'right';
            boxCtx.fillText(`HP: ${player.activePokemon.hp} / ${player.activePokemon.maxHp}`, 150 - boxPadding, boxPadding * 2);

            const pbSize = 7, pbGap = 2;
            const len = Math.min(player.party.length, 6);
            for (let j = 0; j < len; j++) {
                const pbX = boxPadding + (pbSize + pbGap) * j;
                boxCtx.drawImage(player.party[j].hp > 0 ? pokeball : greyPokeball, pbX, boxPadding, pbSize, pbSize);
            }
            ctx.drawImage(boxCanvas, style.box.x, style.box.y);
        }

        // Return base64 string — safe to transfer across thread boundary
        return canvas.toBuffer().toString('base64');
    } catch {
        return null;
    }
}

workerpool.worker({ drawPokemonBattle });
