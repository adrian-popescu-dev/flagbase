import { prisma } from "@/lib/prisma";
import ExperimentsClient from "./ExperimentsClient";

export default async function ExperimentsPage() {
  const project = await prisma.project.findFirst();

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">No project found</h1>
        <p className="text-sm text-zinc-500">Create a project in the database to get started.</p>
      </div>
    );
  }

  const experiments = await prisma.experiment.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: { variants: true },
  });

  return <ExperimentsClient experiments={experiments} projectId={project.id} />;
}
