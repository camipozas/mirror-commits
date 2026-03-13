import {
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
					Your work commits don't show on your personal GitHub profile. This
					tool reads the <strong>timestamps</strong> of your work commits via
					the GitHub API and creates matching empty commits on a personal repo —
					no code is ever copied.
				</p>

				<div className="grid grid-cols-3 gap-3">
					{[
						{ icon: Shield, label: "No code cloned" },
						{ icon: Cloud, label: "No tokens stored" },
						{ icon: Clock, label: "Daily auto-sync" },
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
				<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
					How it works
				</h2>
				<div className="space-y-2 text-sm text-text-muted">
					<p>1. Searches your work org for commits matching your email</p>
					<p>
						2. Creates empty commits with the same timestamps on a private
						mirror repo
					</p>
					<p>
						3. Pushes to your personal GitHub — contribution graph lights up
					</p>
					<p>4. Optional daily auto-sync keeps it up to date</p>
				</div>
			</section>

			{/* MCP Server */}
			<section className="space-y-4">
				<div className="flex items-center gap-2">
					<Cloud size={16} className="text-primary" />
					<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
						MCP Server (remote)
					</h2>
				</div>
				<p className="text-xs text-text-dim leading-relaxed">
					Hosted on Vercel — no local install needed. Configure your MCP client
					with GitHub PATs in headers. Works with Claude Code, Cursor, or any
					MCP client.
				</p>
				<ConfigForm />
			</section>

			{/* CLI */}
			<section className="rounded-lg border border-border bg-card p-6 space-y-5">
				<div className="flex items-center gap-2">
					<Terminal size={16} className="text-primary" />
					<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
						CLI (local)
					</h2>
				</div>

				<p className="text-xs text-text-dim leading-relaxed">
					Run everything locally via the CLI. Uses the{" "}
					<code className="text-primary/70">gh</code> CLI and{" "}
					<code className="text-primary/70">git</code> — no MCP config needed.
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
						{`pnpm mirror sync            # incremental sync
pnpm mirror sync --full     # full re-sync
pnpm mirror sync --dry-run  # preview without pushing
pnpm mirror status          # show sync stats`}
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
