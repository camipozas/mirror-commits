"use client";

import { useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { listRepos } from "@/app/actions";

/**
 * Lets the user search for repos in their work org and add them
 * to the exclude list. Returns selected repos via `onExclude` callback.
 */
export function RepoSelector({
	org,
	excluded,
	onExclude,
}: {
	org: string;
	excluded: string[];
	onExclude: (repos: string[]) => void;
}) {
	const [repos, setRepos] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [filter, setFilter] = useState("");

	const handleLoad = async () => {
		if (!org) return;
		setLoading(true);
		const result = await listRepos(org);
		if (result.success && result.data) {
			setRepos(result.data as string[]);
		}
		setLoaded(true);
		setLoading(false);
	};

	const toggleExclude = (repo: string) => {
		if (excluded.includes(repo)) {
			onExclude(excluded.filter((r) => r !== repo));
		} else {
			onExclude([...excluded, repo]);
		}
	};

	const filtered = repos.filter((r) =>
		r.toLowerCase().includes(filter.toLowerCase()),
	);

	return (
		<div className="rounded-lg border border-border bg-card p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
					Repo Explorer
				</h2>
				<button
					type="button"
					onClick={handleLoad}
					disabled={loading || !org}
					className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-text hover:bg-card-hover disabled:opacity-50 transition-colors cursor-pointer"
				>
					{loading ? (
						<Loader2 size={12} className="animate-spin" />
					) : (
						<Search size={12} />
					)}
					{loaded ? "Refresh" : "Load Repos"}
				</button>
			</div>

			{loaded && (
				<>
					<input
						type="text"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						placeholder="Filter repos..."
						className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-border-focus focus:outline-none transition-colors"
					/>

					<div className="max-h-64 overflow-y-auto space-y-1">
						{filtered.map((repo) => {
							const isExcluded = excluded.includes(repo);
							return (
								<button
									key={repo}
									type="button"
									onClick={() => toggleExclude(repo)}
									className={`w-full text-left rounded-md px-3 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${
										isExcluded
											? "bg-danger/10 text-danger border border-danger/20"
											: "bg-bg text-text-muted hover:bg-card-hover border border-transparent"
									}`}
								>
									<span className="truncate">{repo}</span>
									{isExcluded && <X size={12} />}
								</button>
							);
						})}
						{filtered.length === 0 && (
							<p className="text-xs text-text-dim py-2 text-center">
								{filter ? "No repos match filter" : "No repos found"}
							</p>
						)}
					</div>

					{excluded.length > 0 && (
						<p className="text-xs text-text-dim">
							{excluded.length} repo{excluded.length !== 1 ? "s" : ""} excluded
						</p>
					)}
				</>
			)}
		</div>
	);
}
