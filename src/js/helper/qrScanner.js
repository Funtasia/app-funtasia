import { Html5Qrcode } from "html5-qrcode";
import { CONFIG } from "@/src/js/base/config";

let html5QrCode = null;
let torchOn = false;
let torchSupported = false;
let cachedCameraSetup = null;

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function getFlashIds(elementId) {
    const isQueue = elementId === "queue_qrcode_scanner";
    return {
        btnId:  isQueue ? 'queue-qr-flash-btn'  : 'qr-flash-btn',
        iconId: isQueue ? 'queue-qr-flash-icon' : 'qr-flash-icon',
    };
}

function updateTorchUI(btnEl, iconEl, isOn) {
    if (iconEl) iconEl.textContent = isOn ? 'flashlight_on' : 'flashlight_off';
    if (btnEl)  btnEl.style.background = isOn ? CONFIG.QRSCANNER.torchOnColor : CONFIG.QRSCANNER.torchOffColor;
}

// ── iOS helpers ───────────────────────────────────────────────────────────────

function parseIOSVersion() {
    const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
    return m ? { major: parseInt(m[1]), minor: parseInt(m[2]) } : null;
}

function hasStaleSettingsBug() {
    const v = parseIOSVersion();
    return v && ((v.major === 17 && v.minor >= 2) || (v.major === 18 && v.minor <= 3));
}

function iosSupportsTorch() {
    const v = parseIOSVersion();
    return !v || v.major > 17 || (v.major === 17 && v.minor >= 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera scoring
// Determines iteration order and hard-rejects selfie cameras before any
// stream is opened. Lower score = tried first.
//
// iOS labels:  "Back Camera", "Back Dual Camera", "Back Triple Camera"  → 0
//              "Back Ultra Wide Camera"                                  → 2
//              "Front Camera"                                            → 99 (rejected)
//
// Android:     "camera2 0, facing back"                                  → 0
//              "camera2 N, facing back" (N > 0)                          → 2
//              "camera2 N, facing front"                                  → 99 (rejected)
// ─────────────────────────────────────────────────────────────────────────────

function scoreCamera(label) {
    const l = (label || '').toLowerCase();

    // Hard-reject front/selfie cameras by label
    if (l.includes('front') || l.includes('user')) return 99;

    // iOS main rear cameras (torch-capable)
    if (l === 'back camera' || l.includes('back dual') || l.includes('back triple') || l.match(/camera2 0,\s*facing back/)) return 0;

    // Generic rear
    if (l.includes('back') || l.includes('rear') || l.includes('environment')) return 1;

    // Secondary rear lenses — unlikely to have torch
    if (l.includes('ultra wide') || l.includes('ultrawide') || l.includes('telephoto') || l.match(/camera2 [^0],\s*facing back/)) return 2;

    return 3; // Unknown — try last
}

// ── findBestCamera ────────────────────────────────────────────────────────────

async function findBestCamera() {
    if (cachedCameraSetup) return cachedCameraSetup;
    try {
        // Request base permission so labels are populated
        await navigator.mediaDevices.getUserMedia({ video: true })
            .then(s => s.getTracks().forEach(t => t.stop()))
            .catch(() => {});

        const devices = await navigator.mediaDevices.enumerateDevices();
        const candidates = devices
            .filter(d => d.kind === 'videoinput')
            .map(d => ({ deviceId: d.deviceId, label: d.label }))
            .filter(d => scoreCamera(d.label) < 99)
            .sort((a, b) => scoreCamera(a.label) - scoreCamera(b.label));

        if (!candidates.length) return null;

        const testVideo = Object.assign(document.createElement('video'), { muted: true, playsInline: true });
        let bestCameraId = null;        // torch-capable secondary lens
        let firstVerifiedRearId = null; // first confirmed-rear camera (with or without torch)
        const oldIOS = !iosSupportsTorch();

        for (const device of candidates) {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: device.deviceId } }
                });
            } catch (err) {
                console.warn('[Camera] Could not open:', device.label, err.name);
                continue;
            }

            const track = stream.getVideoTracks()[0];

            // Hard-reject if facingMode confirms it's the selfie camera.
            if (track.getSettings().facingMode === 'user') { 
                track.stop();
                continue;
            }

            // Confirmed rear (or unknown facing — treat as rear)
            if (!firstVerifiedRearId) firstVerifiedRearId = device.deviceId;

            if (oldIOS) {
                track.stop();
                cachedCameraSetup = { deviceId: device.deviceId, hasTorch: false };
                return cachedCameraSetup;
            }

            testVideo.srcObject = stream;
            await testVideo.play().catch(() => {});
            await new Promise(r => setTimeout(r, 400));

            const caps = track.getCapabilities?.() ?? {};
            let isTorchSupported = caps.torch === true;
            if (!isTorchSupported) {
                try { 
                    await track.applyConstraints({ advanced: [{ torch: false }] });
                    isTorchSupported = true;
                } catch {
                    isTorchSupported = false;
                }
            }
            track.stop();

            if (isTorchSupported) {
                const l = device.label.toLowerCase();
                if (l.includes('ultrawide') || l.includes('ultra wide') || l.includes('telephoto')) {
                    if (!bestCameraId) bestCameraId = device.deviceId;
                } else {
                    cachedCameraSetup = { deviceId: device.deviceId, hasTorch: true };
                    return cachedCameraSetup;
                }
            }
        }

        cachedCameraSetup = { deviceId: bestCameraId || firstVerifiedRearId || null, hasTorch: !!bestCameraId };
        return cachedCameraSetup;

    } catch {
        return null;
    }
}

// ── startScanner ──────────────────────────────────────────────────────────────

export async function startScanner(successCallback, elementId = "qrcode_scanner") {
    if (html5QrCode?.isScanning) return;

    if (html5QrCode) { 
        try { html5QrCode.clear(); } catch {} 
    }
    html5QrCode = new Html5Qrcode(elementId);
    if (html5QrCode.isScanning) return;

    const { btnId, iconId } = getFlashIds(elementId);
    const qrFlashBtn = document.getElementById(btnId);

    if (qrFlashBtn) {
        qrFlashBtn.innerHTML = `<span class="material-symbols-outlined text-[20px] animate-spin">hourglass_empty</span> Finding camera...`;
        qrFlashBtn.disabled = true;
    }

    const bestCamera = await findBestCamera();
    const startConfig = bestCamera?.deviceId ? { deviceId: { exact: bestCamera.deviceId } } 
                                             : { facingMode: { ideal: 'environment' } };
    torchSupported = bestCamera?.hasTorch ?? false;

    if (qrFlashBtn) {
        if (!torchSupported) {
            Object.assign(qrFlashBtn, { innerHTML: "Flash is unavailable", disabled: true });
            Object.assign(qrFlashBtn.style, { background: "transparent", border: "none", cursor: "default", fontSize: "12px", padding: "8px" });
        } else {
            qrFlashBtn.disabled = false;
            qrFlashBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]" id="${iconId}">flashlight_off</span> Toggle Flash`;
        }
    }

    try {
        await html5QrCode.start(
            startConfig,
            { fps: 120, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 },
            (text, result) => successCallback(text, result)
        );

        const videoEl = document.querySelector(`#${elementId} video`);
        const track = videoEl?.srcObject?.getVideoTracks()[0];
        if (track) {
            torchOn = hasStaleSettingsBug() ? false : (track.getSettings().torch ?? false);
            if (torchOn && torchSupported) updateTorchUI(qrFlashBtn, document.getElementById(iconId), true);
            track.addEventListener('mute', () => {
                torchOn = false;
                if (torchSupported) updateTorchUI(qrFlashBtn, document.getElementById(iconId), false);
            });
        }

        document.getElementById('qr-error-msg')?.remove();

    } catch (err) {
        console.error("Failed to start QR scanner:", err);
        let errorMsg = document.getElementById('qr-error-msg');
        if (!errorMsg) {
            errorMsg = document.createElement('p');
            errorMsg.id = 'qr-error-msg';
            Object.assign(errorMsg.style, { color: '#ff6b6b', fontSize: '12px', marginTop: '12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" });
            const parent = qrFlashBtn?.parentNode ?? document.getElementById(elementId)?.parentNode;
            parent?.appendChild(errorMsg);
        }
        errorMsg.textContent = "Camera not discoverable. Please use text input mode.";
    }
}

// ── stopScanner ───────────────────────────────────────────────────────────────

export async function stopScanner(elementId = "qrcode_scanner") {
    if (html5QrCode?.isScanning) {
        try {
            const track = document.querySelector(`#${elementId} video`)?.srcObject?.getVideoTracks()[0];
            if (track && torchSupported && torchOn) await track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (err) {
            console.error("Failed to stop QR scanner:", err);
        }
    }

    torchOn = false;
    const { btnId, iconId } = getFlashIds(elementId);
    const btn  = document.getElementById(btnId);
    const icon = document.getElementById(iconId);
    if (btn && torchSupported) updateTorchUI(btn, icon, false);

    const scannerDiv = document.getElementById(elementId);
    if (scannerDiv && !scannerDiv.innerHTML.includes('qr_code_scanner')) {
        scannerDiv.innerHTML = '<span class="material-symbols-outlined" style="font-size: 48px; color: var(--color-ctp-subtext1); opacity: 0.4;">qr_code_scanner</span>';
    }
}

// ── toggleTorch ───────────────────────────────────────────────────────────────

export async function toggleTorch(buttonElement, elementId = "qrcode_scanner") {
    if (!html5QrCode?.isScanning || !torchSupported) {
        console.warn("Scanner is not running or torch unsupported. Cannot toggle torch.");
        return;
    }

    const { iconId } = getFlashIds(elementId);
    const videoEl    = document.querySelector(`#${elementId} video`);
    const track      = videoEl?.srcObject?.getVideoTracks()[0];
    if (!track) return;

    const nextOn = !torchOn;
    try {
        await track.applyConstraints({ advanced: [{ torch: nextOn }] });
        torchOn = nextOn;
        updateTorchUI(buttonElement, document.getElementById(iconId), torchOn);

        if (!hasStaleSettingsBug()) {
            setTimeout(() => {
                const actual = track.getSettings().torch;
                if (actual !== undefined && actual !== torchOn) console.warn(`Torch state drifted from expectation.`);
            }, 100);
        }
    } catch (err) {
        console.error("Failed to toggle torch:", err.name, err.message);
    }
}
