import type { TaskWithStatus } from "../../hooks/useTasksData";
import { useTasksData } from "../../hooks/useTasksData";
import { TasksBoardView } from "../TasksBoardView";
import { TasksEmptyState } from "../TasksEmptyState";
import type { TabValue } from "../TasksTopBar";

interface BoardContentProps {
	filterTab: TabValue;
	searchQuery: string;
	assigneeFilter: string | null;
	onTaskClick: (task: TaskWithStatus) => void;
}

export function BoardContent({
	filterTab,
	searchQuery,
	assigneeFilter,
	onTaskClick,
}: BoardContentProps) {
	const { data, allStatuses } = useTasksData({
		filterTab,
		searchQuery,
		assigneeFilter,
	});

	if (data.length === 0) {
		return <TasksEmptyState />;
	}

	return (
		<TasksBoardView
			data={data}
			allStatuses={allStatuses}
			onTaskClick={onTaskClick}
		/>
	);
}
