(() => {
  'use strict';

  const fixtures = window.LOCAL_LORE_FIXTURES;
  const views = ['setup', 'play', 'reveal', 'summary', 'rankings', 'notes'];
  const els = {};
  document.querySelectorAll('[id]').forEach((node) => { els[node.id] = node; });

  const state = {
    view: 'setup', cityId: 'toronto', radius: 3, modeId: 'daily', rounds: [], roundIndex: 0, scores: [], current: freshRoundState(), pendingMethod: null
  };

  function freshRoundState() {
    return { method: 'named', text: '', selected: null, pin: null, clueUsed: false, result: null };
  }

  function cacheElements() {
    document.querySelectorAll('[data-view-target]').forEach((node) => node.addEventListener('click', () => handleNavigation(node.dataset.viewTarget)));
    els.brandHome.addEventListener('click', () => handleNavigation('setup'));
    els.setupForm.addEventListener('submit', startSet);
    document.querySelectorAll('input[name="radius"], input[name="mode"], input[name="city"]').forEach((input) => input.addEventListener('change', updateSetupCopy));
    els.backToSetup.addEventListener('click', () => handleNavigation('setup'));
    els.clueButton.addEventListener('click', useClue);
    els.closeClue.addEventListener('click', closeClue);
    els.namedMethodTab.addEventListener('click', () => requestMethodSwitch('named'));
    els.pinMethodTab.addEventListener('click', () => requestMethodSwitch('pin'));
    els.confirmMethodSwitch.addEventListener('click', () => { if (state.pendingMethod) switchMethod(state.pendingMethod); state.pendingMethod = null; els.switchNotice.hidden = true; });
    els.cancelMethodSwitch.addEventListener('click', () => { state.pendingMethod = null; els.switchNotice.hidden = true; announce('Your staged answer is still selected.'); });
    els.guessInput.addEventListener('input', handleGuessInput);
    els.guessInput.addEventListener('keydown', handleGuessKeydown);
    els.clearInput.addEventListener('click', clearNamedAnswer);
    els.suggestionList.addEventListener('click', (event) => { const option = event.target.closest('[role="option"]'); if (option) selectSuggestion(Number(option.dataset.index)); });
    els.editAnswer.addEventListener('click', focusCurrentMethod);
    els.commitAnswer.addEventListener('click', commitAnswer);
    els.mapStage.addEventListener('click', handleMapClick);
    els.mapStage.addEventListener('keydown', handleMapKeydown);
    document.querySelectorAll('[data-nudge]').forEach((button) => button.addEventListener('click', () => nudgePin(button.dataset.nudge)));
    els.clearPin.addEventListener('click', clearPin);
    els.nextRoundButton.addEventListener('click', nextRound);
    els.revealFinishButton.addEventListener('click', finishSet);
    els.playAgainButton.addEventListener('click', () => startSet({ preventDefault() {} }));
    els.boardSelect.addEventListener('change', () => showToast('The second board is a fixture preview for the next ruleset.'));
  }

  function getCheckedValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : null;
  }

  function updateSetupCopy() {
    const cityId = getCheckedValue('city') || 'toronto';
    const radius = Number(getCheckedValue('radius') || 3);
    const modeId = getCheckedValue('mode') || 'daily';
    const city = fixtures.cities[cityId] || fixtures.cities.toronto;
    const mode = fixtures.modes[modeId] || fixtures.modes.daily;
    document.querySelectorAll('.choice-card-city').forEach((card) => card.classList.toggle('is-selected', Boolean(card.querySelector('input')?.checked)));
    document.querySelectorAll('.segment-option').forEach((card) => card.classList.toggle('is-selected', card.querySelector('input').checked));
    document.querySelectorAll('.mode-card').forEach((card) => card.classList.toggle('is-selected', card.querySelector('input').checked));
    els.radiusHint.textContent = city.radiusHints[radius];
    els.startSetLabel.textContent = `Start ${mode.label}`;
    els.coverageStatus.querySelector('p').textContent = `${mode.rounds.length} sample rounds · replay anytime.`;
    els.coverageStatus.querySelector('b').textContent = 'Ready to play';
  }

  function startSet(event) {
    if (event?.preventDefault) event.preventDefault();
    state.cityId = getCheckedValue('city') || 'toronto';
    state.radius = Number(getCheckedValue('radius') || 3);
    state.modeId = getCheckedValue('mode') || 'daily';
    const mode = fixtures.modes[state.modeId];
    state.rounds = mode.rounds.map((round) => ({ ...round, catalog: round.catalog.map(([label, secondary]) => ({ label, secondary })) }));
    state.roundIndex = 0;
    state.scores = [];
    state.current = freshRoundState();
    renderRound();
    showView('play');
    announce(`${mode.label} started. Round 1 of ${state.rounds.length}.`);
  }

  function renderRound() {
    const round = state.rounds[state.roundIndex];
    if (!round) return;
    const mode = fixtures.modes[state.modeId];
    const city = fixtures.cities[state.cityId];
    state.current = freshRoundState();
    els.playModeLabel.textContent = mode.eyebrow;
    els.playScopeLabel.textContent = `${city.name} · ${state.radius} km radius`;
    els.roundProgressLabel.textContent = `ROUND ${String(state.roundIndex + 1).padStart(2, '0')} OF ${state.rounds.length}`;
    els.sceneCount.textContent = `SCENE ${String(state.roundIndex + 1).padStart(2, '0')} / ${String(state.rounds.length).padStart(2, '0')}`;
    els.progressFill.style.width = `${(state.roundIndex / state.rounds.length) * 100}%`;
    els.sceneFrame.style.backgroundImage = `linear-gradient(180deg, rgba(10, 22, 17, .04) 35%, rgba(10, 22, 17, .62) 100%), url("${round.image}")`;
    els.sceneFrame.style.backgroundPosition = round.imagePosition || 'center';
    els.sceneFrame.setAttribute('aria-label', `Fixed ${round.category.toLowerCase()} scene for round ${state.roundIndex + 1}. Panning and zooming are unavailable.`);
    els.sceneCategory.textContent = round.category;
    els.playHeading.textContent = /[?.!]$/.test(round.prompt) ? round.prompt : `${round.prompt}.`;
    els.sceneInstruction.textContent = round.instruction;
    els.answerTypeBadge.textContent = round.answerType.toUpperCase();
    els.answerHeading.textContent = mode.answerLabel;
    els.answerHelp.textContent = modeIdHelp(mode);
    els.guessInput.placeholder = round.placeholder;
    els.guessInput.value = '';
    els.inputStatus.textContent = 'Start with two letters. Suggestions are scoped to Toronto.';
    els.clearInput.hidden = true;
    closeSuggestions();
    closeClue();
    els.clueButton.hidden = !mode.clues;
    els.clueButton.disabled = false;
    els.clueLabel.textContent = 'Use a clue';
    els.clueCost.textContent = '−20%';
    els.mapGuessPin.hidden = true;
    els.mapGuessPin.style.left = '50%';
    els.mapGuessPin.style.top = '50%';
    els.pinStatus.textContent = 'No pin placed yet.';
    els.namedPane.hidden = false;
    els.namedPane.classList.remove('is-hidden');
    els.pinPane.hidden = true;
    els.pinPane.classList.add('is-hidden');
    els.namedMethodTab.classList.add('is-active');
    els.pinMethodTab.classList.remove('is-active');
    els.namedMethodTab.setAttribute('aria-selected', 'true');
    els.pinMethodTab.setAttribute('aria-selected', 'false');
    els.stagedAnswer.hidden = true;
    els.commitAnswer.disabled = true;
    els.switchNotice.hidden = true;
    els.clueText.textContent = round.clue;
    renderRoundStrip();
  }

  function modeIdHelp(mode) {
    if (state.modeId === 'landmark') return 'Type the public street name, or switch to a pin for practice.';
    if (mode.untimed) return 'Practice is untimed. Choose a suggestion, or use a pin for a distance score.';
    return 'Choose or type an answer, then lock it in. This sample set can be replayed anytime.';
  }

  function requestMethodSwitch(method) {
    if (state.current.method === method) { focusCurrentMethod(); return; }
    const hasStaged = Boolean(state.current.selected || state.current.pin || state.current.text.trim());
    if (hasStaged) {
      state.pendingMethod = method;
      const label = method === 'named' ? 'Type answer' : 'Drop a pin';
      els.switchNoticeText.textContent = `Switching to ${label} will clear your staged answer.`;
      els.switchNotice.hidden = false;
      els.confirmMethodSwitch.textContent = `Switch to ${label}`;
      els.switchNotice.focus();
      return;
    }
    switchMethod(method);
  }

  function switchMethod(method) {
    state.current.method = method;
    state.current.text = '';
    state.current.selected = null;
    state.current.pin = null;
    els.stagedAnswer.hidden = true;
    els.commitAnswer.disabled = true;
    closeSuggestions();
    els.guessInput.value = '';
    els.clearInput.hidden = true;
    els.mapGuessPin.hidden = true;
    els.pinStatus.textContent = 'No pin placed yet.';
    const named = method === 'named';
    els.namedPane.hidden = !named;
    els.namedPane.classList.toggle('is-hidden', !named);
    els.pinPane.hidden = named;
    els.pinPane.classList.toggle('is-hidden', named);
    els.namedMethodTab.classList.toggle('is-active', named);
    els.pinMethodTab.classList.toggle('is-active', !named);
    els.namedMethodTab.setAttribute('aria-selected', String(named));
    els.pinMethodTab.setAttribute('aria-selected', String(!named));
    announce(named ? 'Answer method changed to type answer.' : 'Answer method changed to drop a pin.');
    focusCurrentMethod();
  }

  function focusCurrentMethod() {
    window.setTimeout(() => { if (state.current.method === 'named') els.guessInput.focus(); else els.mapStage.focus(); }, 0);
  }

  function handleGuessInput() {
    state.current.text = els.guessInput.value;
    state.current.selected = null;
    els.clearInput.hidden = !state.current.text;
    updateStagedAnswer();
    renderSuggestions(state.current.text);
  }

  function handleGuessKeydown(event) {
    const options = [...els.suggestionList.querySelectorAll('[role="option"]')];
    const active = Number(els.guessInput.getAttribute('aria-activedescendant')?.replace('suggestion-', '') ?? -1);
    if (event.key === 'ArrowDown' && options.length && !els.suggestionList.hidden) { event.preventDefault(); setActiveSuggestion(active < options.length - 1 ? active + 1 : 0); }
    else if (event.key === 'ArrowUp' && options.length && !els.suggestionList.hidden) { event.preventDefault(); setActiveSuggestion(active > 0 ? active - 1 : options.length - 1); }
    else if (event.key === 'Enter') {
      if (options.length && !els.suggestionList.hidden && options[active]) { event.preventDefault(); selectSuggestion(Number(options[active].dataset.index)); }
      else if (!els.commitAnswer.disabled) { event.preventDefault(); commitAnswer(); }
    } else if (event.key === 'Escape') closeSuggestions();
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.guessInput.focus(); }
  }

  function renderSuggestions(query) {
    const round = state.rounds[state.roundIndex];
    const normalizedQuery = normalize(query);
    if (!round || normalizedQuery.length < 2) { closeSuggestions(); return; }
    const matches = round.catalog.map((item, index) => ({ ...item, index, score: suggestionScore(normalizedQuery, item.label) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, 6);
    els.suggestionList.innerHTML = matches.map((item, index) => `<button type="button" role="option" id="suggestion-${index}" data-index="${item.index}" aria-selected="false"><span class="suggestion-icon" aria-hidden="true">⌖</span><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.secondary)}</small></span></button>`).join('');
    els.suggestionList.hidden = matches.length === 0;
    els.guessInput.setAttribute('aria-expanded', String(matches.length > 0));
    els.guessInput.removeAttribute('aria-activedescendant');
  }

  function suggestionScore(query, label) {
    const target = normalize(label);
    if (target.startsWith(query)) return 3;
    if (target.includes(query)) return 2;
    return query.split(/\s+/).filter(Boolean).every((token) => target.includes(token)) ? 1 : 0;
  }

  function setActiveSuggestion(index) {
    const options = [...els.suggestionList.querySelectorAll('[role="option"]')];
    options.forEach((option, optionIndex) => option.setAttribute('aria-selected', String(optionIndex === index)));
    const option = options[index];
    if (!option) return;
    els.guessInput.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }

  function selectSuggestion(index) {
    const item = state.rounds[state.roundIndex].catalog[index];
    if (!item) return;
    els.guessInput.value = item.label;
    state.current.text = item.label;
    state.current.selected = item;
    els.clearInput.hidden = false;
    closeSuggestions();
    updateStagedAnswer();
    announce(`Staged answer: ${item.label}.`);
  }

  function clearNamedAnswer() {
    els.guessInput.value = '';
    state.current.text = '';
    state.current.selected = null;
    els.clearInput.hidden = true;
    closeSuggestions();
    updateStagedAnswer();
    els.guessInput.focus();
  }

  function closeSuggestions() {
    els.suggestionList.hidden = true;
    els.suggestionList.innerHTML = '';
    els.guessInput.setAttribute('aria-expanded', 'false');
    els.guessInput.removeAttribute('aria-activedescendant');
  }

  function updateStagedAnswer() {
    const hasAnswer = state.current.method === 'named' ? Boolean(state.current.text.trim()) : Boolean(state.current.pin);
    els.commitAnswer.disabled = !hasAnswer;
    if (!hasAnswer) { els.stagedAnswer.hidden = true; return; }
    const value = state.current.method === 'named' ? state.current.text.trim() : `Pin at ${Math.round(state.current.pin.x)}%, ${Math.round(state.current.pin.y)}% of scope`;
    els.stagedAnswerText.textContent = value;
    els.stagedAnswer.hidden = false;
  }

  function useClue() {
    const mode = fixtures.modes[state.modeId];
    if (!mode.clues || state.current.clueUsed) return;
    state.current.clueUsed = true;
    els.clueLabel.textContent = 'Clue used';
    els.clueCost.textContent = '−20%';
    els.clueButton.disabled = true;
    els.cluePopover.hidden = false;
    announce('Clue revealed. Your score for this round is reduced by 20 percent.');
  }

  function closeClue() { els.cluePopover.hidden = true; }

  function handleMapClick(event) {
    if (event.target.closest('.map-guess-pin')) return;
    const rect = els.mapStage.getBoundingClientRect();
    setPin(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  }

  function handleMapKeydown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); nudgePin(event.key.replace('Arrow', '').toLowerCase()); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!state.current.pin) setPin(50, 50); }
  }

  function setPin(x, y) {
    state.current.pin = { x: clamp(x, 4, 96), y: clamp(y, 6, 94) };
    els.mapGuessPin.style.left = `${state.current.pin.x}%`;
    els.mapGuessPin.style.top = `${state.current.pin.y}%`;
    els.mapGuessPin.hidden = false;
    els.pinStatus.textContent = `Pin placed at ${Math.round(state.current.pin.x)}% east, ${Math.round(state.current.pin.y)}% within the scope.`;
    updateStagedAnswer();
    announce('Guess pin placed. Use the arrow controls to nudge it, or lock it in.');
  }

  function nudgePin(direction) {
    const pin = state.current.pin || { x: 50, y: 50 };
    const step = 2.5;
    const deltas = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] };
    const [dx, dy] = deltas[direction] || [0, 0];
    setPin(pin.x + dx, pin.y + dy);
  }

  function clearPin() {
    state.current.pin = null;
    els.mapGuessPin.hidden = true;
    els.pinStatus.textContent = 'No pin placed yet.';
    updateStagedAnswer();
    els.mapStage.focus();
    announce('Guess pin removed.');
  }

  function commitAnswer() {
    if (els.commitAnswer.disabled) { showToast(state.current.method === 'named' ? 'Choose or type an answer first.' : 'Place a pin on the map first.'); focusCurrentMethod(); return; }
    closeSuggestions();
    const round = state.rounds[state.roundIndex];
    const result = scoreRound(round);
    state.current.result = result;
    state.scores[state.roundIndex] = result;
    renderReveal(round, result);
    showView('reveal');
    announce(`Round complete. ${result.score} points.`);
  }

  function scoreRound(round) {
    const hintFactor = state.current.clueUsed ? 0.8 : 1;
    if (state.current.method === 'named') {
      const normalized = normalize(state.current.text);
      const correct = round.accepted.some((answer) => normalize(answer) === normalized);
      const nearMiss = !correct && round.nearMiss.some((token) => normalized.includes(token));
      return { score: correct ? Math.round(1000 * hintFactor) : 0, method: 'named', correct, nearMiss, distance: null, answer: state.current.text.trim(), clueUsed: state.current.clueUsed, message: correct ? (state.current.clueUsed ? 'Correct — with a little help from the field notes.' : 'You were right on the connection.') : (nearMiss ? 'Right street, different corner.' : 'Not quite this time. The reveal will make the relationship clearer.') };
    }
    const target = round.targetPin;
    const dx = state.current.pin.x - target.x;
    const dy = state.current.pin.y - target.y;
    const distance = Math.round(Math.hypot(dx, dy) * 12);
    const tolerance = 25;
    const falloff = 125;
    const quality = distance >= tolerance + (falloff * 6) ? 0 : Math.exp(-Math.max(0, distance - tolerance) / falloff);
    return { score: Math.round(1000 * quality * hintFactor), method: 'pin', correct: distance <= tolerance, nearMiss: distance <= 150, distance, answer: `Pin at ${Math.round(state.current.pin.x)}%, ${Math.round(state.current.pin.y)}%`, clueUsed: state.current.clueUsed, message: distance <= tolerance ? 'You landed inside the target area.' : distance <= 150 ? 'Close enough to see the connection.' : 'A useful first guess. The target is marked on the reveal.' };
  }

  function renderReveal(round, result) {
    els.roundScoreValue.textContent = result.score.toLocaleString();
    els.revealHeading.textContent = result.score >= 800 ? 'You found the connection.' : result.score >= 350 ? 'You were in the neighborhood.' : 'A new corner to remember.';
    els.revealSubheading.textContent = result.method === 'pin' ? `${result.distance} m from the reviewed target. Accuracy beats speed here.` : 'Here’s what this place can teach you.';
    els.revealAnswerType.textContent = round.category === 'PUBLIC BUILDING' ? 'STREET SHOWN' : 'TARGET SHOWN';
    els.revealAnswer.textContent = round.answer;
    els.resultMessage.innerHTML = `<span class="result-symbol ${result.correct ? '' : 'result-symbol-muted'}" aria-hidden="true">${result.correct ? '✓' : '·'}</span><p>${escapeHtml(result.message)}</p>`;
    els.spatialNoteText.textContent = round.note;
    els.revealMeta.textContent = `${result.method === 'pin' ? 'Pin answer' : 'Named answer'} · ${result.clueUsed ? 'clue used · −20%' : 'unassisted'}`;
    els.revealMap.style.setProperty('--target-x', `${round.targetPin.x}%`);
    els.revealMap.style.setProperty('--target-y', `${round.targetPin.y}%`);
    if (result.method === 'pin') {
      els.revealMap.style.setProperty('--guess-x', `${state.current.pin.x}%`);
      els.revealMap.style.setProperty('--guess-y', `${state.current.pin.y}%`);
      els.revealMap.classList.add('has-guess');
      els.revealMap.setAttribute('aria-label', `Answer map. Your pin was ${result.distance} meters from the target. Target marker shown in coral.`);
    } else {
      els.revealMap.classList.remove('has-guess');
      els.revealMap.setAttribute('aria-label', `Answer map showing the target at ${round.answer}. No pin was submitted.`);
    }
    els.nextRoundButton.innerHTML = state.roundIndex === state.rounds.length - 1 ? 'See your set result <span aria-hidden="true">→</span>' : 'Next place <span aria-hidden="true">→</span>';
    renderRoundStrip();
  }

  function renderRoundStrip() {
    els.roundStrip.innerHTML = state.rounds.map((round, index) => {
      const result = state.scores[index];
      const active = index === state.roundIndex;
      const status = result ? `${result.score.toLocaleString()} pts` : active ? 'current' : 'locked';
      return `<div class="round-strip-item ${active ? 'is-current' : ''} ${result ? 'is-complete' : ''}"><span class="round-strip-number">${String(index + 1).padStart(2, '0')}</span><span><b>${escapeHtml(round.category)}</b><small>${status}</small></span><span class="round-strip-symbol" aria-hidden="true">${result ? '✓' : active ? '•' : '·'}</span></div>`;
    }).join('');
  }

  function nextRound() {
    if (state.roundIndex >= state.rounds.length - 1) { finishSet(); return; }
    state.roundIndex += 1;
    renderRound();
    showView('play');
    announce(`Round ${state.roundIndex + 1} of ${state.rounds.length}.`);
  }

  function finishSet() {
    const completed = state.scores.filter(Boolean);
    const total = completed.reduce((sum, result) => sum + result.score, 0);
    const correct = completed.filter((result) => result.correct).length;
    const pinDistances = completed.filter((result) => result.distance !== null).map((result) => result.distance).sort((a, b) => a - b);
    const median = pinDistances.length ? pinDistances[Math.floor(pinDistances.length / 2)] : null;
    els.summaryScore.textContent = total.toLocaleString();
    els.summaryAccuracy.textContent = `${Math.round((correct / Math.max(1, completed.length)) * 100)}%`;
    els.summaryDistance.textContent = median === null ? 'Named' : `${median} m`;
    els.summaryMarks.textContent = String(10 + (completed.filter((result) => result.correct && !result.clueUsed).length * 5));
    els.summaryRankScore.textContent = `${total.toLocaleString()} pts`;
    const lastRound = state.rounds[Math.min(state.roundIndex, state.rounds.length - 1)];
    els.summaryNote.textContent = lastRound ? `You practiced ${lastRound.answer.replace(' × ', ' at ')}. Explore Field Notes for more street relationships. Progress lasts for this session.` : 'Explore Field Notes for more street relationships.';
    els.summarySubheading.textContent = `${completed.length} of ${state.rounds.length} rounds completed. Replay to try a different answer method.`;
    renderNotes();
    showView('summary');
    announce(`Set complete. ${total} points across ${completed.length} rounds.`);
  }

  function renderLeaderboard() {
    els.leaderboardRows.innerHTML = fixtures.leaderboard.map(([name, score], index) => `<div class="leaderboard-row ${name === 'you · demo' ? 'is-you' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(name)}</b><span>${score}</span></div>`).join('');
  }

  function renderNotes() {
    const played = new Set(state.scores.map((result, index) => result ? state.rounds[index]?.id : null).filter(Boolean));
    els.notesGrid.innerHTML = fixtures.notes.map((note, index) => {
      const noticed = index === 0 || [...played].some((id) => id.includes('queen') && note.id === 'note-spadina');
      return `<article class="note-card ${noticed ? 'is-noticed' : ''}"><div class="note-card-top"><span class="note-category">${escapeHtml(note.category)}</span><span class="note-state">${noticed ? 'NOTICED' : 'UNSEEN'}</span></div><h2>${escapeHtml(note.title)}</h2><p>${escapeHtml(note.relation)}</p><div class="note-card-foot"><span>${noticed ? note.due : 'Play to notice'}</span><span aria-hidden="true">↗</span></div></article>`;
    }).join('');
    els.journalProgress.textContent = `${Math.max(1, played.size)} / 12`;
  }

  function handleNavigation(target) {
    if (!views.includes(target)) return;
    if (target === 'rankings') renderLeaderboard();
    if (target === 'notes') renderNotes();
    showView(target);
  }

  function showView(target) {
    state.view = target;
    views.forEach((view) => {
      const node = document.getElementById(`${view}View`);
      const visible = view === target;
      node.hidden = !visible;
      node.classList.toggle('is-hidden', !visible);
      node.setAttribute('aria-hidden', String(!visible));
    });
    document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === target || (target === 'play' && button.dataset.viewTarget === 'setup')));
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    const heading = document.querySelector(`#${target}View h1, #${target}View h2`);
    if (heading) window.setTimeout(() => { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }, 0);
  }

  function normalize(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[×&/]+/g, ' & ').replace(/\b(avenue|ave)\b/g, 'ave').replace(/\b(street|st)\b/g, 'st').replace(/\s+/g, ' ').trim();
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function announce(message) { els.liveRegion.textContent = ''; window.setTimeout(() => { els.liveRegion.textContent = message; }, 20); }
  function showToast(message) { els.toast.textContent = message; els.toast.classList.add('show'); window.clearTimeout(showToast.timeout); showToast.timeout = window.setTimeout(() => els.toast.classList.remove('show'), 3200); }
  function prefersReducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

  cacheElements();
  updateSetupCopy();
  renderLeaderboard();
  renderNotes();
})();
