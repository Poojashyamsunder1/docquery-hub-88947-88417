import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

/**
 * PUBLIC_INTERFACE
 * PDFPreview renders the first page of a PDF file using pdfjs-dist.
 * - If preview is not possible, shows a user-friendly error message.
 * 
 * Props:
 *   pdfUrl: string (public URL of the PDF to preview)
 *   height: number (optional, px)
 *   width: number (optional, px)
 */
function PDFPreview({ pdfUrl, width = 350, height = 400 }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let renderTask = null;
    let destroyed = false;
    setError(null);

    // pdfjs worker configuration
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const loadAndRender = async () => {
      if (!pdfUrl) return;
      setLoading(true);

      try {
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const ratio = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale: ratio });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;

        renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport,
        });

        await renderTask.promise;
      } catch (err) {
        // Handle CORS or loading errors gracefully
        setError(
          "Unable to preview PDF. " +
          (err?.message && err.message.includes("Unexpected server response") ? 
            " (Possible CORS or permissions issue)" : 
            err?.message || "Unsupported file or network error.")
        );
      }
      if (!destroyed) setLoading(false);
    };

    loadAndRender();

    return () => {
      destroyed = true;
      if (renderTask) renderTask.cancel();
    };
    // eslint-disable-next-line
  }, [pdfUrl, width, height]);

  if (!pdfUrl) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {error ? (
        <div style={{ color: "red", fontSize: 15, textAlign: "center", minHeight: 30 }}>
          {error}
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            style={{
              width: width,
              height: height,
              border: "1px solid var(--border-color)",
              borderRadius: 6,
              background: "#f7f7f7",
              boxShadow: "0 1px 3px #0001"
            }}
          />
          {loading && (
            <div style={{ fontSize: 14, color: "#555", padding: 10 }}>Loading PDF preview...</div>
          )}
        </>
      )}
    </div>
  );
}

export default PDFPreview;
