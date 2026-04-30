(() => {
  'use strict';

  const STORAGE_KEY = 'bunguFriendsSave.v1';
  const now = () => Date.now();
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

  const stageData = [
    { stage: 1, minLevel: 1, name: 'ふしぎなたまご', label: 'たまご', description: 'まだ中身はひみつ。やさしくタップしてね。' },
    { stage: 2, minLevel: 2, name: 'ちびぴつる', label: 'ちび文具', description: 'えんぴつの妖精が生まれたよ。' },
    { stage: 3, minLevel: 4, name: 'ぴつる', label: '見習い文具', description: 'がんばり屋のえんぴつ妖精。' },
    { stage: 4, minLevel: 7, name: 'リボンぴつる', label: 'きら文具', description: 'おしゃれなリボンをつけたぴつる。' },
    { stage: 5, minLevel: 10, name: 'スターぴつる', label: 'レア文具', description: 'ひらめきが星みたいに光る特別な姿。' }
  ];

  const messages = {
    egg: ['たまごがゆれてるよ。やさしくタップしてね。', '中から小さな音がするよ。', 'もうすぐ生まれそう。'],
    happy: ['いっしょにかこう！', 'きょうもがんばるね。', 'ぴかぴかで気持ちいい！', 'ほめられるとうれしいな。'],
    hungry: ['やる気インクがほしいな。', 'ちょっと元気がなくなってきたよ。'],
    dirty: ['けしカスがついちゃった。', 'おそうじしてくれたらうれしいな。'],
    sleepy: ['少しねむくなってきたよ。', 'ノートのベッドで休みたいな。']
  };

  const defaultSave = () => ({
    createdAt: now(),
    updatedAt: now(),
    lastDecayAt: now(),
    customName: '',
    level: 1,
    xp: 0,
    taps: 0,
    stage: 1,
    clean: 80,
    mood: 80,
    friend: 10,
    idea: 0,
    style: 0,
    sound: true,
    diary: ['ふしぎなたまごと出会ったよ。'],
    unlockedStages: [1]
  });

  let state = loadSave();
  let toastTimer = null;
  let audioContext = null;
  let gameTimer = null;
  let gameSeconds = 20;
  let gameScore = 0;
  let gameActive = false;

  const el = {
    soundToggle: document.getElementById('soundToggle'),
    characterButton: document.getElementById('characterButton'),
    characterArt: document.getElementById('characterArt'),
    characterName: document.getElementById('characterName'),
    speechBubble: document.getElementById('speechBubble'),
    levelText: document.getElementById('levelText'),
    xpText: document.getElementById('xpText'),
    xpBar: document.getElementById('xpBar'),
    cleanBar: document.getElementById('cleanBar'),
    moodBar: document.getElementById('moodBar'),
    friendBar: document.getElementById('friendBar'),
    ideaBar: document.getElementById('ideaBar'),
    styleBar: document.getElementById('styleBar'),
    cleanText: document.getElementById('cleanText'),
    moodText: document.getElementById('moodText'),
    friendText: document.getElementById('friendText'),
    ideaText: document.getElementById('ideaText'),
    styleText: document.getElementById('styleText'),
    diaryList: document.getElementById('diaryList'),
    bookGrid: document.getElementById('bookGrid'),
    toast: document.getElementById('toast'),
    gameModal: document.getElementById('gameModal'),
    openGame: document.getElementById('openGame'),
    closeGame: document.getElementById('closeGame'),
    startGame: document.getElementById('startGame'),
    gameBoard: document.getElementById('gameBoard'),
    gameTime: document.getElementById('gameTime'),
    gameScore: document.getElementById('gameScore'),
    renameButton: document.getElementById('renameButton'),
    resetButton: document.getElementById('resetButton')
  };

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      return { ...defaultSave(), ...parsed };
    } catch (error) {
      console.warn('Save data could not be loaded.', error);
      return defaultSave();
    }
  }

  function save() {
    state.updatedAt = now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function applyTimeDecay() {
    const elapsedMinutes = Math.floor((now() - state.lastDecayAt) / 60000);
    if (elapsedMinutes <= 0) return;
    const decayUnits = Math.min(24, Math.floor(elapsedMinutes / 20));
    if (decayUnits > 0) {
      state.clean = clamp(state.clean - decayUnits * 2);
      state.mood = clamp(state.mood - decayUnits * 2);
      state.lastDecayAt = now();
      if (state.clean < 30) addDiary('少しよごれてきたみたい。');
      if (state.mood < 30) addDiary('ぴつるのやる気が下がってきたよ。');
      save();
    }
  }

  function stageForLevel(level) {
    return stageData.slice().reverse().find(item => level >= item.minLevel) || stageData[0];
  }

  function updateStage() {
    const next = stageForLevel(state.level);
    if (next.stage !== state.stage) {
      state.stage = next.stage;
      if (!state.unlockedStages.includes(next.stage)) state.unlockedStages.push(next.stage);
      addDiary(`${next.name}に成長したよ。`);
      showToast(`進化！ ${next.name}になったよ`);
      playTone(740, 0.12);
      setTimeout(() => playTone(920, 0.14), 110);
    }
  }

  function xpNeed() {
    return 100 + (state.level - 1) * 35;
  }

  function gainXp(amount) {
    state.xp += amount;
    let leveled = false;
    while (state.xp >= xpNeed()) {
      state.xp -= xpNeed();
      state.level += 1;
      leveled = true;
    }
    if (leveled) {
      addDiary(`レベル${state.level}になったよ。`);
      showToast(`レベルアップ！ Lv.${state.level}`);
      playTone(660, 0.12);
      setTimeout(() => playTone(880, 0.12), 130);
    }
    updateStage();
  }

  function addDiary(text) {
    const date = new Date();
    const time = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    state.diary.unshift(`${time}　${text}`);
    state.diary = state.diary.slice(0, 12);
  }

  function randomMessage(group) {
    const list = messages[group] || messages.happy;
    return list[Math.floor(Math.random() * list.length)];
  }

  function getMoodMessage() {
    if (state.stage === 1) return randomMessage('egg');
    if (state.clean < 35) return randomMessage('dirty');
    if (state.mood < 35) return randomMessage('hungry');
    if (state.mood < 50) return randomMessage('sleepy');
    return randomMessage('happy');
  }

  function render() {
    const current = stageData.find(item => item.stage === state.stage) || stageData[0];
    const displayName = state.customName || current.name;
    el.characterName.textContent = displayName;
    el.levelText.textContent = state.level;
    el.xpText.textContent = `${state.xp} / ${xpNeed()}`;
    el.xpBar.style.width = `${Math.round((state.xp / xpNeed()) * 100)}%`;

    setBar(el.cleanBar, el.cleanText, state.clean);
    setBar(el.moodBar, el.moodText, state.mood);
    setBar(el.friendBar, el.friendText, state.friend);
    setBar(el.ideaBar, el.ideaText, state.idea);
    setBar(el.styleBar, el.styleText, state.style);

    el.soundToggle.textContent = state.sound ? '♪' : '×';
    el.speechBubble.textContent = getMoodMessage();
    renderCharacter();
    renderDiary();
    renderBook();
  }

  function setBar(bar, text, value) {
    const rounded = Math.round(value);
    bar.style.width = `${rounded}%`;
    text.textContent = rounded;
  }

  function renderCharacter() {
    if (state.stage === 1) {
      el.characterArt.className = 'egg art-stage-egg';
      el.characterArt.innerHTML = '<div class="egg-shine"></div><div class="egg-pattern p1"></div><div class="egg-pattern p2"></div>';
      return;
    }

    el.characterArt.className = `pet stage-${state.stage}`;
    el.characterArt.innerHTML = `
      <div class="star-crown">⭐</div>
      <div class="pet-cap"></div>
      <div class="ribbon"></div>
      <div class="pet-body"></div>
      <div class="arm left"></div>
      <div class="arm right"></div>
      <div class="face-eye left"></div>
      <div class="face-eye right"></div>
      <div class="cheek left"></div>
      <div class="cheek right"></div>
      <div class="mouth"></div>
      <div class="leg left"></div>
      <div class="leg right"></div>
    `;
  }

  function renderDiary() {
    el.diaryList.innerHTML = '';
    state.diary.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      el.diaryList.appendChild(li);
    });
  }

  function renderBook() {
    el.bookGrid.innerHTML = '';
    stageData.forEach(item => {
      const card = document.createElement('div');
      const unlocked = state.unlockedStages.includes(item.stage);
      card.className = `book-item${unlocked ? '' : ' locked'}`;
      card.innerHTML = `<b>${unlocked ? item.name : '？？？'}</b><span>${unlocked ? `${item.label}：${item.description}` : 'まだ出会っていない姿だよ。'}</span>`;
      el.bookGrid.appendChild(card);
    });
  }

  function handleCharacterTap() {
    state.friend = clamp(state.friend + 2);
    state.mood = clamp(state.mood + 1);
    state.taps += 1;
    if (state.stage === 1) {
      gainXp(22);
      if (state.taps >= 5 && state.level < 2) {
        state.xp = xpNeed();
        gainXp(0);
      }
      addDiary('たまごをやさしくタップしたよ。');
    } else {
      gainXp(8);
      addDiary(`${state.customName || 'ぴつる'}をなでたよ。`);
    }
    playTone(540, 0.06);
    save();
    render();
  }

  function care(action) {
    const actionMap = {
      feed: () => {
        state.mood = clamp(state.mood + 18);
        state.idea = clamp(state.idea + 4);
        gainXp(18);
        addDiary('きらきらインクをあげたよ。');
        showToast('やる気が上がったよ');
      },
      clean: () => {
        state.clean = clamp(state.clean + 24);
        state.friend = clamp(state.friend + 5);
        gainXp(16);
        addDiary('けしカスをきれいにしたよ。');
        showToast('ぴかぴかになったよ');
      },
      study: () => {
        state.idea = clamp(state.idea + 16);
        state.mood = clamp(state.mood - 5);
        state.friend = clamp(state.friend + 3);
        gainXp(22);
        addDiary('ノートでおべんきょうしたよ。');
        showToast('ひらめきが増えたよ');
      },
      style: () => {
        state.style = clamp(state.style + 16);
        state.friend = clamp(state.friend + 4);
        gainXp(20);
        addDiary('かわいいシールでデコったよ。');
        showToast('おしゃれになったよ');
      },
      sleep: () => {
        state.mood = clamp(state.mood + 12);
        state.clean = clamp(state.clean - 3);
        gainXp(10);
        addDiary('ノートのベッドで休んだよ。');
        showToast('少し休んで元気になったよ');
      }
    };

    const run = actionMap[action];
    if (!run) return;
    run();
    playTone(620, 0.08);
    save();
    render();
  }

  function showToast(text) {
    clearTimeout(toastTimer);
    el.toast.textContent = text;
    el.toast.classList.remove('hidden');
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2200);
  }

  function playTone(frequency, duration) {
    if (!state.sound) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.03);
    } catch (error) {
      console.warn('Audio is not available.', error);
    }
  }

  function openGame() {
    el.gameModal.classList.remove('hidden');
    resetGameBoard();
  }

  function closeGame() {
    stopGame();
    el.gameModal.classList.add('hidden');
  }

  function resetGameBoard() {
    gameSeconds = 20;
    gameScore = 0;
    gameActive = false;
    el.gameTime.textContent = gameSeconds;
    el.gameScore.textContent = gameScore;
    el.startGame.textContent = 'スタート';
    el.gameBoard.innerHTML = '';
    spawnDirt(8);
  }

  function startGame() {
    stopGame();
    gameActive = true;
    gameSeconds = 20;
    gameScore = 0;
    el.gameTime.textContent = gameSeconds;
    el.gameScore.textContent = gameScore;
    el.startGame.textContent = 'もう一度スタート';
    el.gameBoard.innerHTML = '';
    spawnDirt(12);
    gameTimer = setInterval(() => {
      gameSeconds -= 1;
      el.gameTime.textContent = gameSeconds;
      if (gameSeconds % 3 === 0) spawnDirt(3);
      if (gameSeconds <= 0) finishGame();
    }, 1000);
  }

  function stopGame() {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    gameActive = false;
  }

  function finishGame() {
    stopGame();
    const bonus = Math.min(35, Math.floor(gameScore / 2));
    state.clean = clamp(state.clean + bonus);
    state.idea = clamp(state.idea + Math.floor(gameScore / 8));
    state.friend = clamp(state.friend + Math.floor(gameScore / 10));
    gainXp(20 + bonus);
    addDiary(`けしごむそうじで${gameScore}点とったよ。`);
    save();
    render();
    showToast(`ゲーム終了！ ${gameScore}点`);
  }

  function spawnDirt(count) {
    const boardRect = el.gameBoard.getBoundingClientRect();
    const width = Math.max(260, boardRect.width || 320);
    const height = Math.max(260, boardRect.height || 310);
    for (let i = 0; i < count; i += 1) {
      const dirt = document.createElement('button');
      dirt.className = 'dirt';
      dirt.type = 'button';
      dirt.setAttribute('aria-label', 'よごれ');
      const size = 34 + Math.floor(Math.random() * 22);
      dirt.style.width = `${size}px`;
      dirt.style.height = `${size}px`;
      dirt.style.left = `${Math.floor(Math.random() * (width - size - 8)) + 4}px`;
      dirt.style.top = `${Math.floor(Math.random() * (height - size - 8)) + 4}px`;
      dirt.addEventListener('pointerdown', () => {
        if (!gameActive) return;
        dirt.remove();
        gameScore += 5;
        el.gameScore.textContent = gameScore;
        playTone(760, 0.05);
      }, { once: true });
      el.gameBoard.appendChild(dirt);
    }
  }

  function bindEvents() {
    el.characterButton.addEventListener('click', handleCharacterTap);
    el.soundToggle.addEventListener('click', () => {
      state.sound = !state.sound;
      save();
      render();
      showToast(state.sound ? '音をオンにしたよ' : '音をオフにしたよ');
    });

    document.querySelectorAll('.care-button[data-action]').forEach(button => {
      button.addEventListener('click', () => care(button.dataset.action));
    });

    document.querySelectorAll('.tab').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    el.openGame.addEventListener('click', openGame);
    el.closeGame.addEventListener('click', closeGame);
    el.startGame.addEventListener('click', startGame);
    el.gameModal.addEventListener('click', event => {
      if (event.target === el.gameModal) closeGame();
    });

    el.renameButton.addEventListener('click', () => {
      const currentName = state.customName || (stageData.find(item => item.stage === state.stage) || stageData[0]).name;
      const nextName = prompt('新しいなまえを入力してください', currentName);
      if (nextName === null) return;
      const cleanName = nextName.trim().slice(0, 12);
      state.customName = cleanName;
      addDiary(cleanName ? `なまえを「${cleanName}」にしたよ。` : 'なまえを元に戻したよ。');
      save();
      render();
    });

    el.resetButton.addEventListener('click', () => {
      const ok = confirm('育成データをはじめからに戻しますか？');
      if (!ok) return;
      state = defaultSave();
      save();
      render();
      showToast('はじめからに戻したよ');
    });
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    const target = document.getElementById(`${tabName}Panel`);
    if (target) target.classList.add('active');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('Service worker registration failed.', error);
      });
    });
  }

  applyTimeDecay();
  bindEvents();
  updateStage();
  save();
  render();
  registerServiceWorker();
})();
