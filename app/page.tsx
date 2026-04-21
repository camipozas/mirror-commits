import {
  AlertCircle,
  Clock,
  Cloud,
  GitBranch,
  Github,
  Shield,
  Terminal,
} from 'lucide-react';
import { ConfigForm } from '@/components/config-form';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl space-y-12 px-4 py-12">
      <header className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
            <GitBranch className="text-primary" size={20} />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-xl tracking-tight">mirror-commits</h1>
            <p className="text-text-dim text-xs">
              by{' '}
              <a
                className="text-primary/70 transition-colors hover:text-primary"
                href="https://github.com/camipozas"
              >
                camipozas
              </a>
            </p>
          </div>
          <ThemeToggle />
        </div>

        <p className="text-sm text-text-muted leading-relaxed">
          If you code at work using an org account, those contributions are
          invisible on your personal profile. This tool mirrors{' '}
          <strong>only the timestamps</strong> of your work commits to a private
          repo on your personal account — your contribution graph lights up, and
          no source code is ever copied.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: 'No code copied' },
            { icon: Cloud, label: 'No tokens stored' },
            { icon: Clock, label: 'Set it & forget it' },
          ].map((f) => (
            <div
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-text-muted text-xs"
              key={f.label}
            >
              <f.icon className="shrink-0 text-primary" size={14} />
              {f.label}
            </div>
          ))}
        </div>
      </header>

      {/* How it works */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="font-semibold text-text-muted text-xs uppercase tracking-wide">
          How it works
        </h2>
        <div className="space-y-2 text-text-muted text-xs">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-[10px] text-primary">
              1
            </span>
            <p>
              <strong className="text-text">Reads</strong> your work org's
              commit history — only timestamps, never code
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-[10px] text-primary">
              2
            </span>
            <p>
              <strong className="text-text">Creates</strong> empty commits with
              those timestamps on a private mirror repo
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-[10px] text-primary">
              3
            </span>
            <p>
              <strong className="text-text">Pushes</strong> to your personal
              GitHub — contribution graph lights up
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-[10px] text-primary">
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
      <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="text-primary" size={14} />
          <span className="font-semibold text-text text-xs">Prerequisites</span>
        </div>
        <ul className="list-inside list-disc space-y-1 text-text-dim text-xs">
          <li>Two GitHub accounts (work org + personal)</li>
          <li>Personal email verified on your GitHub account</li>
          <li>
            <strong>MCP option:</strong> just two GitHub PATs (no local install)
          </li>
          <li>
            <strong>CLI option:</strong>{' '}
            <code className="text-primary/70">gh</code> CLI installed + both
            accounts authenticated
          </li>
        </ul>
      </div>

      {/* Getting started */}
      <section className="space-y-2">
        <h2 className="font-semibold text-text-muted text-xs uppercase tracking-wide">
          Get started
        </h2>
        <p className="text-text-dim text-xs leading-relaxed">
          Pick whichever option fits your workflow. The MCP server handles
          everything remotely — no local install needed. Or use the CLI for full
          local control.
        </p>
      </section>

      {/* MCP Server */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="text-primary" size={16} />
          <h2 className="font-semibold text-text-muted text-xs uppercase tracking-wide">
            Option A: MCP Server (zero install)
          </h2>
        </div>
        <p className="text-text-dim text-xs leading-relaxed">
          Use the hosted MCP server from Claude Code, Cursor, or any
          MCP-compatible AI tool. Add the URL to your config and you're done —
          no gh CLI, no local clone, no tokens in your config file.
        </p>

        <p className="text-text-dim text-xs">
          Your AI assistant will have these tools available:
        </p>
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-border border-b">
                <th className="px-3 py-2 text-left font-semibold text-text-muted">
                  Tool
                </th>
                <th className="px-3 py-2 text-left font-semibold text-text-muted">
                  What it does
                </th>
              </tr>
            </thead>
            <tbody className="text-text-dim">
              {[
                [
                  'mirror_init',
                  'One-time setup: create mirror repo and run initial sync',
                ],
                [
                  'mirror_sync',
                  'Sync your commits (supports --since, --full, --dry-run)',
                ],
                ['mirror_status', 'Check how many commits have been mirrored'],
                [
                  'mirror_list_repos',
                  'See all repos in your org (handy for choosing what to exclude)',
                ],
                ['mirror_config', 'View or update your configuration'],
              ].map(([tool, desc]) => (
                <tr className="border-border border-b last:border-0" key={tool}>
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
      <section className="space-y-5 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Terminal className="text-primary" size={16} />
          <h2 className="font-semibold text-text-muted text-xs uppercase tracking-wide">
            Option B: CLI (full local workflow)
          </h2>
        </div>

        <p className="text-text-dim text-xs leading-relaxed">
          Prefer to run things yourself? Clone the repo and use the CLI
          directly. Three commands and you're done.
        </p>

        <div className="space-y-3">
          {[
            {
              step: '1',
              title: 'Clone & install',
              cmd: 'git clone https://github.com/camipozas/mirror-commits\ncd mirror-commits && pnpm install',
            },
            {
              step: '2',
              title: 'Run interactive setup',
              cmd: 'pnpm mirror init',
              desc: 'Prompts for your accounts, checks auth, creates the mirror repo, and runs the first full sync.',
            },
            {
              step: '3',
              title: 'Schedule daily auto-sync (optional)',
              cmd: 'pnpm mirror schedule install',
              desc: 'Installs a macOS launchd job. Default 10 PM.',
            },
          ].map((s) => (
            <div className="flex items-start gap-3" key={s.step}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold text-[10px] text-primary">
                {s.step}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium text-text text-xs">{s.title}</p>
                {s.desc && <p className="text-text-dim text-xs">{s.desc}</p>}
                <pre className="mt-1 overflow-x-auto whitespace-pre rounded bg-bg px-2 py-1 text-[11px] text-primary/70">
                  {s.cmd}
                </pre>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-border border-t pt-4">
          <p className="font-medium text-text text-xs">Command reference</p>
          <pre className="overflow-x-auto whitespace-pre rounded bg-bg px-3 py-2 text-[11px] text-primary/70">
            {`pnpm mirror sync                        # incremental sync
pnpm mirror sync --full                 # full re-sync
pnpm mirror sync --dry-run              # preview without pushing
pnpm mirror sync --since 2025-01-01    	# sync from specific date
pnpm mirror status                      # show sync stats`}
          </pre>
        </div>
      </section>

      <footer className="space-y-2 border-border border-t pt-6 text-center text-text-dim text-xs">
        <p>
          <a
            className="inline-flex items-center gap-1.5 text-primary/70 transition-colors hover:text-primary"
            href="https://github.com/camipozas/mirror-commits"
          >
            <Github size={14} />
            View on GitHub
          </a>
        </p>
        <p>
          Made by{' '}
          <a
            className="text-primary/70 transition-colors hover:text-primary"
            href="https://github.com/camipozas"
          >
            camipozas
          </a>
        </p>
      </footer>
    </main>
  );
}
