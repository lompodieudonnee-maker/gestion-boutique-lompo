import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

function ScannerProduit({ onScan, onClose }) {
  const conteneurId = 'zone-scanner-produit'
  const scannerRef = useRef(null)
  const dejaLuRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(conteneurId)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (codeDecode) => {
          if (dejaLuRef.current) return
          dejaLuRef.current = true

          // On arrête complètement la caméra AVANT de prévenir le parent,
          // pour éviter que React ne retire la zone vidéo pendant qu'elle est encore active.
          scanner
            .stop()
            .then(() => scanner.clear())
            .catch(() => {})
            .finally(() => {
              onScan(codeDecode)
            })
        },
        () => {
          // erreur de lecture image par image : on ignore, c'est normal tant qu'aucun code n'est détecté
        }
      )
      .catch((err) => {
        alert("Impossible d'accéder à la caméra : " + err)
        onClose()
      })

    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current.clear())
          .catch(() => {})
      }
    }
  }, [])

  function fermerManuel() {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => scannerRef.current.clear())
        .catch(() => {})
        .finally(() => onClose())
    } else {
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(43, 38, 32, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '18px',
          maxWidth: '380px',
          width: '90%',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '12px', fontFamily: 'Poppins, Arial, sans-serif' }}>
          📷 Scanner un produit
        </h3>

        <div id={conteneurId} style={{ width: '100%' }} />

        <p style={{ fontSize: '13px', color: '#6B6357', marginTop: '10px', fontFamily: 'Poppins, Arial, sans-serif' }}>
          Placez le code-barres du produit devant la caméra.
        </p>

        <button
          onClick={fermerManuel}
          style={{
            marginTop: '10px',
            padding: '9px 16px',
            border: '1px solid #E6E0D6',
            borderRadius: '8px',
            background: 'white',
            color: '#6B6357',
            cursor: 'pointer',
            fontFamily: 'Poppins, Arial, sans-serif',
            fontWeight: 500,
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

export default ScannerProduit