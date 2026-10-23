// ================= PAGE ROUTING =================
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    // Show target page
    document.getElementById(`page-${pageId}`).classList.add('active');
    
    // Clear status messages
    document.querySelectorAll('.status').forEach(el => el.textContent = '');
    
    // Clear file lists and error highlights
    document.querySelectorAll('.file-list').forEach(list => list.innerHTML = '');
    document.querySelectorAll('.file-item.error').forEach(el => el.classList.remove('error'));
    
    // Reset specific tool variables and UI elements
    if (pageId === 'merge') { 
        filesToMerge = []; 
        updateMergeList(); 
    }
    if (pageId === 'split') { 
        fileToSplit = null; 
        splitFileName.style.display = 'none'; 
        splitOptions.style.display = 'none'; 
        splitBtn.disabled = true; 
    }
    if (pageId === 'rotate') { 
        fileToRotate = null; 
        rotateFileName.style.display = 'none'; 
        rotateOptions.style.display = 'none'; 
        rotateBtn.disabled = true; 
    }
    if (pageId === 'img2pdf') { 
        filesToConvert = []; 
        updateImgList(); 
        imgOptions.style.display = 'none'; 
        imgBtn.disabled = true; 
    }
    if (pageId === 'text2pdf') {
        document.getElementById('text-input').value = '';
        document.getElementById('text-status').textContent = '';
        document.getElementById('text-download-area').innerHTML = '';
    }
    if (pageId === 'collage2pdf') {
        filesToCollage = [];
        updateCollageList();
        document.getElementById('collage-status').textContent = '';
        document.getElementById('collage-download-area').innerHTML = '';
    }
}

// ================= UTILITY FUNCTIONS =================
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showError(element, message) {
    element.textContent = "❌ " + message;
    element.style.color = "#ef4444"; 
}

function showSuccess(element, message) {
    element.textContent = "✅ " + message;
    element.style.color = "#00c4cc"; 
}

function triggerDownload(blob, filename, downloadArea) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        downloadArea.innerHTML = `<a href="${url}" target="_blank" class="download-link">📥 Tap here to save your PDF</a>`;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// =====================================================================
// 1. MERGE TOOL LOGIC
// =====================================================================
const mergeInput = document.getElementById('merge-input');
const mergeList = document.getElementById('merge-file-list');
const mergeBtn = document.getElementById('merge-btn');
const mergeStatus = document.getElementById('merge-status');
const mergeDropZone = document.getElementById('merge-drop-zone');
const mergeDownloadArea = document.getElementById('merge-download-area');
let filesToMerge = [];

document.querySelector('label[for="merge-input"]').addEventListener('click', () => mergeInput.click());

mergeInput.addEventListener('change', (e) => {
    addMergeFiles(Array.from(e.target.files));
    mergeInput.value = ''; 
});

mergeDropZone.addEventListener('dragover', (e) => { e.preventDefault(); mergeDropZone.classList.add('dragover'); });
mergeDropZone.addEventListener('dragleave', () => mergeDropZone.classList.remove('dragover'));
mergeDropZone.addEventListener('drop', (e) => {
    e.preventDefault(); mergeDropZone.classList.remove('dragover');
    addMergeFiles(Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'));
});

function addMergeFiles(files) {
    mergeStatus.textContent = '';
    mergeDownloadArea.innerHTML = '';
    
    files.forEach(file => {
        if (file.size > MAX_FILE_SIZE) {
            showError(mergeStatus, `"${file.name}" is too large (Max 25MB).`);
            return;
        }
        const exists = filesToMerge.some(f => f.name === file.name && f.size === file.size);
        if (!exists) filesToMerge.push(file);
    });
    updateMergeList();
}

function updateMergeList() {
    mergeList.innerHTML = '';
    filesToMerge.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.id = `merge-item-${index}`;
        div.innerHTML = `
            <span class="name">${file.name}</span>
            <span class="size">${formatSize(file.size)}</span>
            <button class="remove-btn" onclick="removeMergeFile(${index})">×</button>
        `;
        mergeList.appendChild(div);
    });
    mergeBtn.disabled = filesToMerge.length < 2;
}

function removeMergeFile(index) {
    filesToMerge.splice(index, 1);
    updateMergeList();
    mergeStatus.textContent = '';
}

mergeBtn.addEventListener('click', async () => {
    mergeBtn.textContent = '⏳ Merging...';
    mergeBtn.disabled = true;
    mergeStatus.textContent = '';
    mergeDownloadArea.innerHTML = '';
    
    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        for (let i = 0; i < filesToMerge.length; i++) {
            const file = filesToMerge[i];
            const arrayBuffer = await file.arrayBuffer();
            
            try {
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
            } catch (fileError) {
                const fileEl = document.getElementById(`merge-item-${i}`);
                if (fileEl) fileEl.classList.add('error');
                
                if (fileError.message.includes('encrypted')) {
                    throw new Error(`"${file.name}" is password-protected.`);
                } else {
                    throw new Error(`"${file.name}" has an invalid or complex structure.`);
                }
            }
        }
        
        const bytes = await mergedPdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        triggerDownload(blob, 'merged.pdf', mergeDownloadArea);
        showSuccess(mergeStatus, 'Merged successfully!');
    } catch (error) {
        showError(mergeStatus, error.message);
    } finally {
        mergeBtn.textContent = 'Merge & Download';
        mergeBtn.disabled = false;
    }
});

// =====================================================================
// 2. SPLIT TOOL LOGIC
// =====================================================================
const splitInput = document.getElementById('split-input');
const splitFileName = document.getElementById('split-file-name');
const splitOptions = document.getElementById('split-options');
const splitPagesInput = document.getElementById('split-pages');
const splitBtn = document.getElementById('split-btn');
const splitStatus = document.getElementById('split-status');
const splitDownloadArea = document.getElementById('split-download-area');
const splitDropZone = document.getElementById('split-drop-zone');

let fileToSplit = null;

document.querySelector('label[for="split-input"]').addEventListener('click', () => splitInput.click());

splitInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleSplitFile(e.target.files[0]);
    splitInput.value = '';
});

splitDropZone.addEventListener('dragover', (e) => { e.preventDefault(); splitDropZone.classList.add('dragover'); });
splitDropZone.addEventListener('dragleave', () => splitDropZone.classList.remove('dragover'));
splitDropZone.addEventListener('drop', (e) => {
    e.preventDefault(); splitDropZone.classList.remove('dragover');
    const pdf = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf');
    if (pdf) handleSplitFile(pdf);
});

function handleSplitFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        showError(splitStatus, 'File is too large (Max 25MB).');
        return;
    }
    fileToSplit = file;
    splitFileName.style.display = 'flex';
    splitFileName.innerHTML = `<span class="name">${file.name}</span><span class="size">${formatSize(file.size)}</span>`;
    splitOptions.style.display = 'block';
    splitBtn.disabled = false;
    splitStatus.textContent = '';
    splitDownloadArea.innerHTML = '';
}

splitBtn.addEventListener('click', async () => {
    if (!fileToSplit) return;
    
    const pageStr = splitPagesInput.value.trim();
    if (!pageStr) {
        showError(splitStatus, 'Please enter page numbers.');
        return;
    }

    splitBtn.textContent = '⏳ Splitting...';
    splitBtn.disabled = true;
    splitStatus.textContent = '';

    try {
        const arrayBuffer = await fileToSplit.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const totalPages = pdf.getPageCount();
        
        let pagesToExtract = [];
        const parts = pageStr.split(',');
        
        parts.forEach(part => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end; i++) pagesToExtract.push(i - 1);
                }
            } else {
                const num = parseInt(part.trim());
                if (!isNaN(num)) pagesToExtract.push(num - 1);
            }
        });

        pagesToExtract = [...new Set(pagesToExtract)].filter(p => p >= 0 && p < totalPages).sort((a,b) => a - b);

        if (pagesToExtract.length === 0) {
            throw new Error('No valid pages found in your input.');
        }

        const newPdf = await PDFLib.PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdf, pagesToExtract);
        copiedPages.forEach(page => newPdf.addPage(page));
        
        const bytes = await newPdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        triggerDownload(blob, 'extracted-pages.pdf', splitDownloadArea);
        showSuccess(splitStatus, `Extracted ${pagesToExtract.length} pages successfully!`);
    } catch (error) {
        if (error.message.includes('encrypted')) {
            showError(splitStatus, 'This PDF is password-protected.');
        } else {
            showError(splitStatus, error.message || 'Error splitting file.');
        }
    } finally {
        splitBtn.textContent = 'Split & Download';
        splitBtn.disabled = false;
    }
});

// =====================================================================
// 3. ROTATE TOOL LOGIC
// =====================================================================
const rotateInput = document.getElementById('rotate-input');
const rotateFileName = document.getElementById('rotate-file-name');
const rotateOptions = document.getElementById('rotate-options');
const rotateDegree = document.getElementById('rotate-degree');
const rotateBtn = document.getElementById('rotate-btn');
const rotateStatus = document.getElementById('rotate-status');
const rotateDownloadArea = document.getElementById('rotate-download-area');
const rotateDropZone = document.getElementById('rotate-drop-zone');

let fileToRotate = null;

document.querySelector('label[for="rotate-input"]').addEventListener('click', () => rotateInput.click());

rotateInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleRotateFile(e.target.files[0]);
    rotateInput.value = '';
});

rotateDropZone.addEventListener('dragover', (e) => { e.preventDefault(); rotateDropZone.classList.add('dragover'); });
rotateDropZone.addEventListener('dragleave', () => rotateDropZone.classList.remove('dragover'));
rotateDropZone.addEventListener('drop', (e) => {
    e.preventDefault(); rotateDropZone.classList.remove('dragover');
    const pdf = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf');
    if (pdf) handleRotateFile(pdf);
});

function handleRotateFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        showError(rotateStatus, 'File is too large (Max 25MB).');
        return;
    }
    fileToRotate = file;
    rotateFileName.style.display = 'flex';
    rotateFileName.innerHTML = `<span class="name">${file.name}</span><span class="size">${formatSize(file.size)}</span>`;
    rotateOptions.style.display = 'block';
    rotateBtn.disabled = false;
    rotateStatus.textContent = '';
    rotateDownloadArea.innerHTML = '';
}

rotateBtn.addEventListener('click', async () => {
    if (!fileToRotate) return;
    
    rotateBtn.textContent = '⏳ Rotating...';
    rotateBtn.disabled = true;
    rotateStatus.textContent = '';

    try {
        const arrayBuffer = await fileToRotate.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        const degrees = parseInt(rotateDegree.value);
        
        const pages = pdf.getPages();
        pages.forEach(page => {
            page.setRotation(PDFLib.degrees(degrees));
        });

        const bytes = await pdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        triggerDownload(blob, 'rotated.pdf', rotateDownloadArea);
        showSuccess(rotateStatus, 'Rotated successfully!');
    } catch (error) {
        if (error.message.includes('encrypted')) {
            showError(rotateStatus, 'This PDF is password-protected.');
        } else {
            showError(rotateStatus, 'Error rotating file. The file may be corrupted.');
        }
    } finally {
        rotateBtn.textContent = 'Rotate & Download';
        rotateBtn.disabled = false;
    }
});

// =====================================================================
// 4. IMAGE TO PDF LOGIC
// =====================================================================
const imgInput = document.getElementById('img-input');
const imgList = document.getElementById('img-file-list');
const imgOptions = document.getElementById('img-options');
const imgPageSize = document.getElementById('img-page-size');
const imgBtn = document.getElementById('img-btn');
const imgStatus = document.getElementById('img-status');
const imgDropZone = document.getElementById('img-drop-zone');
const imgDownloadArea = document.getElementById('img-download-area');

let filesToConvert = [];
const MAX_IMAGES = 20;

document.querySelector('label[for="img-input"]').addEventListener('click', () => imgInput.click());

imgInput.addEventListener('change', (e) => {
    addImgFiles(Array.from(e.target.files));
    imgInput.value = ''; 
});

imgDropZone.addEventListener('dragover', (e) => { e.preventDefault(); imgDropZone.classList.add('dragover'); });
imgDropZone.addEventListener('dragleave', () => imgDropZone.classList.remove('dragover'));
imgDropZone.addEventListener('drop', (e) => {
    e.preventDefault(); imgDropZone.classList.remove('dragover');
    const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addImgFiles(images);
});

function addImgFiles(files) {
    imgStatus.textContent = '';
    imgDownloadArea.innerHTML = '';
    
    const validImages = files.filter(f => f.type.match('image/jpeg') || f.type.match('image/png') || f.type.match('image/webp'));
    
    if (validImages.length < files.length) {
        showError(imgStatus, 'Some files were ignored. Please upload JPG, PNG, or WEBP.');
    }

    validImages.forEach(file => {
        if (filesToConvert.length >= MAX_IMAGES) {
            showError(imgStatus, `You can only convert up to ${MAX_IMAGES} images at a time.`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showError(imgStatus, `"${file.name}" is too large (Max 25MB).`);
            return;
        }
        const exists = filesToConvert.some(f => f.name === file.name && f.size === file.size);
        if (!exists) filesToConvert.push(file);
    });
    
    updateImgList();
}

function updateImgList() {
    imgList.innerHTML = '';
    filesToConvert.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        const imgUrl = URL.createObjectURL(file);
        
        div.innerHTML = `
            <img src="${imgUrl}" class="img-preview">
            <span class="name">${file.name}</span>
            <span class="size">${formatSize(file.size)}</span>
            <button class="remove-btn" onclick="removeImgFile(${index})">×</button>
        `;
        imgList.appendChild(div);
    });
    
    imgOptions.style.display = filesToConvert.length > 0 ? 'block' : 'none';
    imgBtn.disabled = filesToConvert.length < 1;
    imgBtn.textContent = filesToConvert.length > 1 ? `Convert ${filesToConvert.length} Images to PDF` : 'Convert to PDF';
}

function removeImgFile(index) {
    filesToConvert.splice(index, 1);
    updateImgList();
    imgStatus.textContent = '';
}

imgBtn.addEventListener('click', async () => {
    imgBtn.textContent = '⏳ Converting...';
    imgBtn.disabled = true;
    imgStatus.textContent = '';
    imgDownloadArea.innerHTML = '';

    try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const pageMode = imgPageSize.value;

        for (const file of filesToConvert) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            
            try {
                await new Promise((resolve, reject) => { 
                    img.onload = resolve; 
                    img.onerror = () => reject(new Error('Failed to load image.'));
                });
            } catch (err) {
                throw new Error(`"${file.name}" could not be read. Please ensure it is a valid image.`);
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxDim = 2000;
            let width = img.width;
            let height = img.height;
            
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.floor(height * (maxDim / width));
                    width = maxDim;
                } else {
                    width = Math.floor(width * (maxDim / height));
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, width, height);
            
            ctx.drawImage(img, 0, 0, width, height);

            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
            
            const embeddedImg = await pdfDoc.embedJpg(jpegBytes);

            let page;
            if (pageMode === 'a4') {
                page = pdfDoc.addPage([595.28, 841.89]);
            } else if (pageMode === 'letter') {
                page = pdfDoc.addPage([612, 792]);
            } else {
                page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
            }

            if (pageMode === 'fit') {
                page.drawImage(embeddedImg, {
                    x: 0,
                    y: 0,
                    width: embeddedImg.width,
                    height: embeddedImg.height,
                });
            } else {
                const pageWidth = page.getWidth();
                const pageHeight = page.getHeight();
                const imgRatio = embeddedImg.width / embeddedImg.height;
                const pageRatio = pageWidth / pageHeight;

                let drawWidth, drawHeight, x, y;

                if (imgRatio > pageRatio) {
                    drawWidth = pageWidth;
                    drawHeight = pageWidth / imgRatio;
                    x = 0;
                    y = (pageHeight - drawHeight) / 2;
                } else {
                    drawHeight = pageHeight;
                    drawWidth = pageHeight * imgRatio;
                    x = (pageWidth - drawWidth) / 2;
                    y = 0;
                }

                page.drawImage(embeddedImg, {
                    x: x,
                    y: y,
                    width: drawWidth,
                    height: drawHeight,
                });
            }
            
            URL.revokeObjectURL(img.src);
        }

        const bytes = await pdfDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        triggerDownload(blob, 'images.pdf', imgDownloadArea);
        showSuccess(imgStatus, 'Images converted to PDF successfully!');
    } catch (error) {
        console.error(error);
        showError(imgStatus, error.message || 'Error converting images. Please try again.');
    } finally {
        imgBtn.textContent = 'Convert to PDF';
        imgBtn.disabled = false;
    }
});

// =====================================================================
// 5. TEXT TO PDF LOGIC (UPDATED FOR CODE)
// =====================================================================
const textInput = document.getElementById('text-input');
const textPageSize = document.getElementById('text-page-size');
const textBtn = document.getElementById('text-btn');
const textStatus = document.getElementById('text-status');
const textDownloadArea = document.getElementById('text-download-area');

textBtn.addEventListener('click', async () => {
    let text = textInput.value;
    if (!text.trim()) {
        showError(textStatus, 'Please enter some text first.');
        return;
    }

    textBtn.textContent = '⏳ Creating...';
    textBtn.disabled = true;
    textStatus.textContent = '';
    textDownloadArea.innerHTML = '';

    try {
        text = text.replace(/[•●▪]/g, '-');
        text = text.replace(/[“”]/g, '"');
        text = text.replace(/[‘’]/g, "'");
        text = text.replace(/[–—]/g, "-");

        const pdfDoc = await PDFLib.PDFDocument.create();
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Courier);
        
        let pageWidth = 595.28;
        let pageHeight = 841.89;
        if (textPageSize.value === 'letter') {
            pageWidth = 612;
            pageHeight = 792;
        }

        const fontSize = 10;
        const margin = 40;
        const maxLineWidth = pageWidth - (margin * 2);
        
        const lines = [];
        const paragraphs = text.split('\n');
        
        for (const paragraph of paragraphs) {
            if (paragraph.trim() === '') {
                lines.push('');
                continue;
            }
            const words = paragraph.split(' ');
            let currentLine = '';
            
            for (const word of words) {
                const testLine = currentLine ? currentLine + ' ' + word : word;
                let width;
                try {
                    width = font.widthOfTextAtSize(testLine, fontSize);
                } catch(e) {
                    continue; 
                }

                if (width > maxLineWidth) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);
        }

        const lineHeight = fontSize * 1.3;
        let y = pageHeight - margin;
        let page = pdfDoc.addPage([pageWidth, pageHeight]);

        for (const line of lines) {
            if (y < margin + lineHeight) {
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                y = pageHeight - margin;
            }
            if (line) {
                try {
                    page.drawText(line, {
                        x: margin,
                        y: y,
                        size: fontSize,
                        font: font,
                        color: PDFLib.rgb(0, 0, 0),
                    });
                } catch(e) {}
            }
            y -= lineHeight;
        }

        const bytes = await pdfDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        triggerDownload(blob, 'text-document.pdf', textDownloadArea);
        showSuccess(textStatus, 'PDF created successfully!');
    } catch (error) {
        console.error(error);
        showError(textStatus, 'Error creating PDF. Please check your text for unsupported symbols.');
    } finally {
        textBtn.textContent = 'Create PDF';
        textBtn.disabled = false;
    }
});

// =====================================================================
// 6. COLLAGE TO PDF LOGIC
// =====================================================================
const collageInput = document.getElementById('collage-input');
const collageList = document.getElementById('collage-file-list');
const collageBtn = document.getElementById('collage-btn');
const collageStatus = document.getElementById('collage-status');
const collageDropZone = document.getElementById('collage-drop-zone');
const collageDownloadArea = document.getElementById('collage-download-area');

let filesToCollage = [];

document.querySelector('label[for="collage-input"]').addEventListener('click', () => collageInput.click());

collageInput.addEventListener('change', (e) => {
    addCollageFiles(Array.from(e.target.files));
    collageInput.value = ''; 
});

collageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); collageDropZone.classList.add('dragover'); });
collageDropZone.addEventListener('dragleave', () => collageDropZone.classList.remove('dragover'));
collageDropZone.addEventListener('drop', (e) => {
    e.preventDefault(); collageDropZone.classList.remove('dragover');
    const images = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addCollageFiles(images);
});

function addCollageFiles(files) {
    collageStatus.textContent = '';
    collageDownloadArea.innerHTML = '';
    
    const validImages = files.filter(f => f.type.match('image/jpeg') || f.type.match('image/png') || f.type.match('image/webp'));
    
    validImages.forEach(file => {
        if (filesToCollage.length >= 10) {
            showError(collageStatus, 'You can only add up to 10 images for a single page collage.');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showError(collageStatus, `"${file.name}" is too large (Max 25MB).`);
            return;
        }
        const exists = filesToCollage.some(f => f.name === file.name && f.size === file.size);
        if (!exists) filesToCollage.push(file);
    });
    
    updateCollageList();
}

function updateCollageList() {
    collageList.innerHTML = '';
    filesToCollage.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        const imgUrl = URL.createObjectURL(file);
        
        div.innerHTML = `
            <img src="${imgUrl}" class="img-preview">
            <span class="name">${file.name}</span>
            <span class="size">${formatSize(file.size)}</span>
            <button class="remove-btn" onclick="removeCollageFile(${index})">×</button>
        `;
        collageList.appendChild(div);
    });
    
    collageBtn.disabled = filesToCollage.length < 2;
}

function removeCollageFile(index) {
    filesToCollage.splice(index, 1);
    updateCollageList();
    collageStatus.textContent = '';
}

collageBtn.addEventListener('click', async () => {
    if (filesToCollage.length < 2) return;
    
    collageBtn.textContent = '⏳ Creating Collage...';
    collageBtn.disabled = true;
    collageStatus.textContent = '';
    collageDownloadArea.innerHTML = '';

    try {
        const pdfDoc = await PDFLib.PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); 
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();
        
        const numImages = filesToCollage.length;
        
        const cols = Math.ceil(Math.sqrt(numImages));
        const rows = Math.ceil(numImages / cols);
        
        const cellWidth = pageWidth / cols;
        const cellHeight = pageHeight / rows;
        const padding = 10; 

        for (let i = 0; i < numImages; i++) {
            const file = filesToCollage[i];
            
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxDim = 1500; 
            let width = img.width;
            let height = img.height;
            
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.floor(height * (maxDim / width));
                    width = maxDim;
                } else {
                    width = Math.floor(width * (maxDim / height));
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const jpegBytes = await fetch(jpegDataUrl).then(res => res.arrayBuffer());
            const embeddedImg = await pdfDoc.embedJpg(jpegBytes);

            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const cellX = col * cellWidth;
            const cellY = pageHeight - ((row + 1) * cellHeight); 
            
            const maxImgWidth = cellWidth - (padding * 2);
            const maxImgHeight = cellHeight - (padding * 2);
            
            const imgRatio = embeddedImg.width / embeddedImg.height;
            let drawWidth = maxImgWidth;
            let drawHeight = maxImgWidth / imgRatio;
            
            if (drawHeight > maxImgHeight) {
                drawHeight = maxImgHeight;
                drawWidth = maxImgHeight * imgRatio;
            }

            const x = cellX + (cellWidth - drawWidth) / 2;
            const y = cellY + (cellHeight - drawHeight) / 2;

            page.drawImage(embeddedImg, {
                x: x,
                y: y,
                width: drawWidth,
                height: drawHeight,
            });
            
            URL.revokeObjectURL(img.src);
        }

        const bytes = await pdfDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        
        triggerDownload(blob, 'collage.pdf', collageDownloadArea);
        showSuccess(collageStatus, 'Collage created successfully!');
    } catch (error) {
        console.error(error);
        showError(collageStatus, 'Error creating collage. Please try again.');
    } finally {
        collageBtn.textContent = 'Create Single Page PDF';
        collageBtn.disabled = false;
    }
});
