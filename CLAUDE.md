# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pixel Pet Lab is a React + Vite application that generates unique procedural pixel art pets from alphanumeric codes (format: `AA-XXXXXXXX`). It uses Google Gemini to generate names and backstories for the procedurally created pets.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run lint       # TypeScript type checking (no emits)
npm run preview    # Preview production build
```

## Architecture

### Pet Generation Pipeline
1. User provides a code (manual entry, QR scan, or file upload)
2. `generatePetAttributes(code)` in `src/utils/petGenerator.ts` deterministically generates pet traits from the code using a seeded RNG (seedrandom)
3. `generatePixelMap(attrs)` renders the pet as a 16x16 pixel grid
4. `PetCanvas` component draws the grid to an HTML canvas with pixelated rendering
5. Gemini API generates a name and backstory based on the pet's attributes

### Key Files
- **`src/App.tsx`** - Main component: handles input, QR scanning, pet display, and trading card download
- **`src/utils/petGenerator.ts`** - Pure functions for deterministic pet generation: `generatePetAttributes()` and `generatePixelMap()`
- **`vite.config.ts`** - Vite config with `@tailwindcss/vite` plugin, path alias `@`, and `GEMINI_API_KEY` injection

### QR Scanning
Uses `html5-qrcode` library. Supports two modes:
- **Camera scanning** (`isScannerOpen` state) - Opens device camera via `Html5Qrcode.start()`
- **File scanning** (`handleFileScan`) - Scans a still image via `Html5Qrcode.scanFile()`

### Rarity System
Computed by `getRarity(code)` - sums character codes and checks modulo:
- `% 10 === 0` → LEGENDARY
- `% 7 === 0` → RARE
- `% 4 === 0` → UNCOMMON
- Otherwise → COMMON

### Environment Variables
- `GEMINI_API_KEY` - Required for backstory/name generation. Injected via `process.env.GEMINI_API_KEY` in vite.config.ts
- `.env.example` shows the required format

### Dependencies
- **React 19** + **Vite 6** - Frontend framework
- **Tailwind CSS 4** - Styling (via `@tailwindcss/vite`)
- **@google/genai** - Gemini API client
- **html5-qrcode** - QR code scanning
- **canvas-confetti** - Confetti animation on pet generation
- **motion** - Animations (AnimatePresence, motion components)
- **lucide-react** - Icons
- **seedrandom** - Deterministic RNG for pet generation
