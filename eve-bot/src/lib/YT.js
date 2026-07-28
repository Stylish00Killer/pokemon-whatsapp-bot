'use strict';

/**
 * YouTube download/search helpers using @distube/ytdl-core.
 * Replaces the deprecated youtubedl-core/ytdl-core packages.
 */

const ytdl          = require('@distube/ytdl-core');
const { createWriteStream } = require('fs-extra');
const { tmpdir }    = require('os');
const crypto        = require('crypto');

const generateRandomFilename = (length) =>
    crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);

/**
 * Download a YouTube URL as audio or video buffer.
 * @param {string} url
 * @param {'audio'|'video'} type
 * @returns {Promise<Buffer>}
 */
const getBuffer = (url, type) => {
    const ext      = type === 'audio' ? 'mp3' : 'mp4';
    const filename = `${tmpdir()}/${generateRandomFilename(12)}.${ext}`;
    const stream   = createWriteStream(filename);

    const filter   = type === 'audio' ? 'audioonly' : 'videoandaudio';
    const quality  = type === 'audio' ? 'highestaudio' : 'highest';

    ytdl(url, { filter, quality }).pipe(stream);

    return new Promise((resolve, reject) => {
        stream.on('finish', () => {
            require('fs-extra').readFile(filename).then(resolve).catch(reject);
        });
        stream.on('error', reject);
    });
};

/**
 * Parse a video ID from a YouTube URL.
 * @param {string} url
 * @returns {string}
 */
const parseId = (url) => {
    const split = url.split('/');
    if (url.includes('youtu.be')) return split[split.length - 1].split('?')[0];
    return (url.split('=')[1] || '').split('&')[0];
};

module.exports = {
    validateURL: ytdl.validateURL,
    getInfo:     ytdl.getInfo,
    getBuffer,
    parseId,
};
