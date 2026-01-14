/**
 * 웹 텍스트 리더(WebReader) 스크립트
 * 특징: 4MB 이상의 대용량 파일 고속 로딩, 뷰포트 맞춤형 동적 레이아웃, 가상 렌더링
 */

// 1. DOM 요소 참조 객체
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
    loadedFileName: document.getElementById('loadedFileName')
};

// 전역 상태 변수
let fullText = "";      // 전체 텍스트 데이터
let pagesData = [];     // 분할된 페이지별 텍스트 배열
let VIEW_HEIGHT = 0;    // 한 페이지의 높이 (스크롤 이동 단위)

/**
 * [최적화 엔진] 텍스트 분할 함수
 * 뷰포트 높이와 폰트 크기를 계산하여 글자 잘림 없는 최적의 줄 수를 결정합니다.
 */
function splitTextByChunk() {
    if (!fullText) return;
    pagesData = [];
    const lines = fullText.split('\n'); // 줄 단위 분할로 문단 보존
    
    // 안전 마진 계산: 패딩(120px) + 하단 마진(100px) + 보정값(30px) = 250px
    const safetyMargin = 250; 
    const availableHeight = el.contentArea.clientHeight - safetyMargin;
    
    // 줄당 높이 계산: CSS 폰트 사이즈 * line-height(1.6)
    const fontSize = parseFloat(getComputedStyle(el.display).fontSize) || 20.8;
    const lineHeight = fontSize * 1.6; 
    
    // 계산된 줄 수의 75%만 할당하여 가독성 및 하단 여유 공간 확보 (최대 22줄 제한)
    let autoLinesPerPage = Math.floor((availableHeight * 0.75) / lineHeight);
    const safeLines = Math.min(Math.max(1, autoLinesPerPage), 22);

    // 실제 데이터 분할 처리
    for (let i = 0; i < lines.length; i += safeLines) {
        pagesData.push(lines.slice(i, i + safeLines).join('\n'));
    }
    el.totalPage.textContent = pagesData.length;
}

/**
 * [가상 렌더링] 페이지 프레임 생성 함수
 * 수천 개의 DOM을 한꺼번에 로드하지 않고, 틀만 생성 후 필요한 시점에 텍스트를 주입합니다.
 */
function renderVirtualPages() {
    el.display.textContent = "";
    const fragment = document.createDocumentFragment();
    const totalCount = pagesData.length;
    
    for (let i = 0; i < totalCount; i++) {
        const frame = document.createElement('div');
        frame.className = 'page-frame';
        frame.dataset.index = i;
        frame.style.height = VIEW_HEIGHT + "px"; // 정밀한 스크롤 이동을 위한 고정 높이
        
        // 초기 로딩 성능을 위해 상단 10페이지만 즉시 관찰, 나머지는 지연 관찰
        if (i < 10) {
            frame.textContent = pagesData[i];
            pageObserver.observe(frame);
        } else {
            lazyLoadObserver.observe(frame);
        }
        fragment.appendChild(frame);
    }
    el.display.appendChild(fragment);
}

// 2차 관찰자: 멀리 있는 페이지가 스크롤 근처(1000px)에 오면 텍스트 주입 관찰자로 인계
const lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            pageObserver.observe(entry.target);
            lazyLoadObserver.unobserve(entry.target);
        }
    });
}, { root: el.contentArea, rootMargin: '1000px' });

// 1차 관찰자: 화면에 실제 노출된 프레임에만 텍스트를 넣고 현재 페이지 번호 갱신
const pageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.index);
            // 메모리 절약을 위해 실제 보일 때만 텍스트 채움
            if (!entry.target.textContent) entry.target.textContent = pagesData[idx];
            el.currentPage.textContent = idx + 1;
        }
    });
}, { root: el.contentArea, threshold: 0.1 });

// 파일 읽기 이벤트
el.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const startTime = performance.now();
    el.loadedFileName.textContent = file.name;
    VIEW_HEIGHT = el.contentArea.clientHeight - 120; // 스크롤 단위 설정

    const reader = new FileReader();
    reader.onload = (ev) => {
        fullText = ev.target.result;
        splitTextByChunk();  // 데이터 분할
        renderVirtualPages(); // 가상 렌더링
        el.contentArea.scrollTop = 0; // 초기 위치로
        console.log(`[완료] 로딩 시간: ${(performance.now() - startTime).toFixed(2)}ms`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ""; // 동일 파일 재업로드 가능하도록 초기화
};

// [반응형] 브라우저 창 크기 변경 시 실시간 레이아웃 최적화
window.onresize = () => {
    if (!fullText) return;
    VIEW_HEIGHT = el.contentArea.clientHeight - 120;
    splitTextByChunk();   // 변경된 높이에 맞춰 줄 수 재계산
    renderVirtualPages(); // 전체 레이아웃 재구성
    el.contentArea.scrollTop = 0;
};

// 네비게이션 버튼 이벤트 (고정 높이 + 마진을 고려한 정밀 이동)
el.loadBtn.onclick = () => el.fileInput.click();
el.firstBtn.onclick = () => el.contentArea.scrollTo({ top: 0, behavior: 'instant' });
el.lastBtn.onclick = () => el.contentArea.scrollTo({ top: el.contentArea.scrollHeight, behavior: 'instant' });
el.nextBtn.onclick = () => el.contentArea.scrollBy({ top: VIEW_HEIGHT + 100, behavior: 'instant' });
el.prevBtn.onclick = () => el.contentArea.scrollBy({ top: -(VIEW_HEIGHT + 100), behavior: 'instant' });

// 테마 변경 (다크/라이트 모드)
el.themeToggle.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
};

// TTS (음성 합성) 제어
el.speakButton.onclick = () => {
    window.speechSynthesis.cancel();
    const idx = parseInt(el.currentPage.textContent) - 1;
    const uttr = new SpeechSynthesisUtterance(pagesData[idx] || "");
    uttr.lang = 'ko-KR';
    window.speechSynthesis.speak(uttr);
};
el.stopButton.onclick = () => window.speechSynthesis.cancel();

// 토스트 알림 기능
function showToast(message, type = 'success') {
    el.toast.className = `toast toast-${type}`;
    el.toast.textContent = message;
    el.toast.classList.remove('toast-hidden');
    setTimeout(() => el.toast.classList.add('toast-hidden'), 3000);
}

// 책갈피 저장
el.saveBookMarkBtn.onclick = () => {
    if (!fullText) return showToast("파일을 먼저 불러와주세요.", "error");
    const bookmark = { 
        fileName: el.loadedFileName.textContent, 
        scrollTop: el.contentArea.scrollTop 
    };
    localStorage.setItem('webReader_bookmark', JSON.stringify(bookmark));
    showToast("책갈피가 저장되었습니다.");
};

// 책갈피 로드
el.loadBookMarkBtn.onclick = () => {
    const savedData = localStorage.getItem('webReader_bookmark');
    if (!savedData) return showToast("저장된 책갈피가 없습니다.", "error");
    const bookmark = JSON.parse(savedData);
    if (bookmark.fileName !== el.loadedFileName.textContent) {
        return showToast("현재 로드된 파일과 저장된 파일이 다릅니다.", "error");
    }
    el.contentArea.scrollTo({ top: bookmark.scrollTop, behavior: 'smooth' });
};