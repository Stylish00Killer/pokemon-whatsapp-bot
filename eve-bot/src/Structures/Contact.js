'use strict';

/**
 * Get contact info by JID.
 * Returns { username, jid } where username is the stored notify name or "User".
 */
const getContact = async (jid, client) => {
    const stored  = await client.contactDB.get(jid);
    const username = stored || 'User';
    return { username, jid };
};

/**
 * Resolve the best display name for a JID.
 *
 * Priority:
 *   1. pushName  — WhatsApp-provided name from the message (most reliable)
 *   2. contactDB — name saved from a previous contacts.update event
 *   3. phone     — numeric part of the JID as a last resort
 *
 * @param {string} jid       - full JID, e.g. "919028230554@s.whatsapp.net"
 * @param {object} client    - Baileys client with contactDB
 * @param {string} [pushName] - push name from the current message (optional)
 * @returns {Promise<string>}
 */
const getDisplayName = async (jid, client, pushName) => {
    if (pushName && pushName.trim()) return pushName.trim();

    try {
        const stored = await client.contactDB.get(jid);
        if (stored && stored.trim()) return stored.trim();
    } catch { /* ignore */ }

    // Fall back to the numeric part of the JID
    return jid.split('@')[0];
};

/**
 * Save an array of contacts to the contact database.
 * Called on Baileys contacts.update events.
 */
const saveContacts = async (contacts, client) => {
    await Promise.all(
        contacts.map(async (contact) => {
            // Only write when notify is present — an absent notify would overwrite
            // any previously-stored name with an empty string.
            if (contact.id && contact.notify) {
                await client.contactDB.set(contact.id, contact.notify);
            }
        })
    );
};

module.exports = { getContact, getDisplayName, saveContacts };
