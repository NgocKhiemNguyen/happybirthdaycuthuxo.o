const bouquet = document.querySelector('#bouquet');
const canvas = document.querySelector('#flowerCanvas');
const context = canvas.getContext('2d');
const bloomHint = document.querySelector('#bloomHint');
const revealHint = document.querySelector('#revealHint');
const letterScene = document.querySelector('#letterScene');
const bgMusic = document.querySelector('#bgMusic');
if (bgMusic) bgMusic.volume = 0.22;
const floatingNotesContainer = document.querySelector('#floatingNotes');
const spotifyPlayBtn = document.querySelector('#spotifyPlayBtn');
const spotifyWidget = document.querySelector('#spotifyWidget');
const musicStatus = document.querySelector('#musicStatus');
const playSvg = document.querySelector('.play-svg');
const pauseSvg = document.querySelector('.pause-svg');

const flowerFiles = [
    '—Pngtree—a beautiful white lily flower_20145563.png',
    '—Pngtree—closeup of a daisy flower_19459192.png',
    '—Pngtree—pink and white lily flower_15452237.png',
    '—Pngtree—pink lily flower with dew_24103868.png',
    '—Pngtree—pink rose free png_13343562.png',
    '—Pngtree—sunflower blooming flower flower_6342828.png',
    '—Pngtree—red rose love blooming transparent_9068483.png'
];

const images = [];
const preparedImages = [];
let loadedImageCount = 0;

const flowers = [];
let dpr = 1;
let width = 0;
let height = 0;
let animationId = 0;
let animationStart = 0;
let bloomRequested = false;
let bloomDuration = 0;

// Trạng thái: 'IDLE' -> 'BLOOMING' -> 'READY_TO_REVEAL' -> 'REVEALED'
let appState = 'IDLE';
let isFadingOut = false;
let fadeOutStart = 0;

let isMusicPlaying = false;
let notesInterval = 0;

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function easeOut(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return 1 - Math.pow(1 - clamped, 5);
}

/* ==========================================================================
   1. CACHE ẢNH HOA & TỐI ƯU HIỆU NĂNG CANVAS
   ========================================================================== */
function prepareImage(image) {
    if (!image.naturalWidth || !image.naturalHeight) return null;
    const ratio = image.naturalHeight / image.naturalWidth;

    const maxDimLarge = 800;
    const wLarge = Math.min(image.naturalWidth, maxDimLarge);
    const hLarge = Math.max(1, Math.round(wLarge * ratio));
    const canvasLarge = document.createElement('canvas');
    canvasLarge.width = wLarge;
    canvasLarge.height = hLarge;
    const ctxLarge = canvasLarge.getContext('2d');
    ctxLarge.imageSmoothingEnabled = true;
    ctxLarge.imageSmoothingQuality = 'high';
    ctxLarge.drawImage(image, 0, 0, wLarge, hLarge);

    const maxDimSmall = 180;
    const wSmall = Math.min(wLarge, maxDimSmall);
    const hSmall = Math.max(1, Math.round(wSmall * ratio));
    const canvasSmall = document.createElement('canvas');
    canvasSmall.width = wSmall;
    canvasSmall.height = hSmall;
    const ctxSmall = canvasSmall.getContext('2d');
    ctxSmall.imageSmoothingEnabled = true;
    ctxSmall.imageSmoothingQuality = 'high';
    ctxSmall.drawImage(canvasLarge, 0, 0, wSmall, hSmall);

    return {
        ratio,
        canvasLarge,
        canvasSmall
    };
}

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    buildFlowers();
    drawIdleFrame();
}

function buildFlowers() {
    flowers.length = 0;
    bloomDuration = 0;
    const minDim = Math.min(width, height);
    const ringSpacing = Math.max(100, minDim * 0.12);
    const arcSpacing = Math.max(120, minDim * 0.14);
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.hypot(width, height) / 2 + ringSpacing * 1.5;
    let imageIndex = 0;

    for (let radius = 0; radius <= outerRadius; radius += ringSpacing) {
        const count = radius === 0 ? 1 : Math.max(6, Math.ceil((Math.PI * 2 * radius) / arcSpacing));
        const ringDelay = (radius / outerRadius) * 1.7;
        const ringRotation = randomBetween(0, Math.PI * 2);

        for (let index = 0; index < count; index += 1) {
            const angle = ringRotation + (index / count) * Math.PI * 2 + randomBetween(-0.1, 0.1);
            const targetX = radius === 0 ? centerX : centerX + Math.cos(angle) * radius + randomBetween(-15, 15);
            const targetY = radius === 0 ? centerY : centerY + Math.sin(angle) * radius + randomBetween(-15, 15);
            const delay = ringDelay + randomBetween(-0.08, 0.08);
            flowers.push({
                imageIndex: imageIndex % flowerFiles.length,
                targetX,
                targetY,
                delay,
                size: randomBetween(ringSpacing * 2.5, ringSpacing * 3.0),
                rotation: randomBetween(-0.45, 0.45),
                spinSpeed: randomBetween(-0.18, 0.18)
            });
            bloomDuration = Math.max(bloomDuration, delay + 1.2);
            imageIndex += 1;
        }
    }
}

function drawFlower(flower, progress, elapsed, globalFadeAlpha = 1) {
    if (progress <= 0) return;

    const prep = preparedImages[flower.imageIndex];
    if (!prep) return;

    const scale = easeOut(progress);
    if (scale <= 0.002) return;

    const size = flower.size * scale;
    const pixelSize = size * dpr;
    if (pixelSize <= 0.5) return;

    const angle = flower.rotation + flower.spinSpeed * elapsed;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const ratio = prep.ratio;
    const x = (width * 0.5 + (flower.targetX - width * 0.5) * scale) * dpr;
    const y = (height * 0.5 + (flower.targetY - height * 0.5) * scale) * dpr;

    context.setTransform(
        cosine * pixelSize,
        sine * pixelSize, -sine * pixelSize * ratio,
        cosine * pixelSize * ratio,
        x,
        y
    );
    context.globalAlpha = scale * globalFadeAlpha;
    const source = pixelSize < 160 ? prep.canvasSmall : prep.canvasLarge;
    context.drawImage(source, -0.5, -0.5, 1, 1);
}

function drawIdleFrame() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = '#f5edf1';
    context.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFrame(now) {
    const elapsed = (now - animationStart) / 1000;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.fillStyle = '#f5edf1';
    context.fillRect(0, 0, canvas.width, canvas.height);

    let fadeAlpha = 1;
    if (isFadingOut) {
        const fadeElapsed = (now - fadeOutStart) / 1800;
        fadeAlpha = Math.max(0, 1 - fadeElapsed);
        if (fadeElapsed >= 1) {
            isFadingOut = false;
            cancelAnimationFrame(animationId);
            bouquet.classList.add('hidden');
            return;
        }
    }

    const len = flowers.length;
    for (let i = 0; i < len; i++) {
        const flower = flowers[i];
        const progress = (elapsed - flower.delay) / 1.2;
        drawFlower(flower, progress, elapsed, fadeAlpha);
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;

    if (elapsed >= bloomDuration && appState === 'BLOOMING') {
        appState = 'READY_TO_REVEAL';
        revealHint.style.display = 'block';
        requestAnimationFrame(() => {
            revealHint.classList.add('show');
        });
    }

    animationId = requestAnimationFrame(drawFrame);
}

function startBloom(startMusic = true) {
    if (appState !== 'IDLE') return;
    bloomRequested = true;
    bouquet.classList.add('open');
    if (startMusic) startMusicPlayback();
    if (loadedImageCount < flowerFiles.length) return;
    bloomRequested = false;
    cancelAnimationFrame(animationId);
    appState = 'BLOOMING';
    animationStart = performance.now();
    animationId = requestAnimationFrame(drawFrame);
}

/* ==========================================================================
   2. BẤM THÊM 1 LẦN NỮA: HOA BIẾN MẤT & HIỆN LÁ THƯ + VƯỜN HOA LY
   ========================================================================== */
function triggerReveal() {
    if (appState !== 'READY_TO_REVEAL') return;
    appState = 'REVEALED';

    // 1. Ẩn hint Tap to reveal
    revealHint.classList.remove('show');
    setTimeout(() => {
        revealHint.style.display = 'none';
    }, 600);

    // 2. Chuyển background tổng thể trang web sang tone pastel lãng mạn
    document.body.classList.add('reveal-mode');

    // 3. Cho hoa ban đầu dần dần biến mất (fade out mượt mà)
    isFadingOut = true;
    fadeOutStart = performance.now();
    bouquet.classList.add('fading');

    // 4. Hiển thị phân cảnh Lá thư & Vườn hoa ly sống động
    letterScene.classList.remove('hidden');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            letterScene.classList.add('visible');
            initGardenCanvas();
        });
    });
}

/* ==========================================================================
   3. TỰ ĐỘNG TÁCH NỀN LÁ THƯ (CHỈ GIỮ LẠI LÁ THƯ TRONG SUỐT)
   ========================================================================== */
function processTransparentLetter() {
    const letterImgEl = document.querySelector('#letterImg');
    const sourceImg = new Image();
    sourceImg.src = './Picture/letter.png';

    sourceImg.onload = () => {
        try {
            const w = sourceImg.naturalWidth;
            const h = sourceImg.naturalHeight;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            tempCtx.drawImage(sourceImg, 0, 0);

            const imgData = tempCtx.getImageData(0, 0, w, h);
            const data = imgData.data;

            const sIdx = ((5 * w) + (w - 6)) * 4;
            const bgR = data[sIdx];
            const bgG = data[sIdx + 1];
            const bgB = data[sIdx + 2];

            const visited = new Uint8Array(w * h);
            const queue = new Int32Array(w * h);
            let head = 0;
            let tail = 0;

            function colorDist(idx) {
                const dr = data[idx] - bgR;
                const dg = data[idx + 1] - bgG;
                const db = data[idx + 2] - bgB;
                return Math.sqrt(dr * dr + dg * dg + db * db);
            }

            const threshold = 48;

            for (let x = 0; x < w; x++) {
                const topIdx = x;
                if (colorDist(topIdx * 4) < threshold) {
                    visited[topIdx] = 1;
                    queue[tail++] = topIdx;
                }
                const btmIdx = (h - 1) * w + x;
                if (colorDist(btmIdx * 4) < threshold) {
                    visited[btmIdx] = 1;
                    queue[tail++] = btmIdx;
                }
            }
            for (let y = 0; y < h; y++) {
                const leftIdx = y * w;
                if (!visited[leftIdx] && colorDist(leftIdx * 4) < threshold) {
                    visited[leftIdx] = 1;
                    queue[tail++] = leftIdx;
                }
                const rightIdx = y * w + (w - 1);
                if (!visited[rightIdx] && colorDist(rightIdx * 4) < threshold) {
                    visited[rightIdx] = 1;
                    queue[tail++] = rightIdx;
                }
            }

            while (head < tail) {
                const curr = queue[head++];
                const cx = curr % w;
                const cy = (curr / w) | 0;

                data[curr * 4 + 3] = 0;

                if (cx > 0) {
                    const next = curr - 1;
                    if (!visited[next] && colorDist(next * 4) < threshold) {
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
                if (cx < w - 1) {
                    const next = curr + 1;
                    if (!visited[next] && colorDist(next * 4) < threshold) {
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
                if (cy > 0) {
                    const next = curr - w;
                    if (!visited[next] && colorDist(next * 4) < threshold) {
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
                if (cy < h - 1) {
                    const next = curr + w;
                    if (!visited[next] && colorDist(next * 4) < threshold) {
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
            }

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    if (visited[idx]) continue;
                    const isEdge = visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
                    if (isEdge) {
                        const dist = colorDist(idx * 4);
                        if (dist < threshold + 25) {
                            const factor = Math.max(0, Math.min(1, (dist - (threshold - 10)) / 35));
                            data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * factor);
                        }
                    }
                }
            }

            tempCtx.putImageData(imgData, 0, 0);
            letterImgEl.src = tempCanvas.toDataURL('image/png');
        } catch (e) {
            console.error('Dùng ảnh gốc cho lá thư:', e);
            letterImgEl.src = './Picture/letter.png';
        }
    };
    sourceImg.onerror = () => {
        console.error('Không tìm thấy Picture/letter.png');
    };
}

/* ==========================================================================
   4. HIỆU ỨNG ÁNH NẮNG, ĐOM ĐÓM VÀ CÁNH HOA CHO CẢNH LÁ THƯ
   ========================================================================== */
let gardenCanvasId = 0;
let crittersStarted = false;
let critterAnimationId = 0;
let critterPlayUntil = 0;
const gardenPetals = [];
const gardenFireflies = [];

function startMeadowCritters() {
    const container = document.querySelector('#meadowCritters');
    if (!container || crittersStarted) return;
    crittersStarted = true;
    const animalSketches = [
        {
            name: 'Thỏ',
            motion: 'rabbit',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="28" ry="4" fill="#24351f" opacity=".22"/><path d="M38 31C27 5 37 1 44 10l8 22m8 0C67 5 77 7 72 18l-5 16" fill="#f5eade" stroke="#69564a" stroke-width="2.5" stroke-linejoin="round"/><path d="M39 11q7 3 11 18m18-12q-5 4-8 15" fill="none" stroke="#e9a9ad" stroke-width="3" stroke-linecap="round"/><ellipse cx="50" cy="51" rx="27" ry="16" fill="#efe4d7" stroke="#69564a" stroke-width="2.5"/><circle cx="50" cy="40" r="19" fill="#f5eade" stroke="#69564a" stroke-width="2.5"/><circle cx="43" cy="40" r="2.3" fill="#342b29"/><circle cx="57" cy="40" r="2.3" fill="#342b29"/><ellipse cx="50" cy="47" rx="5" ry="3.5" fill="#e9a9ad"/><path d="M45 51q5 5 10 0" fill="none" stroke="#69564a" stroke-width="1.8" stroke-linecap="round"/><circle cx="38" cy="46" r="4" fill="#e8b7b4" opacity=".75"/><circle cx="62" cy="46" r="4" fill="#e8b7b4" opacity=".75"/><path d="M34 61v3m32-3v3" stroke="#69564a" stroke-width="3" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Cáo',
            motion: 'fox',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="30" ry="4" fill="#24351f" opacity=".22"/><path d="M33 34 28 9l20 16m24 9 20-25-5 27" fill="#ef9855" stroke="#694536" stroke-width="2.5" stroke-linejoin="round"/><path d="m34 17 12 10m35-8L70 29" stroke="#fff0dc" stroke-width="4" stroke-linecap="round"/><ellipse cx="50" cy="52" rx="27" ry="14" fill="#ef9550" stroke="#694536" stroke-width="2.5"/><circle cx="50" cy="40" r="20" fill="#ef9855" stroke="#694536" stroke-width="2.5"/><path d="M32 43q-18 1-18 12 10 8 24 1m30-13q18 1 18 12-10 8-24 1" fill="#e78344" stroke="#694536" stroke-width="2.5"/><path d="M38 45q6-6 12 0-1 8-6 9-5-1-6-9m12 0q6-6 12 0-1 8-6 9-5-1-6-9" fill="#fff0dc"/><circle cx="45" cy="46" r="2.2" fill="#342b29"/><circle cx="55" cy="46" r="2.2" fill="#342b29"/><ellipse cx="50" cy="54" rx="3" ry="2.2" fill="#694536"/><path d="M45 58q5 4 10 0" fill="none" stroke="#694536" stroke-width="1.8" stroke-linecap="round"/><path d="M34 61v3m32-3v3" stroke="#694536" stroke-width="3" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Nhím',
            motion: 'hedgehog',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="29" ry="4" fill="#24351f" opacity=".22"/><path d="M18 43 22 29 34 32 36 15 47 27 54 10 61 27 73 15 74 32 87 28 82 45 76 52H24z" fill="#80513d" stroke="#563a30" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="50" cy="51" rx="27" ry="14" fill="#bd805f" stroke="#674b3d" stroke-width="2.5"/><ellipse cx="50" cy="43" rx="21" ry="17" fill="#d29a74" stroke="#674b3d" stroke-width="2.5"/><circle cx="43" cy="41" r="2.2" fill="#342b29"/><circle cx="57" cy="41" r="2.2" fill="#342b29"/><ellipse cx="50" cy="48" rx="7" ry="5" fill="#f4d9b9"/><ellipse cx="50" cy="46" rx="2.8" ry="2" fill="#59433a"/><path d="M46 51q4 3 8 0" fill="none" stroke="#674b3d" stroke-width="1.6" stroke-linecap="round"/><path d="M36 60v3m28-3v3" stroke="#674b3d" stroke-width="3" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Hươu',
            motion: 'deer',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="29" ry="4" fill="#24351f" opacity=".22"/><path d="M35 34 26 17 24 6 35 14 41 8 46 31m19 3 9-17 2-11-11 8-6-6-5 29" fill="none" stroke="#70553a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 45q-11-10-16-1-1 9 11 11m45-10q11-10 16-1 1 9-11 11" fill="#dca96b" stroke="#70553a" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="50" cy="49" rx="24" ry="16" fill="#dca96b" stroke="#70553a" stroke-width="2.5"/><circle cx="50" cy="41" r="19" fill="#e5b877" stroke="#70553a" stroke-width="2.5"/><circle cx="43" cy="40" r="2.2" fill="#342b29"/><circle cx="57" cy="40" r="2.2" fill="#342b29"/><ellipse cx="50" cy="48" rx="9" ry="6" fill="#f7e7cb"/><ellipse cx="50" cy="46" rx="2.5" ry="2" fill="#765044"/><path d="M46 51q4 3 8 0" fill="none" stroke="#70553a" stroke-width="1.7" stroke-linecap="round"/><circle cx="38" cy="49" r="2" fill="#fff0cf"/><circle cx="62" cy="49" r="2" fill="#fff0cf"/><path d="M37 60v3m26-3v3" stroke="#70553a" stroke-width="3" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Ếch',
            motion: 'frog',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="64" rx="29" ry="4" fill="#24351f" opacity=".24"/><ellipse cx="50" cy="49" rx="27" ry="14" fill="#9fc978" stroke="#506d4a" stroke-width="2.5"/><circle cx="39" cy="34" r="10" fill="#acd486" stroke="#506d4a" stroke-width="2.5"/><circle cx="61" cy="34" r="10" fill="#acd486" stroke="#506d4a" stroke-width="2.5"/><ellipse cx="40" cy="34" rx="5" ry="6" fill="#fffdf0"/><ellipse cx="60" cy="34" rx="5" ry="6" fill="#fffdf0"/><circle cx="41" cy="35" r="2.4" fill="#344331"/><circle cx="59" cy="35" r="2.4" fill="#344331"/><ellipse cx="50" cy="49" rx="8" ry="5" fill="#c8e39e"/><path d="M43 51q7 6 14 0" fill="none" stroke="#506d4a" stroke-width="2" stroke-linecap="round"/><path d="M31 56q-8 3-8 8m46-8q8 3 8 8" fill="none" stroke="#506d4a" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="46" r="3" fill="#e99b9b" opacity=".7"/><circle cx="68" cy="46" r="3" fill="#e99b9b" opacity=".7"/></svg>'
        },
        {
            name: 'Mèo',
            motion: 'cat',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="29" ry="4" fill="#24351f" opacity=".22"/><path class="critter-tail" d="M28 55C12 52 11 38 20 34c8-4 15 3 11 9" fill="none" stroke="#705746" stroke-width="5" stroke-linecap="round"/><path d="M30 34 31 12 47 26m6 0 16-14 1 23" fill="#f3d4b1" stroke="#705746" stroke-width="2.5" stroke-linejoin="round"/><path d="m35 19 9 10m29-10-9 10" stroke="#e7a7a0" stroke-width="3" stroke-linecap="round"/><ellipse cx="50" cy="51" rx="27" ry="15" fill="#f3d4b1" stroke="#705746" stroke-width="2.5"/><circle cx="50" cy="41" r="19" fill="#f6dfc6" stroke="#705746" stroke-width="2.5"/><path d="M36 40q6-6 12 0m4 0q6-6 12 0" fill="none" stroke="#705746" stroke-width="2" stroke-linecap="round"/><circle cx="42" cy="40" r="2.2" fill="#342b29"/><circle cx="58" cy="40" r="2.2" fill="#342b29"/><path d="M47 48q3-3 6 0l-3 3z" fill="#d98d91"/><path d="M45 53q5 4 10 0" fill="none" stroke="#705746" stroke-width="1.8" stroke-linecap="round"/><path d="M35 60v3m30-3v3" stroke="#705746" stroke-width="3" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Vịt con',
            motion: 'duck',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="29" ry="4" fill="#24351f" opacity=".22"/><ellipse cx="50" cy="51" rx="28" ry="15" fill="#f5d977" stroke="#78623a" stroke-width="2.5"/><circle cx="50" cy="39" r="19" fill="#f8df7d" stroke="#78623a" stroke-width="2.5"/><path d="M36 25q-4-9 3-11 8-1 10 8m2 1q3-10 11-8 7 2 2 12" fill="#f8df7d" stroke="#78623a" stroke-width="2.5"/><circle cx="43" cy="38" r="2.3" fill="#342b29"/><circle cx="57" cy="38" r="2.3" fill="#342b29"/><path d="m44 45 6-3 6 3-6 5z" fill="#e99555" stroke="#78623a" stroke-width="1.5" stroke-linejoin="round"/><path d="M37 52q13 8 26 0" fill="none" stroke="#e5c65d" stroke-width="2"/><path d="M40 62v3m20-3v3" stroke="#78623a" stroke-width="3" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Sóc',
            motion: 'squirrel',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="28" ry="4" fill="#24351f" opacity=".22"/><path class="critter-tail" d="M32 52C10 57 10 33 21 23c11-10 24-3 21 8-1 7-7 10-13 7 5-8-1-14-8-9-6 5-4 15 11 16z" fill="#c77a47" stroke="#704a34" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="52" cy="51" rx="21" ry="13" fill="#d58a52" stroke="#704a34" stroke-width="2.5"/><path d="M34 35q-2-16 8-16 8 0 9 15m2 0q1-15 9-15 10 0 8 16" fill="#d58a52" stroke="#704a34" stroke-width="2.5"/><circle cx="50" cy="39" r="18" fill="#df995f" stroke="#704a34" stroke-width="2.5"/><circle cx="44" cy="38" r="2.2" fill="#342b29"/><circle cx="56" cy="38" r="2.2" fill="#342b29"/><ellipse cx="50" cy="45" rx="7" ry="5" fill="#f7e5ce"/><circle cx="50" cy="44" r="2" fill="#704a34"/><path d="M46 49q4 3 8 0" fill="none" stroke="#704a34" stroke-width="1.7" stroke-linecap="round"/><path d="M39 61v3m22-3v3" stroke="#704a34" stroke-width="3" stroke-linecap="round"/><path d="M42 49q8 5 16 0" fill="none" stroke="#f2c7a4" stroke-width="2.5"/></svg>'
        },
        {
            name: 'Gấu con',
            motion: 'bear',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="29" ry="4" fill="#24351f" opacity=".22"/><ellipse cx="50" cy="51" rx="27" ry="15" fill="#b98162" stroke="#654a3b" stroke-width="2.5"/><circle cx="36" cy="29" r="10" fill="#c99372" stroke="#654a3b" stroke-width="2.5"/><circle cx="64" cy="29" r="10" fill="#c99372" stroke="#654a3b" stroke-width="2.5"/><circle cx="36" cy="29" r="4.5" fill="#edc2a8"/><circle cx="64" cy="29" r="4.5" fill="#edc2a8"/><circle cx="50" cy="41" r="21" fill="#c99372" stroke="#654a3b" stroke-width="2.5"/><circle cx="43" cy="39" r="2.2" fill="#342b29"/><circle cx="57" cy="39" r="2.2" fill="#342b29"/><ellipse cx="50" cy="48" rx="9" ry="7" fill="#f1dfc9"/><ellipse cx="50" cy="45" rx="3" ry="2.2" fill="#49342d"/><path d="M46 51q4 3 8 0" fill="none" stroke="#654a3b" stroke-width="1.8" stroke-linecap="round"/><path d="M36 59v4m28-4v4" stroke="#654a3b" stroke-width="3" stroke-linecap="round"/><path class="critter-wave-paw" d="M29 50q-9-4-10-13" fill="none" stroke="#b98162" stroke-width="8" stroke-linecap="round"/></svg>'
        },
        {
            name: 'Chim non',
            motion: 'bird',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="27" ry="4" fill="#24351f" opacity=".22"/><ellipse cx="50" cy="49" rx="24" ry="16" fill="#9bb9d6" stroke="#53697c" stroke-width="2.5"/><circle cx="50" cy="37" r="18" fill="#a8c5df" stroke="#53697c" stroke-width="2.5"/><path class="critter-wing" d="M30 42q-7-17 7-18 11 4 9 21-8 7-16-3z" fill="#7fa4c7" stroke="#53697c" stroke-width="2"/><path class="critter-wing" d="M70 42q7-17-7-18-11 4-9 21 8 7 16-3z" fill="#7fa4c7" stroke="#53697c" stroke-width="2"/><circle cx="44" cy="36" r="2.2" fill="#342b29"/><circle cx="56" cy="36" r="2.2" fill="#342b29"/><path d="m44 44 6-3 6 3-6 4z" fill="#efad68" stroke="#76533b" stroke-width="1.5" stroke-linejoin="round"/><path d="M39 61v3m22-3v3" stroke="#53697c" stroke-width="3" stroke-linecap="round"/><path d="M44 51q6 4 12 0" fill="none" stroke="#d7e6f1" stroke-width="2"/></svg>'
        },
        {
            name: 'Bướm',
            motion: 'butterfly',
            svg: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="64" rx="19" ry="3" fill="#24351f" opacity=".18"/><path class="critter-wing critter-wing-left" d="M47 37C34 14 12 18 16 38c2 10 16 14 30 8-15 8-14 22-4 21 9-1 13-15 10-27z" fill="#ef9db8" stroke="#82506a" stroke-width="2.5"/><path class="critter-wing critter-wing-right" d="M53 37c13-23 35-19 31 1-2 10-16 14-30 8 15 8 14 22 4 21-9-1-13-15-10-27z" fill="#f5c879" stroke="#82506a" stroke-width="2.5"/><path d="M50 34v27" stroke="#63475a" stroke-width="4" stroke-linecap="round"/><path d="m49 35-6-8m8 8 6-8" fill="none" stroke="#63475a" stroke-width="2" stroke-linecap="round"/><circle cx="31" cy="36" r="3" fill="#fff2de"/><circle cx="69" cy="36" r="3" fill="#fff2de"/></svg>'
        }
    ];

    const sideProfileArt = {
        rabbit: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="31" ry="4" fill="#24351f" opacity=".22"/><circle cx="25" cy="45" r="9" fill="#fff8ed" stroke="#806858" stroke-width="2"/><ellipse cx="43" cy="50" rx="25" ry="14" fill="#eee0d2" stroke="#806858" stroke-width="2.5"/><path d="M53 36C48 17 49 4 56 4c7 0 9 16 8 30m3 2c4-18 12-26 17-21 5 5-3 18-9 25" fill="#f4e6d9" stroke="#806858" stroke-width="2.5" stroke-linejoin="round"/><path d="M55 10q7 5 7 20m17-9-8 15" fill="none" stroke="#e6a8ad" stroke-width="3" stroke-linecap="round"/><ellipse cx="64" cy="45" rx="18" ry="16" fill="#f5eade" stroke="#806858" stroke-width="2.5"/><circle cx="68" cy="41" r="2" fill="#332b29"/><circle cx="77" cy="43" r="1.4" fill="#332b29"/><ellipse cx="81" cy="50" rx="5" ry="3.5" fill="#fff9ef"/><circle cx="81" cy="49" r="1.5" fill="#d88d91"/><path d="M32 60v3m24-3v3" stroke="#806858" stroke-width="3" stroke-linecap="round"/></svg>',
        fox: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="32" ry="4" fill="#24351f" opacity=".22"/><path class="critter-tail" d="M37 48C21 35 8 40 11 53c3 12 17 12 28 3l-8-4c-5 3-10 1-10-3 0-4 5-5 10-2z" fill="#de8140" stroke="#704831" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="48" cy="50" rx="25" ry="13" fill="#e98d49" stroke="#704831" stroke-width="2.5"/><path d="M54 39c1-15 10-23 21-18 9 4 12 14 8 23l-7 9H57z" fill="#ed9852" stroke="#704831" stroke-width="2.5"/><path d="m61 27 3-17 13 12m4 4 13-13-4 23" fill="#ed9852" stroke="#704831" stroke-width="2.5" stroke-linejoin="round"/><path d="m66 17 7 8m14-6-6 10" stroke="#fff0dc" stroke-width="3" stroke-linecap="round"/><path d="M73 40q13-5 19 2-4 10-18 7l-9-4z" fill="#fff0dc"/><circle cx="72" cy="34" r="2.2" fill="#302823"/><circle cx="80" cy="37" r="1.4" fill="#302823"/><ellipse cx="90" cy="43" rx="2.8" ry="2" fill="#593b30"/><path d="M35 60v3m24-3v3" stroke="#704831" stroke-width="3" stroke-linecap="round"/></svg>',
        hedgehog: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="31" ry="4" fill="#24351f" opacity=".22"/><path d="M20 49 18 39l10 2-2-13 12 8 2-17 12 13 7-17 7 18 13-10-2 17 11-4-8 17-9 10H28z" fill="#79503e" stroke="#513b33" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="47" cy="51" rx="27" ry="14" fill="#b87c61" stroke="#674b3d" stroke-width="2.5"/><path d="M57 39c10-7 23-2 26 8-4 8-14 11-25 6l-9-7z" fill="#f1d9bd"/><circle cx="69" cy="42" r="2.1" fill="#302823"/><circle cx="78" cy="45" r="1.4" fill="#302823"/><ellipse cx="82" cy="49" rx="3" ry="2.3" fill="#51382f"/><path d="M35 60v3m21-3v3" stroke="#674b3d" stroke-width="3" stroke-linecap="round"/></svg>',
        deer: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="64" rx="30" ry="4" fill="#24351f" opacity=".22"/><path d="M35 37 28 22l-1-12 9 8 5-6 5 24m13 1 8-18 2-12 7 9 6-4-2 26" fill="none" stroke="#73553a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 43q-13-10-18-1-2 9 13 13" fill="#d7a363" stroke="#73553a" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="49" cy="51" rx="25" ry="13" fill="#d7a363" stroke="#73553a" stroke-width="2.5"/><path d="M54 39c2-13 12-19 22-13 8 5 9 15 4 23l-8 6H56z" fill="#e4b875" stroke="#73553a" stroke-width="2.5"/><path d="M74 45q11-5 17 2-4 8-16 6l-8-4z" fill="#f7e7cb"/><circle cx="72" cy="35" r="2.1" fill="#302823"/><circle cx="80" cy="38" r="1.4" fill="#302823"/><ellipse cx="89" cy="47" rx="2.7" ry="2" fill="#765044"/><circle cx="62" cy="46" r="2" fill="#fff0cf"/><circle cx="68" cy="49" r="2" fill="#fff0cf"/><path d="M37 60v3m22-3v3" stroke="#73553a" stroke-width="3" stroke-linecap="round"/></svg>',
        cat: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="30" ry="4" fill="#24351f" opacity=".22"/><path class="critter-tail" d="M33 53C15 53 13 39 22 34c7-4 14 2 11 8" fill="none" stroke="#806956" stroke-width="5" stroke-linecap="round"/><ellipse cx="46" cy="51" rx="26" ry="14" fill="#edcfaa" stroke="#806956" stroke-width="2.5"/><path d="M47 36 49 14l16 15m1 7 18-20-1 25" fill="#f2d8b9" stroke="#806956" stroke-width="2.5" stroke-linejoin="round"/><path d="m53 20 8 10m23-10-9 11" stroke="#db9da0" stroke-width="3" stroke-linecap="round"/><ellipse cx="65" cy="43" rx="19" ry="17" fill="#f5dfc6" stroke="#806956" stroke-width="2.5"/><path d="M69 41q4-4 8 0" fill="none" stroke="#806956" stroke-width="1.5"/><circle cx="70" cy="40" r="2" fill="#302823"/><circle cx="78" cy="42" r="1.4" fill="#302823"/><path d="M78 49q4-3 8 0l-4 4z" fill="#d98d91"/><path d="M78 54q4 3 8 0m-13-4-7-2m7 5-8 1" fill="none" stroke="#806956" stroke-width="1.4" stroke-linecap="round"/><path d="M34 60v3m24-3v3" stroke="#806956" stroke-width="3" stroke-linecap="round"/></svg>',
        duck: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="29" ry="4" fill="#24351f" opacity=".22"/><ellipse cx="43" cy="51" rx="27" ry="14" fill="#f1cf58" stroke="#80683d" stroke-width="2.5"/><path d="M50 42c-3-14 5-24 17-23 12 1 18 12 13 23l-8 9H53z" fill="#f5d96d" stroke="#80683d" stroke-width="2.5"/><path d="M41 46q12-11 22 2-9 12-21 4z" fill="#f8e9a5" stroke="#cfad45" stroke-width="2"/><circle cx="67" cy="32" r="2.2" fill="#302823"/><circle cx="75" cy="34" r="1.3" fill="#302823"/><path d="m78 39 14 4-14 4z" fill="#e78d4d" stroke="#80683d" stroke-width="1.8" stroke-linejoin="round"/><path d="M35 61v3m20-3v3" stroke="#80683d" stroke-width="3" stroke-linecap="round"/></svg>',
        squirrel: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="30" ry="4" fill="#24351f" opacity=".22"/><path class="critter-tail" d="M39 52C17 58 12 38 20 26c8-12 25-8 27 3 2 8-6 14-13 10 7-7 1-15-6-11-7 5-4 16 11 17z" fill="#c77a47" stroke="#704a34" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="51" cy="51" rx="22" ry="13" fill="#d58a52" stroke="#704a34" stroke-width="2.5"/><path d="M49 37q-2-15 8-16 8 0 9 15m2 1q2-14 10-12 8 2 5 16" fill="#d58a52" stroke="#704a34" stroke-width="2.5"/><ellipse cx="67" cy="39" rx="17" ry="16" fill="#df995f" stroke="#704a34" stroke-width="2.5"/><circle cx="70" cy="36" r="2.1" fill="#302823"/><circle cx="78" cy="39" r="1.4" fill="#302823"/><ellipse cx="80" cy="46" rx="5" ry="4" fill="#f7e5ce"/><circle cx="80" cy="45" r="1.7" fill="#704a34"/><path d="M40 60v3m22-3v3" stroke="#704a34" stroke-width="3" stroke-linecap="round"/></svg>',
        bear: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="64" rx="29" ry="4" fill="#24351f" opacity=".22"/><ellipse cx="45" cy="51" rx="26" ry="14" fill="#b98162" stroke="#654a3b" stroke-width="2.5"/><circle cx="55" cy="30" r="9" fill="#c99372" stroke="#654a3b" stroke-width="2.5"/><circle cx="76" cy="31" r="8" fill="#c99372" stroke="#654a3b" stroke-width="2.5"/><circle cx="55" cy="30" r="4" fill="#edc2a8"/><circle cx="76" cy="31" r="3.5" fill="#edc2a8"/><ellipse cx="68" cy="42" rx="19" ry="18" fill="#c99372" stroke="#654a3b" stroke-width="2.5"/><circle cx="71" cy="38" r="2.2" fill="#302823"/><circle cx="79" cy="41" r="1.4" fill="#302823"/><ellipse cx="83" cy="48" rx="7" ry="5" fill="#f1dfc9"/><ellipse cx="87" cy="46" rx="2.5" ry="2" fill="#49342d"/><path class="critter-wave-paw" d="M32 48q-9-4-11-14" fill="none" stroke="#b98162" stroke-width="8" stroke-linecap="round"/><path d="M37 60v3m22-3v3" stroke="#654a3b" stroke-width="3" stroke-linecap="round"/></svg>',
        bird: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="48" cy="64" rx="26" ry="4" fill="#24351f" opacity=".22"/><ellipse cx="46" cy="50" rx="25" ry="16" fill="#9bb9d6" stroke="#53697c" stroke-width="2.5"/><path class="critter-wing" d="M34 46q-3-17 11-19 13 8 5 23-8 6-16-4z" fill="#7fa4c7" stroke="#53697c" stroke-width="2"/><circle cx="64" cy="37" r="17" fill="#a8c5df" stroke="#53697c" stroke-width="2.5"/><circle cx="68" cy="34" r="2.2" fill="#302823"/><circle cx="76" cy="37" r="1.4" fill="#302823"/><path d="m79 40 13 4-13 4z" fill="#efad68" stroke="#76533b" stroke-width="1.5" stroke-linejoin="round"/><path d="M38 61v3m18-3v3" stroke="#53697c" stroke-width="3" stroke-linecap="round"/></svg>',
        butterfly: '<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="64" rx="18" ry="3" fill="#24351f" opacity=".18"/><path class="critter-wing critter-wing-left" d="M47 39C34 14 12 18 16 38c2 10 16 14 30 8-15 8-14 22-4 21 9-1 13-15 10-27z" fill="#ef9db8" stroke="#82506a" stroke-width="2.5"/><path class="critter-wing critter-wing-right" d="M53 39c13-23 35-19 31 1-2 10-16 14-30 8 15 8 14 22 4 21-9-1-13-15-10-27z" fill="#f5c879" stroke="#82506a" stroke-width="2.5"/><path d="M50 34v27m-1-27-6-8m8 8 6-8" fill="none" stroke="#63475a" stroke-width="3" stroke-linecap="round"/><circle cx="31" cy="36" r="3" fill="#fff2de"/><circle cx="69" cy="36" r="3" fill="#fff2de"/></svg>'
    };

    const stickerAnimals = [
        {
            name: 'Vịt con',
            motion: 'chick',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="64" rx="22" ry="3" fill="#24351f" opacity=".2"/><path class="critter-leg leg-a" d="M36 53v7l-5 2" fill="none" stroke="#a86638" stroke-width="3" stroke-linecap="round"/><path class="critter-leg leg-b" d="M64 53v7l5 2" fill="none" stroke="#a86638" stroke-width="3" stroke-linecap="round"/><ellipse cx="51" cy="43" rx="27" ry="21" fill="#ffd958" stroke="#714a3b" stroke-width="2.5"/><circle cx="66" cy="24" r="15" fill="#ffe36b" stroke="#714a3b" stroke-width="2.5"/><path d="M57 12q2-8 7-6m5 6q7-7 9-2" fill="none" stroke="#714a3b" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="67" cy="26" rx="2.4" ry="3" fill="#382a29"/><ellipse cx="80" cy="30" rx="2" ry="2.5" fill="#382a29"/><path d="m81 34 12 4-12 4z" fill="#ee8a4a" stroke="#714a3b" stroke-width="1.8" stroke-linejoin="round"/><path d="M32 41q-13 4-9 14 10 4 20-4" fill="#f3c94b" stroke="#714a3b" stroke-width="2"/><circle cx="76" cy="34" r="3" fill="#f3a3a4" opacity=".75"/></svg>`
        },
        {
            name: 'Chuột',
            motion: 'mouse',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="64" rx="24" ry="3" fill="#24351f" opacity=".2"/><path class="critter-tail" d="M28 52C7 58 12 68 28 64" fill="none" stroke="#927f9d" stroke-width="2.5" stroke-linecap="round"/><path class="critter-leg leg-a" d="M39 56v7" stroke="#756780" stroke-width="3" stroke-linecap="round"/><path class="critter-leg leg-b" d="M59 56v7" stroke="#756780" stroke-width="3" stroke-linecap="round"/><ellipse cx="48" cy="48" rx="25" ry="15" fill="#b8a9c5" stroke="#594e65" stroke-width="2.5"/><circle cx="62" cy="34" r="15" fill="#c2b4ce" stroke="#594e65" stroke-width="2.5"/><circle cx="48" cy="22" r="12" fill="#b8a9c5" stroke="#594e65" stroke-width="2.5"/><circle cx="75" cy="22" r="12" fill="#b8a9c5" stroke="#594e65" stroke-width="2.5"/><circle cx="48" cy="22" r="7" fill="#f29db4"/><circle cx="75" cy="22" r="7" fill="#f29db4"/><ellipse cx="69" cy="42" rx="9" ry="6" fill="#e8dce8"/><circle cx="60" cy="33" r="2.4" fill="#302823"/><circle cx="68" cy="35" r="1.5" fill="#302823"/><ellipse cx="77" cy="42" rx="2.5" ry="2" fill="#493743"/><path d="M74 46q4 3 8 0" fill="none" stroke="#594e65" stroke-width="1.5"/><path d="M42 53q7 6 13 0" fill="none" stroke="#e9ddec" stroke-width="5" stroke-linecap="round"/></svg>`
        },
        {
            name: 'Cá voi',
            motion: 'whale',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="critter-tail" d="M78 47q14-2 14-13 7 5 4 13 2 7-5 11-2-7-13-6" fill="#5b9bd2" stroke="#55475a" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 49C14 28 32 17 54 19c19 2 29 13 28 28-1 12-14 17-36 16-20-1-32-5-32-14z" fill="#62a5dc" stroke="#55475a" stroke-width="2.5"/><path d="M17 49q-7 8 1 13 9 4 16-3" fill="#4b91c8" stroke="#55475a" stroke-width="2"/><path d="M30 56q18 8 41 1" fill="none" stroke="#d9efff" stroke-width="5" stroke-linecap="round"/><circle cx="27" cy="47" r="2.5" fill="#382b2a"/><path d="M15 16q-5-8 0-10m1 10q6-6 8-1" fill="none" stroke="#70a9d9" stroke-width="3" stroke-linecap="round"/><circle cx="37" cy="27" r="3" fill="#fff" opacity=".8"/></svg>`
        },
        {
            name: 'Bướm',
            motion: 'butterfly',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><g class="critter-wing critter-wing-left"><path d="M48 35C38 11 14 14 15 33c0 10 15 17 33 13-15 8-12 20-3 20 9 0 12-15 8-27z" fill="#ef91b2" stroke="#604653" stroke-width="2.5"/><circle cx="29" cy="32" r="4" fill="#ffdc75"/></g><g class="critter-wing critter-wing-right"><path d="M52 35c10-24 34-21 33-2 0 10-15 17-33 13 15 8 12 20 3 20-9 0-12-15-8-27z" fill="#74c8e7" stroke="#604653" stroke-width="2.5"/><circle cx="71" cy="32" r="4" fill="#ffdc75"/></g><path d="M50 34v28m-1-28-7-11m9 11 7-11" fill="none" stroke="#493b4d" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="35" r="3" fill="#ffe090"/></svg>`
        },
        {
            name: 'Rùa',
            motion: 'turtle',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="critter-leg leg-a" d="M34 51q-9 6-7 13 8 4 13-5" fill="#a5be72" stroke="#52634c" stroke-width="2.5"/><path class="critter-leg leg-b" d="M63 51q10 6 8 13-8 4-13-5" fill="#a5be72" stroke="#52634c" stroke-width="2.5"/><path d="M21 48q-8-2-9 4l11 4" fill="#a5be72" stroke="#52634c" stroke-width="2.5"/><ellipse cx="49" cy="43" rx="30" ry="20" fill="#56aa9c" stroke="#52634c" stroke-width="2.5"/><path d="M27 39q2-13 20-13 17 0 23 14-5 17-23 17-17 0-20-18z" fill="#71c4ae" stroke="#397c75" stroke-width="2"/><path d="M48 27v29m-19-16h40m-31-12 18 27m1-27L39 54" fill="none" stroke="#397c75" stroke-width="1.8"/><circle cx="78" cy="35" r="13" fill="#b4cc80" stroke="#52634c" stroke-width="2.5"/><circle cx="81" cy="33" r="2" fill="#302823"/><path d="M82 40q4 3 7 0" fill="none" stroke="#52634c" stroke-width="1.7"/></svg>`
        },
        {
            name: 'Thỏ',
            motion: 'rabbit',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="48" cy="65" rx="24" ry="3" fill="#24351f" opacity=".2"/><path class="critter-ear ear-a" d="M51 31C43 12 43 3 49 3c8 0 11 16 13 29" fill="#fff7ef" stroke="#6b5960" stroke-width="2.5"/><path class="critter-ear ear-b" d="M63 32C65 12 74 5 79 9c6 5-2 18-9 27" fill="#fff7ef" stroke="#6b5960" stroke-width="2.5"/><path d="M51 10q5 5 8 17m16-12-7 16" fill="none" stroke="#eea3b3" stroke-width="3"/><ellipse cx="43" cy="51" rx="24" ry="14" fill="#fffaf4" stroke="#6b5960" stroke-width="2.5"/><circle cx="61" cy="42" r="17" fill="#fffaf4" stroke="#6b5960" stroke-width="2.5"/><circle cx="66" cy="39" r="2.2" fill="#302823"/><ellipse cx="75" cy="47" rx="7" ry="4" fill="#fff" stroke="#6b5960" stroke-width="1.5"/><circle cx="74" cy="46" r="1.6" fill="#ec8e9f"/><circle cx="55" cy="48" r="4" fill="#f1b2bd" opacity=".7"/><path class="critter-leg leg-a" d="M34 60v4m23-4v4" stroke="#6b5960" stroke-width="3" stroke-linecap="round"/></svg>`
        },
        {
            name: 'Heo con',
            motion: 'pig',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="65" rx="28" ry="3" fill="#24351f" opacity=".2"/><path class="critter-leg leg-a" d="M32 55v8m17-8v8m17-8v8" stroke="#8c5960" stroke-width="4" stroke-linecap="round"/><ellipse cx="49" cy="47" rx="29" ry="17" fill="#f2aeb6" stroke="#81505b" stroke-width="2.5"/><circle cx="68" cy="35" r="17" fill="#f7bbc0" stroke="#81505b" stroke-width="2.5"/><path d="M55 24q-3-14 5-13 8 1 9 11m5 0q8-12 14-7 4 5-4 15" fill="#f7bbc0" stroke="#81505b" stroke-width="2.5"/><circle cx="63" cy="34" r="2" fill="#382b2a"/><circle cx="74" cy="34" r="2" fill="#382b2a"/><ellipse cx="79" cy="43" rx="9" ry="6" fill="#f5c4c4" stroke="#81505b" stroke-width="2"/><circle cx="76" cy="43" r="1.6" fill="#a96b76"/><circle cx="82" cy="43" r="1.6" fill="#a96b76"/><path d="M38 47q8 7 16 0" fill="none" stroke="#fbdde0" stroke-width="5" stroke-linecap="round"/></svg>`
        },
        {
            name: 'Chó con',
            motion: 'puppy',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="65" rx="29" ry="3" fill="#24351f" opacity=".2"/><path class="critter-tail" d="M27 45q-15-14-17-2 0 10 14 11" fill="none" stroke="#bd7b4c" stroke-width="6" stroke-linecap="round"/><path class="critter-leg leg-a" d="M34 54v9m20-9v9m18-9v9" stroke="#80573f" stroke-width="4" stroke-linecap="round"/><ellipse cx="49" cy="49" rx="28" ry="15" fill="#db9b67" stroke="#80573f" stroke-width="2.5"/><path d="M57 30q-4-9 3-12 8 0 11 12" fill="#db9b67" stroke="#80573f" stroke-width="2.5"/><path d="M73 29q16 0 17 14-2 10-12 8l-8-8z" fill="#c37e55" stroke="#80573f" stroke-width="2.5"/><circle cx="65" cy="36" r="2.2" fill="#302823"/><ellipse cx="76" cy="43" rx="9" ry="7" fill="#fff1dc"/><ellipse cx="82" cy="42" rx="2.4" ry="2" fill="#56382e"/><path d="M71 49q5 4 10 0" fill="none" stroke="#80573f" stroke-width="1.7"/></svg>`
        },
        {
            name: 'Sứa',
            motion: 'jellyfish',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="critter-tentacle tentacle-a" d="M27 47q-4 10 0 18m13-18q-4 11 1 18m14-18q-3 11 2 18m13-18q-2 10 3 17" fill="none" stroke="#67b7d2" stroke-width="5" stroke-linecap="round"/><path d="M19 43a31 27 0 0 1 62 0q-5 13-12 5-7 10-14 1-8 10-15 0-9 9-21-6z" fill="#f28aa3" stroke="#774e6b" stroke-width="2.5" stroke-linejoin="round"/><circle cx="40" cy="39" r="2.3" fill="#382b2a"/><circle cx="60" cy="39" r="2.3" fill="#382b2a"/><path d="M44 47q6 5 12 0" fill="none" stroke="#774e6b" stroke-width="1.8" stroke-linecap="round"/><circle cx="31" cy="43" r="3" fill="#ffd1d9"/><circle cx="69" cy="43" r="3" fill="#ffd1d9"/></svg>`
        },
        {
            name: 'Gấu trúc',
            motion: 'panda',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="50" cy="65" rx="28" ry="3" fill="#24351f" opacity=".2"/><path class="critter-leg leg-a" d="M34 56v7" stroke="#374353" stroke-width="8" stroke-linecap="round"/><path class="critter-leg leg-b" d="M65 56v7" stroke="#374353" stroke-width="8" stroke-linecap="round"/><ellipse cx="50" cy="49" rx="27" ry="16" fill="#fffaf1" stroke="#59616c" stroke-width="2.5"/><circle cx="50" cy="35" r="22" fill="#fffaf1" stroke="#59616c" stroke-width="2.5"/><circle cx="34" cy="18" r="8" fill="#384656"/><circle cx="66" cy="18" r="8" fill="#384656"/><ellipse cx="40" cy="35" rx="7" ry="10" transform="rotate(28 40 35)" fill="#384656"/><ellipse cx="60" cy="35" rx="7" ry="10" transform="rotate(-28 60 35)" fill="#384656"/><circle cx="41" cy="35" r="2.8" fill="#fff"/><circle cx="59" cy="35" r="2.8" fill="#fff"/><ellipse cx="50" cy="44" rx="8" ry="6" fill="#fff"/><ellipse cx="50" cy="42" rx="3" ry="2" fill="#3c3334"/><path d="M47 48q3 3 6 0" fill="none" stroke="#59616c" stroke-width="1.5"/></svg>`
        },
        {
            name: 'Cua',
            motion: 'crab',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="critter-leg leg-a" d="m33 50-9 9m18-7-5 11" stroke="#d96551" stroke-width="4" stroke-linecap="round"/><path class="critter-leg leg-b" d="m62 49 5 13m4-13 10 9" stroke="#d96551" stroke-width="4" stroke-linecap="round"/><ellipse cx="50" cy="46" rx="28" ry="18" fill="#f4775d" stroke="#713f43" stroke-width="2.5"/><path d="M31 35 25 23 18 20m51 15 6-12 7-3" fill="none" stroke="#713f43" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="19" r="7" fill="#f4775d" stroke="#713f43" stroke-width="2.5"/><circle cx="82" cy="19" r="7" fill="#f4775d" stroke="#713f43" stroke-width="2.5"/><path class="critter-claw" d="M14 16q-8-9-11 0 0 7 7 7m76-7q8-9 11 0 0 7-7 7" fill="#f4775d" stroke="#713f43" stroke-width="2.5" stroke-linecap="round"/><circle cx="43" cy="43" r="2.2" fill="#382b2a"/><circle cx="57" cy="43" r="2.2" fill="#382b2a"/><path d="M46 51q4 3 8 0" fill="none" stroke="#713f43" stroke-width="1.5"/></svg>`
        },
        {
            name: 'Mèo tam thể',
            motion: 'cat',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="critter-tail" d="M27 53q-18-6-12-20 5-9 13-3" fill="none" stroke="#7a654f" stroke-width="5" stroke-linecap="round"/><path class="critter-leg leg-a" d="M36 54v9m25-9v9" stroke="#8b795f" stroke-width="4" stroke-linecap="round"/><ellipse cx="48" cy="50" rx="27" ry="15" fill="#f4ead5" stroke="#716354" stroke-width="2.5"/><path d="M31 46q5-16 20-12-3 11-16 15m28 0q8-9 14-3l-2 9-15-1" fill="#bd875a"/><path d="m54 31 1-17 13 14m5 1 14-13-3 24" fill="#f4ead5" stroke="#716354" stroke-width="2.5" stroke-linejoin="round"/><path d="M51 39q13-16 28-4 8 13-3 22H56z" fill="#f2e4cf" stroke="#716354" stroke-width="2.5"/><circle cx="66" cy="40" r="2.2" fill="#302823"/><circle cx="74" cy="42" r="1.4" fill="#302823"/><path d="M75 47q4-3 8 0l-4 3z" fill="#d98d91"/><path d="M73 52q5 3 9 0" fill="none" stroke="#716354" stroke-width="1.5"/><circle cx="42" cy="49" r="5" fill="#dba06d"/></svg>`
        },
        {
            name: 'Cá vàng',
            motion: 'fish',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><path class="critter-tail" d="M28 39 10 25q-2 16 5 21-8 7-5 20l19-15" fill="#f08a49" stroke="#704b40" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="50" cy="45" rx="29" ry="19" fill="#ffc75c" stroke="#704b40" stroke-width="2.5"/><path d="M44 28q8-12 16-2l-9 9m1 19q9 12 17 2l-12-8" fill="#f29a51" stroke="#704b40" stroke-width="2.2"/><path d="M44 31q-7 12 0 27" fill="none" stroke="#fff0b3" stroke-width="3"/><circle cx="68" cy="40" r="2.5" fill="#352b2b"/><path d="M75 48q5 4 9 0" fill="none" stroke="#704b40" stroke-width="1.5"/><circle cx="56" cy="34" r="3" fill="#fff" opacity=".7"/></svg>`
        },
        {
            name: 'Hải cẩu',
            motion: 'seal',
            svg: `<svg viewBox="0 0 100 72" aria-hidden="true"><ellipse cx="49" cy="65" rx="26" ry="3" fill="#24351f" opacity=".2"/><path class="critter-flipper" d="M43 56q-14 8-21 2m37-2q14 8 21 2" fill="#73b8d0" stroke="#4b6473" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="49" cy="45" rx="27" ry="20" fill="#78c4dd" stroke="#4b6473" stroke-width="2.5"/><path d="M31 51q16 12 38 0" fill="none" stroke="#dff7ff" stroke-width="8" stroke-linecap="round"/><circle cx="40" cy="39" r="2.5" fill="#342b2b"/><circle cx="57" cy="39" r="2.5" fill="#342b2b"/><ellipse cx="49" cy="46" rx="10" ry="7" fill="#d8f1f6"/><path d="M45 44q4-4 8 0m-4 2v4m0-4-5-2m5 2 5-2" fill="none" stroke="#4b6473" stroke-width="1.5" stroke-linecap="round"/><circle cx="35" cy="45" r="3" fill="#f4aab4" opacity=".7"/></svg>`
        },
        {
            name: 'Ếch',
            motion: 'frog',
            svg: animalSketches.find((animal) => animal.motion === 'frog').svg
        }
    ];

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const meadowTop = height * 0.52;
    const isSmallScreen = window.matchMedia('(max-width: 600px)').matches;
    const critterWidth = isSmallScreen
        ? Math.max(48, Math.min(66, window.innerWidth * 0.14))
        : Math.max(72, Math.min(96, window.innerWidth * 0.07));
    const critterHeight = isSmallScreen
        ? Math.max(36, Math.min(50, window.innerWidth * 0.1))
        : Math.max(52, Math.min(72, window.innerWidth * 0.05));
    const spacingX = critterWidth + (isSmallScreen ? 12 : 16);
    const spacingY = critterHeight + (isSmallScreen ? 10 : 12);
    const agents = [];
    const chooseWanderPoint = (excludedAgent = null) => {
        let point = {
            x: randomBetween(width * 0.06, width * 0.94),
            y: randomBetween(meadowTop, height * 0.96)
        };
        for (let attempt = 0; attempt < 36; attempt += 1) {
            point = {
                x: randomBetween(width * 0.06, width * 0.94),
                y: randomBetween(meadowTop, height * 0.96)
            };
            const hasSpace = agents.every((other) =>
                other === excludedAgent ||
                Math.abs(other.targetX - point.x) >= spacingX ||
                Math.abs(other.targetY - point.y) >= spacingY
            );
            if (hasSpace) break;
        }
        return point;
    };
    stickerAnimals.forEach((animal, index) => {
        const startingPoint = chooseWanderPoint();
        const critter = document.createElement('span');
        critter.className = `meadow-critter critter-${animal.motion}`;
        critter.setAttribute('role', 'button');
        critter.setAttribute('aria-label', `Chơi với bạn ${animal.name}`);
        critter.tabIndex = 0;
        const sprite = document.createElement('span');
        sprite.className = 'critter-sprite';
        const art = document.createElement('span');
        art.className = 'critter-art';
        art.innerHTML = animal.svg;
        sprite.appendChild(art);
        const hearts = document.createElement('span');
        hearts.className = 'critter-hearts';
        hearts.setAttribute('aria-hidden', 'true');
        hearts.textContent = '♥  ♥';
        critter.appendChild(sprite);
        critter.appendChild(hearts);
        container.appendChild(critter);
        const agent = {
            element: critter,
            sprite,
            baseDirection: animal.motion === 'whale' ? -1 : 1,
            isSymmetrical: ['butterfly', 'crab', 'frog', 'jellyfish', 'panda', 'seal'].includes(animal.motion),
            x: startingPoint.x,
            y: startingPoint.y,
            targetX: startingPoint.x,
            targetY: startingPoint.y,
            nextWanderAt: performance.now() + randomBetween(800, 2400),
            resting: false,
            direction: animal.motion === 'whale' ? -1 : 1,
            frameStartX: startingPoint.x,
            playUntil: 0
        };
        const play = (event) => {
            event.stopPropagation();
            agent.playUntil = performance.now() + 1800;
            critterPlayUntil = Math.max(critterPlayUntil, agent.playUntil);
            agent.element.classList.remove('playing');
            void agent.element.offsetWidth;
            agent.element.classList.add('playing');
            window.setTimeout(() => agent.element.classList.remove('playing'), 1900);
        };
        critter.addEventListener('pointerdown', play);
        critter.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                play(event);
            }
        });
        agents.push(agent);
    });

    let pointer = null;
    let lastFrame = performance.now();
    let touchFollowTimer = 0;
    const updatePointer = (event) => {
        const rect = letterScene.getBoundingClientRect();
        pointer = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    };
    letterScene.addEventListener('pointermove', updatePointer);
    letterScene.addEventListener('pointerleave', () => {
        pointer = null;
        agents.forEach((agent) => {
            agent.resting = false;
            const point = chooseWanderPoint(agent);
            agent.targetX = point.x;
            agent.targetY = point.y;
            agent.nextWanderAt = performance.now() + randomBetween(1200, 2400);
        });
    });
    letterScene.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.letter-wrapper, .spotify-widget, .meadow-critter')) return;
        updatePointer(event);
        critterPlayUntil = performance.now() + 1500;
        if (event.pointerType === 'touch') {
            window.clearTimeout(touchFollowTimer);
            touchFollowTimer = window.setTimeout(() => {
                pointer = null;
            }, 1400);
        }
    });

    function followPointer(now) {
        if (!letterScene.classList.contains('visible')) {
            critterAnimationId = requestAnimationFrame(followPointer);
            return;
        }

        const bounds = container.getBoundingClientRect();
        const w = bounds.width;
        const h = bounds.height;
        const meadowTop = h * 0.52;
        const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
        lastFrame = now;

        const columns = Math.max(2, Math.min(isSmallScreen ? 3 : 5, Math.floor((w - 32 + 16) / spacingX)));
        const rows = Math.ceil(agents.length / columns);
        const gridWidth = Math.min(columns, agents.length) * spacingX - 16;
        const gridHeight = rows * spacingY - 12;
        const pointerX = pointer
            ? Math.max(gridWidth / 2 + 12, Math.min(w - gridWidth / 2 - 12, pointer.x))
            : null;
        const pointerY = pointer
            ? Math.max(gridHeight / 2 + 12, Math.min(h - gridHeight / 2 - 12, pointer.y))
            : null;

        agents.forEach((agent, index) => {
            const playing = now < Math.max(critterPlayUntil, agent.playUntil);
            if (pointer) {
                const row = Math.floor(index / columns);
                const rowStart = row * columns;
                const rowCount = Math.min(columns, agents.length - rowStart);
                const column = index - rowStart;
                agent.targetX = pointerX + (column - (rowCount - 1) / 2) * spacingX;
                agent.targetY = pointerY + (row - (rows - 1) / 2) * spacingY;
            } else if (!agent.resting && Math.hypot(agent.targetX - agent.x, agent.targetY - agent.y) < 22) {
                agent.resting = true;
                agent.nextWanderAt = now + randomBetween(900, 2400);
            } else if (agent.resting && now >= agent.nextWanderAt) {
                const point = chooseWanderPoint(agent);
                agent.targetX = point.x;
                agent.targetY = point.y;
                agent.resting = false;
            }

            const margin = critterWidth / 2 + 8;
            const targetX = Math.max(margin, Math.min(w - margin, agent.targetX));
            const targetY = pointer
                ? Math.max(critterHeight / 2 + 8, Math.min(h - critterHeight / 2 - 8, agent.targetY))
                : Math.max(meadowTop, Math.min(h - margin, agent.targetY));
            const dx = targetX - agent.x;
            const dy = targetY - agent.y;
            const distance = Math.hypot(dx, dy);
            agent.frameStartX = agent.x;
            if (Math.abs(dx) > 2) agent.direction = Math.sign(dx);
            const smoothing = pointer ? 0.72 : 1.1;
            const requestedStep = distance * (1 - Math.exp(-delta / smoothing));
            const maximumStep = (pointer ? 150 : 82) * delta;
            const step = Math.min(requestedStep, maximumStep);
            if (distance > 0) {
                agent.x += (dx / distance) * step;
                agent.y += (dy / distance) * step;
            }
            agent.element.classList.toggle('playing', playing);
        });

        for (let pass = 0; pass < 6; pass += 1) {
            for (let firstIndex = 0; firstIndex < agents.length; firstIndex += 1) {
                for (let secondIndex = firstIndex + 1; secondIndex < agents.length; secondIndex += 1) {
                    const first = agents[firstIndex];
                    const second = agents[secondIndex];
                    const dx = second.x - first.x;
                    const dy = second.y - first.y;
                    const overlapX = spacingX - Math.abs(dx);
                    const overlapY = spacingY - Math.abs(dy);
                    if (overlapX <= 0 || overlapY <= 0) continue;

                    if (overlapX < overlapY) {
                        const direction = dx === 0 ? (firstIndex % 2 ? -1 : 1) : Math.sign(dx);
                        first.x -= direction * overlapX / 2;
                        second.x += direction * overlapX / 2;
                    } else {
                        const direction = dy === 0 ? (firstIndex % 2 ? -1 : 1) : Math.sign(dy);
                        first.y -= direction * overlapY / 2;
                        second.y += direction * overlapY / 2;
                    }

                    const minY = pointer ? critterHeight / 2 + 8 : meadowTop;
                    [first, second].forEach((agent) => {
                        agent.x = Math.max(critterWidth / 2 + 8, Math.min(w - critterWidth / 2 - 8, agent.x));
                        agent.y = Math.max(minY, Math.min(h - critterHeight / 2 - 8, agent.y));
                    });
                }
            }
        }

        agents.forEach((agent) => {
            const marginX = critterWidth / 2 + 8;
            const marginY = critterHeight / 2 + 8;
            agent.x = Math.max(marginX, Math.min(w - marginX, agent.x));
            agent.y = pointer
                ? Math.max(marginY, Math.min(h - marginY, agent.y))
                : Math.max(meadowTop, Math.min(h - marginY, agent.y));
            const actualMovementX = agent.x - agent.frameStartX;
            if (Math.abs(actualMovementX) > 0.5) agent.direction = Math.sign(actualMovementX);
            agent.element.style.transform = `translate3d(${agent.x}px, ${agent.y}px, 0) translate(-50%, -50%)`;
            agent.element.classList.toggle(
                'facing-flipped',
                !agent.isSymmetrical && agent.direction !== agent.baseDirection
            );
        });

        critterAnimationId = requestAnimationFrame(followPointer);
    }

    critterAnimationId = requestAnimationFrame(followPointer);
}

function initGardenCanvas() {
    const gCanvas = document.querySelector('#gardenCanvas');
    if (!gCanvas) return;
    const gCtx = gCanvas.getContext('2d');

    function resizeGarden() {
        gCanvas.width = Math.round(window.innerWidth * dpr);
        gCanvas.height = Math.round(window.innerHeight * dpr);
        buildGardenFlowers(window.innerWidth, window.innerHeight);
    }

    function buildGardenFlowers(w, h) {
        gardenPetals.length = 0;
        for (let i = 0; i < 12; i++) {
            gardenPetals.push({
                x: Math.random() * w,
                y: Math.random() * h,
                speedY: randomBetween(0.35, 0.9),
                speedX: randomBetween(-0.25, 0.25),
                size: randomBetween(5, 10),
                angle: randomBetween(0, Math.PI * 2),
                spin: randomBetween(-0.02, 0.02),
                wobble: randomBetween(0, Math.PI * 2),
                wobbleSpeed: randomBetween(0.015, 0.03),
                alpha: randomBetween(0.18, 0.42)
            });
        }

        gardenFireflies.length = 0;
        for (let i = 0; i < 34; i++) {
            gardenFireflies.push({
                x: Math.random() * w,
                y: h * 0.22 + Math.random() * (h * 0.78),
                radius: randomBetween(1.2, 2.8),
                speedY: randomBetween(-0.22, -0.08),
                speedX: randomBetween(-0.18, 0.18),
                phase: randomBetween(0, Math.PI * 2),
                phaseSpeed: randomBetween(0.02, 0.045)
            });
        }
    }

    resizeGarden();
    window.addEventListener('resize', resizeGarden);
    startMeadowCritters();

    const startTime = performance.now();

    function renderGarden(now) {
        const time = (now - startTime) / 1000;
        const w = window.innerWidth;
        const h = window.innerHeight;

        gCtx.setTransform(1, 0, 0, 1, 0, 0);
        gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);

        // Warm sunlight glow that slowly drifts through the clearing.
        const lightX = (w * (0.48 + Math.sin(time * 0.08) * 0.035)) * dpr;
        const lightY = h * 0.2 * dpr;
        const lightRadius = Math.max(w, h) * 0.48 * dpr;
        const sunlight = gCtx.createRadialGradient(lightX, lightY, 0, lightX, lightY, lightRadius);
        sunlight.addColorStop(0, 'rgba(255, 226, 166, 0.12)');
        sunlight.addColorStop(0.45, 'rgba(255, 232, 185, 0.045)');
        sunlight.addColorStop(1, 'rgba(255, 232, 185, 0)');
        gCtx.fillStyle = sunlight;
        gCtx.fillRect(0, 0, gCanvas.width, gCanvas.height);

        // Glowing fireflies drift gently through the meadow.
        for (let i = 0; i < gardenFireflies.length; i++) {
            const f = gardenFireflies[i];
            f.y += f.speedY;
            f.x += f.speedX + Math.sin(time + f.phase) * 0.4;
            f.phase += f.phaseSpeed;

            if (f.y < h * 0.16) {
                f.y = h + 10;
                f.x = Math.random() * w;
            }

            const glow = (Math.sin(f.phase) + 1) * 0.5; // 0 đến 1
            const r = f.radius * dpr;
            const fx = f.x * dpr;
            const fy = f.y * dpr;

            const radGrad = gCtx.createRadialGradient(fx, fy, 0, fx, fy, r * 3);
            radGrad.addColorStop(0, `rgba(255, 244, 194, ${0.72 * glow})`);
            radGrad.addColorStop(0.5, `rgba(255, 226, 174, ${0.28 * glow})`);
            radGrad.addColorStop(1, 'rgba(255, 226, 174, 0)');

            gCtx.fillStyle = radGrad;
            gCtx.beginPath();
            gCtx.arc(fx, fy, r * 3, 0, Math.PI * 2);
            gCtx.fill();
        }

        // A few softly drifting petals add movement without covering the letter.
        for (let i = 0; i < gardenPetals.length; i++) {
            const p = gardenPetals[i];
            p.y += p.speedY;
            p.wobble += p.wobbleSpeed;
            p.x += p.speedX + Math.sin(p.wobble) * 0.6;
            p.angle += p.spin;

            if (p.y > h + 25) {
                p.y = -20;
                p.x = Math.random() * w;
            }

            const px = p.x * dpr;
            const py = p.y * dpr;
            const pSize = p.size * dpr;

            gCtx.save();
            gCtx.translate(px, py);
            gCtx.rotate(p.angle);
            gCtx.fillStyle = `rgba(255, 224, 208, ${p.alpha})`;

            gCtx.beginPath();
            gCtx.ellipse(0, 0, pSize, pSize * 0.55, 0, 0, Math.PI * 2);
            gCtx.fill();
            gCtx.restore();
        }

        gardenCanvasId = requestAnimationFrame(renderGarden);
    }

    cancelAnimationFrame(gardenCanvasId);
    gardenCanvasId = requestAnimationFrame(renderGarden);
}

let isMusicStarting = false;

async function startMusicPlayback() {
    if (!bgMusic || isMusicStarting || isMusicPlaying) return;
    isMusicStarting = true;
    try {
        bgMusic.volume = 0.22;
        await bgMusic.play();
        if (!bgMusic.paused) setMusicPlayingState(true);
    } catch (error) {
        setMusicPlayingState(false);
        if (musicStatus) musicStatus.textContent = 'Không phát được nhạc';
        console.error('Không thể phát Lana Del Rey - Radio.mp3:', error);
    } finally {
        isMusicStarting = false;
    }
}

function toggleMusic() {
    if (!bgMusic) return;
    if (isMusicPlaying) {
        bgMusic.pause();
        setMusicPlayingState(false);
    } else {
        startMusicPlayback();
    }
}

if (bgMusic) {
    bgMusic.addEventListener('playing', () => {
        if (musicStatus) musicStatus.textContent = 'Birthday mix';
        setMusicPlayingState(true);
    });
    bgMusic.addEventListener('pause', () => setMusicPlayingState(false));
    bgMusic.addEventListener('ended', () => setMusicPlayingState(false));
    bgMusic.addEventListener('error', () => {
        if (musicStatus) musicStatus.textContent = 'Không tìm thấy MP3';
        console.error('Không thể tải Lana Del Rey - Radio.mp3.');
    });
}

function setMusicPlayingState(playing) {
    isMusicPlaying = playing;
    if (spotifyPlayBtn) {
        spotifyPlayBtn.setAttribute('aria-pressed', String(playing));
        spotifyPlayBtn.setAttribute('aria-label', playing ? 'Tạm dừng nhạc nền' : 'Phát nhạc nền');
        spotifyPlayBtn.title = playing ? 'Tạm dừng nhạc nền' : 'Phát nhạc nền';
    }
    if (playing) {
        if (playSvg) playSvg.style.display = 'none';
        if (pauseSvg) pauseSvg.style.display = 'block';
        if (spotifyWidget) spotifyWidget.classList.add('playing');
        startFloatingNotes();
    } else {
        if (playSvg) playSvg.style.display = 'block';
        if (pauseSvg) pauseSvg.style.display = 'none';
        if (spotifyWidget) spotifyWidget.classList.remove('playing');
        stopFloatingNotes();
    }
}

function startFloatingNotes() {
    stopFloatingNotes();
    const noteSymbols = ['♪', '♫', '♬', '♩'];
    notesInterval = setInterval(() => {
        if (!isMusicPlaying || !floatingNotesContainer) return;
        const noteEl = document.createElement('span');
        noteEl.className = 'floating-note';
        noteEl.textContent = noteSymbols[Math.floor(Math.random() * noteSymbols.length)];
        noteEl.style.left = `${randomBetween(-10, 25)}px`;
        floatingNotesContainer.appendChild(noteEl);
        setTimeout(() => noteEl.remove(), 3200);
    }, 850);
}

function stopFloatingNotes() {
    if (notesInterval) {
        clearInterval(notesInterval);
        notesInterval = 0;
    }
}

if (spotifyPlayBtn) {
    spotifyPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMusic();
    });
}

/* ==========================================================================
   6. SỰ KIỆN CLICK & KHỞI TẠO NỀN TẢNG
   ========================================================================== */
bouquet.addEventListener('click', () => {
    if (appState === 'IDLE') {
        startBloom();
    } else if (appState === 'READY_TO_REVEAL') {
        triggerReveal();
    }
});

revealHint.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerReveal();
});

// Tải và chuẩn bị bộ đệm ảnh hoa ban đầu
flowerFiles.forEach((file, index) => {
    const image = new Image();
    images[index] = image;

    const onLoad = () => {
        if (!preparedImages[index] && image.naturalWidth) {
            preparedImages[index] = prepareImage(image);
            loadedImageCount += 1;
            drawIdleFrame();
            if (bloomRequested && loadedImageCount === flowerFiles.length) startBloom(false);
        }
    };

    image.addEventListener('load', onLoad);
    image.addEventListener('error', () => {
        console.error('Không thể tải ảnh hoa:', file);
        loadedImageCount += 1;
        if (bloomRequested && loadedImageCount === flowerFiles.length) startBloom(false);
    });

    image.src = `./Picture/${encodeURIComponent(file)}`;
    if (image.complete && image.naturalWidth) {
        onLoad();
    }
});

// Khởi chạy
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
processTransparentLetter();