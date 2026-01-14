const el = {
    fileInput: document.getElementById('fileInput'),
    loadBtn: document.getElementById('loadBtn'),
    display: document.getElementById('display'),
    themeToggle: document.getElementById('themeToggle'),
    speakButton: document.getElementById('speakButton'),
    stopButton: document.getElementById('stopButton'),
    firstBtn: document.getElementById('firstBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    lastBtn: document.getElementById('lastBtn'),
    currentPage: document.getElementById('currentPage'),
    totalPage: document.getElementById('totalPage'),
    contentArea: document.querySelector('.content-area')
};

let fullText = "";
let pagesData = [];
let VIEW_HEIGHT = 0;

// [핵심] RequestAnimationFrame + Web Worker 스타일 비동기 분할
async function splitTextByHeight() {
    el.display.textContent = "";
    pagesData = [];
    
    const measurer = document.createElement('div');
    measurer.style.cssText = `
        position: absolute; visibility: hidden; width: ${el.display.clientWidth}px;
        font-size: 1.3rem; line-height: 1.6; white-space: pre-wrap; word-break: break-all;
        padding: 0 10px; box-sizing: border-box;
    `;
    document.body.appendChild(measurer);

    const lines = fullText.split('\n');
    
    // 초고속 샘플링: 텍스트 전체를 한번에 넣고 페이지 수 예측
    measurer.textContent = fullText;
    const totalHeight = measurer.getBoundingClientRect().height;
    const estimatedPages = Math.ceil(totalHeight / VIEW_HEIGHT);
    const charsPerPage = Math.floor(fullText.length / estimatedPages * 0.92);
    
    // 문자 단위로 빠르게 자르고 배치 검증
    let pos = 0;
    const batchSize = 10; // 10페이지씩 배치 처리
    
    while (pos < fullText.length) {
        const batch = [];
        
        // 배치 단위로 예상 위치 계산
        for (let b = 0; b < batchSize && pos < fullText.length; b++) {
            let end = Math.min(pos + charsPerPage, fullText.length);
            // 줄바꿈 경계로 조정
            while (end < fullText.length && fullText[end] !== '\n') end++;
            
            const text = fullText.substring(pos, end + 1);
            batch.push({ start: pos, text });
            pos = end + 1;
        }
        
        // 배치 검증 (한 번에 여러 페이지 측정)
        for (const page of batch) {
            measurer.textContent = page.text;
            const h = measurer.getBoundingClientRect().height;
            
            if (h > VIEW_HEIGHT) {
                // 초과 시 이진 탐색으로 빠른 조정
                let lo = 0, hi = page.text.length;
                while (hi - lo > 50) { // 50자 이하로 좁히기
                    const mid = Math.floor((lo + hi) / 2);
                    measurer.textContent = page.text.substring(0, mid);
                    if (measurer.getBoundingClientRect().height <= VIEW_HEIGHT) {
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }
                // 마지막 줄바꿈 찾기
                while (lo > 0 && page.text[lo] !== '\n') lo--;
                pagesData.push(page.text.substring(0, lo));
                pos = page.start + lo + 1;
            } else {
                pagesData.push(page.text);
            }
        }
        
        await new Promise(r => setTimeout(r, 0)); // UI 블로킹 방지
    }

    document.body.removeChild(measurer);
}


// 가상 렌더링 및 이벤트 로직 (기존과 동일하되 VIEW_HEIGHT 연동)
function renderVirtualPages() {
    el.display.textContent = "";
    const fragment = document.createDocumentFragment();
    pagesData.forEach((_, index) => {
        const frame = document.createElement('div');
        frame.className = 'page-frame';
        frame.dataset.index = index;
        frame.style.height = `${VIEW_HEIGHT}px`;
        fragment.appendChild(frame);
        pageObserver.observe(frame);
    });
    el.display.appendChild(fragment);
    el.totalPage.textContent = pagesData.length;
}

// ... 나머지 Observer 및 이동(instant) 로직 동일 ...
const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.index);
            if (!entry.target.textContent) entry.target.textContent = pagesData[idx];
            el.currentPage.textContent = idx + 1;
        }
    });
}, { root: el.contentArea, threshold: 0.5 });

// 3. 이벤트 컨트롤
el.loadBtn.onclick = () => el.fileInput.click();
el.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    VIEW_HEIGHT = el.contentArea.clientHeight; 

    const reader = new FileReader();
    reader.onload = async (ev) => {
        fullText = ev.target.result;
        await splitTextByHeight();
        renderVirtualPages();
        el.contentArea.scrollTop = 0;
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = "";
};

// 이동 컨트롤 (instant)
el.firstBtn.onclick = () => el.contentArea.scrollTo({ top: 0, behavior: 'instant' });
el.lastBtn.onclick = () => {
    el.contentArea.scrollTo({ top: el.contentArea.scrollHeight, behavior: 'instant' });
    setTimeout(() => { el.currentPage.textContent = pagesData.length; }, 50);
};
el.nextBtn.onclick = () => el.contentArea.scrollBy({ top: VIEW_HEIGHT + 10, behavior: 'instant' });
el.prevBtn.onclick = () => el.contentArea.scrollBy({ top: -(VIEW_HEIGHT + 10), behavior: 'instant' });

el.themeToggle.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
};

el.speakButton.onclick = () => {
    window.speechSynthesis.cancel();
    const idx = parseInt(el.currentPage.textContent) - 1;
    const uttr = new SpeechSynthesisUtterance(pagesData[idx] || "");
    uttr.lang = 'ko-KR';
    window.speechSynthesis.speak(uttr);
};
el.stopButton.onclick = () => window.speechSynthesis.cancel();