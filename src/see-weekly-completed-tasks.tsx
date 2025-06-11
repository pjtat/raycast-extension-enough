import { List, Toast, showToast, Color, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  todoistApiToken: string;
}

interface Task {
  id: string;
  content: string;
  completed_at: string;
  project_id: string;
  priority: number;
  user_id: string;
  project_name?: string;
  labels: string[];
}

interface Project {
  id: string;
  name: string;
}

interface TodoistResponse {
  items: Task[];
  next_cursor?: string;
}

interface TasksByProject {
  [projectId: string]: {
    projectName: string;
    tasks: Task[];
  };
}

interface SyncResponse {
  user: {
    id: string;
  };
}

const getPriorityIcon = (priority: number) => {
  switch (priority) {
    case 4:
      return { source: { light: "priority-4.png", dark: "priority-4.png" } };
    case 3:
      return { source: { light: "priority-3.png", dark: "priority-3.png" } };
    case 2:
      return { source: { light: "priority-2.png", dark: "priority-2.png" } };
    default:
      return { source: { light: "priority-1.png", dark: "priority-1.png" } };
  }
};

// Helper function to format date as "Jun 5"
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Command() {
  const [tasksByProject, setTasksByProject] = useState<TasksByProject>({});
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<Preferences>();
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    async function fetchUserId() {
      const response = await fetch('https://api.todoist.com/api/v1/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${preferences.todoistApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sync_token: '*',
          resource_types: ['user'],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const data = await response.json() as SyncResponse;
      return data.user.id;
    }

    async function fetchProjectDetails(projectId: string): Promise<Project> {
      const response = await fetch(
        `https://api.todoist.com/api/v1/projects/${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${preferences.todoistApiToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch project details for project ${projectId}`);
      }

      return response.json() as Promise<Project>;
    }

    async function fetchCompletedTasksPage(cursor?: string): Promise<TodoistResponse> {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceStr = since.toISOString().split('T')[0];
      
      const until = new Date();
      const untilStr = until.toISOString().split('T')[0];

      const url = new URL('https://api.todoist.com/api/v1/tasks/completed/by_completion_date');
      url.searchParams.append('since', sinceStr);
      url.searchParams.append('until', untilStr);
      url.searchParams.append('limit', '50');
      if (cursor) {
        url.searchParams.append('cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${preferences.todoistApiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }

      return response.json() as Promise<TodoistResponse>;
    }

    async function fetchAllCompletedTasks(): Promise<Task[]> {
      const allTasks: Task[] = [];
      let cursor: string | undefined;

      do {
        const response = await fetchCompletedTasksPage(cursor);
        allTasks.push(...response.items);
        cursor = response.next_cursor;
      } while (cursor);

      return allTasks;
    }

    async function fetchCompletedTasks() {
      try {
        const currentUserId = await fetchUserId();
        setUserId(currentUserId);

        const allTasks = await fetchAllCompletedTasks();
        
        const userTasks = allTasks.filter(task => task.user_id === currentUserId);
        
        const projectIds = [...new Set(userTasks.map(task => task.project_id))];
        
        const projectDetails = await Promise.all(
          projectIds.map(async (projectId) => {
            try {
              return await fetchProjectDetails(projectId);
            } catch (error) {
              console.error(`Failed to fetch project ${projectId}:`, error);
              return { id: projectId, name: "Unknown Project" };
            }
          })
        );

        const projectMap = Object.fromEntries(
          projectDetails.map(project => [project.id, project.name])
        );

        const grouped = userTasks.reduce<TasksByProject>((acc, task) => {
          const projectId = task.project_id;
          if (!acc[projectId]) {
            acc[projectId] = {
              projectName: projectMap[projectId] || "Unknown Project",
              tasks: [],
            };
          }
          acc[projectId].tasks.push(task);
          return acc;
        }, {});

        Object.values(grouped).forEach(project => {
          project.tasks.sort((a, b) => a.priority - b.priority);
        });

        setTasksByProject(grouped);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to fetch tasks",
          message: error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchCompletedTasks();
  }, []);

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Weekly Completed Tasks"
      searchBarPlaceholder="Search completed tasks..."
    >
      <List.Section title="🎯 Weekly Summary">
        <List.Item 
          title={`${Object.values(tasksByProject).reduce((total, project) => total + project.tasks.length, 0)} tasks completed this week`}
          icon={Icon.Dot}
        />
      </List.Section>

      {Object.entries(tasksByProject).map(([projectId, { projectName, tasks }]) => (
        <List.Section 
          key={projectId} 
          title={`${projectName} (${tasks.length})`}
        >
          {tasks.map((task) => (
            <List.Item
              key={task.id}
              title={task.content}
              icon={getPriorityIcon(task.priority)}
              accessories={[
                {
                  text: formatDate(task.completed_at),
                  tooltip: "Completion Date"
                }
              ]}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
