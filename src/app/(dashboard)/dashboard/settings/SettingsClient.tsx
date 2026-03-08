"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/Field";
import { createKey, revokeKey } from "./actions";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  environmentId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
};

type Environment = { id: string; name: string; slug: string };

type Props = {
  apiKeys: ApiKey[];
  projectId: string;
  environments: Environment[];
};

export default function SettingsClient({ apiKeys, projectId, environments }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? Apps using it will stop working immediately.")) return;
    startTransition(() => revokeKey(id));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
          <p className="text-sm text-zinc-500">Manage API keys for your apps</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New API key
        </button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-400">No API keys yet.</p>
          <p className="mt-1 text-xs text-zinc-400">Create one to connect your app to Flagbase.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Key</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Environment</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Last used</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {apiKeys.map((key) => {
                const env = environments.find((e) => e.id === key.environmentId);
                return (
                  <tr key={key.id} className="bg-white dark:bg-zinc-900">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {key.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {key.keyPrefix}••••••••
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {env?.name ?? key.environmentId}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevoke(key.id)}
                        disabled={isPending}
                        className="text-xs text-zinc-400 transition hover:text-red-500 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateKeyModal
          projectId={projectId}
          environments={environments}
          onClose={() => setShowCreate(false)}
          onCreated={(key) => {
            setShowCreate(false);
            setNewKey(key);
          }}
        />
      )}

      {newKey && <NewKeyModal rawKey={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}

// ── Create key modal ──────────────────────────────────────────────────────────

function CreateKeyModal({
  projectId,
  environments,
  onClose,
  onCreated,
}: {
  projectId: string;
  environments: Environment[];
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    form.set("projectId", projectId);

    startTransition(async () => {
      try {
        const { key } = await createKey(form);
        onCreated(key);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">New API key</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Name" name="name" placeholder="Production server" required />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Environment</label>
            <select
              name="environmentId"
              required
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              {isPending ? "Creating…" : "Create key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Show new key modal ────────────────────────────────────────────────────────

function NewKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">Save your API key</h2>
        <p className="mb-4 text-sm text-zinc-500">
          This key will only be shown once. Copy it now and store it safely.
        </p>

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
          <code className="flex-1 truncate text-xs text-zinc-700 dark:text-zinc-300">{rawKey}</code>
          <button
            onClick={copy}
            className="text-xs font-medium text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          I've saved it
        </button>
      </div>
    </div>
  );
}
