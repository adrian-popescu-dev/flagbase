import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const project = await prisma.project.findFirst({
    include: { environments: true },
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">No project found</h1>
        <p className="text-sm text-zinc-500">Create a project in the database to get started.</p>
      </div>
    );
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      environmentId: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });

  return (
    <SettingsClient
      apiKeys={apiKeys}
      projectId={project.id}
      environments={project.environments}
    />
  );
}
