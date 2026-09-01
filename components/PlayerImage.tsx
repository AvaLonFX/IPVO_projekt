"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { getPlayerImageUrl, PLAYER_IMAGE_FALLBACK } from "@/lib/player-images";

type PlayerImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onError"> & {
  playerId: number | string | null | undefined;
  alt: string;
  imageSize?: "small" | "large";
};

export default function PlayerImage({
  playerId,
  alt,
  imageSize = "large",
  loading = "lazy",
  ...props
}: PlayerImageProps) {
  const source = getPlayerImageUrl(playerId, imageSize);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = failedSource === source ? PLAYER_IMAGE_FALLBACK : source;

  return (
    <img
      width={1040}
      height={760}
      decoding="async"
      {...props}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => {
        if (src !== PLAYER_IMAGE_FALLBACK) setFailedSource(source);
      }}
    />
  );
}
