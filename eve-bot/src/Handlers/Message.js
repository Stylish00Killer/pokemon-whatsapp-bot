'use strict';

const { serialize } = require('../Structures/WAclient');
const { getStats }  = require('../Helpers/Stats');
const fmt           = require('../Helpers/fmt');
const chalk         = require('chalk');
const axios         = require('axios');

// Per-user command cooldowns (in-memory, clears on restart)
const cool = new Map();

/**
 * Main message handler – called on every messages.upsert event.
 * @param {{ type: string, messages: any[] }} messages
 * @param {any} client
 */
module.exports = async function MessageHandler(messages, client) {
    try {
        if (messages.type !== 'notify') return;

        const rawMsg = messages.messages[0];
        if (!rawMsg?.message) return;

        let M;
        try {
            M = serialize(JSON.parse(JSON.stringify(rawMsg)), client);
        } catch {
            return;
        }

        if (!M.message) return;
        if (M.key?.remoteJid === 'status@broadcast') return;
        if (
            ['protocolMessage', 'senderKeyDistributionMessage', '', null].includes(
                M.type
            )
        )
            return;

        const { isGroup, sender, from, body } = M;
        let gcMeta, gcName, groupMembers, groupAdmins;

        if (isGroup) {
            try {
                gcMeta       = await client.groupMetadata(from);
                gcName       = gcMeta.subject;
                groupMembers = gcMeta?.participants || [];
                groupAdmins  = groupMembers
                    .filter((m) => m.admin)
                    .map((m) => m.id);
            } catch {
                gcMeta       = null;
                gcName       = '';
                groupMembers = [];
                groupAdmins  = [];
            }
        } else {
            gcMeta       = null;
            gcName       = '';
            groupMembers = [];
            groupAdmins  = [];
        }

        const args    = body.trim().split(/\s+/).slice(1);
        const isCmd   = body.startsWith(client.prefix);
        const cmdName = body
            .slice(client.prefix.length)
            .trim()
            .split(/\s+/)
            .shift()
            ?.toLowerCase();
        const arg     = body
            .slice(client.prefix.length + (cmdName ? cmdName.length : 0))
            .trim();

        const ActivateMod = client.DB.get('mod')     || [];
        const banned      = client.DB.get('banned')  || [];

        const companion = client.poke.get(`${sender}_Companion`);
        const economy   = await client.econ.findOne({ userId: sender });

        // ── Anti-link ──────────────────────────────────────────────────────────
        if (
            isGroup &&
            Array.isArray(ActivateMod) &&
            ActivateMod.includes(from) &&
            groupAdmins.includes(
                client.user.id.split(':')[0] + '@s.whatsapp.net'
            ) &&
            body
        ) {
            const groupCodeMatch = body.match(
                /chat\.whatsapp\.com\/(?:invite\/)?([\w\d]*)/
            );
            if (groupCodeMatch?.length === 2 && !groupAdmins.includes(sender)) {
                try {
                    const groupCode        = groupCodeMatch[1];
                    const currentGroupCode = await client.groupInviteCode(from);
                    if (groupCode !== currentGroupCode) {
                        await client.sendMessage(from, { delete: M.key });
                        await client.groupParticipantsUpdate(from, [sender], 'remove');
                        return M.reply('✅ Removed a user who posted an unauthorized invite link.');
                    }
                } catch { /* ignore */ }
            }
        }

        // ── Mention-based chat bot ─────────────────────────────────────────────
        if (M.quoted?.participant) M.mentions.push(M.quoted.participant);
        if (
            M.mentions.includes(
                client.user.id.split(':')[0] + '@s.whatsapp.net'
            ) &&
            !isCmd &&
            isGroup
        ) {
            try {
                const response = await axios.get(
                    `https://hercai.onrender.com/beta/hercai?question=${encodeURIComponent(body)}`,
                    { headers: { 'content-type': 'application/json' } }
                );
                M.reply(
                    body.toLowerCase() === 'hi'
                        ? `Hey ${M.name}, what's up?`
                        : response.data.reply
                );
            } catch { /* ignore */ }
        }

        // ── WA-link forwarding to admin group ─────────────────────────────────
        if (!isGroup && body.includes('chat.whatsapp.com')) {
            const senderInfo    = M.name || sender;
            const messageToMods = `WhatsApp link sent by: ${senderInfo}\nLink: ${body}`;
            await client.sendMessage(from, { text: 'Your request has been sent.' });
            const modsGroupJid = client.groups?.adminsGroup;
            if (modsGroupJid) {
                await client.sendMessage(modsGroupJid, {
                    text: messageToMods,
                    mentions: [sender],
                });
            }
        }

        // ── Group keyword responses ────────────────────────────────────────────
        if (['bot', 'eve'].includes(body.toLowerCase())) {
            const responses = {
                bot: `Everything is working fine, ${M.name} ⚡`,
                eve: 'EVE BOT — made by S00K. Features Pokémon adventures, anime card game, economy, AI chat, and more. Use -help to get started!',
            };
            return M.reply(responses[body.toLowerCase()]);
        }

        if (isCmd && !cmdName) return M.reply('I am alive — use *-help* to get started.');

        client.log(
            `${chalk[isCmd ? 'red' : 'green'](`${isCmd ? '~EXEC' : '~RECV'}`)} ${
                isCmd ? `${client.prefix}${cmdName}` : 'Message'
            } ${chalk.white('from')} ${M.name} ${chalk.white('in')} ${
                isGroup ? gcName : 'DM'
            } ${chalk.white(`args: [${chalk.blue(args.length)}]`)}`,
            'yellow'
        );

        if (!isCmd) return;

        // ── Banned check ───────────────────────────────────────────────────────
        const bannedUser =
            Array.isArray(banned) &&
            banned.find((b) => {
                if (typeof b === 'string') return b === sender;
                if (typeof b === 'object') return b?.user === sender;
                return false;
            });
        if (bannedUser) {
            const reason =
                typeof bannedUser === 'object' ? bannedUser.reason : 'Banned by a moderator.';
            return fmt.replyError(M, 'Access Denied', reason);
        }

        // ── Find command ───────────────────────────────────────────────────────
        const command =
            client.cmd.get(cmdName) ||
            client.cmd.find(
                (cmd) => cmd.aliases && cmd.aliases.includes(cmdName)
            );

        if (!command) {
            const similar = client.cmd
                .filter(
                    (cmd) =>
                        cmd.name.includes(cmdName) ||
                        (cmd.aliases && cmd.aliases.includes(cmdName))
                )
                .sort((a, b) => a.name.length - b.name.length)
                .first();
            return fmt.replyError(
                M,
                'Unknown Command',
                similar
                    ? `No command \`-${cmdName}\` found. Did you mean *-${similar.name}*?`
                    : `No command \`-${cmdName}\` found.`,
                'help'
            );
        }

        // ── Disabled-commands check ────────────────────────────────────────────
        const disabledCommands = client.DB.get('disable-commands') || [];
        const disabledCmd =
            Array.isArray(disabledCommands) &&
            disabledCommands.find(
                (dc) =>
                    dc.command === cmdName ||
                    (command.aliases && command.aliases.includes(dc.command))
            );
        if (disabledCmd) {
            const disabledAt = new Date(disabledCmd.disabledAt).toLocaleString();
            return fmt.replyWarning(
                M,
                'Command Disabled',
                `\`-${command.name}\` was disabled by ${disabledCmd.disabledBy}.\nReason: ${disabledCmd.reason || 'none'}\nDisabled at: ${disabledAt}`
            );
        }

        // ── Cooldown ───────────────────────────────────────────────────────────
        const cooldownAmount = (command.cool ?? 5) * 1000;
        const cooldownKey    = `${sender}${command.name}`;

        /**
         * Normalise a WhatsApp JID to a bare phone number.
         * Strips both the @server suffix and the :device suffix that
         * Baileys appends in multi-device mode (e.g. 91234:0@s.whatsapp.net → 91234).
         */
        const numOf = (jid) => (jid || '').split('@')[0].split(':')[0];

        // Always read the moderators list fresh from DB so that additions or
        // removals take effect immediately without needing a bot restart.
        await client.refreshMods();

        const senderNum   = numOf(sender);
        const senderIsMod = client.mods.some((n) => numOf(n) === senderNum);

        if (!senderIsMod && cool.has(cooldownKey)) {
            const remaining = client.utils.convertMs(cool.get(cooldownKey) - Date.now());
            return fmt.replyCooldown(M, `${remaining}s`);
        } else if (!senderIsMod) {
            cool.set(cooldownKey, Date.now() + cooldownAmount);
            setTimeout(() => cool.delete(cooldownKey), cooldownAmount);
        }

        // ── React to command ───────────────────────────────────────────────────
        if (command.react) {
            try {
                await client.sendMessage(from, {
                    react: { text: command.react, key: M.key },
                });
            } catch { /* ignore */ }
        }

        // ── Permission checks ──────────────────────────────────────────────────
        const checks = [
            {
                // Moderation commands require the sender to be a WhatsApp group admin,
                // unless they are a privileged bot moderator (who bypass this check).
                condition: !senderIsMod && !groupAdmins.includes(sender) && command.category === 'moderation',
                message:   'This command can only be used by group admins.',
            },
            {
                condition:
                    !groupAdmins.includes(
                        client.user.id.split(':')[0] + '@s.whatsapp.net'
                    ) && command.category === 'moderation',
                message: 'I need to be a group admin to use this command.',
            },
            {
                condition: !isGroup && command.category === 'moderation',
                message:   'This command can only be used inside a group.',
            },
            {
                condition: !isGroup && !senderIsMod,
                message:   'The bot can only be used inside groups.',
            },
            {
                condition: !senderIsMod && command.category === 'owner',
                message: 'This command is restricted to bot moderators.',
            },
            {
                condition:
                    command.category === 'pokemon' &&
                    !companion &&
                    command.name !== 'start-journey',
                message: "You haven't started your Pokémon journey yet. Use *-start-journey* to begin.",
            },
        ];

        for (const check of checks) {
            if (check.condition) {
                return fmt.replyNoPermission(M, check.message);
            }
        }

        // ── Execute ────────────────────────────────────────────────────────────
        try {
            await command.execute(client, arg, M);
        } catch (cmdErr) {
            console.error(chalk.red(`[CMD ERROR] ${command.name}:`), cmdErr);
            try {
                await fmt.replyError(
                    M,
                    'Command Failed',
                    cmdErr.message || 'An unexpected error occurred.',
                    `-help ${command.name}`
                );
            } catch { /* ignore */ }
        }

        // ── XP gain ───────────────────────────────────────────────────────────
        if (command.exp) {
            client.exp.add(sender, command.exp);
        }
    } catch (err) {
        console.error(chalk.red('[MessageHandler] Unhandled error:'), err);
    }
};
