import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { deleteManuscriptFile } from "@/server/services/manuscript-upload";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { fileId } = await params;

  try {
    await deleteManuscriptFile(prisma, { userId: user.id, fileId });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    if (message.includes("not found") || message.includes("forbidden"))
      return new NextResponse("Not found", { status: 404 });
    return new NextResponse("Delete failed", { status: 500 });
  }
}
