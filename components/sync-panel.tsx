"use client";

import { useState } from "react";
import { Play, Eye, Loader2, Terminal, CloudOff } from "lucide-react";
import { triggerSync } from "@/app/actions";

/**
 * Panel with buttons to trigger a real sync or a dry-run preview.
 * Displays the CLI output in a terminal-style box. Shows a hint
 * when running on Vercel (no local CLI access).
 */
export function SyncPanel() {
	const [output, setOutput] = useState<string>("");
	const [running, setRunning] = useState(false);

	const handleSync = async (dryRun: boolean) => {
		setRunning(true);
		setOutput(`Running sync${dryRun ? " (dry run)" : ""}...`);
		const result = await triggerSync(dryRun);
		setOutput(result.message);
		setRunning(false);
	};

	return (
		<div className="rounded-lg border border-border bg-card p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
					Sync
				</h2>
				<span className="flex items-center gap-1.5 text-xs text-text-dim">
					<CloudOff size={12} />
					local only
				</span>
			</div>

			<div className="flex gap-3">
				<button
					type="button"
					onClick={() => handleSync(true)}
					disabled={running}
					className="flex items-center gap-2 rounded-md border border-border bg-bg px-4 py-2 text-sm text-text hover:bg-card-hover disabled:opacity-50 transition-colors cursor-pointer"
				>
					{running ? (
						<Loader2 size={14} className="animate-spin" />
					) : (
						<Eye size={14} />
					)}
					Dry Run
				</button>

				<button
					type="button"
					onClick={() => handleSync(false)}
					disabled={running}
					className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
				>
					{running ? (
						<Loader2 size={14} className="animate-spin" />
					) : (
						<Play size={14} />
					)}
					Sync Now
				</button>
			</div>

			{output && (
				<div className="rounded-md border border-border bg-bg p-4">
					<div className="flex items-center gap-2 text-text-dim text-xs mb-2">
						<Terminal size={12} />
						Output
					</div>
					<pre className="text-xs text-text-muted whitespace-pre-wrap break-all leading-relaxed">
						{output}
					</pre>
				</div>
			)}
		</div>
	);
}
