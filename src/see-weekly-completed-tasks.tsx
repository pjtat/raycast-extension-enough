import { List, getPreferenceValues, Icon, Color } from "@raycast/api";
import { ReactElement, useEffect, useState } from "react";

interface Preferences {
  todoistApiToken: string;
}

interface Task {
  id: string;
  content: string;
  completed_at: string;
  priority: number;
  labels: string[];
  project_id: string;
}

interface TodoistResponse {
  items: Task[];
}

function getPriorityIcon(priority: number): { source: Icon; tintColor: Color } {
  switch (priority) {
    case 4:
      return { source: Icon.ExclamationMark, tintColor: Color.Red };
    case 3:
      return { source: Icon.ExclamationMark, tintColor: Color.Orange };
    case 2:
      return { source: Icon.ExclamationMark, tintColor: Color.Blue };
    default:
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.priority - a.priority);
}

async function getWeeklyCompletedTasks(): Promise<Task[]> {
  const preferences = getPreferenceValues<Preferences>();
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const params = new URLSearchParams({
    since: weekAgo.toISOString(),
    until: today.toISOString(),
    limit: "50"
  });

  const response = await fetch(
    `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?${params}`,
    {
      headers: {
        Authorization: `Bearer ${preferences.todoistApiToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json() as TodoistResponse;
  return sortTasksByPriority(data.items);
}

export default function Command(): ReactElement {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWeeklyCompletedTasks()
      .then(data => setTasks(data))
      .catch(err => setError(err.message));
  }, []);

  if (error) {
    return (
      <List>
        <List.Item title="Error" subtitle={error} />
      </List>
    );
  }

  return (
    <List>
      {tasks.map((task) => (
        <List.Item
          key={task.id}
          icon={getPriorityIcon(task.priority)}
          title={task.content}
          subtitle={new Date(task.completed_at).toLocaleDateString()}
          accessories={[
            { text: task.labels.length > 0 ? task.labels.join(", ") : undefined }
          ]}
        />
      ))}
    </List>
  );
}

