import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function ScannerProduit({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const containerId = "lecteur-qr";

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" }, // caméra arrière du téléphone
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (codeDetecte) => {
          onScan(codeDetecte);
          scanner.stop().catch(() => {});
        },
        () => {} // erreurs de lecture ignorées (scan continu)
      )
      .catch((err) => {
        console.error("Impossible de démarrer la caméra :", err);
      });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div style={styles.overlay}>
      <div style={styles.box}>
        <h3 style={{ textAlign: "center", color: "#B8860B" }}>Scanner un produit</h3>
        <div id={containerId} style={{ width: "100%" }} />
        <button onClick={onClose} style={styles.btnFermer}>
          Fermer
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  box: {
    background: "#fff", borderRadius: 12, padding: 20,
    width: "90%", maxWidth: 400,
  },
  btnFermer: {
    marginTop: 15, width: "100%", padding: 10,
    background: "#B8860B", color: "#fff", border: "none",
    borderRadius: 8, fontWeight: "bold",
  },
};