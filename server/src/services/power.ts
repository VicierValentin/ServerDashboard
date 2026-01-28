import { execCommand } from '../utils/exec.js';

/**
 * Perform a power action on the system
 */
export async function performPowerAction(action: 'shutdown' | 'restart'): Promise<void> {
    console.log(`Executing power action: ${action}`);

    if (action === 'shutdown') {
        // Schedule shutdown in 1 minute to allow response to be sent
        await execCommand('shutdown', ['-h', '-now', 'System shutdown initiated via dashboard'], { sudo: true });
    } else if (action === 'restart') {
        // Schedule reboot in 1 minute to allow response to be sent
        await execCommand('shutdown', ['-r', '-now', 'System restart initiated via dashboard'], { sudo: true });
    } else {
        throw new Error(`Unknown power action: ${action}`);
    }
}

/**
 * Cancel a pending shutdown/restart
 */
export async function cancelPowerAction(): Promise<void> {
    await execCommand('shutdown', ['-c'], { sudo: true });
}
