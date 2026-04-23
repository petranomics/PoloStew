// admin-header-manager.js
// Allows admin to edit homepage header carousel (runway slides)
// With image preview, drag & drop, URL input, image linking, and full URL button links

let headerSlides = [];

async function loadHeaderSlides() {
    try {
        const res = await fetch('/data/banners.json');
        const data = await res.json();
        headerSlides = data.banners;
        renderHeaderSlidesAdmin();
    } catch (e) {
        alert('Failed to load header slides');
    }
}

function renderHeaderSlidesAdmin() {
    const container = document.getElementById('headerSlidesAdmin');
    if (!container) return;

    const styles = `
        <style>
            .banner-cards-grid { display: flex; flex-direction: column; gap: 24px; }
            .banner-card {
                background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
                padding: 24px; position: relative; transition: box-shadow 0.2s;
            }
            .banner-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
            .banner-card-header {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0;
            }
            .banner-card-number {
                font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 13px;
                text-transform: uppercase; letter-spacing: 1.5px; color: #999;
            }
            .banner-card-actions { display: flex; gap: 8px; align-items: center; }
            .banner-active-toggle {
                appearance: none; width: 40px; height: 22px; border-radius: 11px;
                background: #ccc; position: relative; cursor: pointer; border: none;
                transition: background 0.2s; outline: none;
            }
            .banner-active-toggle:checked { background: #d4af37; }
            .banner-active-toggle::after {
                content: ''; position: absolute; top: 2px; left: 2px;
                width: 18px; height: 18px; border-radius: 50%; background: #fff;
                transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            .banner-active-toggle:checked::after { transform: translateX(18px); }
            .banner-delete-btn {
                background: none; border: 1px solid #e74c3c; color: #e74c3c;
                padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer;
                font-family: 'Montserrat', sans-serif; font-weight: 600;
                letter-spacing: 0.5px; transition: all 0.2s;
            }
            .banner-delete-btn:hover { background: #e74c3c; color: #fff; }
            .banner-card-body {
                display: grid; grid-template-columns: 240px 1fr; gap: 24px;
            }
            .banner-image-section {
                display: flex; flex-direction: column; gap: 12px;
            }
            .banner-image-preview {
                width: 240px; height: 140px; border-radius: 8px; overflow: hidden;
                background: #f5f5f5; display: flex; align-items: center;
                justify-content: center; border: 2px dashed #ddd; position: relative;
                cursor: pointer; transition: border-color 0.2s;
            }
            .banner-image-preview:hover { border-color: #d4af37; }
            .banner-image-preview.has-image { border-style: solid; border-color: #e0e0e0; }
            .banner-image-preview.dragover { border-color: #d4af37; background: #fdf8e8; }
            .banner-image-preview img { width: 100%; height: 100%; object-fit: cover; }
            .banner-image-placeholder {
                text-align: center; color: #aaa; font-size: 12px;
                font-family: 'Montserrat', sans-serif; padding: 10px;
            }
            .banner-image-placeholder svg { display: block; margin: 0 auto 8px; }
            .banner-image-placeholder span { display: block; margin-top: 4px; font-size: 10px; color: #ccc; }
            .banner-image-source {
                display: flex; gap: 0; border-radius: 6px; overflow: hidden;
                border: 1px solid #e0e0e0;
            }
            .banner-image-source-btn {
                flex: 1; padding: 6px 8px; font-size: 11px; font-family: 'Montserrat', sans-serif;
                font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
                border: none; cursor: pointer; transition: all 0.2s;
                background: #f5f5f5; color: #999; text-align: center;
            }
            .banner-image-source-btn.active { background: #1a1a1a; color: #d4af37; }
            .banner-image-source-btn:hover:not(.active) { background: #eee; }
            .banner-image-url-input {
                display: flex; flex-direction: column; gap: 4px;
            }
            .banner-image-url-input label {
                font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.8px; color: #aaa;
            }
            .banner-image-url-input input {
                padding: 7px 10px; border: 1px solid #e0e0e0; border-radius: 6px;
                font-size: 12px; font-family: 'Montserrat', sans-serif;
                transition: border-color 0.2s; outline: none; width: 100%; box-sizing: border-box;
            }
            .banner-image-url-input input:focus { border-color: #d4af37; }
            .banner-fields { display: flex; flex-direction: column; gap: 12px; }
            .banner-field { display: flex; flex-direction: column; gap: 4px; }
            .banner-field label {
                font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 1px; color: #888;
            }
            .banner-field input {
                padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px;
                font-size: 14px; font-family: 'Montserrat', sans-serif;
                transition: border-color 0.2s; outline: none;
            }
            .banner-field input:focus { border-color: #d4af37; }
            .banner-field .field-hint {
                font-size: 10px; color: #bbb; font-family: 'Montserrat', sans-serif;
                margin-top: 2px;
            }
            .banner-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .banner-admin-footer {
                display: flex; gap: 12px; margin-top: 24px; padding-top: 20px;
                border-top: 1px solid #f0f0f0;
            }
            .banner-add-btn {
                background: #fff; border: 2px dashed #d4af37; color: #d4af37;
                padding: 12px 24px; border-radius: 8px; font-size: 14px; cursor: pointer;
                font-family: 'Montserrat', sans-serif; font-weight: 600;
                letter-spacing: 0.5px; transition: all 0.2s;
            }
            .banner-add-btn:hover { background: #d4af37; color: #fff; border-style: solid; }
            .banner-save-btn {
                background: #1a1a1a; border: none; color: #d4af37;
                padding: 12px 28px; border-radius: 8px; font-size: 14px; cursor: pointer;
                font-family: 'Montserrat', sans-serif; font-weight: 600;
                letter-spacing: 0.5px; transition: all 0.2s;
            }
            .banner-save-btn:hover { background: #333; }
        </style>
    `;

    container.innerHTML = styles + '<div class="banner-cards-grid">' +
        headerSlides.map((slide, i) => {
            var imgMode = slide._imageMode || (slide.backgroundImage && !slide.backgroundImage.startsWith('data:') ? 'url' : 'upload');
            return `
            <div class="banner-card">
                <div class="banner-card-header">
                    <span class="banner-card-number">Banner ${i + 1}</span>
                    <div class="banner-card-actions">
                        <input type="checkbox" class="banner-active-toggle"
                            ${slide.active ? 'checked' : ''}
                            onchange="updateHeaderSlide(${i}, 'active', this.checked)" title="Toggle active">
                        <button class="banner-delete-btn" onclick="removeHeaderSlide(${i})">Delete</button>
                    </div>
                </div>
                <div class="banner-card-body">
                    <div class="banner-image-section">
                        <div class="banner-image-source">
                            <button type="button" class="banner-image-source-btn ${imgMode === 'url' ? 'active' : ''}"
                                onclick="switchImageMode(${i}, 'url')">Paste URL</button>
                            <button type="button" class="banner-image-source-btn ${imgMode === 'upload' ? 'active' : ''}"
                                onclick="switchImageMode(${i}, 'upload')">Upload</button>
                        </div>
                        <div class="banner-image-preview ${slide.backgroundImage ? 'has-image' : ''}"
                            id="banner-preview-${i}"
                            ondragover="handleBannerDragOver(event, ${i})"
                            ondragleave="handleBannerDragLeave(event, ${i})"
                            ondrop="handleBannerDrop(event, ${i})"
                            onclick="triggerBannerUpload(${i})">
                            ${slide.backgroundImage
                                ? '<img src="' + slide.backgroundImage + '" alt="Banner preview">'
                                : '<div class="banner-image-placeholder"><svg width="32" height="32" fill="none" stroke="#bbb" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Drop image here or click to browse<span>Supports JPG, PNG, WebP</span></div>'}
                        </div>
                        <input type="file" id="banner-file-${i}" accept="image/*"
                            onchange="handleBannerFileSelect(event, ${i})" style="display:none">
                        <div class="banner-image-url-input" id="banner-url-section-${i}"
                            style="display:${imgMode === 'url' ? 'flex' : 'none'}">
                            <label>Image URL</label>
                            <input type="text" value="${slide.backgroundImage || ''}"
                                onchange="updateHeaderSlide(${i}, 'backgroundImage', this.value); refreshPreview(${i})"
                                id="banner-url-${i}" placeholder="https://images.unsplash.com/...">
                        </div>
                        <div class="banner-image-url-input">
                            <label>Image Link (where the image links to)</label>
                            <input type="text" value="${slide.imageLink || ''}"
                                onchange="updateHeaderSlide(${i}, 'imageLink', this.value)"
                                placeholder="https://www.thatluxine.com/category?cat=t-shirts">
                        </div>
                    </div>
                    <div class="banner-fields">
                        <div class="banner-field-row">
                            <div class="banner-field">
                                <label>Title</label>
                                <input type="text" value="${slide.title || ''}"
                                    onchange="updateHeaderSlide(${i}, 'title', this.value)"
                                    placeholder="e.g. Spring Collection 2026">
                            </div>
                            <div class="banner-field">
                                <label>Subtitle</label>
                                <input type="text" value="${slide.subtitle || ''}"
                                    onchange="updateHeaderSlide(${i}, 'subtitle', this.value)"
                                    placeholder="e.g. Discover timeless elegance">
                            </div>
                        </div>
                        <div class="banner-field-row">
                            <div class="banner-field">
                                <label>Button Text</label>
                                <input type="text" value="${slide.buttonText || ''}"
                                    onchange="updateHeaderSlide(${i}, 'buttonText', this.value)"
                                    placeholder="e.g. Shop Now">
                            </div>
                            <div class="banner-field">
                                <label>Button Link</label>
                                <input type="text" value="${slide.buttonLink || ''}"
                                    onchange="updateHeaderSlide(${i}, 'buttonLink', this.value)"
                                    placeholder="https://www.thatluxine.com/category?cat=t-shirts">
                                <span class="field-hint">Full URL where the button links to</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('') +
        '</div>' +
        `<div class="banner-admin-footer">
            <button class="banner-add-btn" onclick="addHeaderSlide()">+ Add New Banner</button>
            <button class="banner-save-btn" onclick="saveHeaderSlides()">Save All Changes</button>
        </div>`;
}

function switchImageMode(i, mode) {
    headerSlides[i]._imageMode = mode;
    var urlSection = document.getElementById('banner-url-section-' + i);
    if (urlSection) {
        urlSection.style.display = mode === 'url' ? 'flex' : 'none';
    }
    var card = document.querySelectorAll('.banner-card')[i];
    if (card) {
        var btns = card.querySelectorAll('.banner-image-source-btn');
        btns.forEach(function(btn) { btn.classList.remove('active'); });
        btns[mode === 'url' ? 0 : 1].classList.add('active');
    }
}

function refreshPreview(i) {
    var preview = document.getElementById('banner-preview-' + i);
    var url = headerSlides[i].backgroundImage;
    if (preview && url) {
        preview.className = 'banner-image-preview has-image';
        preview.innerHTML = '<img src="' + url + '" alt="Banner preview">';
    }
}

function handleBannerDragOver(e, i) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('banner-preview-' + i).classList.add('dragover');
}

function handleBannerDragLeave(e, i) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('banner-preview-' + i).classList.remove('dragover');
}

function handleBannerDrop(e, i) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('banner-preview-' + i).classList.remove('dragover');
    var files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        uploadBannerImage(files[0], i);
    }
}

function triggerBannerUpload(i) {
    document.getElementById('banner-file-' + i).click();
}

function handleBannerFileSelect(e, i) {
    var files = e.target.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        uploadBannerImage(files[0], i);
    }
}

async function uploadBannerImage(file, i) {
    var preview = document.getElementById('banner-preview-' + i);
    var reader = new FileReader();
    reader.onload = function(e) {
        preview.className = 'banner-image-preview has-image';
        preview.innerHTML = '<img src="' + e.target.result + '" alt="Banner preview">';
    };
    reader.readAsDataURL(file);

    switchImageMode(i, 'upload');

    try {
        var formData = new FormData();
        formData.append('file', file);
        var res = await fetch('/api/images/upload', { method: 'POST', body: formData });
        if (res.ok) {
            var result = await res.json();
            headerSlides[i].backgroundImage = result.url;
            var urlInput = document.getElementById('banner-url-' + i);
            if (urlInput) urlInput.value = result.url;
        }
    } catch (err) {
        var dataReader = new FileReader();
        dataReader.onload = function(ev) {
            headerSlides[i].backgroundImage = ev.target.result;
            var urlInput = document.getElementById('banner-url-' + i);
            if (urlInput) urlInput.value = ev.target.result;
        };
        dataReader.readAsDataURL(file);
    }
}

function updateHeaderSlide(i, field, value) {
    headerSlides[i][field] = value;
}

function removeHeaderSlide(i) {
    if (confirm('Delete this banner?')) {
        headerSlides.splice(i, 1);
        renderHeaderSlidesAdmin();
    }
}

function addHeaderSlide() {
    headerSlides.push({
        id: 'banner-' + (headerSlides.length + 1),
        title: '',
        subtitle: '',
        backgroundImage: '',
        backgroundColor: '#1a1a1a',
        textColor: '#faf9f6',
        buttonText: '',
        buttonLink: '',
        imageLink: '',
        active: true,
        order: headerSlides.length + 1
    });
    renderHeaderSlidesAdmin();
}

async function saveHeaderSlides() {
    try {
        var btn = document.querySelector('.banner-save-btn');
        if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

        var cleanSlides = headerSlides.map(function(s) {
            var clean = Object.assign({}, s);
            delete clean._imageMode;
            return clean;
        });

        var res = await fetch('/api/banners/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ banners: cleanSlides })
        });
        if (res.ok) {
            alert('Banners saved successfully!');
        } else {
            alert('Failed to save banners');
        }
    } catch (e) {
        alert('Error saving banners');
    } finally {
        var btn = document.querySelector('.banner-save-btn');
        if (btn) { btn.textContent = 'Save All Changes'; btn.disabled = false; }
    }
}

window.loadHeaderSlides = loadHeaderSlides;
window.updateHeaderSlide = updateHeaderSlide;
window.removeHeaderSlide = removeHeaderSlide;
window.addHeaderSlide = addHeaderSlide;
window.saveHeaderSlides = saveHeaderSlides;
window.handleBannerDragOver = handleBannerDragOver;
window.handleBannerDragLeave = handleBannerDragLeave;
window.handleBannerDrop = handleBannerDrop;
window.triggerBannerUpload = triggerBannerUpload;
window.handleBannerFileSelect = handleBannerFileSelect;
window.uploadBannerImage = uploadBannerImage;
window.refreshPreview = refreshPreview;
window.switchImageMode = switchImageMode;
