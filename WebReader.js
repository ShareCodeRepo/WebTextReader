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

// [수정] 글자 수가 아닌 '줄 수' 기준으로 분할하여 짤림 방지
// function splitTextByChunk() {
//     pagesData = [];
//     const lines = fullText.split('\n'); // 전체 텍스트를 줄 단위로 분리
//     const LINES_PER_PAGE = 20; // 한 페이지에 표시할 적정 줄 수 (화면 크기에 따라 조절)

//     for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
//         // 지정된 줄 수만큼 잘라서 합침
//         const chunk = lines.slice(i, i + LINES_PER_PAGE).join('\n');
//         pagesData.push(chunk);
//     }
//     el.totalPage.textContent = pagesData.length;
// }

function splitTextByChunk() {
    pagesData = [];
    const lines = fullText.split('\n');
    
    // 1. 가용 높이 계산 (패딩 및 마진 고려하여 더 넉넉하게 제외)
    const safetyMargin = 250; 
    const availableHeight = el.contentArea.clientHeight - safetyMargin;
    
    // 2. 줄당 높이 계산 (style.css의 1.3rem * 1.6 반영)
    const fontSize = parseFloat(getComputedStyle(el.display).fontSize);
    const lineHeight = fontSize * 1.6; 
    
    // 3. 줄 수 계산 (가용 높이의 75%만 텍스트 영역으로 할당하여 20줄 내외 유도)
    let autoLinesPerPage = Math.floor((availableHeight * 0.75) / lineHeight);
    
    // 4. 최종 안전 장치: 계산값이 커지더라도 최대 22줄을 넘지 않도록 제한
    const safeLines = Math.min(Math.max(1, autoLinesPerPage), 22);

    for (let i = 0; i < lines.length; i += safeLines) {
        const chunk = lines.slice(i, i + safeLines).join('\n');
        pagesData.push(chunk);
    }
    
    el.totalPage.textContent = pagesData.length;
    console.log(`[안전 최적화] 계산: ${autoLinesPerPage}줄 -> 최종 확정: ${safeLines}줄`);
}

// [변경] 모든 페이지를 만들지 않고 "필요한 틀"만 만듭니다.
function renderVirtualPages() {
    el.display.textContent = "";
    const fragment = document.createDocumentFragment();
    
    // 핵심 최적화: 4MB 파일이 500페이지라면, 초기에는 상단 10페이지만 생성
    // 나머지는 빈 공간(Spacer)으로 처리하거나 순차적 생성
    const totalCount = pagesData.length;
    
    for (let i = 0; i < totalCount; i++) {
        const frame = document.createElement('div');
        frame.className = 'page-frame';
        frame.dataset.index = i;
        frame.style.height = VIEW_HEIGHT + "px"; // style.css의 설정과 연동
        
        // 초기 10페이지만 즉시 렌더링 (7초 지연의 주범인 대량 생성을 방지)
        if (i < 10) {
            frame.textContent = pagesData[i];
            pageObserver.observe(frame);
        } else {
            // 나머지는 스크롤이 근처에 올 때까지 관찰 보류 (Lazy Loading)
            lazyLoadObserver.observe(frame);
        }
        
        fragment.appendChild(frame);
    }
    el.display.appendChild(fragment);
    el.totalPage.textContent = totalCount;
}

// [추가] 멀리 있는 페이지를 위한 2차 관찰자
const lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            pageObserver.observe(entry.target); // 실제 텍스트 주입 관찰자로 인계
            lazyLoadObserver.unobserve(entry.target);
        }
    });
}, { root: el.contentArea, rootMargin: '1000px' }); // 1000px 근처에 오면 미리 준비

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

// [수정] 파일 로드 핸들러
el.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const startTime = performance.now();
    el.loadedFileName.textContent = file.name;
    VIEW_HEIGHT = el.contentArea.clientHeight - 120;

    const reader = new FileReader();
    reader.onload = (ev) => {
        fullText = ev.target.result;
        
        // 병목이었던 splitTextByHeight() 대신 아래 함수 실행
        splitTextByChunk(); 
        renderVirtualPages();
        
        el.contentArea.scrollTop = 0;
        const duration = (performance.now() - startTime).toFixed(2);
        console.log(`[최적화 완료] 로딩 시간: ${duration}ms`);
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

// [복구] 브라우저 크기 변경 시 레이아웃 실시간 재계산
window.onresize = () => {
    if (!fullText) return;

    // 1. 현재 본문 영역 높이 재측정
    VIEW_HEIGHT = el.contentArea.clientHeight - 120;

    // 2. 바뀐 높이에 맞춰 줄 수 및 페이지 데이터 재생성
    splitTextByChunk();
    
    // 3. 가상 페이지 틀 재렌더링
    renderVirtualPages();

    // 4. (선택) 페이지 중간에서 리사이즈 시 위치 유지를 위해 최상단 이동 또는 알림
    el.contentArea.scrollTop = 0;
    showToast("화면 크기에 맞춰 페이지를 재설정했습니다.", "success");
};