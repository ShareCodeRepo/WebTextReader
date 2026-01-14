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
    contentArea: document.querySelector('.content-area'),
    saveBookMarkBtn: document.getElementById('saveBookMarkBtn'),
    loadBookMarkBtn: document.getElementById('loadBookMarkBtn'),
    toast: document.getElementById('toastContainer'),
    loadedFileName: document.getElementById('loadedFileName'),
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    progressPercent: document.getElementById('progressPercent')
};

let fullText = "";
let pagesData = [];
let VIEW_HEIGHT = 0;

// [최적화] CPU 연산만 사용하는 고속 청크 분할
function splitTextByChunk() {
    pagesData = [];
    // 약 8000자 단위 분할 (가독성과 성능의 균형)
    const CHUNK_SIZE = 8000; 
    for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
        pagesData.push(fullText.slice(i, i + CHUNK_SIZE));
    }
    el.totalPage.textContent = pagesData.length;
}

// [최적화] 빈 프레임만 먼저 생성하여 렌더링 지연 차단
// [수정] renderVirtualPages: 초기 성능 극대화 버전
function renderVirtualPages() {
    el.display.textContent = "";
    const fragment = document.createDocumentFragment();
    
    // 전체를 다 만들지 않고, 일단 20개만 먼저 만듭니다. (병목 해결 핵심)
    const initialRenderCount = Math.min(pagesData.length, 20);
    
    for (let i = 0; i < pagesData.length; i++) {
        const frame = document.createElement('div');
        frame.className = 'page-frame';
        frame.dataset.index = i;
        frame.style.height = VIEW_HEIGHT + "px";
        
        // 초기 로딩 시에는 상단 일부 페이지만 텍스트와 관찰자 등록
        if (i < initialRenderCount) {
            frame.textContent = pagesData[i];
            pageObserver.observe(frame);
        }
        
        fragment.appendChild(frame);
    }
    el.display.appendChild(fragment);
    el.totalPage.textContent = pagesData.length;
}

// [수정] 스크롤 시 동적으로 관찰 대상 추가 (나머지 페이지용)
el.contentArea.onscroll = () => {
    const frames = el.display.querySelectorAll('.page-frame:not([data-observed])');
    frames.forEach(frame => {
        const rect = frame.getBoundingClientRect();
        if (rect.top < window.innerHeight * 2) { // 근처에 오면 관찰 시작
            pageObserver.observe(frame);
            frame.setAttribute('data-observed', 'true');
        }
    });
};

// 교차 관찰자: 화면에 보일 때만 텍스트 주입
const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.index);
            if (!entry.target.textContent) entry.target.textContent = pagesData[idx];
            el.currentPage.textContent = idx + 1;
        }
    });
}, { root: el.contentArea, threshold: 0.1 });

// 파일 로드 핸들러
el.loadBtn.onclick = () => el.fileInput.click();

el.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const startTime = performance.now();
    el.loadedFileName.textContent = file.name;
    VIEW_HEIGHT = el.contentArea.clientHeight - 120;

    const reader = new FileReader();
    reader.onload = (ev) => {
        fullText = ev.target.result;
        
        splitTextByChunk(); 
        renderVirtualPages();
        
        el.contentArea.scrollTop = 0;
        const duration = (performance.now() - startTime).toFixed(2);
        console.log(`[최적화 결과] 로딩 시간: ${duration}ms`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = "";
};

// 페이지 이동 (VIEW_HEIGHT 기반 정밀 이동)
el.firstBtn.onclick = () => el.contentArea.scrollTo({ top: 0, behavior: 'instant' });
el.lastBtn.onclick = () => el.contentArea.scrollTo({ top: el.contentArea.scrollHeight, behavior: 'instant' });
el.nextBtn.onclick = () => el.contentArea.scrollBy({ top: VIEW_HEIGHT, behavior: 'instant' });
el.prevBtn.onclick = () => el.contentArea.scrollBy({ top: -VIEW_HEIGHT, behavior: 'instant' });

// 테마 및 TTS 기능
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

function showToast(message, type = 'success') {
    el.toast.className = `toast toast-${type}`;
    el.toast.textContent = message;
    el.toast.classList.remove('toast-hidden');
    setTimeout(() => el.toast.classList.add('toast-hidden'), 3000);
}

// 책갈피 기능
el.saveBookMarkBtn.onclick = () => {
    if (!fullText) return showToast("파일을 먼저 불러와주세요.", "error");
    const bookmark = {
        fileName: el.loadedFileName.textContent,
        scrollTop: el.contentArea.scrollTop,
        timestamp: Date.now()
    };
    localStorage.setItem('webReader_bookmark', JSON.stringify(bookmark));
    showToast("책갈피가 저장되었습니다.");
};

el.loadBookMarkBtn.onclick = () => {
    const savedData = localStorage.getItem('webReader_bookmark');
    if (!savedData) return showToast("저장된 책갈피가 없습니다.", "error");

    const bookmark = JSON.parse(savedData);
    if (bookmark.fileName !== el.loadedFileName.textContent) {
        return showToast("현재 파일과 저장된 파일이 다릅니다.", "error");
    }

    el.contentArea.scrollTo({ top: bookmark.scrollTop, behavior: 'smooth' });
    showToast("위치를 복구했습니다.");
};