import { prisma } from "@/lib/prisma";
import FlagsClient from "./FlagsClient";

export default async function FlagsPage() {
  // Single-tenant: use the first project + first environment
  const project = await prisma.project.findFirst({
    include: { environments: { take: 1 } },
  });

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          No project found
        </h1>
        <p className="text-sm text-zinc-500">
          Create a project in the database to get started.
        </p>
      </div>
    );
  }

  const environment = project.environments[0];

  const flags = await prisma.flag.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      states: environment
        ? { where: { environmentId: environment.id } }
        : false,
    },
  });

  return (
    <FlagsClient
      flags={flags}
      projectId={project.id}
      environmentId={environment?.id ?? ""}
    />
  );
}
