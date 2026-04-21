'use client';

import { Check, Copy, ExternalLink, Key } from 'lucide-react';
import { useState } from 'react';

interface Config {
  excludeRepos: string[];
  mirrorRepoName: string;
  personalAccount: string;
  personalEmail: string;
  workEmails: string[];
  workGhUser: string;
  workOrg: string;
}

const defaultConfig: Config = {
  workEmails: [''],
  workOrg: '',
  workGhUser: '',
  personalAccount: '',
  mirrorRepoName: 'work-mirror',
  personalEmail: '',
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
      'mirror-commits': {
        type: 'http',
        url: 'https://mirror-commits.vercel.app/api/mcp',
        headers: {
          'X-GitHub-Work-Token': 'ghp_your_work_token',
          'X-GitHub-Personal-Token': 'ghp_your_personal_token',
          'X-Config': JSON.stringify(xConfig),
        },
      },
    },
    null,
    2
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
    <div className="space-y-5 rounded-lg border border-border bg-card p-6">
      <h2 className="font-semibold text-text-muted text-xs uppercase tracking-wide">
        Generate your config
      </h2>

      <p className="text-text-dim text-xs leading-relaxed">
        Fill in your details, hit copy, and paste the result into your MCP
        client config (e.g.{' '}
        <code className="text-primary/70">~/.claude.json</code> under{' '}
        <code className="text-primary/70">mcpServers</code>). No{' '}
        <code className="text-primary/70">gh</code> CLI needed — everything runs
        through the GitHub API using your tokens.
      </p>

      {/* Token guidance */}
      <div className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2">
          <Key className="text-primary" size={14} />
          <span className="font-semibold text-text text-xs">
            First, create two GitHub tokens
          </span>
        </div>
        <p className="text-text-dim text-xs">
          You need one token per GitHub account so the tool can read your work
          commits and push to your personal mirror repo.
        </p>
        <div className="grid grid-cols-1 gap-3 text-text-dim text-xs md:grid-cols-2">
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
          className="inline-flex items-center gap-1.5 text-primary/70 text-xs transition-colors hover:text-primary"
          href="https://github.com/settings/tokens/new"
          rel="noopener noreferrer"
          target="_blank"
        >
          Create a token on GitHub
          <ExternalLink size={12} />
        </a>
      </div>

      <p className="font-medium text-text-muted text-xs uppercase tracking-wide">
        Your accounts
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          hint="The org where your work repos live"
          label="Work GitHub org"
          onChange={(v) => updateField('workOrg', v)}
          placeholder="your-org"
          value={config.workOrg}
        />
        <Field
          hint="Your username in the work org"
          label="Work GitHub username"
          onChange={(v) => updateField('workGhUser', v)}
          placeholder="your-work-username"
          value={config.workGhUser}
        />
        <Field
          hint="Where the mirror repo will be created"
          label="Personal GitHub username"
          onChange={(v) => updateField('personalAccount', v)}
          placeholder="your-personal-username"
          value={config.personalAccount}
        />
        <Field
          hint="A private repo will be created with this name"
          label="Mirror repo name"
          onChange={(v) => updateField('mirrorRepoName', v)}
          placeholder="work-mirror"
          value={config.mirrorRepoName}
        />
        <div>
          <Field
            hint="Must be verified on GitHub for contributions to count"
            label="Personal email"
            onChange={(v) => updateField('personalEmail', v)}
            placeholder="you@gmail.com"
            value={config.personalEmail}
          />
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-text-muted text-xs">
          Work email(s)
        </span>
        <input
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text transition-colors placeholder:text-text-dim focus:border-border-focus focus:outline-none"
          onChange={(e) =>
            updateField(
              'workEmails',
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="you@company.com"
          type="text"
          value={config.workEmails.join(', ')}
        />
        <p className="mt-1 text-[11px] text-text-dim">
          The email(s) you use for work commits — separate multiple with commas
        </p>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-text-muted text-xs">
          Repos to skip (optional)
        </span>
        <textarea
          className="w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm text-text transition-colors placeholder:text-text-dim focus:border-border-focus focus:outline-none"
          onChange={(e) =>
            updateField(
              'excludeRepos',
              e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="your-org/repo-to-skip"
          rows={2}
          value={config.excludeRepos.join('\n')}
        />
        <p className="mt-1 text-[11px] text-text-dim">
          One per line, in <code className="text-primary/70">org/repo</code>{' '}
          format — e.g.{' '}
          <code className="text-primary/70">MyOrg/internal-tools</code>
        </p>
      </label>

      <div className="flex items-center gap-3">
        <button
          className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-bg text-xs transition-colors hover:bg-primary/90"
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Config'}
        </button>
        <span className="text-text-dim text-xs">
          Replace <code className="text-primary/70">ghp_your_*</code>{' '}
          placeholders with your real tokens
        </span>
      </div>

      <pre className="overflow-x-auto rounded-md border border-border bg-bg p-3 text-[11px] text-text-muted">
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
      <span className="mb-1.5 block text-text-muted text-xs">{label}</span>
      <input
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text transition-colors placeholder:text-text-dim focus:border-border-focus focus:outline-none"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
      {hint && <p className="mt-1 text-[11px] text-text-dim">{hint}</p>}
    </label>
  );
}
