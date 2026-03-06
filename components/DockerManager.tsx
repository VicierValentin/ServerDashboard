import React, { useState, useEffect, useCallback } from 'react';
import type { DockerData, DockerContainer, DockerComposeProject } from '../types';
import { DockerContainerState } from '../types';
import { api } from '../services/api';
import { DockerIcon } from './icons/DockerIcon';
import { PowerIcon } from './icons/PowerIcon';
import { RestartIcon } from './icons/RestartIcon';

interface DockerManagerProps {
  dockerData: DockerData;
  setDockerData: React.Dispatch<React.SetStateAction<DockerData>>;
}

const stateStyles = {
  [DockerContainerState.RUNNING]: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    label: 'Running',
  },
  [DockerContainerState.STOPPED]: {
    dot: 'bg-gray-500',
    text: 'text-gray-400',
    label: 'Stopped',
  },
  [DockerContainerState.PAUSED]: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-400',
    label: 'Paused',
  },
  [DockerContainerState.RESTARTING]: {
    dot: 'bg-blue-500',
    text: 'text-blue-400',
    label: 'Restarting',
  },
  [DockerContainerState.CREATED]: {
    dot: 'bg-purple-500',
    text: 'text-purple-400',
    label: 'Created',
  },
  [DockerContainerState.DEAD]: {
    dot: 'bg-red-500',
    text: 'text-red-400',
    label: 'Dead',
  },
};

const projectStatusStyles = {
  running: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    label: 'Running',
  },
  partial: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-400',
    label: 'Partial',
  },
  stopped: {
    dot: 'bg-gray-500',
    text: 'text-gray-400',
    label: 'Stopped',
  },
};

export const DockerManager: React.FC<DockerManagerProps> = ({ dockerData, setDockerData }) => {
  const [loadingContainer, setLoadingContainer] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // WebSocket connection for real-time updates
  useEffect(() => {
    const cleanup = api.streamDockerStatus(
      (data) => {
        setDockerData(data);
      },
      (error) => {
        console.error('Docker status stream error:', error);
      }
    );

    return cleanup;
  }, [setDockerData]);

  const toggleProjectExpanded = (projectName: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectName)) {
        newSet.delete(projectName);
      } else {
        newSet.add(projectName);
      }
      return newSet;
    });
  };

  const handleContainerAction = async (
    containerId: string,
    action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause'
  ) => {
    setLoadingContainer(containerId);
    try {
      let data: DockerData;
      switch (action) {
        case 'start':
          data = await api.startDockerContainer(containerId);
          break;
        case 'stop':
          data = await api.stopDockerContainer(containerId);
          break;
        case 'restart':
          data = await api.restartDockerContainer(containerId);
          break;
        case 'pause':
          data = await api.pauseDockerContainer(containerId);
          break;
        case 'unpause':
          data = await api.unpauseDockerContainer(containerId);
          break;
      }
      setDockerData(data);
    } catch (error) {
      alert(`Failed to ${action} container.`);
      console.error(error);
    } finally {
      setLoadingContainer(null);
    }
  };

  const handleProjectAction = async (
    projectName: string,
    action: 'up' | 'down' | 'restart'
  ) => {
    setLoadingProject(projectName);
    try {
      let data: DockerData;
      switch (action) {
        case 'up':
          data = await api.composeUp(projectName);
          break;
        case 'down':
          data = await api.composeDown(projectName);
          break;
        case 'restart':
          data = await api.composeRestart(projectName);
          break;
      }
      setDockerData(data);
    } catch (error) {
      alert(`Failed to ${action} project ${projectName}.`);
      console.error(error);
    } finally {
      setLoadingProject(null);
    }
  };

  const handleProjectPauseResume = async (project: DockerComposeProject) => {
    setLoadingProject(project.name);
    try {
      // Check if any container is running to determine action
      const hasRunning = project.containers.some(c => c.state === DockerContainerState.RUNNING);
      const action = hasRunning ? 'pause' : 'unpause';
      
      // Pause/unpause all containers in sequence
      for (const container of project.containers) {
        if (hasRunning && container.state === DockerContainerState.RUNNING) {
          await api.pauseDockerContainer(container.id);
        } else if (!hasRunning && container.state === DockerContainerState.PAUSED) {
          await api.unpauseDockerContainer(container.id);
        }
      }
      
      // Refresh data
      const data = await api.getDockerData();
      setDockerData(data);
    } catch (error) {
      alert(`Failed to pause/resume project ${project.name}.`);
      console.error(error);
    } finally {
      setLoadingProject(null);
    }
  };

  const renderContainer = (container: DockerContainer, isInProject: boolean = false) => {
    const styles = stateStyles[container.state];
    const isLoading = loadingContainer === container.id;
    const canStart = container.state === DockerContainerState.STOPPED || container.state === DockerContainerState.CREATED;
    const canStop = container.state === DockerContainerState.RUNNING;
    const canPause = container.state === DockerContainerState.RUNNING;
    const canUnpause = container.state === DockerContainerState.PAUSED;

    return (
      <div
        key={container.id}
        className={`${isInProject ? 'bg-gray-900/50 ml-4' : 'bg-gray-900/70'} p-4 rounded-lg`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-white">{container.name}</p>
              {container.composeService && (
                <span className="text-xs bg-purple-600/50 text-purple-200 px-1.5 py-0.5 rounded">
                  {container.composeService}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">{container.image}</p>
            <div className="flex items-center mt-2">
              <span className={`w-2 h-2 rounded-full mr-2 ${styles.dot}`}></span>
              <p className={`text-sm ${styles.text}`}>{styles.label}</p>
            </div>
            {container.ports && (
              <p className="text-xs text-gray-500 mt-1">{container.ports}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleContainerAction(container.id, 'restart')}
              disabled={isLoading || container.state === DockerContainerState.STOPPED}
              className="p-2 rounded-md bg-blue-700 hover:bg-blue-600 text-blue-200 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Restart ${container.name}`}
              title="Restart"
            >
              <RestartIcon className="w-5 h-5" />
            </button>
            {canPause ? (
              <button
                onClick={() => handleContainerAction(container.id, 'pause')}
                disabled={isLoading}
                className="px-4 py-2 rounded-md font-semibold bg-yellow-600 hover:bg-yellow-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {isLoading ? 'Processing...' : 'Pause'}
              </button>
            ) : canUnpause ? (
              <button
                onClick={() => handleContainerAction(container.id, 'unpause')}
                disabled={isLoading}
                className="px-4 py-2 rounded-md font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {isLoading ? 'Processing...' : 'Unpause'}
              </button>
            ) : null}
            {canStart ? (
              <button
                onClick={() => handleContainerAction(container.id, 'start')}
                disabled={isLoading}
                className="px-4 py-2 rounded-md font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait w-20"
              >
                {isLoading ? 'Processing...' : 'Start'}
              </button>
            ) : canStop ? (
              <button
                onClick={() => handleContainerAction(container.id, 'stop')}
                disabled={isLoading}
                className="px-4 py-2 rounded-md font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait w-20"
              >
                {isLoading ? 'Processing...' : 'Stop'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderComposeProject = (project: DockerComposeProject) => {
    const isExpanded = expandedProjects.has(project.name);
    const styles = projectStatusStyles[project.status];
    const isLoading = loadingProject === project.name;
    const hasRunning = project.containers.some(c => c.state === DockerContainerState.RUNNING);
    const hasPaused = project.containers.some(c => c.state === DockerContainerState.PAUSED);

    return (
      <div key={project.name} className="bg-gray-900/70 rounded-lg overflow-hidden">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleProjectExpanded(project.name)}
                  className="text-white hover:text-gray-300 transition-colors"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <DockerIcon className="w-6 h-6 text-blue-400" />
                <p className="font-bold text-white text-lg">{project.name}</p>
                <span className="text-xs bg-blue-600/50 text-blue-200 px-2 py-0.5 rounded">
                  {project.containers.length} container{project.containers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center mt-2 ml-7">
                <span className={`w-2 h-2 rounded-full mr-2 ${styles.dot}`}></span>
                <p className={`text-sm ${styles.text}`}>{styles.label}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-7 lg:ml-0">
              <button
                onClick={() => handleProjectAction(project.name, 'restart')}
                disabled={isLoading || project.status === 'stopped'}
                className="p-2 rounded-md bg-blue-700 hover:bg-blue-600 text-blue-200 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Restart ${project.name}`}
                title="Restart Project"
              >
                <RestartIcon className="w-5 h-5" />
              </button>
              {project.status !== 'stopped' && (
                <button
                  onClick={() => handleProjectPauseResume(project)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md font-semibold bg-yellow-600 hover:bg-yellow-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                  title={hasRunning ? 'Pause All' : 'Resume All'}
                >
                  {isLoading ? '...' : (hasRunning ? 'Pause' : 'Resume')}
                </button>
              )}
              {project.status === 'stopped' ? (
                <button
                  onClick={() => handleProjectAction(project.name, 'up')}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait w-20"
                >
                  {isLoading ? '...' : 'Up'}
                </button>
              ) : (
                <button
                  onClick={() => handleProjectAction(project.name, 'down')}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-md font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-wait w-20"
                >
                  {isLoading ? '...' : 'Down'}
                </button>
              )}
            </div>
          </div>
        </div>
        {isExpanded && (
          <div className="px-4 pb-4 space-y-2">
            {project.containers.map((container) => renderContainer(container, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 backdrop-blur-sm h-full">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <DockerIcon className="w-6 h-6" />
        Docker Containers
      </h2>
      <div className="space-y-4">
        {dockerData.composeProjects.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Compose Projects</h3>
            <div className="space-y-3">
              {dockerData.composeProjects.map(renderComposeProject)}
            </div>
          </div>
        )}
        {dockerData.standaloneContainers.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Standalone Containers</h3>
            <div className="space-y-3">
              {dockerData.standaloneContainers.map((container) => renderContainer(container, false))}
            </div>
          </div>
        )}
        {dockerData.composeProjects.length === 0 && dockerData.standaloneContainers.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <DockerIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No Docker containers found</p>
            <p className="text-sm mt-1">Start some containers to see them here</p>
          </div>
        )}
      </div>
    </div>
  );
};
