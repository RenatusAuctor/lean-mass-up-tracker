import { auth, db, signInWithPopup, provider, onAuthStateChanged, signOut, ref, set, get, child } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const weightInput = document.getElementById('weight-input');
    const calcBtn = document.getElementById('calculate-btn');
    const setupSection = document.getElementById('setup-section');
    const dashboardSection = document.getElementById('dashboard');
    const resetBtn = document.getElementById('reset-btn');

    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfile = document.getElementById('user-profile');
    const userAvatar = document.getElementById('user-avatar');

    const elCalsEaten = document.getElementById('val-cals-eaten');
    const elCalsTarget = document.getElementById('val-cals-target');
    const elProEaten = document.getElementById('val-pro-eaten');
    const elProTarget = document.getElementById('val-pro-target');
    const elFatEaten = document.getElementById('val-fat-eaten');
    const elFatTarget = document.getElementById('val-fat-target');
    const elCarbEaten = document.getElementById('val-carb-eaten');
    const elCarbTarget = document.getElementById('val-carb-target');

    const barCals = document.getElementById('bar-calories');
    const barPro = document.getElementById('bar-protein');
    const barFat = document.getElementById('bar-fat');
    const barCarb = document.getElementById('bar-carbs');

    const mealText = document.getElementById('meal-text');
    const mealImage = document.getElementById('meal-image');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const spinner = analyzeBtn.querySelector('.spinner');
    const aiErrorMsg = document.getElementById('ai-error-msg');
    const mealList = document.getElementById('meal-list');
    
    const globalFeedList = document.getElementById('global-feed-list');
    const langToggleBtn = document.getElementById('lang-toggle-btn');

    // ---- State ----
    let currentUser = null;
    const todayStr = new Date().toLocaleDateString();
    
    let state = {
        lastDate: todayStr,
        hasTarget: false,
        weight: 0,
        targets: { cals: 0, pro: 0, fat: 0, carb: 0 },
        eaten: { cals: 0, pro: 0, fat: 0, carb: 0 },
        meals: [],
        history: {} // { "YYYY. MM. DD.": { eaten: {...}, meals: [...] } }
    };
    let currentImageBase64 = null;
    let currentLang = localStorage.getItem('lang') || 'ko';

    // ---- Initialization ----
    applyTranslations();
    
    // Restore local state
    const localState = localStorage.getItem('macro_state');
    if (localState) {
        let parsed = JSON.parse(localState);
        state = { ...state, ...parsed }; // Merge default with local
        checkDailyReset();
        renderState();
    }

    fetchGlobalFeed();

    // ---- Authentication & Data Sync ----
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            loginBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userAvatar.src = user.photoURL || '';
            
            const dbRef = ref(db);
            try {
                const snapshot = await get(child(dbRef, `users/${user.uid}/state`));
                if (snapshot.exists()) {
                    const cloudState = snapshot.val();
                    
                    // Smart Merge Logic: If user had unauthenticated local data today, merge it into cloud data
                    if (state.eaten && state.eaten.cals > 0 && cloudState.lastDate === todayStr) {
                        // Merge local into cloud
                        cloudState.eaten.cals += state.eaten.cals;
                        cloudState.eaten.pro += state.eaten.pro;
                        cloudState.eaten.fat += state.eaten.fat;
                        cloudState.eaten.carb += state.eaten.carb;
                        cloudState.meals = [...(state.meals || []), ...(cloudState.meals || [])];
                        state = cloudState;
                    } else if (state.eaten && state.eaten.cals > 0 && cloudState.lastDate !== todayStr) {
                        // Local has today's data, cloud is old. Keep local, just take targets from cloud if needed
                        if (!state.hasTarget && cloudState.hasTarget) {
                            state.hasTarget = cloudState.hasTarget;
                            state.targets = cloudState.targets;
                            state.weight = cloudState.weight;
                        }
                    } else {
                        // Just use cloud state
                        state = cloudState;
                    }
                }
                
                checkDailyReset();
                renderState();
                saveState(); // Save the newly merged state back to cloud and local
                
            } catch(e) {
                console.error("Failed to fetch user state", e);
            }
        } else {
            currentUser = null;
            loginBtn.classList.remove('hidden');
            userProfile.classList.add('hidden');
        }
    });

    loginBtn.onclick = () => {
        signInWithPopup(auth, provider).catch(error => {
            console.error("Login failed:", error);
            alert("Login Failed: " + error.message);
        });
    };

    logoutBtn.onclick = () => {
        signOut(auth).then(() => {
            state = {
                lastDate: todayStr,
                hasTarget: false,
                weight: 0,
                targets: { cals: 0, pro: 0, fat: 0, carb: 0 },
                eaten: { cals: 0, pro: 0, fat: 0, carb: 0 },
                meals: [],
                history: {}
            };
            localStorage.removeItem('macro_state');
            renderState();
        });
    };

    // ---- Daily Reset Logic ----
    function checkDailyReset() {
        const currentDateStr = new Date().toLocaleDateString();
        if (state.lastDate && state.lastDate !== currentDateStr) {
            // It's a new day! Archive yesterday's data
            if (!state.history) state.history = {};
            if (state.eaten.cals > 0) {
                state.history[state.lastDate] = {
                    eaten: { ...state.eaten },
                    meals: [...state.meals]
                };
            }
            // Reset today
            state.eaten = { cals: 0, pro: 0, fat: 0, carb: 0 };
            state.meals = [];
            state.lastDate = currentDateStr;
            saveState();
        }
    }

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
            if (window.t && window.t(key)) el.innerHTML = window.t(key);
        });
        document.querySelectorAll('[data-i18n-ph]').forEach(el => {
            const key = el.getAttribute('data-i18n-ph');
            if (window.t && window.t(key)) el.setAttribute('placeholder', window.t(key));
        });
        langToggleBtn.textContent = currentLang === 'ko' ? '🌐 JA' : '🌐 KO';
    }

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
        
        saveState();
        renderState();
    };

    resetBtn.onclick = () => {
        const msg = currentLang === 'ko' ? '오늘의 기록을 모두 초기화하시겠습니까?' : '今日の記録をすべてリセットしますか？';
        if(confirm(msg)) {
            state.eaten = { cals: 0, pro: 0, fat: 0, carb: 0 };
            state.meals = [];
            saveState();
            renderState();
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

    // ---- AI Analysis (Serverless API) ----
    analyzeBtn.onclick = async () => {
        const text = mealText.value.trim();
        if (!text && !currentImageBase64) {
            alert(currentLang === 'ko' ? "분석할 음식의 텍스트나 사진을 넣어주세요." : "分析する食べ物のテキストや写真を入れてください。");
            return;
        }

        setLoading(true);
        aiErrorMsg.classList.add('hidden');
        checkDailyReset(); // Ensure we are on the right day before adding

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    textPrompt: text,
                    base64Image: currentImageBase64,
                    langCode: currentLang === 'ko' ? 'Korean' : 'Japanese'
                })
            });

            if (!response.ok) throw new Error("API call failed");

            const result = await response.json();
            
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
            renderState();
            
            // Push to global feed (Serverless API)
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
        if (currentUser) {
            set(ref(db, 'users/' + currentUser.uid + '/state'), state).catch(e => console.error("Firebase sync error", e));
        }
    }

    function renderState() {
        if (state.hasTarget) {
            setupSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            setTimeout(() => dashboardSection.classList.remove('hidden'), 10);
            updateDashboardUI();
            renderMealHistory();
        } else {
            setupSection.style.display = 'flex';
            dashboardSection.style.display = 'none';
            dashboardSection.classList.add('hidden');
        }
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
        if (!element) return;
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
        if (!state.meals || state.meals.length === 0) {
            mealList.innerHTML = `<li class="empty-state">${window.t('emptyHistory') || '아직 기록된 식단이 없습니다.'}</li>`;
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
        if (!obj) return;
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

    // ---- Central Server (Global Feed) Serverless API ----
    async function publishToGlobalFeed(mealName, cals) {
        // Send a generic key instead of a hardcoded language message, so the frontend translates it.
        try {
            await fetch('/api/feed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: "SOMEONE_ADDED_MEAL", food: mealName, calories: cals, timestamp: Date.now() })
            });
            fetchGlobalFeed(); // refresh
        } catch(e) { console.error('Feed publish failed', e); }
    }

    async function fetchGlobalFeed() {
        try {
            const response = await fetch('/api/feed');
            if(!response.ok) return;
            const data = await response.json();
            
            if(data && Object.keys(data).length > 0) {
                const entries = Object.values(data).sort((a,b) => b.timestamp - a.timestamp);
                
                globalFeedList.innerHTML = entries.map(entry => {
                    const timeStr = new Date(entry.timestamp).toLocaleTimeString(currentLang === 'ko' ? 'ko-KR' : 'ja-JP', {hour:'2-digit', minute:'2-digit'});
                    // We can optionally translate entry.message here if we want, but it's fine
                    return `
                    <li style="border-left: 3px solid var(--neon-blue);">
                        <div class="meal-info">
                            <span class="meal-name">👤 Anonymous</span>
                            <span style="font-size: 0.8rem; color: #94a3b8;">${timeStr}</span>
                        </div>
                        <div style="font-size: 0.9rem; margin-top: 0.5rem;">
                            <strong>${entry.food}</strong> (${entry.calories} kcal)
                        </div>
                    </li>
                `}).join('');
            }
        } catch(e) { console.error('Feed fetch failed', e); }
    }
});
