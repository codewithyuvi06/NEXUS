export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Review' | 'Completed'
export type Priority = 'Low' | 'Medium' | 'High'
export type Task = {
  id: string; title: string; description?: string; status: TaskStatus; priority: Priority;
  dueDate: string; project: string; tags: string[]; subtasks: number; doneSubtasks: number; completedAt?: string
}
export type Project = { id: string; name: string; description: string; status: string; progress: number; deadline: string; priority: Priority; color: string }
export type Goal = { id: string; title: string; category: string; progress: number; deadline: string; milestones: number; completed?: boolean }
export type Habit = { id: string; title: string; category: string; streak: number; week: boolean[]; archived?: boolean }
export type Note = { id: string; title: string; body: string; category: string; tags: string[]; favorite: boolean; updatedAt: string }

export type FocusSession = { id: string; taskId?: string; taskTitle: string; mode: string; durationMinutes: number; endedAt: string }
