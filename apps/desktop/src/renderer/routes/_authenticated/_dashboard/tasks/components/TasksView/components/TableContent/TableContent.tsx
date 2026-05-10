import { useCallback, useEffect, useMemo } from "react";
import type { TaskWithStatus } from "../../hooks/useTasksData";
import { useTasksTable } from "../../hooks/useTasksTable";
import { TasksEmptyState } from "../TasksEmptyState";
import { TasksTableView } from "../TasksTableView";
import type { TabValue } from "../TasksTopBar";
import { getSelectedTasks } from "./utils/getSelectedTasks";

interface TableContentProps {
	filterTab: TabValue;
	searchQuery: string;
	assigneeFilter: string | null;
	onTaskClick: (task: TaskWithStatus) => void;
	onSelectionChange?: (
		selectedTasks: TaskWithStatus[],
		clearSelection: () => void,
	) => void;
}

export function TableContent({
	filterTab,
	searchQuery,
	assigneeFilter,
	onTaskClick,
	onSelectionChange,
}: TableContentProps) {
	const { table, slugColumnWidth, rowSelection, setRowSelection } =
		useTasksTable({
			filterTab,
			searchQuery,
			assigneeFilter,
		});

	const selectedTasks = useMemo(() => {
		return getSelectedTasks(table.getRowModel().flatRows, rowSelection);
	}, [rowSelection, table]);

	const clearSelection = useCallback(() => {
		setRowSelection({});
	}, [setRowSelection]);

	useEffect(() => {
		onSelectionChange?.(selectedTasks, clearSelection);
	}, [selectedTasks, clearSelection, onSelectionChange]);

	if (table.getRowModel().rows.length === 0) {
		return <TasksEmptyState />;
	}

	return (
		<TasksTableView
			table={table}
			slugColumnWidth={slugColumnWidth}
			onTaskClick={onTaskClick}
		/>
	);
}
