import { execFile as execFileCb, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFileCb);

/**
 * Execute a command safely using execFile (no shell interpolation)
 * This prevents command injection attacks
 */
export async function execCommand(
    command: string,
    args: string[] = [],
    options: { timeout?: number; sudo?: boolean } = {}
): Promise<{ stdout: string; stderr: string }> {
    const { timeout = 30000, sudo = false } = options;

    const actualCommand = sudo ? 'sudo' : command;
    const actualArgs = sudo ? [command, ...args] : args;

    try {
        const { stdout, stderr } = await execFileAsync(actualCommand, actualArgs, {
            timeout,
            maxBuffer: 1024 * 1024, // 1MB buffer
        });
        return { stdout: stdout.toString(), stderr: stderr.toString() };
    } catch (error: any) {
        // Include stderr in error for debugging
        const stderr = error.stderr?.toString() || '';
        const stdout = error.stdout?.toString() || '';
        throw new Error(`Command failed: ${actualCommand} ${actualArgs.join(' ')}\nstderr: ${stderr}\nstdout: ${stdout}`);
    }
}

/**
 * Spawn a long-running process (for log streaming)
 */
export function spawnProcess(
    command: string,
    args: string[] = [],
    options: { sudo?: boolean; cwd?: string; shell?: boolean } = {}
): ChildProcess {
    const { sudo = false, cwd, shell = false } = options;

    const actualCommand = sudo ? 'sudo' : command;
    const actualArgs = sudo ? [command, ...args] : args;

    return spawn(actualCommand, actualArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd,
        shell,
    });
}

/**
 * Parse systemctl show output into key-value pairs
 */
export function parseSystemctlShow(output: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of output.split('\n')) {
        const eqIndex = line.indexOf('=');
        if (eqIndex > 0) {
            const key = line.substring(0, eqIndex);
            const value = line.substring(eqIndex + 1);
            result[key] = value;
        }
    }
    return result;
}
