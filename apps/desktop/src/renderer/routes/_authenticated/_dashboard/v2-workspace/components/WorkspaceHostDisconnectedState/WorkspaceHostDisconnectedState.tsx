import { Button } from "@superset/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MonitorX } from "lucide-react";

interface WorkspaceHostDisconnectedStateProps {
	hostName: string;
	hostId: string;
	reason: "offline" | "unreachable" | "missing";
}

function getReasonLabel(reason: WorkspaceHostDisconnectedStateProps["reason"]) {
	if (reason === "offline") return "Offline";
	if (reason === "missing") return "Unavailable";
	return "Relay unreachable";
}

export function WorkspaceHostDisconnectedState({
	hostName,
	hostId,
	reason,
}: WorkspaceHostDisconnectedStateProps) {
	return (
		<div className="flex h-full w-full items-center justify-center p-6">
			<div className="flex w-full max-w-sm flex-col items-start gap-6">
				<div className="grid size-10 place-items-center rounded-lg border border-border/60 bg-muted/30">
					<MonitorX
						className="size-[18px] text-muted-foreground"
						strokeWidth={1.5}
						aria-hidden="true"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<h1 className="text-[15px] font-medium tracking-tight text-foreground">
						Host disconnected
					</h1>
					<p className="select-text cursor-text text-[13px] leading-relaxed text-muted-foreground">
						This workspace's host is not reachable through the relay. Restart
						Superset on that host, then reopen this workspace.
					</p>
				</div>

				<div className="flex w-full flex-col gap-0 overflow-hidden rounded-md border border-border/60 bg-muted/30">
					<div className="flex items-center gap-2.5 px-3 py-2">
						<span
							aria-hidden="true"
							className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
						/>
						<span
							className="select-text cursor-text min-w-0 truncate text-[13px] font-medium text-foreground"
							title={hostName}
						>
							{hostName}
						</span>
					</div>
					<div className="border-t border-border/60 px-3 py-2">
						<div className="flex items-center justify-between gap-3">
							<span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
								Status
							</span>
							<span className="text-[12px] text-muted-foreground">
								{getReasonLabel(reason)}
							</span>
						</div>
						<div className="mt-1 flex items-center justify-between gap-3">
							<span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
								Host ID
							</span>
							<code className="select-text cursor-text max-w-44 truncate font-mono text-[12px] tabular-nums text-muted-foreground">
								{hostId}
							</code>
						</div>
					</div>
				</div>

				<Button
					asChild
					size="sm"
					variant="ghost"
					className="-ml-2 h-7 gap-1.5 px-2 text-[13px] font-medium text-foreground hover:bg-muted/60"
				>
					<Link to="/v2-workspaces">
						Browse workspaces
						<ArrowRight
							className="size-3.5"
							strokeWidth={2}
							aria-hidden="true"
						/>
					</Link>
				</Button>
			</div>
		</div>
	);
}
