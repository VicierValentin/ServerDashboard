import { execCommand } from '../utils/exec.js';
import { DockerContainerState, type DockerContainer, type DockerComposeProject, type DockerData } from '../types.js';
import { COMPOSE_PROJECTS_MAP } from '../config.js';

/**
 * Parse Docker container state from status string
 */
function parseContainerState(state: string): DockerContainerState {
    const stateLower = state.toLowerCase();
    
    if (stateLower === 'running') return DockerContainerState.RUNNING;
    if (stateLower === 'paused') return DockerContainerState.PAUSED;
    if (stateLower === 'restarting') return DockerContainerState.RESTARTING;
    if (stateLower === 'exited') return DockerContainerState.STOPPED;
    if (stateLower === 'created') return DockerContainerState.CREATED;
    if (stateLower === 'dead') return DockerContainerState.DEAD;
    
    return DockerContainerState.STOPPED;
}

/**
 * Get Docker compose labels for a container
 */
async function getContainerLabels(containerId: string): Promise<{ project?: string; service?: string }> {
    try {
        const { stdout } = await execCommand('docker', [
            'inspect',
            '--format={{index .Config.Labels "com.docker.compose.project"}},{{index .Config.Labels "com.docker.compose.service"}}',
            containerId
        ]);
        
        const [project, service] = stdout.trim().split(',');
        return {
            project: project && project !== '<no value>' ? project : undefined,
            service: service && service !== '<no value>' ? service : undefined,
        };
    } catch (error) {
        console.error(`Failed to get labels for container ${containerId}:`, error);
        return {};
    }
}

/**
 * List all Docker containers
 */
export async function listContainers(): Promise<DockerContainer[]> {
    try {
        const { stdout } = await execCommand('docker', [
            'ps',
            '-a',
            '--format',
            '{{json .}}'
        ]);

        if (!stdout.trim()) {
            return [];
        }

        const lines = stdout.trim().split('\n');
        const containers: DockerContainer[] = [];

        for (const line of lines) {
            try {
                const data = JSON.parse(line);
                
                // Get compose labels
                const labels = await getContainerLabels(data.ID);
                
                containers.push({
                    id: data.ID,
                    name: data.Names.startsWith('/') ? data.Names.substring(1) : data.Names,
                    image: data.Image,
                    status: data.Status,
                    state: parseContainerState(data.State),
                    created: new Date(data.CreatedAt).toISOString(),
                    ports: data.Ports || '',
                    composeProject: labels.project,
                    composeService: labels.service,
                });
            } catch (parseError) {
                console.error('Failed to parse container JSON:', line, parseError);
            }
        }

        return containers;
    } catch (error) {
        console.error('Failed to list Docker containers:', error);
        return [];
    }
}

/**
 * Derive project status from container states
 */
function deriveProjectStatus(containers: DockerContainer[]): 'running' | 'partial' | 'stopped' {
    const runningCount = containers.filter(c => c.state === DockerContainerState.RUNNING).length;
    
    if (runningCount === containers.length) return 'running';
    if (runningCount === 0) return 'stopped';
    return 'partial';
}

/**
 * Get all Docker data (compose projects and standalone containers)
 */
export async function getDockerData(): Promise<DockerData> {
    const allContainers = await listContainers();
    
    // Separate compose and standalone containers
    const composeContainers = allContainers.filter(c => c.composeProject);
    const standaloneContainers = allContainers.filter(c => !c.composeProject);
    
    // Group compose containers by project
    const projectMap = new Map<string, DockerContainer[]>();
    for (const container of composeContainers) {
        const projectName = container.composeProject!;
        if (!projectMap.has(projectName)) {
            projectMap.set(projectName, []);
        }
        projectMap.get(projectName)!.push(container);
    }
    
    // Convert to DockerComposeProject array
    const composeProjects: DockerComposeProject[] = Array.from(projectMap.entries()).map(
        ([name, containers]) => ({
            name,
            containers,
            status: deriveProjectStatus(containers),
            composePath: COMPOSE_PROJECTS_MAP[name],
        })
    );
    
    return {
        composeProjects,
        standaloneContainers,
    };
}

/**
 * Start a Docker container
 */
export async function startContainer(containerId: string): Promise<void> {
    await execCommand('docker', ['start', containerId]);
}

/**
 * Stop a Docker container
 */
export async function stopContainer(containerId: string): Promise<void> {
    await execCommand('docker', ['stop', containerId]);
}

/**
 * Restart a Docker container
 */
export async function restartContainer(containerId: string): Promise<void> {
    await execCommand('docker', ['restart', containerId]);
}

/**
 * Pause a Docker container
 */
export async function pauseContainer(containerId: string): Promise<void> {
    await execCommand('docker', ['pause', containerId]);
}

/**
 * Unpause a Docker container
 */
export async function unpauseContainer(containerId: string): Promise<void> {
    await execCommand('docker', ['unpause', containerId]);
}

/**
 * Bring up a Docker Compose project
 */
export async function composeUp(projectName: string): Promise<void> {
    const composePath = COMPOSE_PROJECTS_MAP[projectName];
    if (!composePath) {
        throw new Error(`No compose file configured for project: ${projectName}`);
    }
    
    await execCommand('docker', ['compose', '-f', composePath, 'up', '-d']);
}

/**
 * Bring down a Docker Compose project
 */
export async function composeDown(projectName: string): Promise<void> {
    const composePath = COMPOSE_PROJECTS_MAP[projectName];
    if (!composePath) {
        throw new Error(`No compose file configured for project: ${projectName}`);
    }
    
    await execCommand('docker', ['compose', '-f', composePath, 'down']);
}

/**
 * Restart a Docker Compose project
 */
export async function composeRestart(projectName: string): Promise<void> {
    const composePath = COMPOSE_PROJECTS_MAP[projectName];
    if (!composePath) {
        throw new Error(`No compose file configured for project: ${projectName}`);
    }
    
    await execCommand('docker', ['compose', '-f', composePath, 'restart']);
}

/**
 * Stream Docker container status updates via WebSocket
 */
export async function streamContainerStatus(
    send: (data: DockerData) => void
): Promise<() => void> {
    let isActive = true;
    
    // Poll for updates every 2 seconds
    const poll = async () => {
        while (isActive) {
            try {
                const data = await getDockerData();
                send(data);
            } catch (error) {
                console.error('Error polling Docker status:', error);
            }
            
            // Wait 2 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    };
    
    // Start polling in background
    poll();
    
    // Return cleanup function
    return () => {
        isActive = false;
    };
}
