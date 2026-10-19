import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { Project } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  activeProjects: Project[];
  isLoading: boolean;
  setActiveProject: (project: Project | null) => void;
  removeProject: (projectId: number) => void;
  refreshProjects: (options?: { silent?: boolean }) => Promise<void>;
  refreshActiveProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(
  undefined
);

export const ProjectProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] =
    useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const latestProjectsRequest = useRef(0);

  // Multiple projects can have ACTIVE status simultaneously.
  const activeProjects = projects.filter(
    (project) => project.status === 'ACTIVE'
  );

  const refreshProjects = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;

    const requestId = ++latestProjectsRequest.current;

    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const list: Project[] = await api.getProjects();

      if (requestId !== latestProjectsRequest.current) return;

      setProjects(list);

      setActiveProject((current) => {
        if (!list.length) return null;

        if (!current) return list[0];

        return list.find((project) => project.id === current.id)
          ?? list[0];
      });
    } catch (error) {
      if (requestId !== latestProjectsRequest.current) return;

      console.error('Failed to load projects:', error);
      throw error;
    } finally {
      if (
        requestId === latestProjectsRequest.current &&
        !options?.silent
      ) {
        setIsLoading(false);
      }
    }
  }, [user]);

  const removeProject = useCallback((projectId: number) => {
    latestProjectsRequest.current += 1;
    setProjects((previous) =>
      previous.filter((project) => project.id !== projectId),
    );
    setActiveProject((current) => {
      if (current?.id !== projectId) return current;
      return projects.find((project) => project.id !== projectId) ?? null;
    });
  }, [projects]);

  const refreshActiveProject = async () => {
    if (!activeProject) return;

    try {
      const updated = await api.getProject(activeProject.id);

      setProjects((previous) =>
        previous.map((project) =>
          project.id === updated.id ? updated : project
        )
      );

      setActiveProject(updated);
    } catch (error) {
      console.error('Failed to refresh active project:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setActiveProject(null);
      return;
    }

    void refreshProjects().catch((error) =>
      console.error('Initial project load failed:', error)
    );

    const refreshProjectsInBackground = () => {
      void refreshProjects({ silent: true }).catch((error) =>
        console.error('Background project refresh failed:', error)
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProjectsInBackground();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshProjectsInBackground();
      }
    }, 5000);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshProjects]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjects,
        isLoading,
        setActiveProject,
        removeProject,
        refreshProjects,
        refreshActiveProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error(
      'useProject must be used within a ProjectProvider'
    );
  }

  return context;
};