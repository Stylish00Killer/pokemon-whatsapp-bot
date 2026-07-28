#!/usr/bin/env node
'use strict';

/**
 * Task 2 — Canvas Rendering Smoke Test
 * Run from pokemon-bot/: node scripts/test-canvas.js
 * Saves output to pokemon-bot/test-render.png
 */

process.chdir(require('path').join(__dirname, '..'));

const Canvas = require('canvas');
const fs     = require('fs');
const path   = require('path');

function roundRect(ctx, x, y, w, h, r) {
    r = r || 8;
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

(async () => {
    console.log('\n━━━ Canvas Smoke Test ━━━\n');

    // ── 1. Basic canvas creation ──────────────────────────────────────────
    console.log('1. Creating canvas…');
    let canvas, ctx;
    try {
        canvas = Canvas.createCanvas(400, 200);
        ctx    = canvas.getContext('2d');
        console.log(`   ✅ Canvas created (${canvas.width}×${canvas.height})`);
    } catch (err) {
        console.error('   ❌ Canvas.createCanvas failed:', err.message);
        process.exit(1);
    }

    // ── 2. Load local assets ──────────────────────────────────────────────
    console.log('2. Loading local assets…');
    let background, pokeball, greyPokeball;
    try {
        background   = await Canvas.loadImage(fs.readFileSync(path.join('assets', 'Images', 'battle.png')));
        pokeball     = await Canvas.loadImage(fs.readFileSync(path.join('assets', 'Images', 'pokeball.png')));
        greyPokeball = await Canvas.loadImage(fs.readFileSync(path.join('assets', 'Images', 'greyPokeball.png')));
        console.log(`   ✅ battle.png      (${background.width}×${background.height})`);
        console.log(`   ✅ pokeball.png    (${pokeball.width}×${pokeball.height})`);
        console.log(`   ✅ greyPokeball.png (${greyPokeball.width}×${greyPokeball.height})`);
    } catch (err) {
        console.error('   ❌ Asset load failed:', err.message);
        process.exit(1);
    }

    // ── 3. Render mock "Wild Pikachu appeared!" battle card ───────────────
    console.log('3. Rendering mock battle card…');
    try {
        canvas = Canvas.createCanvas(background.width, background.height);
        ctx    = canvas.getContext('2d');

        ctx.drawImage(background, 0, 0);

        // Wild Pokémon info box (top-right)
        const box1 = Canvas.createCanvas(150, 60);
        const bx1  = box1.getContext('2d');
        bx1.fillStyle   = 'rgb(24,24,24)';
        bx1.strokeStyle = 'rgb(50,50,50)';
        roundRect(bx1, 0, 0, 150, 60, 12);
        bx1.fillStyle = '#ffffff';
        bx1.font      = 'bold 11px Sans-Serif';
        bx1.textAlign = 'left';
        bx1.fillText('Wild Pikachu   Lv.8', 10, 44);
        bx1.textAlign = 'right';
        bx1.fillText('HP: 48 / 48', 140, 18);
        const pbSize = 7, pbGap = 2;
        for (let j = 0; j < 6; j++) {
            bx1.drawImage(j < 4 ? pokeball : greyPokeball, 10 + (pbSize + pbGap) * j, 22, pbSize, pbSize);
        }
        ctx.drawImage(box1, background.width - 170, 18);

        // Player info box (bottom-left)
        const box2 = Canvas.createCanvas(150, 60);
        const bx2  = box2.getContext('2d');
        bx2.fillStyle   = 'rgb(24,24,24)';
        bx2.strokeStyle = 'rgb(50,50,50)';
        roundRect(bx2, 0, 0, 150, 60, 12);
        bx2.fillStyle = '#ffffff';
        bx2.font      = 'bold 11px Sans-Serif';
        bx2.textAlign = 'left';
        bx2.fillText('Charmander     Lv.5', 10, 44);
        bx2.textAlign = 'right';
        bx2.fillText('HP: 39 / 39', 140, 18);
        for (let j = 0; j < 6; j++) {
            bx2.drawImage(j < 1 ? pokeball : greyPokeball, 10 + (pbSize + pbGap) * j, 22, pbSize, pbSize);
        }
        ctx.drawImage(box2, 18, background.height - 78);

        // Flavour banner
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, background.height - 30, background.width, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font      = 'bold 13px Sans-Serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ Wild Pikachu appeared!', background.width / 2, background.height - 10);

        console.log('   ✅ Battle card rendered');
    } catch (err) {
        console.error('   ❌ Render failed:', err.message);
        process.exit(1);
    }

    // ── 4. Font rendering sanity check ────────────────────────────────────
    console.log('4. Font rendering sanity check…');
    try {
        const fc  = Canvas.createCanvas(320, 50);
        const fct = fc.getContext('2d');
        fct.fillStyle = '#1a1a2e';
        fct.fillRect(0, 0, 320, 50);
        fct.fillStyle = '#ffffff';
        fct.font      = 'bold 16px Sans-Serif';
        fct.fillText('Pokémon Battle Test 🎮', 10, 32);
        const buf = fc.toBuffer('image/png');
        if (!buf || buf.length < 100) throw new Error('Buffer suspiciously small — fonts may be missing');
        console.log(`   ✅ Font rendered OK (${buf.length} bytes)`);
    } catch (err) {
        console.error('   ❌ Font render failed:', err.message);
        process.exit(1);
    }

    // ── 5. Save output ────────────────────────────────────────────────────
    console.log('5. Saving test-render.png…');
    try {
        const outBuf = canvas.toBuffer('image/png');
        const outPath = path.join(__dirname, '..', 'test-render.png');
        fs.writeFileSync(outPath, outBuf);
        console.log(`   ✅ Saved test-render.png (${outBuf.length} bytes)`);
    } catch (err) {
        console.error('   ❌ Save failed:', err.message);
        process.exit(1);
    }

    console.log('\n🎉 Canvas smoke test passed.\n');
})();
