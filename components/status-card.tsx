"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, GitCommitHorizontal, FolderGit2 } from "lucide-react";
import { getState, checkAuth } from "@/app/actions";

interface State {
	lastSyncedAt: string | null;
	totalCommitsMirrored: number;
	mirrorRepoPath: string;
}

/**
 * Displays the current mirror status: last sync time, total commits,
 * mirror repo path, and gh auth status.
 */
export function StatusCard() {
	const [state, setState] = useState<State | null>(null);
	const [authStatus, setAuthStatus] = useState<string>("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function load() {
			const [stateResult, authResult] = await Promise.all([
				getState(),
				checkAuth(),
			]);
			if (stateResult.data) setState(stateResult.data as State);
			setAuthStatus(authResult.message);
			setLoading(false);
		}
		load();
	}, []);

	if (loading) {
		return (
			<div className="rounded-lg border border-border bg-card p-6 animate-pulse">
				<div className="h-4 bg-border rounded w-1/3 mb-4" />
				<div className="h-3 bg-border rounded w-2/3 mb-2" />
				<div className="h-3 bg-border rounded w-1/2" />
			</div>
		);
	}

	const stats = [
		{
			icon: Clock,
			label: "Last synced",
			value: state?.lastSyncedAt
				? new Date(state.lastSyncedAt).toLocaleString()
				: "Never",
		},
		{
			icon: GitCommitHorizontal,
			label: "Total mirrored",
			value: state?.totalCommitsMirrored?.toString() ?? "0",
		},
		{
			icon: FolderGit2,
			label: "Mirror repo",
			value: state?.mirrorRepoPath || "Not set",
		},
	];

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{stats.map((s) => (
					<div
						key={s.label}
						className="rounded-lg border border-border bg-card p-4 hover:bg-card-hover transition-colors"
					>
						<div className="flex items-center gap-2 text-text-muted text-xs mb-1">
							<s.icon size={14} />
							{s.label}
						</div>
						<p className="text-sm font-medium truncate">{s.value}</p>
					</div>
				))}
			</div>

			<div className="rounded-lg border border-border bg-card p-4">
				<div className="flex items-center gap-2 text-text-muted text-xs mb-2">
					<Activity size={14} />
					gh auth status
				</div>
				<pre className="text-xs text-text-dim whitespace-pre-wrap break-all">
					{authStatus}
				</pre>
			</div>
		</div>
	);
}
