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

    // ---- Initialization ----
    if (apiKey) apiKeyInput.value = apiKey;

    if (state.hasTarget) {
        setupSection.classList.add('hidden');
        dashboardSection.style.display = 'block';
        setTimeout(() => dashboardSection.classList.remove('hidden'), 10);
        updateDashboardUI();
        renderMealHistory();
    }

    // ---- Settings Modal ----
    settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
    closeModal.onclick = () => settingsModal.classList.add('hidden');
    saveKeyBtn.onclick = () => {
        const val = apiKeyInput.value.trim();
        if (val) {
            apiKey = val;
            localStorage.setItem('gemini_api_key', apiKey);
            settingsModal.classList.add('hidden');
            alert('API 키가 저장되었습니다.');
        } else {
            alert('API 키를 입력해주세요.');
        }
    };

    // ---- Base Calculations ----
    calcBtn.onclick = () => {
        const weight = parseFloat(weightInput.value);
        if (isNaN(weight) || weight <= 0) {
            alert("올바른 체중을 입력해주세요.");
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
        if(confirm('오늘의 기록을 모두 초기화하시겠습니까?')) {
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
                // Extract base64 part
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
            alert("설정(⚙️)에서 Gemini API 키를 먼저 입력해주세요.");
            settingsModal.classList.remove('hidden');
            return;
        }

        const text = mealText.value.trim();
        if (!text && !currentImageBase64) {
            alert("분석할 음식의 텍스트를 입력하거나 사진을 업로드해주세요.");
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
                name: result.name || (text ? text.substring(0, 15) + '...' : '업로드한 사진'),
                macros: result,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            });

            saveState();
            updateDashboardUI();
            renderMealHistory();
            
            // Clear inputs
            mealText.value = '';
            removeImageBtn.click();
            
        } catch (error) {
            console.error("AI Error:", error);
            aiErrorMsg.textContent = "분석에 실패했습니다. API 키가 유효한지 확인하시거나 다시 시도해주세요.";
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
        
        // Target Labels
        document.getElementById('cal-protein').textContent = targets.pro * 4;
        document.getElementById('cal-fat').textContent = targets.fat * 9;
        document.getElementById('cal-carbs').textContent = targets.carb * 4;

        // Numbers
        elCalsTarget.textContent = targets.cals.toLocaleString();
        elProTarget.textContent = targets.pro;
        elFatTarget.textContent = targets.fat;
        elCarbTarget.textContent = targets.carb;

        animateValue(elCalsEaten, parseFloat(elCalsEaten.textContent.replace(/,/g, '')) || 0, eaten.cals);
        animateValue(elProEaten, parseFloat(elProEaten.textContent) || 0, eaten.pro);
        animateValue(elFatEaten, parseFloat(elFatEaten.textContent) || 0, eaten.fat);
        animateValue(elCarbEaten, parseFloat(elCarbEaten.textContent) || 0, eaten.carb);

        // Progress Bars
        updateBar(barCals, eaten.cals, targets.cals, true);
        updateBar(barPro, eaten.pro, targets.pro);
        updateBar(barFat, eaten.fat, targets.fat);
        updateBar(barCarb, eaten.carb, targets.carb);
    }

    function updateBar(element, current, max, isCalorie = false) {
        let pct = Math.min((current / max) * 100, 100);
        element.style.width = `${pct}%`;
        
        // Color warning if exceeding
        if (current > max) {
            if(isCalorie) {
                element.style.backgroundColor = 'var(--danger)';
            } else {
                element.classList.add('bg-danger');
            }
            element.parentElement.previousElementSibling.querySelector('.number').classList.add('text-danger');
        } else {
            if(isCalorie) {
                element.style.backgroundColor = 'white';
            } else {
                element.classList.remove('bg-danger');
            }
            element.parentElement.previousElementSibling.querySelector('.number').classList.remove('text-danger');
        }
    }

    function renderMealHistory() {
        if (state.meals.length === 0) {
            mealList.innerHTML = '<li class="empty-state">아직 기록된 식단이 없습니다.</li>';
            return;
        }
        
        mealList.innerHTML = state.meals.map(meal => `
            <li>
                <div class="meal-info">
                    <span class="meal-name">${meal.name} <span style="font-size: 0.75rem; color: #94a3b8; font-weight:normal">${meal.time}</span></span>
                    <span class="meal-cals">${meal.macros.calories} kcal</span>
                </div>
                <div class="meal-macros">
                    <span>🥩 단 ${meal.macros.protein}g</span>
                    <span>🥑 지 ${meal.macros.fat}g</span>
                    <span>🍚 탄 ${meal.macros.carbs}g</span>
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
        
        let parts = [];
        if (textPrompt) {
            parts.push({ text: `Analyze this meal: "${textPrompt}". Estimate the macronutrients. Return ONLY a valid JSON object with keys: "name" (a short string name of the food), "calories" (number), "protein" (number), "fat" (number), "carbs" (number). No markdown, no backticks, just the JSON string.` });
        } else {
            parts.push({ text: `Analyze the food in this image. Estimate the macronutrients. Return ONLY a valid JSON object with keys: "name" (a short string name of the food in Korean), "calories" (number), "protein" (number), "fat" (number), "carbs" (number). No markdown, no backticks, just the JSON string.` });
        }

        if (base64Image) {
            parts.push({
                inline_data: { mime_type: "image/jpeg", data: base64Image }
            });
        }

        const requestBody = {
            contents: [{ parts: parts }],
            generationConfig: {
                temperature: 0.2,
                response_mime_type: "application/json"
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        
        try {
            // Remove markdown code blocks if the model ignored instructions
            let cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);
            
            // Validate numbers
            return {
                name: result.name || '식단',
                calories: Math.max(0, parseInt(result.calories) || 0),
                protein: Math.max(0, parseInt(result.protein) || 0),
                fat: Math.max(0, parseInt(result.fat) || 0),
                carbs: Math.max(0, parseInt(result.carbs) || 0),
            };
        } catch (e) {
            throw new Error("Failed to parse JSON response from AI");
        }
    }
});
