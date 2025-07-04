let cvReady = false;
cv['onRuntimeInitialized'] = () => { cvReady = true; };

const upload = document.getElementById('upload');
const inputCanvas = document.getElementById('inputCanvas');
const outputSVG = document.getElementById('outputSVG');
const btnSvg = document.getElementById('downloadSvg');
const btnPng = document.getElementById('downloadPng');
let currentPath = [];

upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => processImage(img);
    img.src = URL.createObjectURL(file);
});

function processImage(img) {
    if (!cvReady) { alert('OpenCV is not ready'); return; }
    const canvas = inputCanvas;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    let src = cv.imread(canvas);
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
    cv.threshold(src, src, 127, 255, cv.THRESH_BINARY);

    let skeleton = skeletonize(src.clone());
    currentPath = skeletonToPath(skeleton);
    const svgString = drawSVG(currentPath, skeleton.cols, skeleton.rows);
    skeleton.delete();
    src.delete();

    btnSvg.onclick = () => downloadSVG(svgString);
    btnPng.onclick = () => downloadPNG(currentPath, skeleton.cols, skeleton.rows);
}

function skeletonize(src) {
    let element = cv.Mat.ones(3, 3, cv.CV_8U);
    let skeleton = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    let temp = new cv.Mat();
    let eroded = new cv.Mat();
    while (true) {
        cv.erode(src, eroded, element);
        cv.dilate(eroded, temp, element);
        cv.subtract(src, temp, temp);
        cv.bitwise_or(skeleton, temp, skeleton);
        eroded.copyTo(src);
        if (cv.countNonZero(src) === 0) break;
    }
    element.delete();
    temp.delete();
    eroded.delete();
    return skeleton;
}

function skeletonToPath(mat) {
    const width = mat.cols;
    const height = mat.rows;
    const data = mat.data;
    const visited = new Uint8Array(data.length);
    const path = [];

    function neighbors(idx) {
        const x = idx % width;
        const y = Math.floor(idx / width);
        const res = [];
        for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
                if (i === 0 && j === 0) continue;
                const nx = x + i, ny = y + j;
                if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                    const nidx = ny * width + nx;
                    if (data[nidx] > 0 && !visited[nidx]) res.push(nidx);
                }
            }
        }
        return res;
    }

    function dfs(start) {
        const stack = [start];
        visited[start] = 1;
        path.push({ x: start % width, y: Math.floor(start / width) });
        while (stack.length) {
            const idx = stack[stack.length - 1];
            const neigh = neighbors(idx);
            if (neigh.length) {
                const n = neigh[0];
                visited[n] = 1;
                path.push({ x: n % width, y: Math.floor(n / width) });
                stack.push(n);
            } else {
                stack.pop();
                if (stack.length) {
                    const n = stack[stack.length - 1];
                    path.push({ x: n % width, y: Math.floor(n / width) });
                }
            }
        }
    }

    let next = data.findIndex((v, i) => v > 0 && !visited[i]);
    while (next >= 0) {
        if (path.length > 0) path.push({ x: next % width, y: Math.floor(next / width) });
        dfs(next);
        next = data.findIndex((v, i) => v > 0 && !visited[i]);
    }
    return path;
}

function drawSVG(path, width, height) {
    outputSVG.setAttribute('viewBox', `0 0 ${width} ${height}`);
    outputSVG.setAttribute('width', width);
    outputSVG.setAttribute('height', height);
    const d = path.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    outputSVG.innerHTML = `<path d="${d}" stroke="black" fill="none" stroke-width="1"/>`;
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'><path d='${d}' stroke='black' fill='none' stroke-width='1'/></svg>`;
}

function downloadSVG(svgString) {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.svg';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadPNG(path, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    path.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.png';
        a.click();
        URL.revokeObjectURL(url);
    });
}
