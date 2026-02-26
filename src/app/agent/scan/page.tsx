'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import type { Order } from '@/types';
import toast from 'react-hot-toast';
import {
  QrCode, CheckCircle, XCircle, Camera, CameraOff,
  ArrowLeft, RotateCcw, Package, Keyboard,
} from 'lucide-react';

// ── Status progression for scan action ───────────────────────────────────────

const SCAN_ACTIONS = [
  { value: 'processing', label: 'Picked Up from Seller'  },
  { value: 'shipped',    label: 'In Transit / On the Way' },
  { value: 'delivered',  label: 'Delivered to Customer'  },
] as const;

type ScanAction = typeof SCAN_ACTIONS[number]['value'];
type ScanState  = 'idle' | 'scanning' | 'found' | 'success' | 'error';

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const router = useRouter();
  const { isAgent, agentTown, loading: roleLoading } = useUserRole();

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const readerRef   = useRef<import('@zxing/browser').BrowserMultiFormatReader | null>(null);
  const scanActive  = useRef(false);

  const [scanState, setScanState]           = useState<ScanState>('idle');
  const [cameraError, setCameraError]       = useState<string | null>(null);
  const [lastCode, setLastCode]             = useState<string>('');
  const [manualCode, setManualCode]         = useState('');
  const [showManual, setShowManual]         = useState(false);
  const [selectedAction, setSelectedAction] = useState<ScanAction>('processing');
  const [foundOrder, setFoundOrder]         = useState<Order | null>(null);
  const [processing, setProcessing]         = useState(false);
  const [facingMode, setFacingMode]         = useState<'environment' | 'user'>('environment');
  const [cameras, setCameras]               = useState<MediaDeviceInfo[]>([]);

  const supabase = createClient();

  // ── Camera / ZXing setup ──────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    scanActive.current = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (readerRef.current as any)?.reset?.();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanState((s) => (s === 'scanning' ? 'idle' : s));
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanState('scanning');
    scanActive.current = true;

    try {
      // Dynamic import — avoids SSR issues
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      // DecodeHintType and BarcodeFormat live in @zxing/library
      const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;

      // List available cameras
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      setCameras(devices);

      // Get camera stream
      const constraints: MediaStreamConstraints = {
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Decode continuously from video
      reader.decodeFromStream(stream, videoRef.current!, (result, error) => {
        if (!scanActive.current) return;
        if (result) {
          const code = result.getText();
          if (code && code !== lastCode) {
            setLastCode(code);
            handleCode(code);
          }
        }
        if (error && !(error.name === 'NotFoundException')) {
          console.warn('ZXing decode error:', error.message);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      setCameraError(
        msg.includes('NotAllowedError') || msg.includes('Permission')
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : msg.includes('NotFoundError')
          ? 'No camera found on this device.'
          : `Camera error: ${msg}`
      );
      setScanState('idle');
    }
  }, [facingMode, lastCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop camera when page unmounts
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ── Lookup order by tracking code ──────────────────────────────────────────

  const handleCode = useCallback(async (code: string) => {
    if (!scanActive.current) return;
    stopCamera();
    setScanState('found');
    setProcessing(true);

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('tracking_code', code.trim().toUpperCase())
      .maybeSingle();

    setProcessing(false);

    if (error || !order) {
      // Try fallback: search by order ID prefix
      const { data: byId } = await supabase
        .from('orders')
        .select('*')
        .ilike('id', `${code.trim()}%`)
        .maybeSingle();

      if (!byId) {
        setScanState('error');
        toast.error('No order found for this code');
        return;
      }
      setFoundOrder(byId as unknown as Order);
    } else {
      setFoundOrder(order as unknown as Order);
    }

    setScanState('found');
  }, [stopCamera, supabase]);

  // ── Manual code entry ─────────────────────────────────────────────────────

  function submitManual() {
    const code = manualCode.trim();
    if (!code) { toast.error('Please enter a tracking code'); return; }
    setShowManual(false);
    handleCode(code);
  }

  // ── Confirm action ────────────────────────────────────────────────────────

  async function confirmAction() {
    if (!foundOrder) return;
    setProcessing(true);

    const { data, error } = await supabase.rpc('scan_order', {
      p_tracking_code: foundOrder.tracking_code ?? foundOrder.id,
      p_new_status:    selectedAction,
    });

    setProcessing(false);

    if (error) {
      toast.error(error.message);
      setScanState('error');
      return;
    }

    const result = data as { success: boolean; error?: string };
    if (!result.success) {
      toast.error(result.error ?? 'Scan failed');
      setScanState('error');
    } else {
      setScanState('success');
      toast.success('Order updated successfully');
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    setFoundOrder(null);
    setLastCode('');
    setManualCode('');
    setScanState('idle');
    setCameraError(null);
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">Access denied</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Only field agents can access the scanner</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-4 bg-gray-900 border-b border-gray-800">
        <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold">Scan Order</h1>
          <p className="text-xs text-gray-400">Town: {agentTown ?? 'Unassigned'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Toggle camera facing */}
          {cameras.length > 1 && scanState === 'scanning' && (
            <button
              onClick={() => {
                stopCamera();
                setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
              }}
              className="p-2 rounded-full hover:bg-gray-800 text-gray-400"
              title="Flip camera"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowManual((v) => !v)}
            className="p-2 rounded-full hover:bg-gray-800 text-gray-400"
            title="Manual entry"
          >
            <Keyboard className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Action selector */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <p className="text-xs text-gray-400 mb-2">Action on scan:</p>
        <div className="flex gap-2 flex-wrap">
          {SCAN_ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => setSelectedAction(a.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedAction === a.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual entry */}
      {showManual && (
        <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
              placeholder="Enter tracking code e.g. MHM-A1B2C3D4"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              autoFocus
            />
            <button
              onClick={submitManual}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
            >
              Look up
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col">

        {/* ── IDLE STATE ─────────────────────────────────────────────────── */}
        {scanState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-24 h-24 rounded-full bg-indigo-900/40 flex items-center justify-center">
              <QrCode className="w-12 h-12 text-indigo-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Ready to Scan</h2>
              <p className="text-gray-400 text-sm">
                Point your camera at the barcode or QR code on the packing slip
              </p>
            </div>
            {cameraError && (
              <div className="bg-red-900/40 border border-red-800 rounded-xl p-4 text-sm text-red-300 max-w-sm text-center">
                {cameraError}
              </div>
            )}
            <button
              onClick={startCamera}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold text-lg transition-colors shadow-lg"
            >
              <Camera className="w-6 h-6" />
              Open Camera
            </button>
            <button
              onClick={() => setShowManual((v) => !v)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Enter code manually instead
            </button>
          </div>
        )}

        {/* ── SCANNING STATE ──────────────────────────────────────────────── */}
        {scanState === 'scanning' && (
          <div className="flex-1 relative bg-black">
            {/* Video feed */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scan overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Dark overlay with cut-out */}
              <div className="absolute inset-0 bg-black/50" />

              {/* Target reticle */}
              <div className="relative z-10 w-64 h-64">
                {/* Corner brackets */}
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-10 h-10 border-indigo-400 ${cls}`} />
                ))}
                {/* Animated scan line */}
                <div className="absolute inset-x-0 h-0.5 bg-indigo-400 animate-scan-line" />
              </div>

              <p className="relative z-10 mt-6 text-white text-sm bg-black/60 px-4 py-2 rounded-full">
                Point at barcode or QR code
              </p>

              <button
                onClick={stopCamera}
                className="relative z-10 mt-4 flex items-center gap-2 text-sm text-gray-300 hover:text-white px-4 py-2 rounded-full bg-black/40 transition-colors"
              >
                <CameraOff className="w-4 h-4" /> Stop Camera
              </button>
            </div>
          </div>
        )}

        {/* ── FOUND / CONFIRM STATE ───────────────────────────────────────── */}
        {scanState === 'found' && (
          <div className="flex-1 flex flex-col p-4 gap-4">
            {processing ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400 mx-auto mb-3" />
                  <p className="text-gray-400">Looking up order…</p>
                </div>
              </div>
            ) : foundOrder ? (
              <>
                {/* Order card */}
                <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-indigo-400" />
                    <h2 className="font-bold text-lg">Order Found</h2>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tracking Code</span>
                      <span className="font-mono text-indigo-300">{foundOrder.tracking_code ?? '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Order ID</span>
                      <span className="font-mono text-xs">{foundOrder.id.slice(0, 12)}…</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total</span>
                      <span className="font-semibold">KES {foundOrder.total?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Current Status</span>
                      <span className="capitalize">{foundOrder.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment</span>
                      <span className={`uppercase text-xs font-semibold ${
                        foundOrder.payment_method === 'cod' ? 'text-orange-400' : 'text-green-400'
                      }`}>
                        {foundOrder.payment_method}
                      </span>
                    </div>
                    {foundOrder.shipping_address && (
                      <div className="pt-2 border-t border-gray-800">
                        <p className="text-gray-400 mb-1">Delivery address</p>
                        {(() => {
                          const addr = foundOrder.shipping_address as { full_name?: string; address_line1?: string; city?: string; phone?: string };
                          return (
                            <>
                              <p className="font-medium">{addr?.full_name}</p>
                              <p className="text-gray-300">{addr?.address_line1}, {addr?.city}</p>
                              {addr?.phone && <p className="text-gray-400">{addr.phone}</p>}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action to apply */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <p className="text-sm text-gray-400 mb-3">Mark order as:</p>
                  <div className="space-y-2">
                    {SCAN_ACTIONS.map((a) => (
                      <label key={a.value} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="action"
                          value={a.value}
                          checked={selectedAction === a.value}
                          onChange={() => setSelectedAction(a.value)}
                          className="accent-indigo-500"
                        />
                        <span className="text-sm">{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* COD warning */}
                {foundOrder.payment_method === 'cod' && selectedAction === 'delivered' && (
                  <div className="bg-orange-900/40 border border-orange-800 rounded-xl p-4 text-sm text-orange-300">
                    ⚠️ This is a Cash on Delivery order. Collect payment from customer before confirming delivery.
                  </div>
                )}

                {/* Confirm / Reset */}
                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={confirmAction}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-xl font-semibold transition-colors"
                  >
                    {processing ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirm Update
                      </>
                    )}
                  </button>
                  <button
                    onClick={reset}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── SUCCESS STATE ───────────────────────────────────────────────── */}
        {scanState === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-24 h-24 rounded-full bg-green-900/40 flex items-center justify-center animate-scale-in">
              <CheckCircle className="w-14 h-14 text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Done!</h2>
              <p className="text-gray-400">
                Order successfully marked as{' '}
                <span className="text-green-400 font-semibold">{selectedAction}</span>
              </p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={reset}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold"
              >
                <QrCode className="w-5 h-5" /> Scan Next
              </button>
              <button
                onClick={() => router.push('/agent')}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR STATE ─────────────────────────────────────────────────── */}
        {scanState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-24 h-24 rounded-full bg-red-900/40 flex items-center justify-center">
              <XCircle className="w-14 h-14 text-red-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Scan Failed</h2>
              <p className="text-gray-400 text-sm">
                Order not found, or you don&apos;t have permission to update it.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold"
              >
                <RotateCcw className="w-5 h-5" /> Try Again
              </button>
              <button
                onClick={() => router.push('/agent')}
                className="px-5 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl"
              >
                Back
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
