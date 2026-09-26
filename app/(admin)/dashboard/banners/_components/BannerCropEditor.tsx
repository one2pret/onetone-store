'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { RotateCcw, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface BannerCropEditorProps {
  image: string;
}

const INITIAL_CROP: Point = { x: 0, y: 0 };

export function BannerCropEditor({ image }: BannerCropEditorProps) {
  const [crop, setCrop] = useState<Point>(INITIAL_CROP);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function resetCrop() {
    setCrop(INITIAL_CROP);
    setZoom(1);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Atur posisi banner</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Geser gambar dan gunakan zoom sampai bagian penting berada di dalam bingkai 3:1.
        </p>
      </div>

      <div className="relative aspect-[3/1] min-h-36 overflow-hidden rounded-lg bg-neutral-950 sm:min-h-48">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={3}
          aspect={3 / 1}
          objectFit="cover"
          cropShape="rect"
          showGrid
          restrictPosition
          roundCropAreaPixels
          onCropChange={setCrop}
          onCropComplete={handleCropComplete}
          onZoomChange={setZoom}
          mediaProps={{ alt: 'Gambar banner yang sedang diatur' }}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="bannerZoom" className="flex items-center gap-2 text-xs text-muted-foreground">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            Zoom {zoom.toFixed(2)}×
          </Label>
          <input
            id="bannerZoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-2 h-2 w-full cursor-pointer accent-primary"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={resetCrop} className="shrink-0">
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Reset posisi
        </Button>
      </div>

      <input type="hidden" name="cropX" value={croppedAreaPixels?.x ?? ''} />
      <input type="hidden" name="cropY" value={croppedAreaPixels?.y ?? ''} />
      <input type="hidden" name="cropWidth" value={croppedAreaPixels?.width ?? ''} />
      <input type="hidden" name="cropHeight" value={croppedAreaPixels?.height ?? ''} />
    </div>
  );
}
