import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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
  refreshProjects: () => Promise<void>;
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

  // Multiple projects can have ACTIVE status simultaneously.
  const activeProjects = projects.filter(
    (project) => project.status === 'ACTIVE'
  );

  const refreshProjects = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const list: Project[] = await api.getProjects();
      setProjects(list);

      setActiveProject((current) => {
        if (!list.length) return null;

        if (!current) return list[0];

        return list.find((project) => project.id === current.id)
          ?? list[0];
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

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
    if (user) {
      void refreshProjects().catch((error) =>
        console.error('Initial project load failed:', error)
      );
    } else {
      setProjects([]);
      setActiveProject(null);
    }
  }, [user]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjects,
        isLoading,
        setActiveProject,
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