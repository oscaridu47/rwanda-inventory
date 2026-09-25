"use client";

import { useState } from "react";
import BarcodeScanner from "../components/BarcodeScanner";

export default function BarcodePage() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");

  function handleScan(barcode: string) {
    setScannedBarcode(barcode);
    setScannerOpen(false);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Barcode Scanner
            </h1>

            <p className="mt-2 text-gray-600">
              Test barcode scanning before connecting it
              to your inventory.
            </p>
          </div>

          <a
            href="/"
            className="rounded-lg bg-white px-5 py-3 text-center font-medium text-gray-900 shadow hover:bg-gray-50"
          >
            Dashboard
          </a>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          {!scannerOpen ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900">
                Scan a Product
              </h2>

              <p className="mt-2 text-gray-600">
                Start the camera and point it at a barcode.
              </p>

              <button
                type="button"
                onClick={() => {
                  setScannedBarcode("");
                  setScannerOpen(true);
                }}
                className="mt-6 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
              >
                Open Barcode Scanner
              </button>
            </>
          ) : (
            <BarcodeScanner
              onScan={handleScan}
              onClose={() => setScannerOpen(false)}
            />
          )}
        </div>

        {scannedBarcode && (
          <div className="mt-6 rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Scanned Barcode
            </p>

            <p className="mt-2 break-all text-2xl font-bold text-gray-900">
              {scannedBarcode}
            </p>

            <button
              type="button"
              onClick={() => {
                setScannedBarcode("");
                setScannerOpen(true);
              }}
              className="mt-5 rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Scan Another
            </button>
          </div>
        )}
      </div>
    </main>
  );
}