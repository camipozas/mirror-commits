#!/usr/bin/env node
import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { init } from "@/src/core/init";
import { sync } from "@/src/core/sync";
import { loadConfig } from "@/src/core/config";
import { loadState } from "@/src/core/state";
import {
	installSchedule,
	removeSchedule,
	scheduleStatus,
} from "@/src/core/launchd";

/**
 * Root CLI program.
 *
 * @description Entry point for the `mirror` command. Sub-commands are
 * registered below. Each command is a thin adapter: it parses CLI arguments
 * and delegates to the core domain functions, keeping business logic out of
 * this file (Single Responsibility).
 */
const program = new Command();

program
	.name("mirror")
	.description("Mirror work GitHub contributions to personal profile")
	.version("1.0.0");

program
	.command("init")
	.description("One-time setup: verify gh auth, create mirror repo")
	.option("--work-org <org>", "Work GitHub org", "Euronet-RiaDigital-Product")
	.option(
		"--work-emails <emails>",
		"Comma-separated work emails",
		"cpozas@riamoneytransfer.com",
	)
	.option("--work-user <user>", "Work gh username", "CPozas_euronet")
	.option("--personal <account>", "Personal gh username", "camipozas")
	.option("--repo-name <name>", "Mirror repo name", "work-mirror")
	.action(async (opts) => {
		try {
			const result = await init({
				workOrg: opts.workOrg,
				workEmails: opts.workEmails.split(",").map((e: string) => e.trim()),
				workGhUser: opts.workUser,
				personalAccount: opts.personal,
				mirrorRepoName: opts.repoName,
			});
			console.log(chalk.green(result));
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

/**
 * Parent command grouping all schedule sub-commands.
 */
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
