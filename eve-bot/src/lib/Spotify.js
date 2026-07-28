'use strict';

/**
 * Spotify-like track info + YouTube audio fallback.
 * Does NOT require a Spotify API key.
 *
 * Usage:
 *   const { spotifydl } = require('./lib/Spotify');
 *   const result = await spotifydl(spotifyTrackUrl);
 *   // result: { data, audio }
 *
 * data shape: { name, artists, album_name, release_date, cover_url }
 * audio: Buffer (mp3)
 *
 * How it works:
 *   1. Calls the odesli.co (song.link) API to resolve the Spotify track
 *      and find the corresponding YouTube URL.
 *   2. Falls back to a YouTube title search if odesli is unavailable.
 *   3. Downloads audio via @distube/ytdl-core.
 */

const axios  = require('axios');
const ytdl   = require('@distube/ytdl-core');
const yts    = require('yt-search');
const { createWriteStream } = require('fs-extra');
const { tmpdir } = require('os');
const crypto = require('crypto');

const randomName = () =>
    crypto.randomBytes(8).toString('hex');

/**
 * Download audio from a YouTube URL into a Buffer.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function downloadYTAudio(url) {
    const filename = `${tmpdir()}/${randomName()}.mp3`;
    const stream   = createWriteStream(filename);
    ytdl(url, { filter: 'audioonly', quality: 'highestaudio' }).pipe(stream);
    return new Promise((resolve, reject) => {
        stream.on('finish', () =>
            require('fs-extra').readFile(filename).then(resolve).catch(reject)
        );
        stream.on('error', reject);
    });
}

/**
 * Main Spotify downloader function.
 * @param {string} spotifyUrl  - open.spotify.com/track/... URL
 * @returns {Promise<{data: object, audio: Buffer}>}
 */
async function spotifydl(spotifyUrl) {
    // 1. Try odesli.co to get YouTube URL + track metadata
    let trackName   = '';
    let artistName  = '';
    let albumName   = '';
    let coverUrl    = '';
    let releaseDate = '';
    let youtubeUrl  = null;

    try {
        const odesliRes = await axios.get(
            `https://api.odesli.co/resolve?url=${encodeURIComponent(spotifyUrl)}&userCountry=US`,
            { timeout: 8000 }
        );
        const od = odesliRes.data;
        const entity = od.entitiesByUniqueId[od.entityUniqueId];

        trackName   = entity?.title        || '';
        artistName  = entity?.artistName   || '';
        albumName   = entity?.albumName    || '';
        coverUrl    = entity?.thumbnailUrl || '';
        releaseDate = entity?.releaseDate  || '';

        // Find YouTube link from odesli response
        const ytLink = od.linksByPlatform?.youtube;
        if (ytLink?.url) youtubeUrl = ytLink.url;
    } catch {
        // odesli unavailable — will fall back to search below
    }

    // 2. If no YouTube URL from odesli, search by title
    if (!youtubeUrl) {
        const query   = `${trackName} ${artistName}`.trim() ||
            spotifyUrl; // worst case, search the spotify URL text
        const results = await yts(query.substring(0, 100));
        if (!results.videos || !results.videos.length) {
            throw new Error('Could not find a matching YouTube video for this track.');
        }
        youtubeUrl = results.videos[0].url;

        // If metadata was empty (odesli failed entirely), pull from YT result
        if (!trackName) {
            trackName  = results.videos[0].title;
            artistName = results.videos[0].author?.name || '';
        }
    }

    // 3. Download audio
    const audio = await downloadYTAudio(youtubeUrl);

    return {
        data: {
            name:         trackName,
            artists:      artistName ? [artistName] : [],
            album_name:   albumName,
            release_date: releaseDate,
            cover_url:    coverUrl,
        },
        audio,
    };
}

module.exports = { spotifydl };
