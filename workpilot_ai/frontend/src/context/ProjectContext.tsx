import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  setActiveProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  refreshActiveProject: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshProjects = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const list = await api.getProjects();
      setProjects(list);
      if (list.length > 0) {
        // If no active project or active project was deleted/not in list, pick the first
        if (!activeProject || !list.some(p => p.id === activeProject.id)) {
          setActiveProject(list[0]);
        } else {
          const updated = list.find(p => p.id === activeProject.id);
          if (updated) setActiveProject(updated);
        }
      } else {
        setActiveProject(null);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshActiveProject = async () => {
    if (!activeProject) return;
    try {
      const updated = await api.getProject(activeProject.id);
      setActiveProject(updated);
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (err) {
      console.error("Failed to refresh active project:", err);
    }
  };

  useEffect(() => {
    if (user) {
      refreshProjects();
    } else {
      setProjects([]);
      setActiveProject(null);
    }
  }, [user]);

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      isLoading,
      setActiveProject,
      refreshProjects,
      refreshActiveProject
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
