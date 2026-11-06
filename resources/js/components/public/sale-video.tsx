/** Video de una venta real en la demo (public/videos). Se muestra la imagen con un botón grande, y al tocarlo arranca con sonido. */
import { Play } from 'lucide-react';
import { useRef, useState } from 'react';

export function SaleVideo() {
    const video = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <div className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_-24px_rgb(0_0_0/0.7)] ring-1 ring-white/15">
            <video ref={video} controls={isPlaying} preload="metadata" poster="/images/landing/video-poster.jpg" className="aspect-video w-full">
                <source src="/videos/sivefarma-demo.mp4" type="video/mp4" />
            </video>
            {!isPlaying && (
                <button
                    type="button"
                    aria-label="Reproducir video de una venta"
                    onClick={() => {
                        setIsPlaying(true);
                        video.current?.play();
                    }}
                    className="group absolute inset-0 flex items-center justify-center bg-black/25"
                >
                    <span className="pub-pulse bg-primary flex size-20 items-center justify-center rounded-full text-white shadow-xl shadow-black/40 transition-transform duration-200 group-hover:scale-110">
                        <Play className="ml-1 size-8 fill-current" />
                    </span>
                </button>
            )}
        </div>
    );
}
