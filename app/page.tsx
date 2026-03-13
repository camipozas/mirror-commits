import { GitBranch } from "lucide-react";
import { StatusCard } from "@/components/status-card";
import { ConfigForm } from "@/components/config-form";
import { SyncPanel } from "@/components/sync-panel";
import { CliReference } from "@/components/cli-reference";

export default function Home() {
	return (
		<main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
			<header className="space-y-2">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
						<GitBranch size={18} className="text-primary" />
					</div>
					<h1 className="text-lg font-bold tracking-tight">mirror-commits</h1>
				</div>
				<p className="text-sm text-text-muted">
					Mirror work GitHub contributions to your personal profile. No tokens
					stored, no code downloaded — just timestamps via API.
				</p>
			</header>

			<StatusCard />
			<SyncPanel />
			<ConfigForm />
			<CliReference />

			<footer className="text-center text-xs text-text-dim py-4 border-t border-border">
				localhost only — this UI never leaves your machine
			</footer>
		</main>
	);
}
