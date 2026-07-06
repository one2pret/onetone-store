"use client";

// components/admin/GoogleDrivePicker.tsx
// Tombol "Import dari Google Drive" + Google Picker popup

import { useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { importFromDrive } from "@/app/actions/drive-import";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface Props {
  productId: number;
  onImported?: () => void;
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY!;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal load ${src}`));
    document.body.appendChild(script);
  });
}

export function GoogleDrivePicker({ productId, onImported }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isLoadingPicker, setIsLoadingPicker] = useState(false);

  const buildPicker = useCallback(
    (accessToken: string) => {
      const view = new window.google.picker.DocsView(
        window.google.picker.ViewId.DOCS_IMAGES
      )
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMode(window.google.picker.DocsViewMode.GRID);

      const picker = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
        .setDeveloperKey(API_KEY)
        .setOAuthToken(accessToken)
        .addView(view)
        .setTitle("Pilih foto produk dari Google Drive")
        .setCallback((data: any) => {
          const action = data[window.google.picker.Response.ACTION];

          if (action === window.google.picker.Action.PICKED) {
            const docs = data[window.google.picker.Response.DOCUMENTS];
            const fileIds: string[] = docs.map(
              (doc: any) => doc[window.google.picker.Document.ID]
            );

            if (fileIds.length === 0) return;

            toast.info(`Mengimport ${fileIds.length} foto dari Drive...`);

            startTransition(async () => {
              const result = await importFromDrive(productId, fileIds, accessToken);

              if (result.success) {
                toast.success(
                  `${result.imported} foto berhasil diimport` +
                    (result.failed > 0 ? `, ${result.failed} gagal` : "")
                );
                if (result.errors.length > 0) {
                  console.warn("Import errors:", result.errors);
                }
                onImported?.();
              } else {
                toast.error(result.errors[0] ?? "Gagal import dari Drive");
              }
            });
          }
        })
        .build();

      picker.setVisible(true);
      setIsLoadingPicker(false);
    },
    [productId, onImported]
  );

  const openPicker = useCallback(async () => {
    if (!CLIENT_ID) {
      toast.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID belum diisi di .env.local");
      return;
    }
    if (!API_KEY) {
      toast.error("NEXT_PUBLIC_GOOGLE_PICKER_API_KEY belum diisi di .env.local");
      return;
    }
    setIsLoadingPicker(true);
    try {
      await loadScript("https://apis.google.com/js/api.js");
      await loadScript("https://accounts.google.com/gsi/client");

      await new Promise<void>((resolve) => {
        window.gapi.load("picker", () => resolve());
      });

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (tokenResponse: { access_token: string }) => {
          if (!tokenResponse.access_token) {
            toast.error("Gagal mendapat akses Google Drive");
            setIsLoadingPicker(false);
            return;
          }
          buildPicker(tokenResponse.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: "" });
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuka Google Drive");
      setIsLoadingPicker(false);
    }
  }, [buildPicker]);

  const busy = isPending || isLoadingPicker;

  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={busy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-[#51B1A6] hover:text-[#51B1A6] transition-colors disabled:opacity-50 disabled:pointer-events-none"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path d="M7.71 3.5L1.15 15l3.43 6 6.56-11.5L7.71 3.5z" fill="#0066DA" />
        <path d="M16.29 3.5H7.71l6.56 11.5h8.58L16.29 3.5z" fill="#00AC47" />
        <path d="M22.85 15h-8.58L11.14 21h8.58l3.13-6z" fill="#EA4335" />
      </svg>
      {busy ? "Memproses..." : "Import dari Google Drive"}
    </button>
  );
}
