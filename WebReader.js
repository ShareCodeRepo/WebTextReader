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

    // 북 마크 저장, 로드
    saveBookMarkBtn: document.getElementById('saveBookMarkBtn'),
    loadBookMarkBtn: document.getElementById('loadBookMarkBtn'),

    // alert 커스텀
    toast: document.getElementById('toastContainer'),
    loadedFileName: document.getElementById('loadedFileName'),

    // 진행바 표시 요소: 컨테이너, 바, 백분율
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    progressPercent: document.getElementById('progressPercent')
};

let fullText = "";
let pagesData = [];
let VIEW_HEIGHT = 0;

// 페이지 분할 및 프로그레스 업데이트
async function splitTextByHeight() {
    el.display.textContent = "";
    pagesData = [];
    el.progressContainer.classList.add('active'); // CSS 클래스로 제어
    
    const measurer = document.createElement('div');
    measurer.className = 'measurer-hidden'; // style.css에 정의된 클래스 사용
    measurer.style.width = el.display.clientWidth + "px"; // 너비만 동적 계산
    document.body.appendChild(measurer);

    const lines = fullText.split('\n');
    let currentChunk = [];
    const totalLines = lines.length;

    for (let i = 0; i < totalLines; i++) {
        currentChunk.push(lines[i]);
        measurer.textContent = currentChunk.join('\n');
        
        if (measurer.offsetHeight > VIEW_HEIGHT) {
            currentChunk.pop(); 
            pagesData.push(currentChunk.join('\n'));
            currentChunk = [lines[i]]; // 마지막 줄을 다음 페이지 시작으로 설정 (중복 해결)
        }

        // 200줄마다 UI 갱신 (성능 최적화)
        if (i % 200 === 0) {
            const pct = Math.floor((i / totalLines) * 100);
            el.progressBar.style.width = pct + "%"; 
            el.progressPercent.textContent = pct;
            await new Promise(res => setTimeout(res, 0)); // 메인 스레드 양보
        }
    }
    
    if (currentChunk.length > 0) pagesData.push(currentChunk.join('\n'));
    document.body.removeChild(measurer);
    el.progressContainer.classList.remove('active');
}

// 가상 렌더링
function renderVirtualPages() {
    el.display.textContent = "";
    const fragment = document.createDocumentFragment();
    pagesData.forEach((_, index) => {
        const frame = document.createElement('div');
        frame.className = 'page-frame';
        frame.dataset.index = index;
        frame.style.height = VIEW_HEIGHT + "px";
        fragment.appendChild(frame);
        pageObserver.observe(frame);
    });
    el.display.appendChild(fragment);
    el.totalPage.textContent = pagesData.length;
}

const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.index);
            if (!entry.target.textContent) entry.target.textContent = pagesData[idx];
            el.currentPage.textContent = idx + 1;
        }
    });
}, { root: el.contentArea, threshold: 0.5 });

// 이벤트 핸들러
el.loadBtn.onclick = () => el.fileInput.click();

el.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 사이드바에 파일명 표시
    el.loadedFileName.textContent = file.name;
    
    VIEW_HEIGHT = el.contentArea.clientHeight - 120; // 상하 패딩 제외 실질 높이

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

el.firstBtn.onclick = () => el.contentArea.scrollTo({ top: 0, behavior: 'instant' });
el.lastBtn.onclick = () => el.contentArea.scrollTo({ top: el.contentArea.scrollHeight, behavior: 'instant' });
el.nextBtn.onclick = () => el.contentArea.scrollBy({ top: VIEW_HEIGHT + 100, behavior: 'instant' });
el.prevBtn.onclick = () => el.contentArea.scrollBy({ top: -(VIEW_HEIGHT + 100), behavior: 'instant' });

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

/**
 * 토스트 알림 표시 함수
 * @param {string} message - 표시할 메시지
 * @param {string} type - 'success' 또는 'error'
 */
function showToast(message, type = 'success') {
    // 기존 클래스 초기화
    el.toast.className = 'toast';
    
    // 타입에 따른 클래스 추가 (toast-success 또는 toast-error)
    el.toast.classList.add(`toast-${type}`);
    el.toast.textContent = message;

    // 표시 (toast-hidden 제거)
    el.toast.classList.remove('toast-hidden');

    // 3초 후 다시 숨김
    setTimeout(() => {
        el.toast.classList.add('toast-hidden');
    }, 3000);
}

// 현재 읽던 위치 저장
el.saveBookMarkBtn.onclick = () => {
    if (fullText.length === 0) {
        showToast("파일을 먼저 불러와주세요.", "error");
        return;
    }

    const bookmark = {
        fileName: el.loadedFileName.textContent,
        scrollTop: el.contentArea.scrollTop,
        timestamp: new Date().getTime()
    };

    localStorage.setItem('webReader_bookmark', JSON.stringify(bookmark));
    showToast("책갈피가 저장되었습니다.", "success");
};

// 저장된 위치 불러오기
el.loadBookMarkBtn.onclick = () => {
    const savedData = localStorage.getItem('webReader_bookmark');

    if (!savedData) {
        showToast("저장된 책갈피가 없습니다.", "error");
        return;
    }

    const bookmark = JSON.parse(savedData);
    const currentFileName = el.loadedFileName.textContent;
    
    if (currentFileName === "파일 없음" || !fullText) {
        showToast("파일을 먼저 불러와 주세요.", "error");
        return;
    }

    // 현재 열린 파일과 저장된 파일명이 다를 경우 경고
    if (bookmark.fileName !== el.loadedFileName.textContent) {
        showToast("현재 파일과 저장된 책갈피의 파일이 다릅니다.", "error");
        return;
    }

    el.contentArea.scrollTo({
        top: bookmark.scrollTop,
        behavior: 'smooth'
    });
    showToast("저장된 위치로 이동했습니다.", "success");
};