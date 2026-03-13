"use client";

import { Check, Copy } from "lucide-react";
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

/**
 * Pure client-side config generator. Fill in the form and copy the JSON
 * to use as your `mirror.config.json`.
 */
export function ConfigForm() {
	const [config, setConfig] = useState<Config>(defaultConfig);
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		const json = JSON.stringify(config, null, 2);
		await navigator.clipboard.writeText(json);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const updateField = <K extends keyof Config>(key: K, value: Config[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<div className="rounded-lg border border-border bg-card p-6 space-y-5">
			<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
				Config Generator
			</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Field
					label="Work Org"
					value={config.workOrg}
					onChange={(v) => updateField("workOrg", v)}
					placeholder="your-org"
				/>
				<Field
					label="Work GitHub User"
					value={config.workGhUser}
					onChange={(v) => updateField("workGhUser", v)}
					placeholder="your-work-username"
				/>
				<Field
					label="Personal Account"
					value={config.personalAccount}
					onChange={(v) => updateField("personalAccount", v)}
					placeholder="your-personal-username"
				/>
				<Field
					label="Mirror Repo Name"
					value={config.mirrorRepoName}
					onChange={(v) => updateField("mirrorRepoName", v)}
					placeholder="work-mirror"
				/>
				<Field
					label="Personal Email"
					value={config.personalEmail}
					onChange={(v) => updateField("personalEmail", v)}
					placeholder="you@gmail.com"
				/>
			</div>

			<label className="block">
				<span className="block text-xs text-text-muted mb-1.5">
					Work Emails (comma-separated)
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
			</label>

			<label className="block">
				<span className="block text-xs text-text-muted mb-1.5">
					Excluded Repos (one per line)
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
					placeholder="org/repo-to-skip"
					rows={3}
					className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-border-focus focus:outline-none transition-colors resize-none"
				/>
			</label>

			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg hover:bg-primary/90 transition-colors cursor-pointer"
				>
					{copied ? <Check size={14} /> : <Copy size={14} />}
					{copied ? "Copied!" : "Copy JSON"}
				</button>
			</div>

			<pre className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted overflow-x-auto">
				{JSON.stringify(config, null, 2)}
			</pre>
		</div>
	);
}

function Field({
	label,
	value,
	onChange,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder: string;
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
		</label>
	);
}
