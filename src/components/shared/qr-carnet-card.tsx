"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer, User, Phone, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface QrCarnetCardProps {
  alumnoId: string;
  nombre: string;
  curso?: string | null;
  seccion?: string | null;
  telefono?: string | null;
  escuela?: string | null;
}

export function QrCarnetCard({
  alumnoId,
  nombre,
  curso,
  seccion,
  telefono,
  escuela = "Cantina Escolar",
}: QrCarnetCardProps) {
  const [qrDataUrl, setQrDataUrl]   = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied]         = useState(false);
  const canvasRef                   = useRef<HTMLCanvasElement | null>(null);

  // El payload del QR escaneable por el POS
  const qrPayload = `cantinapp:alumno:${alumnoId}`;

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#0f172a", // Slate-900
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generando QR:", err));
  }, [qrPayload]);

  // Generar la imagen completa combinada (QR + Nombre + Teléfono) en Canvas
  const generarCarnetImagen = async (): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      // Dimensiones de tarjeta estándar de alta resolución
      canvas.width = 600;
      canvas.height = 760;

      // Fondo blanco puro con esquinas suaves
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Marco decorativo sutil
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 6;
      ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

      // Barra superior con nombre de la institución
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(16, 16, canvas.width - 32, 70);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((escuela ?? "CANTINA ESCOLAR").toUpperCase(), canvas.width / 2, 60);

      // Cargar y dibujar el QR arriba centrado
      const img = new Image();
      img.onload = () => {
        const qrSize = 360;
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = 110;
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

        // Separador
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(60, 495);
        ctx.lineTo(canvas.width - 60, 495);
        ctx.stroke();

        // Nombre del alumno centrado
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(nombre, canvas.width / 2, 545);

        // Curso y sección si aplica
        if (curso) {
          ctx.fillStyle = "#475569";
          ctx.font = "500 22px sans-serif";
          ctx.fillText(`${curso}${seccion ? ` - Sección ${seccion}` : ""}`, canvas.width / 2, 585);
        }

        // Teléfono centrado debajo
        ctx.fillStyle = "#0284c7"; // Azul
        ctx.font = "bold 24px monospace";
        ctx.fillText(telefono ? `Tel: ${telefono}` : "CantinApp Prepago", canvas.width / 2, 640);

        // Pie de tarjeta
        ctx.fillStyle = "#94a3b8";
        ctx.font = "16px sans-serif";
        ctx.fillText("Muestra este carnet en el mostrador para realizar consumos", canvas.width / 2, 695);

        resolve(canvas.toDataURL("image/png"));
      };
      img.src = qrDataUrl;
    });
  };

  const handleDescargar = async () => {
    if (!qrDataUrl) return;
    setDownloading(true);
    try {
      const dataUrl = await generarCarnetImagen();
      const link = document.createElement("a");
      link.download = `carnet-${nombre.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleImprimir = async () => {
    if (!qrDataUrl) return;
    const dataUrl = await generarCarnetImagen();
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Carnet QR — ${nombre}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
              img { max-width: 320px; height: auto; border: 1px solid #ccc; border-radius: 12px; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <Card className="max-w-sm mx-auto overflow-hidden border shadow-md bg-card text-card-foreground">
      <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
        {/* Cabecera del Carnet */}
        <div className="w-full pb-2 border-b">
          <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
            {escuela}
          </span>
        </div>

        {/* Imagen del QR (Arriba) */}
        <div className="p-3 bg-white rounded-2xl shadow-inner border flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR de ${nombre}`}
              className="w-56 h-56 object-contain"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-muted-foreground text-xs">
              Generando QR...
            </div>
          )}
        </div>

        {/* Datos identificativos centrados (Debajo del QR) */}
        <div className="space-y-1 w-full">
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center justify-center gap-1.5">
            <User className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{nombre}</span>
          </h3>

          {(curso || seccion) && (
            <p className="text-xs text-muted-foreground font-medium">
              {curso} {seccion ? `• Sec. ${seccion}` : ""}
            </p>
          )}

          <div className="pt-2 flex items-center justify-center gap-1 text-primary font-mono text-sm font-semibold">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{telefono ?? "Sin teléfono asignado"}</span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-2 gap-2 w-full pt-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={handleDescargar}
            disabled={!qrDataUrl || downloading}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {downloading ? "Generando..." : "Guardar PNG"}
          </Button>

          <Button
            size="sm"
            variant="default"
            className="w-full text-xs"
            onClick={handleImprimir}
            disabled={!qrDataUrl}
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
