import { readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const ABOUT_CAROUSELS_DIR = path.join(process.cwd(), "public", "assets", "img", "about-carousels");
const ABOUT_CAROUSELS_URL_ROOT = "/assets/img/about-carousels";
const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

function naturalCompare(left, right) {
  return left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" });
}

function isImageFile(name) {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

async function listFolderMedia(folderName) {
  const folderPath = path.join(ABOUT_CAROUSELS_DIR, folderName);
  const entries = await readdir(folderPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort(naturalCompare)
    .map((fileName) => `${ABOUT_CAROUSELS_URL_ROOT}/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`);
}

export async function GET() {
  try {
    const entries = await readdir(ABOUT_CAROUSELS_DIR, { withFileTypes: true });
    const folderNames = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(naturalCompare);

    const groups = Object.fromEntries(
      await Promise.all(
        folderNames.map(async (folderName) => [folderName, await listFolderMedia(folderName)])
      )
    );

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        groups
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        groups: {},
        error: error instanceof Error ? error.message : "Failed to build about media manifest"
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
