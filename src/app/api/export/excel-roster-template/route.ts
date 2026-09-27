import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { buildExcelImportTemplateBuffer } from "@/lib/teams/excel-import/template";

export async function GET() {
  await requireUser();

  const buffer = await buildExcelImportTemplateBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="ligera-plantilla-equipos-jugadores.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
