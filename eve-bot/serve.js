'use strict';

/**
 * EVE BOT — cross-platform auto-restart supervisor
 *
 * Usage: npm run serve
 *
 * Spawns `node index.js` and restarts it automatically whenever it exits
 * with a non-zero code (crash, uncaught exception, network drop, etc.).
 * Exits cleanly when you press Ctrl+C or the bot exits with code 0.
 *
 * Crash-loop guard: if the bot crashes more than MAX_RESTARTS times within
 * WINDOW_MS milliseconds the supervisor gives up and exits with code 1.
 */

const { spawn } = require('child_process');

const RESTART_DELAY_MS = 3_000;  // wait 3 s before restarting
const MAX_RESTARTS     = 10;     // max crashes allowed in the window
const WINDOW_MS        = 60_000; // sliding window length (1 minute)

let restartCount = 0;
let windowStart  = Date.now();
let child        = null;

function start() {
    child = spawn(process.execPath, ['index.js'], {
        stdio: 'inherit',
        env:   process.env,
    });

    child.on('exit', (code, signal) => {
        child = null;

        // Clean shutdown — user pressed Ctrl+C or bot called process.exit(0)
        if (code === 0 || signal === 'SIGINT' || signal === 'SIGTERM') {
            console.log('\n[SUPERVISOR] Bot exited cleanly. Goodbye.');
            process.exit(0);
        }

        // Slide the restart window
        const now = Date.now();
        if (now - windowStart > WINDOW_MS) {
            restartCount = 0;
            windowStart  = now;
        }
        restartCount++;

        if (restartCount > MAX_RESTARTS) {
            console.error(
                `\n[SUPERVISOR] Bot crashed ${MAX_RESTARTS} times in 60 s — giving up.` +
                '\n             Fix the underlying issue and run "npm run serve" again.'
            );
            process.exit(1);
        }

        const secs = RESTART_DELAY_MS / 1000;
        console.log(
            `\n[SUPERVISOR] Bot exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}).` +
            ` Restarting in ${secs}s… (attempt ${restartCount}/${MAX_RESTARTS})`
        );
        setTimeout(start, RESTART_DELAY_MS);
    });
}

// Forward Ctrl+C / SIGTERM so the child process can shut down cleanly
function shutdown() {
    if (child) {
        child.kill('SIGTERM');
    } else {
        process.exit(0);
    }
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

console.log('[SUPERVISOR] Starting EVE BOT with auto-restart enabled…');
console.log('[SUPERVISOR] Press Ctrl+C to stop.\n');
start();
