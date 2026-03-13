"use client";

import { useEffect, useState } from "react";
import {
	Save,
	Loader2,
	AlertCircle,
	CheckCircle2,
	Copy,
	Check,
} from "lucide-react";
import { getConfig, saveConfig } from "@/app/actions";

interface Config {
	workEmails: string[];
	workOrg: string;
	workGhUser: string;
	personalAccount: string;
	mirrorRepoName: string;
	excludeRepos: string[];
}

const defaultConfig: Config = {
	workEmails: [""],
	workOrg: "",
	workGhUser: "",
	personalAccount: "",
	mirrorRepoName: "work-mirror",
	excludeRepos: [],
};

/**
 * Multi-field form to edit the mirror config. Loads existing config on mount
 * when running locally. On Vercel, works as a config generator with copy-to-clipboard.
 */
export function ConfigForm() {
	const [config, setConfig] = useState<Config>(defaultConfig);
	const [status, setStatus] = useState<{
		type: "idle" | "saving" | "success" | "error";
		message?: string;
	}>({ type: "idle" });
	const [loaded, setLoaded] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		async function load() {
			const result = await getConfig();
			if (result.success && result.data) {
				setConfig(result.data as Config);
			}
			setLoaded(true);
		}
		load();
	}, []);

	const handleSave = async () => {
		setStatus({ type: "saving" });
		const result = await saveConfig(config);
		setStatus({
			type: result.success ? "success" : "error",
			message: result.message,
		});
		if (result.success) {
			setTimeout(() => setStatus({ type: "idle" }), 3000);
		}
	};

	const handleCopy = async () => {
		const json = JSON.stringify(config, null, 2);
		await navigator.clipboard.writeText(json);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const updateField = <K extends keyof Config>(key: K, value: Config[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }));
	};

	if (!loaded) {
		return (
			<div className="rounded-lg border border-border bg-card p-6 animate-pulse">
				<div className="h-4 bg-border rounded w-1/4 mb-6" />
				<div className="space-y-4">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="h-10 bg-border rounded" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-card p-6 space-y-5">
			<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
				Configuration
			</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Field
					label="Work Org"
					value={config.workOrg}
					onChange={(v) => updateField("workOrg", v)}
					placeholder="Euronet-RiaDigital-Product"
				/>
				<Field
					label="Work GitHub User"
					value={config.workGhUser}
					onChange={(v) => updateField("workGhUser", v)}
					placeholder="CPozas_euronet"
				/>
				<Field
					label="Personal Account"
					value={config.personalAccount}
					onChange={(v) => updateField("personalAccount", v)}
					placeholder="camipozas"
				/>
				<Field
					label="Mirror Repo Name"
					value={config.mirrorRepoName}
					onChange={(v) => updateField("mirrorRepoName", v)}
					placeholder="work-mirror"
				/>
			</div>

			<div>
				<label className="block text-xs text-text-muted mb-1.5">
					Work Emails (comma-separated)
				</label>
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
			</div>

			<div>
				<label className="block text-xs text-text-muted mb-1.5">
					Excluded Repos (one per line)
				</label>
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
			</div>

			<div className="flex items-center gap-3 flex-wrap">
				<button
					type="button"
					onClick={handleSave}
					disabled={status.type === "saving"}
					className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-bg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
				>
					{status.type === "saving" ? (
						<Loader2 size={14} className="animate-spin" />
					) : (
						<Save size={14} />
					)}
					Save Config
				</button>

				<button
					type="button"
					onClick={handleCopy}
					className="flex items-center gap-2 rounded-md border border-border bg-bg px-4 py-2 text-sm text-text hover:bg-card-hover transition-colors cursor-pointer"
				>
					{copied ? (
						<Check size={14} className="text-primary" />
					) : (
						<Copy size={14} />
					)}
					{copied ? "Copied!" : "Copy JSON"}
				</button>

				{status.type === "success" && (
					<span className="flex items-center gap-1.5 text-xs text-primary">
						<CheckCircle2 size={14} />
						{status.message}
					</span>
				)}
				{status.type === "error" && (
					<span className="flex items-center gap-1.5 text-xs text-warning">
						<AlertCircle size={14} />
						{status.message}
					</span>
				)}
			</div>

			<details className="text-xs">
				<summary className="text-text-dim cursor-pointer hover:text-text-muted transition-colors">
					Preview JSON
				</summary>
				<pre className="mt-2 rounded-md border border-border bg-bg p-3 text-text-muted overflow-x-auto">
					{JSON.stringify(config, null, 2)}
				</pre>
			</details>
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
		<div>
			<label className="block text-xs text-text-muted mb-1.5">{label}</label>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-border-focus focus:outline-none transition-colors"
			/>
		</div>
	);
}
