import type { StateStore } from "@/src/core/state";
import type { GitHubClient } from "@/src/lib/github-api";
import type { State } from "@/src/lib/schema";

/**
 * {@link StateStore} backed by a `.mirror-state.json` file in the
 * mirror repository on GitHub.
 *
 * @description Reads and writes state via the GitHub Contents API so
 * the Vercel function remains fully stateless — the repo itself is the
 * single source of truth.
 */
export class RemoteStateStore implements StateStore {
	private readonly client: GitHubClient;
	private readonly repoFullName: string;
	private fileSha: string | undefined;

	constructor(personalClient: GitHubClient, repoFullName: string) {
		this.client = personalClient;
		this.repoFullName = repoFullName;
	}

	async load(): Promise<State> {
		try {
			const res = await this.client.fetch<{
				content: string;
				sha: string;
			}>(`/repos/${this.repoFullName}/contents/.mirror-state.json`);

			this.fileSha = res.sha;
			const content = Buffer.from(res.content, "base64").toString("utf-8");
			const parsed = JSON.parse(content) as {
				lastSyncedAt?: string | null;
				totalCommitsMirrored?: number;
			};

			return {
				mirrorRepoPath: this.repoFullName,
				lastSyncedAt: parsed.lastSyncedAt ?? null,
				totalCommitsMirrored: parsed.totalCommitsMirrored ?? 0,
			};
		} catch {
			// File doesn't exist yet — fresh state
			return {
				mirrorRepoPath: this.repoFullName,
				lastSyncedAt: null,
				totalCommitsMirrored: 0,
			};
		}
	}

	async save(state: State): Promise<void> {
		const payload = {
			lastSyncedAt: state.lastSyncedAt,
			totalCommitsMirrored: state.totalCommitsMirrored,
		};
		const encoded = Buffer.from(JSON.stringify(payload, null, 2)).toString(
			"base64",
		);

		// Fetch current SHA if we don't have it yet
		if (!this.fileSha) {
			try {
				const existing = await this.client.fetch<{ sha: string }>(
					`/repos/${this.repoFullName}/contents/.mirror-state.json`,
				);
				this.fileSha = existing.sha;
			} catch {
				// File doesn't exist — will be created
			}
		}

		const res = await this.client.fetch<{ content: { sha: string } }>(
			`/repos/${this.repoFullName}/contents/.mirror-state.json`,
			{
				method: "PUT",
				body: {
					message: "chore: update mirror state",
					content: encoded,
					...(this.fileSha ? { sha: this.fileSha } : {}),
				},
			},
		);

		this.fileSha = res.content.sha;
	}
}
