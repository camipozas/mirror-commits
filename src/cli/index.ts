#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import {
	init,
	promptForOptions,
	checkGhAccounts,
	runGhLogin,
} from "@/src/core/init";
import { sync } from "@/src/core/sync";
import { loadConfig } from "@/src/core/config";
import { loadState } from "@/src/core/state";
import {
	installSchedule,
	removeSchedule,
	scheduleStatus,
} from "@/src/core/launchd";

const program = new Command();

program
	.name("mirror")
	.description("Mirror work GitHub contributions to personal profile")
	.version("1.0.0");

program
	.command("init")
	.description(
		"One-time setup: verify gh auth, create mirror repo, run first sync",
	)
	.option("--work-org <org>", "Work GitHub org")
	.option("--work-emails <emails>", "Comma-separated work emails")
	.option("--work-user <user>", "Work gh username")
	.option("--personal <account>", "Personal gh username")
	.option("--repo-name <name>", "Mirror repo name", "work-mirror")
	.option("--personal-email <email>", "Personal email for commit author")
	.option("--no-sync", "Skip automatic first sync")
	.action(async (opts) => {
		try {
			const isInteractive =
				!opts.workOrg && !opts.workEmails && !opts.workUser && !opts.personal;

			let options: {
				workOrg: string;
				workEmails: string[];
				workGhUser: string;
				personalAccount: string;
				mirrorRepoName: string;
				personalEmail: string;
			};

			if (isInteractive) {
				// Interactive mode: prompt for everything
				options = await promptForOptions();

				// Check gh accounts
				console.log(chalk.blue("\nChecking gh auth..."));
				const accounts = await checkGhAccounts();

				if (accounts.has(options.workGhUser)) {
					console.log(
						chalk.green(`  ✓ Work account (${options.workGhUser}) found`),
					);
				} else {
					console.log(
						chalk.yellow(`  ✗ Work account (${options.workGhUser}) not found`),
					);
					console.log(chalk.blue("  → Opening browser to add work account..."));
					await runGhLogin();
				}

				if (accounts.has(options.personalAccount)) {
					console.log(
						chalk.green(
							`  ✓ Personal account (${options.personalAccount}) found`,
						),
					);
				} else {
					console.log(
						chalk.yellow(
							`  ✗ Personal account (${options.personalAccount}) not found`,
						),
					);
					console.log(
						chalk.blue("  → Opening browser to add personal account..."),
					);
					await runGhLogin();
				}
			} else {
				// Non-interactive mode: use flags
				options = {
					workOrg: opts.workOrg ?? "",
					workEmails: (opts.workEmails ?? "")
						.split(",")
						.map((e: string) => e.trim()),
					workGhUser: opts.workUser ?? "",
					personalAccount: opts.personal ?? "",
					mirrorRepoName: opts.repoName,
					personalEmail: opts.personalEmail ?? "",
				};
			}

			await init(options, opts.sync !== false);
		} catch (err) {
			console.error(chalk.red(`Init failed: ${err}`));
			process.exit(1);
		}
	});

program
	.command("sync")
	.description("Sync work commits to mirror repo")
	.option("--full", "Full re-sync (ignore last cursor)", false)
	.option("--dry-run", "Preview commits without creating them", false)
	.option("--since <date>", "Sync commits after this date (ISO)")
	.option("--config <path>", "Config file path")
	.action(async (opts) => {
		try {
			const result = await sync({
				full: opts.full,
				dryRun: opts.dryRun,
				since: opts.since,
				configPath: opts.config,
			});
			if (result.dryRun) {
				console.log(
					chalk.yellow(
						`Dry run: ${result.commitsFound} commits would be mirrored.`,
					),
				);
			}
		} catch (err) {
			console.error(chalk.red(`Sync failed: ${err}`));
			process.exit(1);
		}
	});

program
	.command("status")
	.description("Show mirror status")
	.action(async () => {
		try {
			const state = await loadState();
			console.log(chalk.bold("Mirror Status"));
			console.log(`  Last synced: ${state.lastSyncedAt ?? "never"}`);
			console.log(`  Total mirrored: ${state.totalCommitsMirrored}`);
			console.log(`  Mirror repo: ${state.mirrorRepoPath || "not set"}`);

			try {
				const config = await loadConfig();
				console.log(chalk.bold("\nConfig"));
				console.log(`  Work org: ${config.workOrg}`);
				console.log(`  Work user: ${config.workGhUser}`);
				console.log(`  Personal: ${config.personalAccount}`);
				console.log(`  Mirror repo: ${config.mirrorRepoName}`);
				console.log(`  Excluded: ${config.excludeRepos?.join(", ") || "none"}`);
			} catch {
				console.log(
					chalk.yellow("\nNo config found. Run `mirror init` first."),
				);
			}
		} catch (err) {
			console.error(chalk.red(`Status failed: ${err}`));
			process.exit(1);
		}
	});

const schedule = program
	.command("schedule")
	.description("Manage daily sync schedule (macOS launchd)");

schedule
	.command("install")
	.description("Install daily sync")
	.option("--hour <hour>", "Hour to run (0-23)", "22")
	.action(async (opts) => {
		try {
			const projectDir = resolve(import.meta.dirname, "../..");
			const result = await installSchedule(
				Number.parseInt(opts.hour, 10),
				projectDir,
			);
			console.log(chalk.green(result));
		} catch (err) {
			console.error(chalk.red(`Install failed: ${err}`));
			process.exit(1);
		}
	});

schedule
	.command("remove")
	.description("Remove daily sync")
	.action(async () => {
		try {
			const result = await removeSchedule();
			console.log(chalk.green(result));
		} catch (err) {
			console.error(chalk.red(`Remove failed: ${err}`));
			process.exit(1);
		}
	});

schedule
	.command("status")
	.description("Show schedule status")
	.action(async () => {
		try {
			const result = await scheduleStatus();
			console.log(result);
		} catch (err) {
			console.error(chalk.red(`Status failed: ${err}`));
			process.exit(1);
		}
	});

program.parse();
