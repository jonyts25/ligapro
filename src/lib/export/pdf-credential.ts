import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { PLAYER_PHOTO_BUCKET } from "@/lib/players/constants";
import { playerVerificationLabel } from "@/lib/players/constants";
import type { PlayerCredentialData } from "@/lib/players/types";

async function loadPhotoBytes(
  photoPath: string | null
): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" } | null> {
  if (!photoPath) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PLAYER_PHOTO_BUCKET)
    .download(photoPath);

  if (error || !data) return null;

  const bytes = new Uint8Array(await data.arrayBuffer());
  const lower = photoPath.toLowerCase();
  if (lower.endsWith(".png")) return { bytes, kind: "png" };
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return { bytes, kind: "jpg" };
  }
  return null;
}

export async function buildCredentialPdf(input: {
  credential: PlayerCredentialData;
  organizationName: string;
  seasonName: string;
  competitionName: string;
}): Promise<Uint8Array> {
  const { credential, organizationName, seasonName, competitionName } = input;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([280, 420]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let y = height - 36;

  page.drawText(organizationName, {
    x: 24,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 16;
  page.drawText(`${competitionName} · ${seasonName}`, {
    x: 24,
    y,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 14;
  page.drawText("Credencial de jugador", {
    x: 24,
    y,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });

  const photoBoxSize = 96;
  const photoX = (width - photoBoxSize) / 2;
  const photoY = height - 170;
  const photo = await loadPhotoBytes(credential.photoPath);

  if (photo) {
    try {
      const image =
        photo.kind === "png"
          ? await pdf.embedPng(photo.bytes)
          : await pdf.embedJpg(photo.bytes);
      page.drawImage(image, {
        x: photoX,
        y: photoY,
        width: photoBoxSize,
        height: photoBoxSize,
      });
    } catch {
      page.drawRectangle({
        x: photoX,
        y: photoY,
        width: photoBoxSize,
        height: photoBoxSize,
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
      });
      page.drawText("Sin foto", {
        x: photoX + 28,
        y: photoY + 44,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
  } else {
    page.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoBoxSize,
      height: photoBoxSize,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    const initials = credential.fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    page.drawText(initials || "?", {
      x: photoX + photoBoxSize / 2 - 10,
      y: photoY + photoBoxSize / 2 - 6,
      size: 24,
      font: fontBold,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  y = photoY - 28;
  page.drawText(credential.fullName, {
    x: 24,
    y,
    size: 16,
    font: fontBold,
    maxWidth: width - 48,
  });
  y -= 18;
  page.drawText(`Equipo: ${credential.teamName}`, {
    x: 24,
    y,
    size: 11,
    font,
  });
  y -= 16;
  if (credential.jerseyNumber != null) {
    page.drawText(`Dorsal: ${credential.jerseyNumber}`, {
      x: 24,
      y,
      size: 11,
      font,
    });
    y -= 16;
  }

  if (credential.requirePlayerVerification) {
    page.drawText(
      `Verificación: ${playerVerificationLabel(credential.verificationStatus)}`,
      {
        x: 24,
        y,
        size: 10,
        font: fontBold,
        color:
          credential.verificationStatus === "approved"
            ? rgb(0.1, 0.55, 0.2)
            : rgb(0.55, 0.4, 0.05),
      }
    );
    y -= 16;
  }

  page.drawText("Documento generado al momento · no es credencial oficial con QR", {
    x: 24,
    y: 24,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
    maxWidth: width - 48,
  });

  return new Uint8Array(await pdf.save());
}
