"use client";

import { Check, Copy, ExternalLink, Key } from "lucide-react";
import { useState } from "react";

interface Config {
	workEmails: string[];
	workOrg: string;
	workGhUser: string;
	personalAccount: string;
	mirrorRepoName: string;
	personalEmail: string;
	excludeRepos: string[];
}

const defaultConfig: Config = {
	workEmails: [""],
	workOrg: "",
	workGhUser: "",
	personalAccount: "",
	mirrorRepoName: "work-mirror",
	personalEmail: "",
	excludeRepos: [],
};

function buildOutput(config: Config): string {
	const xConfig = {
		workEmails: config.workEmails.filter(Boolean),
		workOrg: config.workOrg,
		workGhUser: config.workGhUser,
		personalAccount: config.personalAccount,
		mirrorRepoName: config.mirrorRepoName,
		personalEmail: config.personalEmail,
		...(config.excludeRepos.length > 0
			? { excludeRepos: config.excludeRepos }
			: {}),
	};

	return JSON.stringify(
		{
			"mirror-commits": {
				type: "http",
				url: "https://mirror-commits.vercel.app/api/mcp",
				headers: {
					"X-GitHub-Work-Token": "ghp_your_work_token",
					"X-GitHub-Personal-Token": "ghp_your_personal_token",
					"X-Config": JSON.stringify(xConfig),
				},
			},
		},
		null,
		2,
	);
}

export function ConfigForm() {
	const [config, setConfig] = useState<Config>(defaultConfig);
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(buildOutput(config));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const updateField = <K extends keyof Config>(key: K, value: Config[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<div className="rounded-lg border border-border bg-card p-6 space-y-5">
			<h2 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
				Generate your config
			</h2>

			<p className="text-xs text-text-dim leading-relaxed">
				Fill in your details, hit copy, and paste the result into your MCP
				client config (e.g.{" "}
				<code className="text-primary/70">~/.claude.json</code> under{" "}
				<code className="text-primary/70">mcpServers</code>). No{" "}
				<code className="text-primary/70">gh</code> CLI needed — everything runs
				through the GitHub API using your tokens.
			</p>

			{/* Token guidance */}
			<div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3">
				<div className="flex items-center gap-2">
					<Key size={14} className="text-primary" />
					<span className="text-xs font-semibold text-text">
						First, create two GitHub tokens
					</span>
				</div>
				<p className="text-xs text-text-dim">
					You need one token per GitHub account so the tool can read your work
					commits and push to your personal mirror repo.
				</p>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-text-dim">
					<div className="space-y-1">
						<p className="font-medium text-text">Work account token</p>
						<p>
							Scope: <code className="text-primary/70">repo</code> — lets the
							tool read your org's commit history
						</p>
					</div>
					<div className="space-y-1">
						<p className="font-medium text-text">Personal account token</p>
						<p>
							Scope: <code className="text-primary/70">repo</code> — lets the
							tool create and push to the mirror repo
						</p>
					</div>
				</div>
				<a
					href="https://github.com/settings/tokens/new"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
				>
					Create a token on GitHub
					<ExternalLink size={12} />
				</a>
			</div>

			<p className="text-xs font-medium text-text-muted uppercase tracking-wide">
				Your accounts
			</p>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Field
					label="Work GitHub org"
					value={config.workOrg}
					onChange={(v) => updateField("workOrg", v)}
					placeholder="your-org"
					hint="The org where your work repos live"
				/>
				<Field
					label="Work GitHub username"
					value={config.workGhUser}
					onChange={(v) => updateField("workGhUser", v)}
					placeholder="your-work-username"
					hint="Your username in the work org"
				/>
				<Field
					label="Personal GitHub username"
					value={config.personalAccount}
					onChange={(v) => updateField("personalAccount", v)}
					placeholder="your-personal-username"
					hint="Where the mirror repo will be created"
				/>
				<Field
					label="Mirror repo name"
					value={config.mirrorRepoName}
					onChange={(v) => updateField("mirrorRepoName", v)}
					placeholder="work-mirror"
					hint="A private repo will be created with this name"
				/>
				<div>
					<Field
						label="Personal email"
						value={config.personalEmail}
						onChange={(v) => updateField("personalEmail", v)}
						placeholder="you@gmail.com"
						hint="Must be verified on GitHub for contributions to count"
					/>
				</div>
			</div>

			<label className="block">
				<span className="block text-xs text-text-muted mb-1.5">
					Work email(s)
				</span>
				<input
					type="text"
					value={config.workEmails.join(", ")}
					onChange={(e) =>
						updateField(
							"workEmails",
							e.target.value
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean),
						)
					}
					placeholder="you@company.com"
					className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-border-focus focus:outline-none transition-colors"
				/>
				<p className="text-[11px] text-text-dim mt-1">
					The email(s) you use for work commits — separate multiple with commas
				</p>
			</label>

			<label className="block">
				<span className="block text-xs text-text-muted mb-1.5">
					Repos to skip (optional)
				</span>
				<textarea
					value={config.excludeRepos.join("\n")}
					onChange={(e) =>
						updateField(
							"excludeRepos",
							e.target.value
								.split("\n")
								.map((s) => s.trim())
								.filter(Boolean),
						)
					}
					placeholder="your-org/repo-to-skip"
					rows={2}
					className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-border-focus focus:outline-none transition-colors resize-none"
				/>
				<p className="text-[11px] text-text-dim mt-1">
					One per line, in <code className="text-primary/70">org/repo</code>{" "}
					format — e.g.{" "}
					<code className="text-primary/70">MyOrg/internal-tools</code>
				</p>
			</label>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-bg hover:bg-primary/90 transition-colors cursor-pointer"
				>
					{copied ? <Check size={14} /> : <Copy size={14} />}
					{copied ? "Copied!" : "Copy Config"}
				</button>
				<span className="text-xs text-text-dim">
					Replace <code className="text-primary/70">ghp_your_*</code>{" "}
					placeholders with your real tokens
				</span>
			</div>

			<pre className="rounded-md border border-border bg-bg p-3 text-[11px] text-text-muted overflow-x-auto">
				{buildOutput(config)}
			</pre>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	placeholder,
	hint,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
	hint?: string;
}) {
	return (
		<label className="block">
			<span className="block text-xs text-text-muted mb-1.5">{label}</span>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-border-focus focus:outline-none transition-colors"
			/>
			{hint && <p className="text-[11px] text-text-dim mt-1">{hint}</p>}
		</label>
	);
}
