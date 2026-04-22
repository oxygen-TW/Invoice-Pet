/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, RefObject, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, RefreshCw, Heart, Sparkles, QrCode, X, AlertCircle, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { generatePetAttributes, generatePixelMap, PetAttributes, PixelData } from './utils/petGenerator';

export default function App() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pet, setPet] = useState<{ attributes: PetAttributes; grid: PixelData; code: string } | null>(null);
  const [petName, setPetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [backstory, setBackstory] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'starting' | 'running' | 'error' | 'analyzing'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    let stream: MediaStream | null = null;

    const parseTaiwanEInvoice = (raw: string): string | null => {
      // Taiwan e-invoice QR is Base64 encoded, 64 characters
      if (/^[A-Za-z0-9+/=]{64}$/.test(raw.trim())) {
        try {
          const decoded = atob(raw.trim());
          // Format: CompanyID|InvoiceID|Date|Amount|Random|CarrierID...
          const parts = decoded.split('|');
          if (parts.length >= 2) {
            const companyId = parts[0];
            const invoiceId = parts[1];
            // Convert to our format: first 2 chars of company ID + invoice ID
            const alpha = companyId.slice(0, 2).toUpperCase();
            const numeric = invoiceId.padStart(8, '0').slice(0, 8);
            return `${alpha}-${numeric}`;
          }
        } catch (e) {
          // Not base64 decodable as valid invoice
        }
      }
      return null;
    };

    const tryParseCode = (text: string): string | null => {
      // 1. Try standard format (AA-XXXXXXXX or AXXXXXXXX)
      const standardMatch = text.match(/([a-zA-Z]{2})[-]?(\d{8})/);
      if (standardMatch) {
        return `${standardMatch[1].toUpperCase()}-${standardMatch[2]}`;
      }
      // 2. Try Taiwan e-invoice format
      const einvoiceCode = parseTaiwanEInvoice(text);
      if (einvoiceCode) return einvoiceCode;
      return null;
    };

    if (isScannerOpen) {
      setScannerStatus('starting');
      const videoElement = document.getElementById('qr-video') as HTMLVideoElement;

      if (!videoElement) {
        setScannerStatus('error');
        setError('Scanner element not found');
        return;
      }

      const reader = new BrowserMultiFormatReader();
      scannerRef.current = reader;

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        },
        audio: false
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then((mediaStream) => {
          if (!isMounted) {
            mediaStream.getTracks().forEach(t => t.stop());
            return;
          }
          stream = mediaStream;
          videoElement.srcObject = mediaStream;
          videoElement.playsInline = true;
          videoElement.muted = true;

          return videoElement.play();
        })
        .then(() => {
          if (!isMounted || !scannerRef.current) return;

          setScannerStatus('running');

          // Use decode in a loop for continuous scanning
          const decodeLoop = () => {
            if (!isMounted || !scannerRef.current) return;

            try {
              // Check if video has enough dimensions (is playing)
              if (videoElement.readyState < 2) {
                setTimeout(decodeLoop, 100);
                return;
              }

              const result = reader.decode(videoElement);
              if (result && isMounted) {
                const text = result.getText();
                setScannerStatus('analyzing');

                const parsedCode = tryParseCode(text);
                if (parsedCode) {
                  setCode(parsedCode);
                  stopScanner();
                  return;
                } else {
                  setError('Invalid format. Resuming scan...');
                  setTimeout(() => {
                    if (!isMounted) return;
                    setError('');
                    setScannerStatus('running');
                  }, 1200);
                }
              }
            } catch (err) {
              if (err instanceof NotFoundException) {
                // No QR found, continue scanning
              } else {
                console.warn('Decode error:', err);
              }
            }
            setTimeout(decodeLoop, 100);
          };

          decodeLoop();
        })
        .catch((err) => {
          console.error('Camera error:', err);
          if (isMounted) {
            setScannerStatus('error');
            setError('Could not access camera. Please check permissions.');
          }
        });
    } else {
      stopScanner();
    }

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      stopScanner();
    };
  }, [isScannerOpen]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stopAsyncDecode?.();
      scannerRef.current = null;
      setScannerStatus('idle');
      setIsScannerOpen(false);
    }
  };


  const handleFileScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerStatus('analyzing');
    if (isScannerOpen) {
      stopScanner();
      setIsScannerOpen(false);
    }

    try {
      const reader = new BrowserMultiFormatReader();
      const imageData = await createImageBitmap(file);
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);

      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img, 0, 0);
      const imageBitmap = await createImageBitmap(canvas);

      const result = await reader.decodeFromImageElement(img);
      const decodedText = result.getText();

      const match = decodedText.match(/([a-zA-Z]{2})[-]?(\d{8})/);
      if (match) {
        const alpha = match[1].toUpperCase();
        const numeric = match[2];
        setCode(`${alpha}-${numeric}`);
        setError('');
      } else {
        setError('QR Code detected, but no valid Alpha-Numeric ID found.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not detect QR code in the image. Please try re-taking the photo or ensure it is sharp.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setScannerStatus('idle');
    }
  };

  const validateCode = (input: string) => {
    const regex = /^[A-Z]{2}-[0-9]{8}$/;
    return regex.test(input);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    // Auto-hyphenation logic
    if (val.length === 2 && !val.includes('-')) {
      val = val + '-';
    } else if (val.length > 2 && val[2] !== '-') {
      val = val.slice(0, 2) + '-' + val.slice(2);
    }

    // Limit length to the correct format (AA-XXXXXXXX)
    if (val.length <= 11) {
      setCode(val);
    }
  };

  const handleGenerate = async () => {
    const upperCode = code.toUpperCase();
    if (!validateCode(upperCode)) {
      setError('Invalid format! Use AA-XXXXXXXX (e.g. XP-12345678)');
      return;
    }

    setError('');
    setLoading(true);
    setBackstory('');
    setPetName('');

    try {
      const attributes = generatePetAttributes(upperCode);
      const grid = generatePixelMap(attributes);

      setPet({ attributes, grid, code: upperCode });

      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [attributes.primaryColor, attributes.secondaryColor, '#ffffff']
      });

      // Use species as pet name
      setPetName(attributes.species);
      setBackstory(`A unique ${attributes.species.toLowerCase()} discovered through identity code ${upperCode}.`);

    } catch (err) {
      console.error(err);
      setError('Something went wrong. Try again!');
    } finally {
      setLoading(false);
    }
  };

  const downloadPet = () => {
    if (!canvasRef.current || !pet) return;

    // Create an offscreen canvas for the "Trading Card"
    const card = document.createElement('canvas');
    const ctx = card.getContext('2d');
    if (!ctx) return;

    const width = 400;
    const height = 600;
    card.width = width;
    card.height = height;

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // 3. Draw Pet Image (Scaled)
    const petImg = canvasRef.current;
    const petSize = 320;
    const petOffset = (width - petSize) / 2;
    ctx.drawImage(petImg, petOffset, 40, petSize, petSize);

    // 4. Draw Name Section
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(petName.toUpperCase(), width / 2, 400);

    // 5. Draw Rarity
    const rarity = getRarity(pet.code);
    ctx.fillStyle = rarity === 'LEGENDARY' ? '#d97706' : rarity === 'RARE' ? '#7c3aed' : '#3b82f6';
    ctx.font = 'bold 16px "Inter", sans-serif';
    ctx.fillText(rarity, width / 2, 430);

    // 6. Draw Traits
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111111';
    ctx.font = '10px "Inter", sans-serif';
    const traits = [
      { l: 'SPECIES', v: pet.attributes.species },
      { l: 'EYES', v: pet.attributes.eyeType },
      { l: 'PATTERN', v: pet.attributes.pattern },
      { l: 'ACCESSORY', v: pet.attributes.accessory },
    ];

    traits.forEach((t, i) => {
      const y = 480 + (i * 25);
      ctx.fillStyle = '#999999';
      ctx.fillText(t.l, 60, y);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 12px "Inter", sans-serif';
      ctx.fillText(t.v.toUpperCase(), 160, y);
      ctx.font = '10px "Inter", sans-serif';
    });

    // 7. Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cccccc';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText('PIXEL PET LAB // PROCEDURAL GENESIS', width / 2, height - 30);

    // Download
    const link = document.createElement('a');
    link.download = `pet-${petName.toLowerCase()}-${pet.code}.png`;
    link.href = card.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="geometric-container w-full max-w-[1000px] min-h-[600px] relative"
      >
        {/* Header */}
        <header className="geometric-header">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-yellow-400 rotate-45 border border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]"></div>
            <h1 className="text-xl font-bold tracking-tighter uppercase font-sans">
              Pixel.Genesis / V1.0
            </h1>
          </div>
          <div className="text-[10px] opacity-70 font-mono uppercase tracking-widest">
            STATUS: {loading ? 'SYNTHESIZING...' : 'READY_FOR_INPUT'}
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row">
          {/* Left Side: Controls */}
          <section className="w-full lg:w-1/2 border-r-0 lg:border-r-2 border-black p-8 lg:p-12 flex flex-col justify-center gap-10">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="label-micro block">Subject Identity Code</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-bold text-gray-600 hover:text-black uppercase flex items-center gap-1 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    Read Photo
                  </button>
                  <button
                    onClick={() => setIsScannerOpen(!isScannerOpen)}
                    className={`text-[10px] font-bold uppercase flex items-center gap-1 transition-colors ${isScannerOpen ? 'text-red-500 hover:text-red-400' : 'text-blue-600 hover:text-blue-500'}`}
                  >
                    {isScannerOpen ? <X className="w-3 h-3" /> : <QrCode className="w-3 h-3" />}
                    {isScannerOpen ? 'Abort Scan' : 'Scan Code'}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isScannerOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative border-2 border-black mb-4 bg-gray-50 overflow-hidden min-h-[250px] flex items-center justify-center">
                      <div id="qr-reader" className="w-full">
                        <video id="qr-video" className="w-full h-full object-cover" playsInline muted></video>
                      </div>

                      {/* Scanning Guide/Box Overlay */}
                      {scannerStatus === 'running' && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                          <div className="w-[180px] h-[180px] border-2 border-dashed border-blue-500/40 relative">
                            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-500"></div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-500"></div>
                            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-500"></div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-500"></div>
                          </div>
                          <p className="mt-4 text-[9px] font-bold uppercase tracking-widest text-blue-500/60 bg-white/80 px-2 py-0.5 rounded">
                            Align QR Inside Frame
                          </p>
                        </div>
                      )}

                      {scannerStatus === 'starting' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 gap-4">
                          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Initializing Optical Sensor...</p>
                        </div>
                      )}

                      {scannerStatus === 'analyzing' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-sm gap-4 border-4 border-blue-500">
                          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-white px-2 py-1 border-2 border-blue-500">Processing Image Frame...</p>
                        </div>
                      )}

                      {scannerStatus === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-6 text-center gap-4 border-4 border-red-500">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Hardware Access Denied</p>
                          <p className="text-xs text-gray-500">Please ensure camera permissions are granted for this domain. Attempting to fallback...</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileScan}
                />
                <input
                  type="text"
                  placeholder="AA-XXXXXXXX"
                  value={code}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  className="geometric-input"
                  maxLength={11}
                  disabled={scannerStatus === 'analyzing'}
                />
                <div className="flex justify-between items-center text-[10px]">
                  <p className="text-gray-400 uppercase">
                    Format: [AA-XXXXXXXX] • ALPHA-NUMERIC
                  </p>
                  {scannerStatus === 'analyzing' && (
                    <span className="font-bold text-blue-500 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin"/> ANALYZING IMAGE...
                    </span>
                  )}
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-red-600 font-mono text-[10px] font-bold"
                  >
                    ! ERROR: {error}
                  </motion.p>
                )}
              </div>
            </div>


            <div className="space-y-6">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full geometric-btn flex items-center justify-center gap-3"
              >
                {loading ? 'Processing...' : 'Manifest Companion'}
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div className="trait-box">
                  <p className="label-micro mb-1">Trait: Origin</p>
                  <p className="text-sm font-bold uppercase">{pet ? pet.attributes.species : '---'}</p>
                </div>
                <div className="trait-box">
                  <p className="label-micro mb-1">Trait: Rarity</p>
                  <p className="text-sm font-bold uppercase tracking-tight">{pet ? getRarity(pet.code) : '---'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Side: Visualizer */}
          <section className="w-full lg:w-1/2 bg-[#fdfdfd] p-8 lg:p-12 flex flex-col items-center justify-center relative border-t-2 lg:border-t-0 border-black">
            <div className="absolute top-6 left-6 text-[10px] font-bold text-gray-300 uppercase font-mono tracking-widest">
              Visualizer-01 // Output
            </div>

            <AnimatePresence mode="wait">
              {!pet ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-[320px] h-[320px] bg-white border-4 border-black flex flex-col items-center justify-center text-center p-8"
                >
                  <div className="w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-4">
                    <Heart className="w-8 h-8 text-gray-200" />
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Awaiting Manifestation Seed
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="pet-display"
                  initial={{ rotate: -5, scale: 0.8, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  className="relative"
                >
                  <PetCanvas grid={pet.grid} attrs={pet.attributes} canvasRef={canvasRef} />

                  <div className="absolute -bottom-4 -right-4 bg-yellow-400 border-2 border-black px-4 py-2 font-bold text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    <span>SYNTH_V1.0.SEC</span>
                  </div>

                  <button
                    onClick={downloadPet}
                    className="absolute -top-4 -right-4 bg-white border-2 border-black p-2 hover:bg-gray-50 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-12 text-center max-w-[300px]">
              <h3 className="text-lg font-bold uppercase tracking-tighter font-sans">
                {pet ? (petName || pet.attributes.species) : 'NO_SUBJECT_LOADED'}
              </h3>
              <p className="text-[10px] text-gray-400 font-mono mb-2">
                {pet ? `UID: ${pet.code}` : ''}
              </p>
              <p className="text-sm text-gray-500 mt-3 italic leading-relaxed">
                {backstory || '"A digital companion forged from the specific identity code provided."'}
              </p>
            </div>
          </section>
        </main>

        <footer className="h-12 border-t-2 border-black flex items-center px-6 justify-between bg-white text-gray-500">
          <div className="flex gap-8">
            <span className="text-[10px] font-bold uppercase tracking-widest">Seed: {pet ? `0x${pet.code.split('-')[1]}` : 'NULL'}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Engine: Pro-Synth 4.2</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest">
            © 2026 PixelLab.Internal // Genesis
          </div>
        </footer>
      </motion.div>
          </div>
  );
}

function PetCanvas({ grid, attrs, canvasRef }: { grid: PixelData; attrs: PetAttributes; canvasRef: RefObject<HTMLCanvasElement | null> }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 16;
    const pixelSize = 20; // 320px
    canvas.width = size * pixelSize;
    canvas.height = size * pixelSize;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid pattern background
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 0.5;
    for(let i=0; i<=size; i++) {
      ctx.beginPath(); ctx.moveTo(i*pixelSize, 0); ctx.lineTo(i*pixelSize, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*pixelSize); ctx.lineTo(canvas.width, i*pixelSize); ctx.stroke();
    }

    // Draw Grid
    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);

          // Slight shading/border for each pixel for depth
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      });
    });
  }, [grid]);

  return (
    <div className="w-[320px] h-[320px] bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

function getRarity(code: string) {
  const sum = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  if (sum % 10 === 0) return 'LEGENDARY';
  if (sum % 7 === 0) return 'RARE';
  if (sum % 4 === 0) return 'UNCOMMON';
  return 'COMMON';
}
