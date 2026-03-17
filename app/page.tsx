import {
	AlertCircle,
	Clock,
	Cloud,
	GitBranch,
	Github,
	Shield,
	Terminal,
} from "lucide-react";
import { ConfigForm } from "@/components/config-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
	return (
		<main className="max-w-2xl mx-auto px-4 py-12 space-y-12">
			<header className="space-y-5">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
						<GitBranch size={20} className="text-primary" />
					</div>
					<div className="flex-1">
						<h1 className="text-xl font-bold tracking-tight">mirror-commits</h1>
						<p className="text-xs text-text-dim">
							by{" "}
							<a
								href="https://github.com/camipozas"
								className="text-primary/70 hover:text-primary transition-colors"
							>
								camipozas
							</a>
						</p>
					</div>
					<ThemeToggle />
				</div>

				<p className="text-sm text-text-muted leading-relaxed">
					If you code at work using an org account, those contributions are
					invisible on your personal profile. This tool mirrors{" "}
					<strong>only the timestamps</strong> of your work commits to a private
					repo on your personal account — your contribution graph lights up, and
					no source code is ever copied.
				</p>

				<div className="grid grid-cols-3 gap-3">
					{[
						{ icon: Shield, label: "No code copied" },
						{ icon: Cloud, label: "No tokens stored" },
						{ icon: Clock, label: "Set it & forget it" },
					].map((f) => (
						<div
							key={f.label}
							className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-text-muted"
						>
							<f.icon size={14} className="text-primary shrink-0" />
							{f.label}
						</div>
					))}
				</div>
			</header>

			{/* How it works */}
			<section className="rounded-lg border border-border bg-card p-6 space-y-4">
				<h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
					How it works
				</h2>
				<div className="space-y-2 text-xs text-text-muted">
					<div className="flex gap-2.5 items-start">
						<span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold mt-0.5">
							1
						</span>
						<p>
							<strong className="text-text">Reads</strong> your work org's
							commit history — only timestamps, never code
						</p>
					</div>
					<div className="flex gap-2.5 items-start">
						<span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold mt-0.5">
							2
						</span>
						<p>
							<strong className="text-text">Creates</strong> empty commits with
							those timestamps on a private mirror repo
						</p>
					</div>
					<div className="flex gap-2.5 items-start">
						<span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold mt-0.5">
							3
						</span>
						<p>
							<strong className="text-text">Pushes</strong> to your personal
							GitHub — contribution graph lights up
						</p>
					</div>
					<div className="flex gap-2.5 items-start">
						<span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold mt-0.5">
							4
						</span>
						<p>
							<strong className="text-text">Auto-syncs</strong> daily so you
							never think about it again
						</p>
					</div>
				</div>
			</section>

			{/* Prerequisites */}
			<div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-2">
				<div className="flex items-center gap-2">
					<AlertCircle size={14} className="text-primary" />
					<span className="text-xs font-semibold text-text">Prerequisites</span>
				</div>
				<ul className="text-xs text-text-dim space-y-1 list-disc list-inside">
					<li>
						Two GitHub accounts (work org + personal)
					</li>
					<li>Personal email verified on your GitHub account</li>
					<li>
						<strong>MCP option:</strong> just two GitHub PATs (no local install)
					</li>
					<li>
						<strong>CLI option:</strong>{" "}
						<code className="text-primary/70">gh</code> CLI installed + both
						accounts authenticated
					</li>
				</ul>
			</div>

			{/* Getting started */}
			<section className="space-y-2">
				<h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
					Get started
				</h2>
				<p className="text-xs text-text-dim leading-relaxed">
					Pick whichever option fits your workflow. The MCP server handles
					everything remotely — no local install needed. Or use the CLI for full
					local control.
				</p>
			</section>

			{/* MCP Server */}
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<Cloud size={16} className="text-primary" />
					<h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
						Option A: MCP Server (zero install)
					</h2>
				</div>
				<p className="text-xs text-text-dim leading-relaxed">
					Use the hosted MCP server from Claude Code, Cursor, or any
					MCP-compatible AI tool. Add the URL to your config and you're done —
					no gh CLI, no local clone, no tokens in your config file.
				</p>

				<p className="text-xs text-text-dim">
					Your AI assistant will have these tools available:
				</p>
				<div className="rounded-lg border border-border bg-bg overflow-hidden">
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b border-border">
								<th className="text-left px-3 py-2 text-text-muted font-semibold">
									Tool
								</th>
								<th className="text-left px-3 py-2 text-text-muted font-semibold">
									What it does
								</th>
							</tr>
						</thead>
						<tbody className="text-text-dim">
							{[
								[
									"mirror_init",
									"One-time setup: create mirror repo and run initial sync",
								],
								[
									"mirror_sync",
									"Sync your commits (supports --since, --full, --dry-run)",
								],
								["mirror_status", "Check how many commits have been mirrored"],
								[
									"mirror_list_repos",
									"See all repos in your org (handy for choosing what to exclude)",
								],
								["mirror_config", "View or update your configuration"],
							].map(([tool, desc]) => (
								<tr key={tool} className="border-b border-border last:border-0">
									<td className="px-3 py-1.5">
										<code className="text-primary/70">{tool}</code>
									</td>
									<td className="px-3 py-1.5">{desc}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<ConfigForm />
			</section>

			{/* CLI */}
			<section className="rounded-lg border border-border bg-card p-6 space-y-5">
				<div className="flex items-center gap-2">
					<Terminal size={16} className="text-primary" />
					<h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
						Option B: CLI (full local workflow)
					</h2>
				</div>

				<p className="text-xs text-text-dim leading-relaxed">
					Prefer to run things yourself? Clone the repo and use the CLI
					directly. Three commands and you're done.
				</p>

				<div className="space-y-3">
					{[
						{
							step: "1",
							title: "Clone & install",
							cmd: "git clone https://github.com/camipozas/mirror-commits\ncd mirror-commits && pnpm install",
						},
						{
							step: "2",
							title: "Run interactive setup",
							cmd: "pnpm mirror init",
							desc: "Prompts for your accounts, checks auth, creates the mirror repo, and runs the first full sync.",
						},
						{
							step: "3",
							title: "Schedule daily auto-sync (optional)",
							cmd: "pnpm mirror schedule install",
							desc: "Installs a macOS launchd job. Default 10 PM.",
						},
					].map((s) => (
						<div key={s.step} className="flex gap-3 items-start">
							<span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold mt-0.5">
								{s.step}
							</span>
							<div className="flex-1 min-w-0 space-y-0.5">
								<p className="text-xs font-medium text-text">{s.title}</p>
								{s.desc && <p className="text-xs text-text-dim">{s.desc}</p>}
								<pre className="text-[11px] text-primary/70 bg-bg rounded px-2 py-1 mt-1 overflow-x-auto whitespace-pre">
									{s.cmd}
								</pre>
							</div>
						</div>
					))}
				</div>

				<div className="border-t border-border pt-4 space-y-2">
					<p className="text-xs font-medium text-text">Command reference</p>
					<pre className="text-[11px] text-primary/70 bg-bg rounded px-3 py-2 overflow-x-auto whitespace-pre">
						{`pnpm mirror sync                        # incremental sync
pnpm mirror sync --full                 # full re-sync
pnpm mirror sync --dry-run              # preview without pushing
pnpm mirror sync --since 2025-01-01    	# sync from specific date
pnpm mirror status                      # show sync stats`}
					</pre>
				</div>
			</section>

			<footer className="text-center text-xs text-text-dim pt-6 border-t border-border space-y-2">
				<p>
					<a
						href="https://github.com/camipozas/mirror-commits"
						className="inline-flex items-center gap-1.5 text-primary/70 hover:text-primary transition-colors"
					>
						<Github size={14} />
						View on GitHub
					</a>
				</p>
				<p>
					Made by{" "}
					<a
						href="https://github.com/camipozas"
						className="text-primary/70 hover:text-primary transition-colors"
					>
						camipozas
					</a>
				</p>
			</footer>
		</main>
	);
}
