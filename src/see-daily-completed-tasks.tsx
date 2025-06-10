import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  todoistApiKey: string;
}

async function getCompletedTasks() {
  const preferences = getPreferenceValues<Preferences>();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const params = new URLSearchParams({
    since: today.toISOString(),
    until: tomorrow.toISOString(),
    limit: "50"
  });

  const response = await fetch(
    `https://api.todoist.com/api/v1/tasks/completed/by_completion_date?${params}`,
    {
      headers: {
        Authorization: `Bearer ${preferences.todoistApiKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}
