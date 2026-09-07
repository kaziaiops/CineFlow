"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function createProject(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const project = await db.project.create({
    data: { title },
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.project.delete({ where: { id } });
  revalidatePath("/");
}
