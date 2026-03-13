"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Terminal, Bot, Globe } from "lucide-react";

interface Command {
	cmd: string;
	desc: string;
}

const cliCommands: Command[] = [
	{
		cmd: "pnpm mirror init",
		desc: "One-time setup: verify gh auth, create mirror repo",
	},
	{ cmd: "pnpm mirror sync", desc: "Incremental sync (only new commits)" },
	{ cmd: "pnpm mirror sync --full", desc: "Full re-sync from scratch" },
	{ cmd: "pnpm mirror sync --dry-run", desc: "Preview what would be mirrored" },
	{
		cmd: "pnpm mirror sync --since 2025-01-01",
		desc: "Sync commits after a specific date",
	},
	{
		cmd: "pnpm mirror status",
		desc: "Show last sync time, total commits, config",
	},
	{
		cmd: "pnpm mirror schedule install",
		desc: "Install daily launchd job (22:00)",
	},
	{
		cmd: "pnpm mirror schedule install --hour 8",
		desc: "Install at custom hour",
	},
	{ cmd: "pnpm mirror schedule remove", desc: "Remove the launchd schedule" },
	{ cmd: "pnpm mirror schedule status", desc: "Check if schedule is active" },
];

const mcpTools: Command[] = [
	{ cmd: "mirror_init", desc: "Setup both gh accounts and create mirror repo" },
	{
		cmd: "mirror_sync",
		desc: "Sync commits (supports full, dryRun, since params)",
	},
	{ cmd: "mirror_status", desc: "View sync state and config" },
	{
		cmd: "mirror_schedule",
		desc: "Manage launchd cron (install/remove/status)",
	},
	{ cmd: "mirror_list_repos", desc: "List all repos in the work org" },
	{ cmd: "mirror_config", desc: "View or update config (e.g. excludeRepos)" },
	{ cmd: "mirror_log", desc: "Tail the sync log file" },
];

const setupSteps = [
	{
		step: "1",
		text: "Add personal GitHub account to gh CLI",
		cmd: "gh auth login --hostname github.com --web",
	},
	{
		step: "2",
		text: "Configure HTTPS credential helper",
		cmd: "gh auth setup-git",
	},
	{
		step: "3",
		text: "Switch back to work account",
		cmd: "gh auth switch --user CPozas_euronet",
	},
	{
		step: "4",
		text: "Run init to create mirror repo",
		cmd: "pnpm mirror init",
	},
	{
		step: "5",
		text: "Do a dry run to preview",
		cmd: "pnpm mirror sync --dry-run",
	},
	{ step: "6", text: "Sync for real", cmd: "pnpm mirror sync" },
];

/**
 * Reference section showing all CLI commands, MCP tools, and setup steps.
 */
export function CliReference() {
	return (
		<div className="space-y-4">
			<Section icon={Terminal} title="Getting Started" defaultOpen>
				<div className="space-y-2">
					{setupSteps.map((s) => (
						<div key={s.step} className="flex gap-3 items-start">
							<span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
								{s.step}
							</span>
							<div className="flex-1 min-w-0">
								<p className="text-xs text-text-muted">{s.text}</p>
								<code className="text-xs text-primary/80 block mt-0.5 truncate">
									{s.cmd}
								</code>
							</div>
						</div>
					))}
				</div>
			</Section>

			<Section icon={Terminal} title="CLI Commands">
				<CommandTable commands={cliCommands} />
			</Section>

			<Section icon={Bot} title="MCP Tools (Claude Code)">
				<CommandTable commands={mcpTools} />
			</Section>
		</div>
	);
}

function Section({
	icon: Icon,
	title,
	defaultOpen = false,
	children,
}: {
	icon: React.ComponentType<{ size: number }>;
	title: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="rounded-lg border border-border bg-card overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="w-full flex items-center gap-2 p-4 text-sm font-semibold text-text-muted uppercase tracking-wide hover:bg-card-hover transition-colors cursor-pointer"
			>
				{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
				<Icon size={14} />
				{title}
			</button>
			{open && <div className="px-4 pb-4">{children}</div>}
		</div>
	);
}

function CommandTable({ commands }: { commands: Command[] }) {
	return (
		<div className="space-y-1">
			{commands.map((c) => (
				<div
					key={c.cmd}
					className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 rounded-md px-3 py-2 bg-bg text-xs"
				>
					<code className="text-primary/80 font-medium shrink-0">{c.cmd}</code>
					<span className="text-text-dim">{c.desc}</span>
				</div>
			))}
		</div>
	);
}
