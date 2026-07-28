'use strict';

/**
 * shizofunc.js — EVE BOT message helpers
 *
 * All functions use plain client.sendMessage() (Baileys-native).
 * No NativeFlow / InteractiveMessage / relayMessage — those formats are
 * WhatsApp Business-only and cause "message couldn't load" on personal accounts.
 *
 * Signatures kept identical so every caller works unchanged.
 *
 *   shizobtn1    (client, from, text, btntxt, btnid, footer)
 *   shizobtn1img (client, from, text, img,    btntxt, btnid, footer)
 *   shizobtn1gif (client, from, text, img,    btntxt, btnid, footer)
 */

/**
 * Send a plain text message.
 * btntxt / btnid are accepted for API compatibility but ignored —
 * text buttons are not supported on personal accounts.
 */
const shizobtn1 = async (client, from, text, btntxt, btnid, footer) => {
    const body = footer ? `${text}\n\n_${footer}_` : `${text}`;
    await client.sendMessage(`${from}`, { text: body });
};

/**
 * Send an image with a caption.
 * `img` may be a Buffer (local file) or a URL string.
 */
const shizobtn1img = async (client, from, text, img, btntxt, btnid, footer) => {
    const caption    = footer ? `${text}\n\n_${footer}_` : `${text}`;
    const imgContent = Buffer.isBuffer(img)
        ? { image: img }
        : { image: { url: `${img}` } };
    await client.sendMessage(`${from}`, { ...imgContent, caption });
};

/**
 * Send a GIF/video with a caption.
 * `img` may be a Buffer (local file) or a URL string.
 */
const shizobtn1gif = async (client, from, text, img, btntxt, btnid, footer) => {
    const caption      = footer ? `${text}\n\n_${footer}_` : `${text}`;
    const videoContent = Buffer.isBuffer(img)
        ? { video: img }
        : { video: { url: `${img}` } };
    await client.sendMessage(`${from}`, { ...videoContent, caption, gifPlayback: true });
};

module.exports = { shizobtn1, shizobtn1img, shizobtn1gif };
