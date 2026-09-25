"use client";

import {
  BarcodeFormat,
  DecodeHintType,
} from "@zxing/library";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type CameraDevice = {
  deviceId: string;
  label: string;
};

type BarcodeScannerProps = {
  onScan: (barcode: string) => void;
  onClose?: () => void;
};

/**
 * Detect virtual cameras so we can prefer real hardware cameras.
 */
function isVirtualCamera(label: string) {
  const name = label.toLowerCase();

  return (
    name.includes("obs") ||
    name.includes("virtual") ||
    name.includes("manycam") ||
    name.includes("snap camera") ||
    name.includes("droidcam") ||
    name.includes("xsplit") ||
    name.includes("iriun")
  );
}

/**
 * Detect rear/environment cameras.
 */
function isRearCamera(label: string) {
  const name = label.toLowerCase();

  return (
    name.includes("back") ||
    name.includes("rear") ||
    name.includes("environment") ||
    name.includes("world")
  );
}

export default function BarcodeScanner({
  onScan,
  onClose,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const readerRef =
    useRef<BrowserMultiFormatReader | null>(null);

  const controlsRef = useRef<{
    stop: () => void;
  } | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const trackRef =
    useRef<MediaStreamTrack | null>(null);

  const lockedRef = useRef(false);

  const [cameras, setCameras] =
    useState<CameraDevice[]>([]);

  const [selectedCameraId, setSelectedCameraId] =
    useState("");

  const [isScanning, setIsScanning] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [scannedBarcode, setScannedBarcode] =
    useState("");

  const [status, setStatus] =
    useState("Loading cameras...");

  const [cameraResolution, setCameraResolution] =
    useState("");

  const [zoomSupported, setZoomSupported] =
    useState(false);

  const [zoom, setZoom] = useState(1);

  /**
   * -------------------------------------------------------
   * LOAD ALL CAMERAS
   * -------------------------------------------------------
   */
  async function loadCameras() {
    setLoading(true);
    setError("");

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setError(
          "Your browser does not support camera access.",
        );

        return;
      }

      /**
       * Ask for camera permission first.
       * This is important because camera labels can
       * sometimes be hidden until permission is granted.
       */
      const permissionStream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      permissionStream
        .getTracks()
        .forEach((track) => track.stop());

      /**
       * Get every available video input.
       */
      const devices =
        await BrowserMultiFormatReader.listVideoInputDevices();

      if (devices.length === 0) {
        setCameras([]);

        setError(
          "No camera was found. Connect a camera and try again.",
        );

        return;
      }

      /**
       * Prefer physical cameras over virtual cameras.
       *
       * If there are no physical cameras, we still allow
       * virtual cameras.
       */
      const physicalCameras = devices.filter(
        (device) =>
          !isVirtualCamera(device.label),
      );

      const usableCameras =
        physicalCameras.length > 0
          ? physicalCameras
          : devices;

      const cameraList: CameraDevice[] =
        usableCameras.map((device) => ({
          deviceId: device.deviceId,
          label:
            device.label ||
            `Camera ${device.deviceId.slice(0, 8)}`,
        }));

      setCameras(cameraList);

      /**
       * Prefer a rear/environment camera when available.
       */
      const rearCamera = cameraList.find((camera) =>
        isRearCamera(camera.label),
      );

      if (rearCamera) {
        setSelectedCameraId(
          rearCamera.deviceId,
        );
      } else {
        setSelectedCameraId(
          cameraList[0].deviceId,
        );
      }

      setStatus(
        `${cameraList.length} camera${
          cameraList.length === 1 ? "" : "s"
        } available.`,
      );
    } catch (err) {
      console.error(
        "Camera loading error:",
        err,
      );

      if (
        err instanceof DOMException &&
        err.name === "NotAllowedError"
      ) {
        setError(
          "Camera permission was denied. Allow camera access in Chrome.",
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        setError(
          "No camera could be found.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not access the camera.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * -------------------------------------------------------
   * CAMERA OPTIMIZATION
   * -------------------------------------------------------
   */
  async function optimizeCamera(
    stream: MediaStream,
  ) {
    const track =
      stream.getVideoTracks()[0];

    if (!track) {
      return;
    }

    trackRef.current = track;

    /**
     * Read actual camera resolution.
     */
    try {
      const settings = track.getSettings();

      if (
        settings.width &&
        settings.height
      ) {
        setCameraResolution(
          `${settings.width} × ${settings.height}`,
        );
      }
    } catch {
      // Some browsers may not expose camera settings.
    }

    /**
     * Read camera capabilities.
     *
     * "any" is intentionally used because browser camera
     * capabilities such as zoom and focusMode are not
     * consistently represented by TypeScript.
     */
    try {
      const capabilities =
        track.getCapabilities() as any;

      const advanced: any[] = [];

      /**
       * Continuous autofocus.
       */
      if (
        Array.isArray(
          capabilities.focusMode,
        ) &&
        capabilities.focusMode.includes(
          "continuous",
        )
      ) {
        advanced.push({
          focusMode: "continuous",
        });
      }

      /**
       * Camera zoom.
       */
      if (
        capabilities.zoom &&
        typeof capabilities.zoom.min ===
          "number" &&
        typeof capabilities.zoom.max ===
          "number"
      ) {
        const minimum =
          capabilities.zoom.min;

        const maximum =
          capabilities.zoom.max;

        const preferred = Math.min(
          maximum,
          Math.max(minimum, 1.5),
        );

        if (maximum > minimum) {
          setZoomSupported(true);
          setZoom(preferred);

          advanced.push({
            zoom: preferred,
          });
        }
      }

      /**
       * Apply optional camera improvements.
       */
      if (advanced.length > 0) {
        try {
          await track.applyConstraints({
            advanced,
          } as any);
        } catch (err) {
          console.log(
            "Optional camera optimization unavailable:",
            err,
          );
        }
      }
    } catch (err) {
      console.log(
        "Camera capabilities unavailable:",
        err,
      );
    }
  }

  /**
   * -------------------------------------------------------
   * CHANGE CAMERA ZOOM
   * -------------------------------------------------------
   */
  async function changeZoom(
    value: number,
  ) {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [
          {
            zoom: value,
          },
        ],
      } as any);

      setZoom(value);
    } catch (err) {
      console.log(
        "Zoom unavailable:",
        err,
      );
    }
  }

  /**
   * -------------------------------------------------------
   * START SCANNER
   * -------------------------------------------------------
   */
  async function startScanner() {
    setError("");
    setScannedBarcode("");
    setCameraResolution("");
    setZoomSupported(false);

    lockedRef.current = false;

    if (!videoRef.current) {
      setError(
        "The camera display is not ready.",
      );

      return;
    }

    if (!selectedCameraId) {
      setError(
        "Please select a camera first.",
      );

      return;
    }

    /**
     * Make sure an old scanner is completely stopped.
     */
    stopScanner();

    try {
      /**
       * ---------------------------------------------------
       * STRONG ZXING HINTS
       * ---------------------------------------------------
       */
      const hints =
        new Map<DecodeHintType, any>();

      hints.set(
        DecodeHintType.POSSIBLE_FORMATS,
        [
          /**
           * QR
           */
          BarcodeFormat.QR_CODE,

          /**
           * Common retail barcodes.
           */
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,

          /**
           * Inventory / industrial barcodes.
           */
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,

          /**
           * Other commonly encountered format.
           */
          BarcodeFormat.CODABAR,
        ],
      );

      /**
       * Tell ZXing to make a stronger decoding attempt.
       */
      hints.set(
        DecodeHintType.TRY_HARDER,
        true,
      );

      /**
       * Create ZXing reader.
       */
      const reader =
        new BrowserMultiFormatReader(
          hints,
        );

      readerRef.current = reader;

      setIsScanning(true);

      setStatus(
        "Strong barcode scanner active...",
      );

      /**
       * ---------------------------------------------------
       * HIGH-QUALITY CAMERA CONSTRAINTS
       * ---------------------------------------------------
       */
      const constraints:
        MediaStreamConstraints = {
        audio: false,

        video: {
          deviceId: {
            exact: selectedCameraId,
          },

          width: {
            ideal: 1920,
          },

          height: {
            ideal: 1080,
          },

          frameRate: {
            ideal: 30,
            min: 15,
          },
        },
      };

      /**
       * Start decoding.
       */
      const controls =
        await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          async (result) => {
            /**
             * No barcode detected yet.
             */
            if (!result) {
              return;
            }

            /**
             * Prevent duplicate scans.
             */
            if (lockedRef.current) {
              return;
            }

            const value =
              result.getText().trim();

            if (!value) {
              return;
            }

            /**
             * Lock immediately so the same barcode
             * isn't detected multiple times.
             */
            lockedRef.current = true;

            setScannedBarcode(value);
            setIsScanning(false);

            setStatus(
              "Barcode detected successfully!",
            );

            /**
             * Stop ZXing.
             */
            if (controlsRef.current) {
              try {
                controlsRef.current.stop();
              } catch (err) {
                console.log(
                  "Scanner stop error:",
                  err,
                );
              }

              controlsRef.current = null;
            }

            /**
             * Send barcode to parent component.
             */
            onScan(value);
          },
        );

      controlsRef.current = controls;

      /**
       * Get the MediaStream attached to the video.
       */
      if (videoRef.current) {
        const stream =
          videoRef.current.srcObject;

        if (stream instanceof MediaStream) {
          streamRef.current = stream;

          await optimizeCamera(stream);
        }
      }
    } catch (err) {
      console.error(
        "Scanner error:",
        err,
      );

      setIsScanning(false);

      if (
        err instanceof DOMException &&
        err.name === "NotAllowedError"
      ) {
        setError(
          "Camera permission was denied. Allow camera access in Chrome.",
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        setError(
          "The selected camera was not found. Try another camera.",
        );
      } else if (
        err instanceof DOMException &&
        err.name === "OverconstrainedError"
      ) {
        setError(
          "The selected camera cannot provide the requested settings. Try another camera.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not start the scanner.",
        );
      }

      setStatus(
        "Scanner stopped.",
      );
    }
  }

  /**
   * -------------------------------------------------------
   * STOP SCANNER
   * -------------------------------------------------------
   */
  function stopScanner() {
    /**
     * Stop ZXing controls.
     */
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (err) {
        console.log(
          "Scanner stop error:",
          err,
        );
      }

      controlsRef.current = null;
    }

    /**
     * Stop stored MediaStream.
     */
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    /**
     * Stop anything still attached to the video element.
     */
    if (videoRef.current) {
      const stream =
        videoRef.current.srcObject;

      if (stream instanceof MediaStream) {
        stream
          .getTracks()
          .forEach((track) => {
            track.stop();
          });
      }

      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    trackRef.current = null;
    readerRef.current = null;

    lockedRef.current = false;

    setIsScanning(false);
    setZoomSupported(false);
  }

  /**
   * -------------------------------------------------------
   * CHANGE CAMERA
   * -------------------------------------------------------
   */
  function changeCamera(
    cameraId: string,
  ) {
    stopScanner();

    setError("");
    setScannedBarcode("");
    setCameraResolution("");

    setSelectedCameraId(
      cameraId,
    );

    setStatus(
      "Camera selected. Press Start Scanner.",
    );
  }

  /**
   * -------------------------------------------------------
   * SCAN AGAIN
   * -------------------------------------------------------
   */
  function scanAgain() {
    setError("");
    setScannedBarcode("");
    setCameraResolution("");

    lockedRef.current = false;

    setStatus(
      "Ready for another scan.",
    );
  }

  /**
   * -------------------------------------------------------
   * REFRESH CAMERAS
   * -------------------------------------------------------
   */
  async function refreshCameras() {
    stopScanner();

    setError("");
    setScannedBarcode("");
    setCameraResolution("");

    await loadCameras();
  }

  /**
   * -------------------------------------------------------
   * INITIAL LOAD
   * -------------------------------------------------------
   */
  useEffect(() => {
    loadCameras();

    return () => {
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch {}
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });
      }

      if (videoRef.current) {
        const stream =
          videoRef.current.srcObject;

        if (stream instanceof MediaStream) {
          stream
            .getTracks()
            .forEach((track) => {
              track.stop();
            });
        }

        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  /**
   * -------------------------------------------------------
   * USER INTERFACE
   * -------------------------------------------------------
   */
  return (
    <div className="w-full rounded-xl bg-white p-5 shadow-sm">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Barcode & QR Scanner
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            High-performance scanner for RwandaInventory.
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        )}
      </div>

      {/* CAMERA SELECTOR */}
      <div className="mt-5">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Camera / Device
        </label>

        <select
          value={selectedCameraId}
          onChange={(event) =>
            changeCamera(
              event.target.value,
            )
          }
          disabled={
            loading || isScanning
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 outline-none focus:border-black disabled:bg-gray-100"
        >
          <option value="">
            {loading
              ? "Loading cameras..."
              : "Select a camera"}
          </option>

          {cameras.map((camera) => (
            <option
              key={camera.deviceId}
              value={camera.deviceId}
            >
              {camera.label}
            </option>
          ))}
        </select>
      </div>

      {/* CAMERA VIEW */}
      <div className="relative mt-5 overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="block min-h-[360px] w-full object-cover"
        />

        {/* STRONG SCANNING AREA */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-48 w-[94%] rounded-xl border-2 border-white shadow-lg">
              {/* RED SCAN LINE */}
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(255,0,0,0.9)]" />

              {/* TOP LEFT */}
              <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-white" />

              {/* TOP RIGHT */}
              <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-white" />

              {/* BOTTOM LEFT */}
              <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-white" />

              {/* BOTTOM RIGHT */}
              <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-white" />
            </div>
          </div>
        )}

        {/* STOPPED MESSAGE */}
        {!isScanning &&
          !scannedBarcode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg bg-black/70 px-5 py-3 text-sm text-white">
                Scanner stopped
              </div>
            </div>
          )}
      </div>

      {/* CAMERA INFORMATION */}
      <div className="mt-3 flex flex-wrap gap-2">
        {isScanning && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            ● Strong scanning active
          </span>
        )}

        {cameraResolution && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            {cameraResolution}
          </span>
        )}

        {zoomSupported && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
            Optical/digital zoom available
          </span>
        )}
      </div>

      {/* ZOOM CONTROL */}
      {isScanning &&
        zoomSupported && (
          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Camera Zoom
              </span>

              <span className="text-sm font-semibold text-gray-900">
                {zoom.toFixed(1)}×
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="4"
              step="0.1"
              value={zoom}
              onChange={(event) =>
                changeZoom(
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="mt-3 w-full"
            />
          </div>
        )}

      {/* STATUS */}
      <div className="mt-4 rounded-lg bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-700">
          {status}
        </p>

        {isScanning && (
          <p className="mt-1 text-xs text-gray-500">
            For a 1D barcode, keep the full
            barcode inside the scanning box.
          </p>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">
            Scanner error
          </p>

          <p className="mt-1">
            {error}
          </p>
        </div>
      )}

      {/* RESULT */}
      {scannedBarcode && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-700">
            Barcode detected
          </p>

          <p className="mt-2 break-all text-xl font-bold text-green-900">
            {scannedBarcode}
          </p>
        </div>
      )}

      {/* BUTTONS */}
      <div className="mt-5 flex flex-wrap gap-3">
        {!isScanning ? (
          <button
            type="button"
            onClick={startScanner}
            disabled={
              loading ||
              !selectedCameraId
            }
            className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Scanner
          </button>
        ) : (
          <button
            type="button"
            onClick={stopScanner}
            className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Stop Scanner
          </button>
        )}

        {scannedBarcode && (
          <button
            type="button"
            onClick={scanAgain}
            className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Scan Another
          </button>
        )}

        <button
          type="button"
          onClick={refreshCameras}
          disabled={
            loading || isScanning
          }
          className="rounded-lg border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Refresh Cameras
        </button>
      </div>

      {/* INFORMATION */}
      <div className="mt-5 rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-semibold text-gray-800">
          Powerful scanning mode
        </p>

        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-500">
          <li>
            QR codes remain supported.
          </li>

          <li>
            Optimized for EAN-13, EAN-8, UPC-A and UPC-E.
          </li>

          <li>
            Supports Code 128, Code 39, Code 93 and ITF.
          </li>

          <li>
            Uses stronger ZXing decoding for difficult barcodes.
          </li>

          <li>
            Uses higher camera resolution when available.
          </li>

          <li>
            Uses continuous autofocus when supported by the camera.
          </li>

          <li>
            Supports switching between connected cameras.
          </li>

          <li>
            Supports camera zoom when the device provides it.
          </li>
        </ul>
      </div>
    </div>
  );
}