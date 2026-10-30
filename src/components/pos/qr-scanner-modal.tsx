"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Zap, ZapOff, X, AlertCircle } from "lucide-react";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export function QrScannerModal({ open, onClose, onScanSuccess }: QrScannerModalProps) {
  const [error, setError]           = useState<string | null>(null);
  const [hasTorch, setHasTorch]     = useState(false);
  const [torchOn, setTorchOn]       = useState(false);
  const [starting, setStarting]     = useState(true);

  const scannerRef     = useRef<Html5Qrcode | null>(null);
  const containerId    = "qr-reader-caja";
  const audioCtxRef    = useRef<AudioContext | null>(null);

  // Reproducir un pitido rápido de confirmación
  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtxRef.current = new AudioContextClass();
        }
      }
      if (audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime); // La (A5)
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // Audio context fallido no bloquea el escaneo
    }

    // Vibración háptica en móvil
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    setStarting(true);
    setError(null);

    const timeout = setTimeout(() => {
      const html5QrCode = new Html5Qrcode(containerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const qrConfig = {
        fps: 25,
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0,
      };

      html5QrCode
        .start(
          { facingMode: "environment" },
          qrConfig,
          (decodedText) => {
            playBeep();
            // Extraer ID si tiene prefijo cantinapp:alumno:
            let id = decodedText.trim();
            if (id.startsWith("cantinapp:alumno:")) {
              id = id.replace("cantinapp:alumno:", "");
            }
            onScanSuccess(id);
            onClose();
          },
          () => {} // Ignorar frames sin QR
        )
        .then(() => {
          setStarting(false);
          // Verificar si soporta linterna (torch)
          try {
            const track = (html5QrCode as any).getRunningTrackCameraCapabilities?.();
            if (track && track.torchFeature && track.torchFeature().isSupported()) {
              setHasTorch(true);
            }
          } catch {}
        })
        .catch((err) => {
          console.error("Error al iniciar cámara:", err);
          setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
          setStarting(false);
        });
    }, 150);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onClose, onScanSuccess, playBeep]);

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const track = (scannerRef.current as any).getRunningTrackCameraCapabilities?.();
      if (track?.torchFeature) {
        const nextState = !torchOn;
        await track.torchFeature().apply(nextState);
        setTorchOn(nextState);
      }
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-4 sm:p-6 w-[95vw] rounded-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Escanear QR de Alumno
          </DialogTitle>
          <div className="flex items-center gap-1">
            {hasTorch && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={toggleTorch}
              >
                {torchOn ? <Zap className="h-4 w-4 text-amber-500 fill-amber-500" /> : <ZapOff className="h-4 w-4" />}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="relative mt-2 flex flex-col items-center justify-center min-h-[300px] bg-black/95 rounded-xl overflow-hidden shadow-inner">
          <div id={containerId} className="w-full h-full max-w-[320px] aspect-square" />

          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs text-sm gap-2">
              <Camera className="h-8 w-8 text-primary animate-pulse" />
              <span>Iniciando sensor de cámara...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center bg-background/95 text-center gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={onClose}>
                Cerrar e ingresar manualmente
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-2">
          Apunta la cámara al código QR del carnet del alumno para identificarlo instantáneamente.
        </p>
      </DialogContent>
    </Dialog>
  );
}
