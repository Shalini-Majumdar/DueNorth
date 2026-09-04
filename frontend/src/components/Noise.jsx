import { useEffect, useState } from "react";

/**
 * Adapted from React Bits Noise. The original repaints film grain every other
 * animation frame — far too much motion (and CPU) for an operations console.
 * Here a small grain tile is generated once and repeated as a static texture,
 * so large navy surfaces don't read as flat blocks of colour.
 */
export default function Noise({ alpha = 10, tile = 128, opacity = 0.035 }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = tile;
    canvas.height = tile;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(tile, tile);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = alpha;
    }
    ctx.putImageData(image, 0, 0);
    setUrl(canvas.toDataURL());
  }, [alpha, tile]);

  if (!url) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ backgroundImage: `url(${url})`, backgroundRepeat: "repeat", opacity }}
    />
  );
}
