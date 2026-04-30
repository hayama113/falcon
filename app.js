(() => {
  'use strict';

  const STORAGE_KEY = 'bunguFriendsSave.v2';
  const OLD_STORAGE_KEY = 'bunguFriendsSave.v1';
  const now = () => Date.now();
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
  const randomItem = list => list[Math.floor(Math.random() * list.length)];

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
    petted: ['えへへ、なでなでうれしい！', 'もっとなでてほしいな。', 'なかよし度アップだよ！'],
    angry: ['つつかないで〜！', 'ぷんぷん！やさしくなでてね。', 'びっくりしたよ、もう！'],
    hungry: ['やる気インクがほしいな。', 'ちょっと元気がなくなってきたよ。'],
    dirty: ['けしカスがついちゃった。', 'おそうじしてくれたらうれしいな。'],
    sleepy: ['少しねむくなってきたよ。', 'ノートのベッドで休みたいな。']
  };

  const gameDefs = {
    rps: { title: 'じゃんけんゲーム', help: '相手の手に勝つ手を選ぼう。' },
    candy: { title: 'キャンディーをタップ', help: '出てくるキャンディーをタップして消そう。' },
    look: { title: 'あっち向いてホイ', help: 'ぴつるが向く方向を予想して当てよう。' },
    flags: { title: '赤旗、白旗ゲーム', help: '出された指示と同じボタンを押そう。' },
    catch: { title: 'お皿キャッチ', help: '上から落ちてくる物を、お皿で受け止めよう。' }
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
    bgm: false,
    diary: ['ふしぎなたまごと出会ったよ。'],
    unlockedStages: [1]
  });

  let state = loadSave();
  let toastTimer = null;
  let effectTimer = null;
  let audioContext = null;
  let bgmTimer = null;
  let bgmStep = 0;
  let pointerState = null;

  let currentGame = 'rps';
  let gameTimer = null;
  let gameSeconds = 20;
  let gameScore = 0;
  let gameActive = false;
  let gameIntervals = [];
  let catchLoopId = null;
  let catchObjects = [];
  let catchDishX = 160;
  let lastCatchFrame = 0;

  const el = {
    soundToggle: document.getElementById('soundToggle'),
    bgmToggle: document.getElementById('bgmToggle'),
    characterButton: document.getElementById('characterButton'),
    characterArt: document.getElementById('characterArt'),
    reactionEffect: document.getElementById('reactionEffect'),
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
    gameTitle: document.getElementById('gameTitle'),
    gameHelp: document.getElementById('gameHelp'),
    renameButton: document.getElementById('renameButton'),
    resetButton: document.getElementById('resetButton')
  };

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
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
    return randomItem(list);
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

    el.soundToggle.textContent = state.sound ? '🔊' : '🔇';
    el.bgmToggle.classList.toggle('on', state.bgm);
    el.bgmToggle.textContent = state.bgm ? 'BGM ON' : 'BGM';
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

  function speak(text) {
    el.speechBubble.textContent = text;
  }

  function showReaction(mark, className) {
    clearTimeout(effectTimer);
    el.reactionEffect.textContent = mark;
    el.reactionEffect.classList.remove('hidden');
    el.characterArt.classList.remove('happy', 'angry', 'hatch-tap');
    el.characterArt.classList.add(className);
    effectTimer = setTimeout(() => {
      el.reactionEffect.classList.add('hidden');
      el.characterArt.classList.remove('happy', 'angry', 'hatch-tap');
    }, 850);
  }

  function hatchTap() {
    state.friend = clamp(state.friend + 2);
    state.mood = clamp(state.mood + 1);
    state.taps += 1;
    gainXp(22);
    if (state.taps >= 5 && state.level < 2) {
      state.xp = xpNeed();
      gainXp(0);
    }
    addDiary('たまごをやさしくタップしたよ。');
    save();
    render();
    speak('たまごがコトコトゆれたよ。もうすぐ生まれそう！');
    showReaction('🥚', 'hatch-tap');
    playTone(540, 0.06);
  }

  function petCharacter() {
    state.friend = clamp(state.friend + 5);
    state.mood = clamp(state.mood + 4);
    gainXp(9);
    addDiary(`${state.customName || 'ぴつる'}をなでたよ。`);
    save();
    render();
    speak(randomMessage('petted'));
    showReaction('💗', 'happy');
    playTone(760, 0.08);
  }

  function angerCharacter() {
    state.friend = clamp(state.friend - 1);
    state.mood = clamp(state.mood - 4);
    addDiary(`${state.customName || 'ぴつる'}をタップして、少し怒らせちゃった。`);
    save();
    render();
    speak(randomMessage('angry'));
    showReaction('💢', 'angry');
    playTone(220, 0.08);
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

  function ensureAudioContext() {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function playTone(frequency, duration, volume = 0.06, type = 'sine') {
    if (!state.sound) return;
    try {
      const context = ensureAudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.03);
    } catch (error) {
      console.warn('Audio is not available.', error);
    }
  }

  function playBgmNote(frequency, startDelay, duration, volume) {
    if (!state.bgm) return;
    try {
      const context = ensureAudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      const start = context.currentTime + startDelay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    } catch (error) {
      console.warn('BGM is not available.', error);
    }
  }

  function startBgm() {
    stopBgm(false);
    state.bgm = true;
    save();
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.00, 698.46];
    bgmStep = 0;
    const tick = () => {
      const note = melody[bgmStep % melody.length];
      const bass = bgmStep % 4 === 0 ? 261.63 : 329.63;
      playBgmNote(note, 0, 0.42, 0.025);
      playBgmNote(bass, 0.02, 0.5, 0.012);
      bgmStep += 1;
    };
    tick();
    bgmTimer = setInterval(tick, 620);
    render();
  }

  function stopBgm(shouldSave = true) {
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = null;
    if (shouldSave) {
      state.bgm = false;
      save();
      render();
    }
  }

  function openGame() {
    el.gameModal.classList.remove('hidden');
    selectGame(currentGame);
  }

  function closeGame() {
    stopGame(true);
    el.gameModal.classList.add('hidden');
  }

  function selectGame(gameName) {
    currentGame = gameName;
    const def = gameDefs[currentGame];
    stopGame(false);
    document.querySelectorAll('.game-choice').forEach(button => {
      button.classList.toggle('active', button.dataset.game === currentGame);
    });
    el.gameTitle.textContent = def.title;
    el.gameHelp.textContent = def.help;
    el.gameTime.textContent = gameSeconds;
    el.gameScore.textContent = gameScore;
    el.startGame.textContent = 'スタート';
    el.gameBoard.innerHTML = `<div class="game-center"><div class="game-prompt">${def.title}</div><div class="game-result">スタートを押してね。</div></div>`;
  }

  function startGame() {
    stopGame(false);
    gameActive = true;
    gameSeconds = 20;
    gameScore = 0;
    el.gameTime.textContent = gameSeconds;
    el.gameScore.textContent = gameScore;
    el.startGame.textContent = 'もう一度スタート';
    setupCurrentGame();
    gameTimer = setInterval(() => {
      gameSeconds -= 1;
      el.gameTime.textContent = gameSeconds;
      if (gameSeconds <= 0) finishGame();
    }, 1000);
  }

  function stopGame(clearBoard) {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    gameIntervals.forEach(timer => clearInterval(timer));
    gameIntervals = [];
    if (catchLoopId) cancelAnimationFrame(catchLoopId);
    catchLoopId = null;
    catchObjects = [];
    lastCatchFrame = 0;
    gameActive = false;
    if (clearBoard) el.gameBoard.innerHTML = '';
  }

  function finishGame() {
    stopGame(false);
    const bonus = Math.min(35, Math.floor(gameScore / 2));
    state.clean = clamp(state.clean + Math.floor(bonus / 2));
    state.idea = clamp(state.idea + Math.floor(gameScore / 8));
    state.friend = clamp(state.friend + Math.floor(gameScore / 10));
    state.mood = clamp(state.mood + Math.floor(gameScore / 12));
    gainXp(18 + bonus);
    addDiary(`${gameDefs[currentGame].title}で${gameScore}点とったよ。`);
    save();
    render();
    el.gameBoard.innerHTML = `<div class="game-center"><div class="game-prompt">ゲーム終了！</div><div class="game-result">${gameScore}点とったよ。</div></div>`;
    showToast(`ゲーム終了！ ${gameScore}点`);
  }

  function addScore(points, text) {
    if (!gameActive) return;
    gameScore = Math.max(0, gameScore + points);
    el.gameScore.textContent = gameScore;
    if (text) {
      const result = el.gameBoard.querySelector('.game-result');
      if (result) result.textContent = text;
    }
    if (points > 0) playTone(820, 0.05);
    if (points < 0) playTone(180, 0.06);
  }

  function setupCurrentGame() {
    if (currentGame === 'rps') setupRpsGame();
    if (currentGame === 'candy') setupCandyGame();
    if (currentGame === 'look') setupLookGame();
    if (currentGame === 'flags') setupFlagsGame();
    if (currentGame === 'catch') setupCatchGame();
  }

  function setupRpsGame() {
    const hands = [
      { key: 'rock', label: 'グー', emoji: '✊', beats: 'scissors' },
      { key: 'scissors', label: 'チョキ', emoji: '✌️', beats: 'paper' },
      { key: 'paper', label: 'パー', emoji: '✋', beats: 'rock' }
    ];
    let target = randomItem(hands);
    el.gameBoard.innerHTML = `
      <div class="game-center">
        <div class="game-prompt"></div>
        <div class="game-actions"></div>
        <div class="game-result">勝つ手をえらんでね。</div>
      </div>`;
    const prompt = el.gameBoard.querySelector('.game-prompt');
    const actions = el.gameBoard.querySelector('.game-actions');
    const drawRound = () => {
      target = randomItem(hands);
      prompt.textContent = `相手は ${target.emoji} ${target.label}`;
    };
    hands.forEach(hand => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'game-action';
      button.textContent = `${hand.emoji}\n${hand.label}`;
      button.addEventListener('click', () => {
        if (!gameActive) return;
        if (hand.beats === target.key) addScore(10, '勝ち！ +10');
        else if (hand.key === target.key) addScore(3, 'あいこ！ +3');
        else addScore(0, 'まけ。次がんばろう。');
        drawRound();
      });
      actions.appendChild(button);
    });
    drawRound();
  }

  function setupCandyGame() {
    el.gameBoard.innerHTML = '';
    const spawnCandy = count => {
      const rect = el.gameBoard.getBoundingClientRect();
      const width = Math.max(260, rect.width || 320);
      const height = Math.max(260, rect.height || 310);
      for (let i = 0; i < count; i += 1) {
        const candy = document.createElement('button');
        candy.type = 'button';
        candy.className = 'candy';
        candy.textContent = '🍬';
        const size = 34 + Math.floor(Math.random() * 18);
        candy.style.width = `${size}px`;
        candy.style.height = `${size}px`;
        candy.style.left = `${Math.floor(Math.random() * (width - size - 12)) + 6}px`;
        candy.style.top = `${Math.floor(Math.random() * (height - size - 12)) + 6}px`;
        candy.addEventListener('pointerdown', () => {
          if (!gameActive) return;
          candy.remove();
          addScore(5, 'キャンディー！ +5');
        }, { once: true });
        el.gameBoard.appendChild(candy);
      }
    };
    spawnCandy(14);
    gameIntervals.push(setInterval(() => spawnCandy(3), 1900));
  }

  function setupLookGame() {
    const dirs = [
      { key: 'up', label: 'うえ', emoji: '⬆️' },
      { key: 'down', label: 'した', emoji: '⬇️' },
      { key: 'left', label: 'ひだり', emoji: '⬅️' },
      { key: 'right', label: 'みぎ', emoji: '➡️' }
    ];
    el.gameBoard.innerHTML = `
      <div class="game-center">
        <div class="game-prompt">あっち向いて……ホイ！</div>
        <div class="game-actions two"></div>
        <div class="game-result">方向を予想してね。</div>
      </div>`;
    const actions = el.gameBoard.querySelector('.game-actions');
    dirs.forEach(dir => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'game-action';
      button.textContent = `${dir.emoji} ${dir.label}`;
      button.addEventListener('click', () => {
        if (!gameActive) return;
        const answer = randomItem(dirs);
        const resultText = `ぴつるは${answer.label}！`;
        if (dir.key === answer.key) addScore(10, `${resultText} あたり！ +10`);
        else addScore(2, `${resultText} おしい！ +2`);
      });
      actions.appendChild(button);
    });
  }

  function setupFlagsGame() {
    const commands = [
      { color: 'red', up: true, text: '赤あげて！' },
      { color: 'red', up: false, text: '赤さげて！' },
      { color: 'white', up: true, text: '白あげて！' },
      { color: 'white', up: false, text: '白さげて！' }
    ];
    const flagState = { red: false, white: false };
    let current = randomItem(commands);
    el.gameBoard.innerHTML = `
      <div class="game-center">
        <div class="game-prompt"></div>
        <div class="flag-area">
          <div class="flag-person"><div id="redFlag" class="flag-stick down"><div class="flag-cloth red"></div></div><span>赤</span></div>
          <div class="flag-person"><div id="whiteFlag" class="flag-stick down"><div class="flag-cloth white"></div></div><span>白</span></div>
        </div>
        <div class="game-actions two"></div>
        <div class="game-result">指示どおりに押そう。</div>
      </div>`;
    const prompt = el.gameBoard.querySelector('.game-prompt');
    const actions = el.gameBoard.querySelector('.game-actions');
    const redFlag = el.gameBoard.querySelector('#redFlag');
    const whiteFlag = el.gameBoard.querySelector('#whiteFlag');
    const updateFlags = () => {
      redFlag.classList.toggle('down', !flagState.red);
      whiteFlag.classList.toggle('down', !flagState.white);
    };
    const nextCommand = () => {
      current = randomItem(commands);
      prompt.textContent = current.text;
    };
    commands.forEach(command => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'game-action';
      button.textContent = command.text.replace('！', '');
      button.addEventListener('click', () => {
        if (!gameActive) return;
        flagState[command.color] = command.up;
        updateFlags();
        const ok = command.color === current.color && command.up === current.up;
        addScore(ok ? 8 : -2, ok ? '正解！ +8' : 'ちがうよ。 -2');
        nextCommand();
      });
      actions.appendChild(button);
    });
    updateFlags();
    nextCommand();
  }

  function setupCatchGame() {
    el.gameBoard.innerHTML = '<div id="catchDish" class="catch-dish" aria-hidden="true"></div>';
    const dish = el.gameBoard.querySelector('#catchDish');
    const setDish = clientX => {
      const rect = el.gameBoard.getBoundingClientRect();
      catchDishX = clamp(clientX - rect.left, 48, rect.width - 48);
      dish.style.left = `${catchDishX}px`;
    };
    dish.style.left = `${catchDishX}px`;
    el.gameBoard.addEventListener('pointermove', event => {
      if (!gameActive) return;
      setDish(event.clientX);
    });
    el.gameBoard.addEventListener('pointerdown', event => {
      if (!gameActive) return;
      setDish(event.clientX);
    });

    const spawnItem = () => {
      if (!gameActive) return;
      const rect = el.gameBoard.getBoundingClientRect();
      const item = document.createElement('div');
      item.className = 'fall-item';
      item.textContent = randomItem(['✏️', '📎', '⭐', '🍬', '🌸']);
      const x = Math.floor(Math.random() * Math.max(1, rect.width - 38));
      const obj = { el: item, x, y: -34, speed: 120 + Math.random() * 90, caught: false };
      item.style.left = `${x}px`;
      item.style.top = `${obj.y}px`;
      catchObjects.push(obj);
      el.gameBoard.appendChild(item);
    };

    const loop = time => {
      if (!gameActive) return;
      if (!lastCatchFrame) lastCatchFrame = time;
      const delta = Math.min(0.04, (time - lastCatchFrame) / 1000);
      lastCatchFrame = time;
      const rect = el.gameBoard.getBoundingClientRect();
      catchObjects.forEach(obj => {
        obj.y += obj.speed * delta;
        obj.el.style.top = `${obj.y}px`;
        const itemCenter = obj.x + 17;
        const caughtY = obj.y > rect.height - 64 && obj.y < rect.height - 18;
        const caughtX = Math.abs(itemCenter - catchDishX) < 58;
        if (!obj.caught && caughtY && caughtX) {
          obj.caught = true;
          obj.el.remove();
          addScore(6, 'キャッチ！ +6');
        }
      });
      catchObjects = catchObjects.filter(obj => {
        if (obj.caught) return false;
        if (obj.y > rect.height + 40) {
          obj.el.remove();
          return false;
        }
        return true;
      });
      catchLoopId = requestAnimationFrame(loop);
    };

    spawnItem();
    gameIntervals.push(setInterval(spawnItem, 650));
    catchLoopId = requestAnimationFrame(loop);
  }

  function bindEvents() {
    el.characterButton.addEventListener('pointerdown', event => {
      pointerState = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, distance: 0, stroked: false };
      el.characterButton.setPointerCapture(event.pointerId);
    });

    el.characterButton.addEventListener('pointermove', event => {
      if (!pointerState || pointerState.id !== event.pointerId) return;
      const dx = event.clientX - pointerState.lastX;
      const dy = event.clientY - pointerState.lastY;
      pointerState.distance += Math.hypot(dx, dy);
      pointerState.lastX = event.clientX;
      pointerState.lastY = event.clientY;
      if (pointerState.distance > 34) pointerState.stroked = true;
    });

    const finishPointer = event => {
      if (!pointerState || pointerState.id !== event.pointerId) return;
      const wasStroked = pointerState.stroked;
      pointerState = null;
      if (state.stage === 1) {
        hatchTap();
      } else if (wasStroked) {
        petCharacter();
      } else {
        angerCharacter();
      }
    };

    el.characterButton.addEventListener('pointerup', finishPointer);
    el.characterButton.addEventListener('pointercancel', () => { pointerState = null; });

    el.soundToggle.addEventListener('click', () => {
      state.sound = !state.sound;
      save();
      render();
      showToast(state.sound ? '効果音をオンにしたよ' : '効果音をオフにしたよ');
    });

    el.bgmToggle.addEventListener('click', () => {
      if (state.bgm) {
        stopBgm(true);
        showToast('BGMをオフにしたよ');
      } else {
        startBgm();
        showToast('BGMをオンにしたよ');
      }
    });

    document.querySelectorAll('.care-button[data-action]').forEach(button => {
      button.addEventListener('click', () => care(button.dataset.action));
    });

    document.querySelectorAll('.tab').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    document.querySelectorAll('.game-choice').forEach(button => {
      button.addEventListener('click', () => selectGame(button.dataset.game));
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
      stopBgm(false);
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
  if (state.bgm) state.bgm = false;
  save();
  render();
  registerServiceWorker();
})();
