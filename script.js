document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const weightInput = document.getElementById('weight-input');
    const calcBtn = document.getElementById('calculate-btn');
    const setupSection = document.getElementById('setup-section');
    const dashboardSection = document.getElementById('dashboard');
    const resetBtn = document.getElementById('reset-btn');

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModal = document.getElementById('close-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');

    // Dashboard values
    const elCalsEaten = document.getElementById('val-cals-eaten');
    const elCalsTarget = document.getElementById('val-cals-target');
    const elProEaten = document.getElementById('val-pro-eaten');
    const elProTarget = document.getElementById('val-pro-target');
    const elFatEaten = document.getElementById('val-fat-eaten');
    const elFatTarget = document.getElementById('val-fat-target');
    const elCarbEaten = document.getElementById('val-carb-eaten');
    const elCarbTarget = document.getElementById('val-carb-target');

    // Progress Bars
    const barCals = document.getElementById('bar-calories');
    const barPro = document.getElementById('bar-protein');
    const barFat = document.getElementById('bar-fat');
    const barCarb = document.getElementById('bar-carbs');

    // AI Input
    const mealText = document.getElementById('meal-text');
    const mealImage = document.getElementById('meal-image');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const spinner = analyzeBtn.querySelector('.spinner');
    const aiErrorMsg = document.getElementById('ai-error-msg');
    const mealList = document.getElementById('meal-list');
    
    // Global Feed
    const globalFeedList = document.getElementById('global-feed-list');
    const langToggleBtn = document.getElementById('lang-toggle-btn');

    // ---- Configuration ----
    // 사용자님의 실제 서버 API 주소 또는 Firebase Database URL을 여기에 하드코딩하세요.
    // 예: "https://my-custom-server.com/api" 또는 "https://my-firebase-project.firebaseio.com/"
    const MY_SERVER_URL = "https://your-server-endpoint.com/"; 

    // ---- State ----
    let apiKey = localStorage.getItem('gemini_api_key') || '';
    
    let state = JSON.parse(localStorage.getItem('macro_state')) || {
        hasTarget: false,
        weight: 0,
        targets: { cals: 0, pro: 0, fat: 0, carb: 0 },
        eaten: { cals: 0, pro: 0, fat: 0, carb: 0 },
        meals: []
    };
    let currentImageBase64 = null;
    let currentLang = localStorage.getItem('lang') || 'ko';

    // ---- Initialization ----
    if (apiKey) apiKeyInput.value = apiKey;

    applyTranslations();

    if (state.hasTarget) {
        setupSection.classList.add('hidden');
        dashboardSection.style.display = 'block';
        setTimeout(() => dashboardSection.classList.remove('hidden'), 10);
        updateDashboardUI();
        renderMealHistory();
    }
    
    fetchGlobalFeed();

    // ---- Language Toggle ----
    langToggleBtn.onclick = () => {
        currentLang = currentLang === 'ko' ? 'ja' : 'ko';
        localStorage.setItem('lang', currentLang);
        applyTranslations();
        renderMealHistory();
    };

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.innerHTML = window.t(key);
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            el.setAttribute('placeholder', window.t(key));
        });
        langToggleBtn.textContent = currentLang === 'ko' ? '🌐 JA' : '🌐 KO';
    }

    // ---- Settings Modal ----
    settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
    closeModal.onclick = () => settingsModal.classList.add('hidden');
    saveKeyBtn.onclick = () => {
        apiKey = apiKeyInput.value.trim();
        localStorage.setItem('gemini_api_key', apiKey);
        settingsModal.classList.add('hidden');
    };

    // ---- Base Calculations ----
    calcBtn.onclick = () => {
        const weight = parseFloat(weightInput.value);
        if (isNaN(weight) || weight <= 0) {
            alert(currentLang === 'ko' ? "올바른 체중을 입력해주세요." : "正しい体重を入力してください。");
            return;
        }

        const totalCalories = Math.round(weight * 42);
        const proteinGrams = Math.round(weight * 2);
        const fatGrams = Math.round(weight * 1.1);
        const carbsGrams = Math.max(0, Math.round((totalCalories - (proteinGrams * 4 + fatGrams * 9)) / 4));

        state.hasTarget = true;
        state.weight = weight;
        state.targets = { cals: totalCalories, pro: proteinGrams, fat: fatGrams, carb: carbsGrams };
        state.eaten = { cals: 0, pro: 0, fat: 0, carb: 0 };
        state.meals = [];
        
        saveState();
        
        setupSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        setTimeout(() => dashboardSection.classList.remove('hidden'), 10);
        
        updateDashboardUI();
        renderMealHistory();
    };

    resetBtn.onclick = () => {
        const msg = currentLang === 'ko' ? '오늘의 기록을 모두 초기화하시겠습니까?' : '今日の記録をすべてリセットしますか？';
        if(confirm(msg)) {
            state.eaten = { cals: 0, pro: 0, fat: 0, carb: 0 };
            state.meals = [];
            saveState();
            updateDashboardUI();
            renderMealHistory();
        }
    };

    // ---- Image Upload Preview ----
    mealImage.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imagePreview.src = event.target.result;
                imagePreview.classList.remove('hidden');
                removeImageBtn.classList.remove('hidden');
                currentImageBase64 = event.target.result.split(',')[1];
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageBtn.onclick = () => {
        mealImage.value = '';
        currentImageBase64 = null;
        imagePreview.classList.add('hidden');
        removeImageBtn.classList.add('hidden');
    };

    // ---- AI Analysis ----
    analyzeBtn.onclick = async () => {
        if (!apiKey) {
            alert(currentLang === 'ko' ? "설정(⚙️)에서 Gemini API 키를 먼저 입력해주세요." : "設定(⚙️)からGemini APIキーを先に入力してください。");
            settingsModal.classList.remove('hidden');
            return;
        }

        const text = mealText.value.trim();
        if (!text && !currentImageBase64) {
            alert(currentLang === 'ko' ? "분석할 음식의 텍스트나 사진을 넣어주세요." : "分析する食べ物のテキストや写真を入れてください。");
            return;
        }

        setLoading(true);
        aiErrorMsg.classList.add('hidden');

        try {
            const result = await callGeminiAPI(text, currentImageBase64);
            
            // Add to state
            state.eaten.cals += result.calories;
            state.eaten.pro += result.protein;
            state.eaten.fat += result.fat;
            state.eaten.carb += result.carbs;
            
            state.meals.unshift({
                name: result.name || (text ? text.substring(0, 15) + '...' : 'Uploaded Photo'),
                macros: result,
                time: new Date().toLocaleTimeString(currentLang === 'ko' ? 'ko-KR' : 'ja-JP', { hour: '2-digit', minute: '2-digit' })
            });

            saveState();
            updateDashboardUI();
            renderMealHistory();
            
            // Push to global feed (Central Server)
            publishToGlobalFeed(result.name, result.calories);
            
            // Clear inputs
            mealText.value = '';
            if(!removeImageBtn.classList.contains('hidden')) removeImageBtn.click();
            
        } catch (error) {
            console.error("AI Error:", error);
            aiErrorMsg.classList.remove('hidden');
        } finally {
            setLoading(false);
        }
    };

    // ---- Core Functions ----
    function saveState() {
        localStorage.setItem('macro_state', JSON.stringify(state));
    }

    function setLoading(isLoading) {
        if (isLoading) {
            btnText.classList.add('hidden');
            spinner.classList.remove('hidden');
            analyzeBtn.disabled = true;
        } else {
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    }

    function updateDashboardUI() {
        const { targets, eaten } = state;
        
        document.getElementById('cal-protein').textContent = targets.pro * 4;
        document.getElementById('cal-fat').textContent = targets.fat * 9;
        document.getElementById('cal-carbs').textContent = targets.carb * 4;

        elCalsTarget.textContent = targets.cals.toLocaleString();
        elProTarget.textContent = targets.pro;
        elFatTarget.textContent = targets.fat;
        elCarbTarget.textContent = targets.carb;

        animateValue(elCalsEaten, parseFloat(elCalsEaten.textContent.replace(/,/g, '')) || 0, eaten.cals);
        animateValue(elProEaten, parseFloat(elProEaten.textContent) || 0, eaten.pro);
        animateValue(elFatEaten, parseFloat(elFatEaten.textContent) || 0, eaten.fat);
        animateValue(elCarbEaten, parseFloat(elCarbEaten.textContent) || 0, eaten.carb);

        updateBar(barCals, eaten.cals, targets.cals, true);
        updateBar(barPro, eaten.pro, targets.pro);
        updateBar(barFat, eaten.fat, targets.fat);
        updateBar(barCarb, eaten.carb, targets.carb);
    }

    function updateBar(element, current, max, isCalorie = false) {
        let pct = Math.min((current / max) * 100, 100);
        element.style.width = `${pct}%`;
        
        if (current > max) {
            if(isCalorie) element.style.backgroundColor = 'var(--danger)';
            else element.classList.add('bg-danger');
            element.parentElement.previousElementSibling.querySelector('.number').classList.add('text-danger');
        } else {
            if(isCalorie) element.style.backgroundColor = 'white';
            else element.classList.remove('bg-danger');
            element.parentElement.previousElementSibling.querySelector('.number').classList.remove('text-danger');
        }
    }

    function renderMealHistory() {
        if (state.meals.length === 0) {
            mealList.innerHTML = `<li class="empty-state">${window.t('emptyHistory')}</li>`;
            return;
        }
        
        mealList.innerHTML = state.meals.map(meal => `
            <li>
                <div class="meal-info">
                    <span class="meal-name">${meal.name} <span style="font-size: 0.75rem; color: #94a3b8; font-weight:normal">${meal.time}</span></span>
                    <span class="meal-cals">${meal.macros.calories} kcal</span>
                </div>
                <div class="meal-macros">
                    <span>🥩 ${currentLang==='ko'?'단':'タ'} ${meal.macros.protein}g</span>
                    <span>🥑 ${currentLang==='ko'?'지':'脂'} ${meal.macros.fat}g</span>
                    <span>🍚 ${currentLang==='ko'?'탄':'炭'} ${meal.macros.carbs}g</span>
                </div>
            </li>
        `).join('');
    }

    function animateValue(obj, start, end) {
        if (start === end) {
            obj.innerHTML = Math.floor(end).toLocaleString();
            return;
        }
        let startTimestamp = null;
        const duration = 800;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentVal = start + (end - start) * easeOutQuart;
            
            obj.innerHTML = Math.floor(currentVal).toLocaleString();
            if (progress < 1) window.requestAnimationFrame(step);
            else obj.innerHTML = Math.floor(end).toLocaleString();
        };
        window.requestAnimationFrame(step);
    }

    // ---- Gemini API Fetch ----
    async function callGeminiAPI(textPrompt, base64Image) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        let langCode = currentLang === 'ko' ? 'Korean' : 'Japanese';
        let parts = [];
        if (textPrompt) {
            parts.push({ text: `Analyze this meal: "${textPrompt}". Estimate the macronutrients. Return ONLY a valid JSON object with keys: "name" (a short string name of the food in ${langCode}), "calories" (number), "protein" (number), "fat" (number), "carbs" (number). No markdown.` });
        } else {
            parts.push({ text: `Analyze the food in this image. Estimate the macronutrients. Return ONLY a valid JSON object with keys: "name" (a short string name of the food in ${langCode}), "calories" (number), "protein" (number), "fat" (number), "carbs" (number). No markdown.` });
        }

        if (base64Image) {
            parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Image } });
        }

        const requestBody = { contents: [{ parts: parts }], generationConfig: { temperature: 0.2, response_mime_type: "application/json" } };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        
        try {
            let cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);
            return {
                name: result.name || (currentLang === 'ko' ? '식단' : '食事'),
                calories: Math.max(0, parseInt(result.calories) || 0),
                protein: Math.max(0, parseInt(result.protein) || 0),
                fat: Math.max(0, parseInt(result.fat) || 0),
                carbs: Math.max(0, parseInt(result.carbs) || 0),
            };
        } catch (e) {
            throw new Error("Parse failed");
        }
    }

    // ---- Central Server (Global Feed) ----
    async function publishToGlobalFeed(mealName, cals) {
        if(!MY_SERVER_URL || MY_SERVER_URL.includes('your-server-endpoint')) return;
        const msg = currentLang === 'ko' ? '누군가 방금 식단을 추가했습니다!' : '誰かが食事を追加しました！';
        const data = {
            message: msg,
            food: mealName,
            calories: cals,
            timestamp: Date.now()
        };
        try {
            // Firebase Realtime DB URL example: https://my-db.firebaseio.com/feed.json
            const endpoint = MY_SERVER_URL.endsWith('.json') ? MY_SERVER_URL : `${MY_SERVER_URL}feed.json`;
            await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            fetchGlobalFeed(); // refresh
        } catch(e) { console.error('Feed publish failed'); }
    }

    async function fetchGlobalFeed() {
        if(!MY_SERVER_URL || MY_SERVER_URL.includes('your-server-endpoint')) return;
        try {
            // Get last 5 entries
            const endpoint = MY_SERVER_URL.endsWith('.json') ? MY_SERVER_URL : `${MY_SERVER_URL}feed.json`;
            const response = await fetch(`${endpoint}?orderBy="$key"&limitToLast=5`);
            if(!response.ok) return;
            const data = await response.json();
            
            if(data && Object.keys(data).length > 0) {
                // Convert object to array and sort descending
                const entries = Object.values(data).sort((a,b) => b.timestamp - a.timestamp);
                
                globalFeedList.innerHTML = entries.map(entry => `
                    <li style="border-left: 3px solid var(--neon-blue);">
                        <div class="meal-info">
                            <span class="meal-name">👤 Anonymous</span>
                            <span style="font-size: 0.8rem; color: #94a3b8;">${new Date(entry.timestamp).toLocaleTimeString(currentLang === 'ko' ? 'ko-KR' : 'ja-JP', {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div style="font-size: 0.9rem; margin-top: 0.5rem;">
                            <strong>${entry.food}</strong> (${entry.calories} kcal)
                        </div>
                    </li>
                `).join('');
            }
        } catch(e) { console.error('Feed fetch failed'); }
    }
});
