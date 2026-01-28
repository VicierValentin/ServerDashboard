import { writeFile, unlink, readFile, copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { execCommand } from '../utils/exec.js';
import { SYSTEMD_USER_DIR } from '../config.js';
import type { SystemdTimer, CreateTimerRequest } from '../types.js';

const TIMER_PREFIX = 'dashboard-shutdown';
const TIMER_BACKUP_DIR = '/home/vvicier/timersBackup';

/**
 * Parse systemctl list-timers output to get timer information
 */
export async function getShutdownTimers(): Promise<SystemdTimer[]> {
    try {
        // Get all timers matching our prefix
        const { stdout } = await execCommand('systemctl', [
            'list-timers',
            '--all',
            '--no-pager',
            '--output=json',
        ]);

        // Parse JSON output (systemd 250+)
        let timers: any[] = [];
        try {
            timers = JSON.parse(stdout);
        } catch {
            // Fallback: parse text output for older systemd versions
            return await getTimersFromTextOutput();
        }

        // Filter to only our dashboard timers
        const dashboardTimers = timers.filter((t: any) =>
            t.unit?.startsWith(TIMER_PREFIX) || t.unit?.includes('shutdown')
        );

        return await Promise.all(dashboardTimers.map(async (t: any) => {
            const id = t.unit?.replace('.timer', '') || '';
            const props = await getTimerProperties(id);
            const isActive = await isTimerActive(id);

            return {
                id,
                name: props.description || formatTimerName(id),
                onCalendar: props.onCalendar || '',
                nextElapse: t.next ? new Date(t.next / 1000).toISOString() : new Date().toISOString(),
                lastTriggered: t.last ? new Date(t.last / 1000).toISOString() : null,
                active: isActive,
                persistent: props.persistent ?? true,
            };
        }));
    } catch (error) {
        console.error('Failed to get timers:', error);
        return [];
    }
}

/**
 * Fallback for older systemd versions
 */
async function getTimersFromTextOutput(): Promise<SystemdTimer[]> {
    try {
        const { stdout } = await execCommand('systemctl', [
            'list-timers',
            '--all',
            '--no-pager',
        ]);

        // Parse text output line by line
        const lines = stdout.split('\n').slice(1); // Skip header
        const timers: SystemdTimer[] = [];

        for (const line of lines) {
            if (line.includes(TIMER_PREFIX) || line.includes('shutdown')) {
                const parts = line.split(/\s{2,}/);
                if (parts.length >= 4) {
                    const unit = parts[parts.length - 1]?.replace('.timer', '') || '';
                    const props = await getTimerProperties(unit);
                    const isActive = await isTimerActive(unit);

                    timers.push({
                        id: unit,
                        name: props.description || formatTimerName(unit),
                        onCalendar: props.onCalendar || '',
                        nextElapse: parts[0] ? new Date(parts[0]).toISOString() : new Date().toISOString(),
                        lastTriggered: parts[2] && parts[2] !== 'n/a' ? new Date(parts[2]).toISOString() : null,
                        active: isActive,
                        persistent: props.persistent ?? true,
                    });
                }
            }
        }

        return timers;
    } catch (error) {
        console.error('Failed to parse timer text output:', error);
        return [];
    }
}

/**
 * Check if a timer is actually active (running)
 */
async function isTimerActive(timerId: string): Promise<boolean> {
    try {
        const { stdout } = await execCommand('systemctl', [
            'is-active',
            `${timerId}.timer`,
        ]);
        return stdout.trim() === 'active';
    } catch {
        // is-active returns non-zero exit code for inactive timers
        return false;
    }
}

/**
 * Get timer properties from systemctl show
 */
async function getTimerProperties(timerId: string): Promise<{ description?: string; onCalendar?: string; persistent?: boolean }> {
    try {
        const { stdout } = await execCommand('systemctl', [
            'show',
            `${timerId}.timer`,
            '--property=Description,TimersCalendar,Persistent',
        ]);

        const lines = stdout.split('\n');
        const result: { description?: string; onCalendar?: string; persistent?: boolean } = {};

        for (const line of lines) {
            if (line.startsWith('Description=')) {
                result.description = line.substring('Description='.length);
            } else if (line.startsWith('TimersCalendar=')) {
                // Format: TimersCalendar={ OnCalendar=*-*-* 02:00:00 ; ... }
                const match = line.match(/OnCalendar=([^;}\s]+(?:\s[^;}\s]+)*)/);
                if (match) {
                    result.onCalendar = match[1];
                }
            } else if (line.startsWith('Persistent=')) {
                result.persistent = line.substring('Persistent='.length).toLowerCase() === 'yes';
            }
        }

        return result;
    } catch {
        return {};
    }
}

/**
 * Format timer ID to display name
 */
function formatTimerName(timerId: string): string {
    return timerId
        .replace(TIMER_PREFIX + '-', '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Generate timer unit file content
 */
function generateTimerUnit(name: string, onCalendar: string, persistent: boolean): string {
    return `[Unit]
Description=${name}

[Timer]
OnCalendar=${onCalendar}
Persistent=${persistent ? 'yes' : 'no'}

[Install]
WantedBy=timers.target
`;
}

/**
 * Generate service unit file content for shutdown
 */
function generateServiceUnit(name: string): string {
    return `[Unit]
Description=${name} Service

[Service]
Type=oneshot
ExecStart=/sbin/shutdown -h now
`;
}

/**
 * Create or update a shutdown timer
 */
export async function addOrUpdateTimer(
    timer: CreateTimerRequest & { id?: string }
): Promise<SystemdTimer[]> {
    const timerId = timer.id || `${TIMER_PREFIX}-${Date.now()}`;
    const timerPath = join(SYSTEMD_USER_DIR, `${timerId}.timer`);
    const servicePath = join(SYSTEMD_USER_DIR, `${timerId}.service`);

    if (timer.id) {
        // Update existing timer - only change OnCalendar, Description, and Persistent values
        await updateTimerFields(timerPath, servicePath, timer.name, timer.onCalendar, timer.persistent ?? true);
    } else {
        // Create new timer - write both timer and service unit files
        await writeFile(timerPath, generateTimerUnit(timer.name, timer.onCalendar, timer.persistent ?? true));
        await writeFile(servicePath, generateServiceUnit(timer.name));
    }

    // Reload systemd
    await execCommand('systemctl', ['daemon-reload'], { sudo: true });

    // Enable/disable based on active state
    if (timer.active) {
        await execCommand('systemctl', ['enable', '--now', `${timerId}.timer`], { sudo: true });
    } else {
        await execCommand('systemctl', ['disable', '--now', `${timerId}.timer`], { sudo: true });
    }

    return getShutdownTimers();
}

/**
 * Update OnCalendar, Description, and Persistent values in existing timer files
 */
async function updateTimerFields(timerPath: string, servicePath: string, newName: string, newOnCalendar: string, newPersistent: boolean): Promise<void> {
    try {
        // Update timer file
        const timerContent = await readFile(timerPath, 'utf-8');
        const updatedTimerContent = timerContent
            .replace(/^Description=.*$/m, `Description=${newName}`)
            .replace(/^OnCalendar=.*$/m, `OnCalendar=${newOnCalendar}`)
            .replace(/^Persistent=.*$/m, `Persistent=${newPersistent ? 'yes' : 'no'}`);
        await writeFile(timerPath, updatedTimerContent);

        // Update service file description
        const serviceContent = await readFile(servicePath, 'utf-8');
        const updatedServiceContent = serviceContent
            .replace(/^Description=.*$/m, `Description=${newName} Service`);
        await writeFile(servicePath, updatedServiceContent);
    } catch (error) {
        console.error('Failed to update timer fields:', error);
        throw new Error('Failed to update timer');
    }
}

/**
 * Remove a shutdown timer
 */
export async function removeTimer(timerId: string): Promise<SystemdTimer[]> {
    const timerPath = join(SYSTEMD_USER_DIR, `${timerId}.timer`);
    const servicePath = join(SYSTEMD_USER_DIR, `${timerId}.service`);

    // Backup timer files before deletion
    await backupTimerFiles(timerId, timerPath, servicePath);

    // Stop and disable the timer
    try {
        await execCommand('systemctl', ['disable', '--now', `${timerId}.timer`], { sudo: true });
    } catch {
        // Timer might not be enabled
    }

    // Remove unit files
    try {
        await unlink(timerPath);
        await unlink(servicePath);
    } catch {
        // Files might not exist
    }

    // Reload systemd
    await execCommand('systemctl', ['daemon-reload'], { sudo: true });

    return getShutdownTimers();
}

/**
 * Backup timer files before deletion
 */
async function backupTimerFiles(timerId: string, timerPath: string, servicePath: string): Promise<void> {
    try {
        // Ensure backup directory exists
        await mkdir(TIMER_BACKUP_DIR, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupTimerPath = join(TIMER_BACKUP_DIR, `${timerId}_${timestamp}.timer`);
        const backupServicePath = join(TIMER_BACKUP_DIR, `${timerId}_${timestamp}.service`);

        // Copy timer file
        try {
            await copyFile(timerPath, backupTimerPath);
            console.log(`Backed up timer to ${backupTimerPath}`);
        } catch {
            console.warn(`Could not backup timer file: ${timerPath}`);
        }

        // Copy service file
        try {
            await copyFile(servicePath, backupServicePath);
            console.log(`Backed up service to ${backupServicePath}`);
        } catch {
            console.warn(`Could not backup service file: ${servicePath}`);
        }
    } catch (error) {
        console.error('Failed to create backup:', error);
        // Don't fail the deletion if backup fails
    }
}

/**
 * Skip a timer (disable temporarily)
 */
export async function skipTimer(timerId: string): Promise<SystemdTimer[]> {
    // Stop the timer temporarily
    await execCommand('systemctl', ['stop', `${timerId}.timer`], { sudo: true });

    return getShutdownTimers();
}

/**
 * Unskip a timer (re-enable a skipped timer)
 */
export async function unskipTimer(timerId: string): Promise<SystemdTimer[]> {
    // Start the timer again
    await execCommand('systemctl', ['start', `${timerId}.timer`], { sudo: true });

    return getShutdownTimers();
}
