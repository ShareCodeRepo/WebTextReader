const el = {
    fileInput: document.getElementById('fileInput'),
    loadBtn: document.getElementById('loadBtn'),
    display: document.getElementById('display'),
    themeToggle: document.getElementById('themeToggle'),
    speakButton: document.getElementById('speakButton'),
    stopButton: document.getElementById('stopButton'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    currentPage: document.getElementById('currentPage'),
    totalPage: document.getElementById('totalPage'),
    saveBtn: document.getElementById('saveBtn'),
    configInput: document.getElementById('configInput'),
    loadConfigBtn: document.getElementById('loadConfigBtn'),
    contentArea: document.querySelector('.content-area')
};

let fullText = "";
let currentIndex = 0;
const CHUNK_SIZE = 30000; // 한 페이지당 글자 수

// 1. 파일 열기
el.loadBtn.onclick = () => el.fileInput.click();
el.fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        fullText = ev.target.result;
        currentIndex = 0;
        render();
        e.target.value = "";
    };
    reader.readAsText(file);
};

// 2. 렌더링 및 페이지 갱신
function render() {
    if (!fullText) return;
    el.display.innerText = fullText.substring(currentIndex, currentIndex + CHUNK_SIZE);
    el.contentArea.scrollTop = 0;
    
    const current = Math.floor(currentIndex / CHUNK_SIZE) + 1;
    const total = Math.ceil(fullText.length / CHUNK_SIZE);
    el.currentPage.innerText = current;
    el.totalPage.innerText = total;
}

// 3. 페이지 이동
el.nextBtn.onclick = () => {
    if (currentIndex + CHUNK_SIZE < fullText.length) {
        currentIndex += CHUNK_SIZE;
        render();
    }
};
el.prevBtn.onclick = () => {
    if (currentIndex - CHUNK_SIZE >= 0) {
        currentIndex -= CHUNK_SIZE;
        render();
    }
};

// 4. 위치 저장
el.saveBtn.onclick = () => {
    if (!fullText) return;
    const data = { index: currentIndex, theme: document.documentElement.getAttribute('data-theme') };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reader_pos.json";
    a.click();
};

// 5. 위치 불러오기
el.loadConfigBtn.onclick = () => el.configInput.click();
el.configInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file || !fullText) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        currentIndex = data.index || 0;
        if (data.theme) document.documentElement.setAttribute('data-theme', data.theme);
        render();
        e.target.value = "";
    };
    reader.readAsText(file);
};

// 테마 및 TTS
el.themeToggle.onclick = () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
};
el.speakButton.onclick = () => {
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(el.display.innerText);
    uttr.lang = 'ko-KR';
    window.speechSynthesis.speak(uttr);
};
el.stopButton.onclick = () => window.speechSynthesis.cancel();