/**
 * 音声入力SOAPノート - アプリケーションロジック
 */

// --- SOAP キーワード辞書 ---
const SOAP_KEYWORDS = {
  S: [
    '痛い', '痛む', '痛み', 'つらい', 'しびれる', '痺れる', '痺れ', 'しびれ',
    'だるい', '倦怠感', '動かしにくい', '動かない', '不安', '眠れない', '不眠',
    '訴え', '訴える', '違和感', '重い', '重だるい', '苦しい', '息苦しい',
    '気になる', '調子が悪い', '気分', '怖い', 'つかえる', 'こわばる', '張る'
  ],
  O: [
    'ROM', 'MMT', '度', 'cm', 'kg', 'mmHg', '秒', '歩行', '握力', 'バイタル',
    '腫脹', '熱感', '発赤', '血圧', '脈拍', '体温', 'SpO2', '酸素飽和度',
    '可動域', '筋力', '浮腫', '徒手筋力', 'TUG', '10m', 'BBS', 'FIM',
    'Barthel', '反射', '触診', '聴診', '測定', '観察', '所見', '創部', '排液'
  ],
  A: [
    '考えられる', '原因', '問題', '改善', '低下', '制限', 'リスク', '評価',
    '要因', '影響', '傾向', '困難', '阻害', 'アセスメント', '解釈', '推測',
    '疑われる', '可能性', '良好', '不十分', '自立度', '能力', '維持'
  ],
  P: [
    'プログラム', '目標', '実施', '継続', '指導', '週', 'セット', '退院',
    '自主トレ', '予定', '方針', '訓練', '処方', '介入', 'ストレッチ',
    'トレーニング', '見守り', '介助', '指示', '計画', '次回', '相談', '促す'
  ]
};

// サンプル文章（整形外科・リハビリの典型例）
const CLINICAL_SAMPLE_TEXT = `患者は「右膝がズキズキ痛くて、階段を降りるのが特につらい。夜間も眠れないことがある」と訴えあり。
バイタルは血圧132/78mmHg、脈拍72回、体温36.5度。
右膝関節ROMは屈曲95度、伸展-10度であり、関節周囲に軽度の腫脹と熱感を認める。
徒手筋力検査では大腿四頭筋MMT3レベル、握力は右24kg、左26kgであった。
歩行時は右立脚期の疼痛回避性跛行を認め、10m歩行に16秒を要した。
右膝関節可動域制限および大腿四頭筋の筋力低下が歩行能力低下の主な原因と考えられ、段差昇降時の転倒リスクが高いと評価される。
本日は疼痛緩和のためのアイシングと大腿四頭筋セッティング運動を20回2セット実施した。
週3回のリハビリプログラムを継続し、自宅での自主トレ指導として椅子からの立ち上がり訓練を指導した。
来週のカンファレンスにて退院に向けた屋外歩行自立を目標に再評価を行う予定。`;

// 内部状態
let state = {
  isRecording: false,
  finalTranscript: '',
  parsedItems: {
    S: [],
    O: [],
    A: [],
    P: [],
    U: [] // 未分類 (Unclassified)
  }
};

// DOM要素
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnClear = document.getElementById('btnClear');
const btnSample = document.getElementById('btnSample');
const btnConvert = document.getElementById('btnConvert');
const btnCopyFormatted = document.getElementById('btnCopyFormatted');
const rawTextarea = document.getElementById('rawTextarea');
const interimPreview = document.getElementById('interimPreview');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const charCount = document.getElementById('charCount');
const browserAlert = document.getElementById('browserAlert');
const unclassifiedSection = document.getElementById('unclassifiedSection');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// --- Web Speech API の初期化 ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.isRecording = true;
    updateRecordingUI(true);
    showToast('音声認識を開始しました。マイクに向かって話してください。');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        let textToAdd = transcript.trim();
        if (textToAdd) {
          if (!textToAdd.endsWith('。') && !textToAdd.endsWith('！') && !textToAdd.endsWith('？')) {
            textToAdd += '。';
          }
          if (rawTextarea.value && !rawTextarea.value.endsWith('\n') && !rawTextarea.value.endsWith('。')) {
            rawTextarea.value += '。\n' + textToAdd;
          } else if (rawTextarea.value) {
            rawTextarea.value += '\n' + textToAdd;
          } else {
            rawTextarea.value = textToAdd;
          }
          updateCharCount();
        }
      } else {
        interimTranscript += transcript;
      }
    }

    // 暫定（話している途中）のテキストをプレビュー
    if (interimTranscript) {
      interimPreview.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
        認識中: ${escapeHtml(interimTranscript)}
      `;
    } else {
      interimPreview.innerHTML = '';
    }
  };

  recognition.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('マイクへのアクセスが許可されていません。ブラウザのアドレスバーにある鍵アイコンからマイクの使用を許可してください。');
      stopRecording();
    } else if (event.error === 'no-speech') {
      // 音声が検出されなかった場合
    } else {
      statusText.textContent = `エラー (${event.error})`;
    }
  };

  recognition.onend = () => {
    // ユーザーが手動で停止していなければ再開（無音等で切れる場合の自動復帰）
    if (state.isRecording) {
      try {
        recognition.start();
      } catch (e) {
        state.isRecording = false;
        updateRecordingUI(false);
      }
    } else {
      updateRecordingUI(false);
    }
  };
} else {
  // 非対応ブラウザ
  browserAlert.style.display = 'block';
  btnStart.disabled = true;
  btnStart.title = 'お使いのブラウザは音声認識APIに対応していません';
  statusText.textContent = '音声認識非対応 (手入力のみ可能)';
}

// --- イベントリスナー設定 ---
btnStart.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
btnClear.addEventListener('click', clearAll);
btnSample.addEventListener('click', insertSampleText);
btnConvert.addEventListener('click', parseTextToSOAP);
btnCopyFormatted.addEventListener('click', copyAllFormatted);
rawTextarea.addEventListener('input', updateCharCount);

// 録音開始
function startRecording() {
  if (!recognition) return;
  try {
    recognition.start();
  } catch (e) {
    console.error(e);
  }
}

// 録音停止
function stopRecording() {
  state.isRecording = false;
  if (recognition) {
    recognition.stop();
  }
  updateRecordingUI(false);
  interimPreview.innerHTML = '';
  showToast('録音を停止しました。全体のテキストが表示されています。');
}

// 録音中UIの更新
function updateRecordingUI(isRecording) {
  if (isRecording) {
    btnStart.disabled = true;
    btnStop.disabled = false;
    btnStop.classList.add('recording-active');
    statusBadge.classList.add('recording');
    statusText.textContent = '録音中... (音声を聞き取っています)';
  } else {
    btnStart.disabled = !recognition;
    btnStop.disabled = true;
    btnStop.classList.remove('recording-active');
    statusBadge.classList.remove('recording');
    statusText.textContent = '待機中 (録音停止)';
  }
}

// クリア処理
function clearAll() {
  if (rawTextarea.value && !confirm('入力テキストおよびSOAP結果をクリアしますか？')) {
    return;
  }
  rawTextarea.value = '';
  interimPreview.innerHTML = '';
  updateCharCount();
  state.parsedItems = { S: [], O: [], A: [], P: [], U: [] };
  renderAllCards();
  showToast('すべてクリアしました');
}

// サンプル文章の挿入
function insertSampleText() {
  rawTextarea.value = CLINICAL_SAMPLE_TEXT;
  updateCharCount();
  showToast('臨床サンプル文章を挿入しました。「SOAP形式に変換」を押してください。');
}

// 文字数カウント更新
function updateCharCount() {
  charCount.textContent = rawTextarea.value.length;
}

// --- SOAP 自動振り分けロジック ---
function parseTextToSOAP() {
  const rawText = rawTextarea.value.trim();
  if (!rawText) {
    alert('文章を入力するか、マイクで録音してから変換してください。');
    return;
  }

  // 句点・改行等で文に分割
  const sentences = splitIntoSentences(rawText);

  state.parsedItems = { S: [], O: [], A: [], P: [], U: [] };

  sentences.forEach((sentence, index) => {
    const cleanSentence = sentence.trim();
    if (!cleanSentence) return;

    const classification = classifySentence(cleanSentence);
    state.parsedItems[classification.category].push({
      id: 'item_' + Date.now() + '_' + index,
      text: cleanSentence,
      matchedKeywords: classification.matchedKeywords,
      category: classification.category
    });
  });

  renderAllCards();
  showToast('SOAP形式に振り分けました！');

  // 結果カードへスクロール
  document.querySelector('.result-section').scrollIntoView({ behavior: 'smooth' });
}

// 文章を文単位に分割する
function splitIntoSentences(text) {
  const lines = text.split(/\n+/);
  const result = [];

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const parts = trimmedLine.split(/(?<=[。！？!?])/g);
    parts.forEach(p => {
      const item = p.trim();
      if (item) {
        result.push(item);
      }
    });
  });

  return result;
}

// 1つの文をキーワードから S, O, A, P, U (未分類) に分類する
function classifySentence(sentence) {
  const scores = { S: 0, O: 0, A: 0, P: 0 };
  const matched = { S: [], O: [], A: [], P: [] };

  // 各カテゴリのキーワードをマッチング
  for (const [category, keywords] of Object.entries(SOAP_KEYWORDS)) {
    for (const kw of keywords) {
      if (sentence.includes(kw)) {
        scores[category] += 1;
        if (!matched[category].includes(kw)) {
          matched[category].push(kw);
        }
      }
    }
  }

  // 文脈補正
  if (sentence.includes('実施') || sentence.includes('プログラム') || sentence.includes('目標') || sentence.includes('指導') || sentence.includes('自主トレ')) {
    scores.P += 2;
  }

  if (sentence.includes('考えられる') || sentence.includes('アセスメント') || sentence.includes('リスク')) {
    scores.A += 2;
  }

  if (sentence.includes('訴え') || sentence.includes('痛い') || sentence.includes('つらい')) {
    scores.S += 2;
  }

  // 最も高いスコアを判定
  let bestCategory = 'U';
  let maxScore = 0;

  for (const cat of ['S', 'O', 'A', 'P']) {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      bestCategory = cat;
    }
  }

  return {
    category: bestCategory,
    matchedKeywords: bestCategory !== 'U' ? matched[bestCategory] : []
  };
}

// --- UI レンダリング ---
function renderAllCards() {
  ['S', 'O', 'A', 'P', 'U'].forEach(cat => renderCard(cat));

  // 未分類カードの表示制御（未分類アイテムがある時のみ表示）
  if (state.parsedItems.U.length > 0) {
    unclassifiedSection.style.display = 'block';
  } else {
    unclassifiedSection.style.display = 'none';
  }
}

function renderCard(cat) {
  const bodyElem = document.getElementById(`body${cat}`);
  const countElem = document.getElementById(`count${cat}`);
  const items = state.parsedItems[cat];

  if (countElem) {
    countElem.textContent = `${items.length}件`;
  }

  if (items.length === 0) {
    const labels = {
      S: 'S（主観的情報）の該当項目はありません',
      O: 'O（客観的情報）の該当項目はありません',
      A: 'A（評価）の該当項目はありません',
      P: 'P（計画）の該当項目はありません',
      U: '未分類の項目はありません'
    };
    bodyElem.innerHTML = `<div class="empty-placeholder">${labels[cat]}</div>`;
    return;
  }

  let html = '';
  items.forEach((item, index) => {
    const keywordsBadges = (item.matchedKeywords || []).map(kw => 
      `<span class="keyword-tag">#${escapeHtml(kw)}</span>`
    ).join('');

    html += `
      <div class="item-card" data-id="${item.id}" data-category="${cat}">
        <div class="item-text" contenteditable="true" onblur="updateItemText('${cat}', ${index}, this.innerText)">
          ${escapeHtml(item.text)}
        </div>
        <div class="item-footer">
          <div class="matched-keywords">
            ${keywordsBadges || '<span class="keyword-tag" style="background:#f1f5f9;color:#94a3b8;">手動/未検出</span>'}
          </div>
          <div class="item-actions">
            <select class="category-select" onchange="moveItemCategory('${cat}', ${index}, this.value)" title="セクションを変更">
              <option value="S" ${cat === 'S' ? 'selected' : ''}>S (主観)</option>
              <option value="O" ${cat === 'O' ? 'selected' : ''}>O (客観)</option>
              <option value="A" ${cat === 'A' ? 'selected' : ''}>A (評価)</option>
              <option value="P" ${cat === 'P' ? 'selected' : ''}>P (計画)</option>
              <option value="U" ${cat === 'U' ? 'selected' : ''}>未分類</option>
            </select>
            <button class="btn-delete-item" onclick="deleteItem('${cat}', ${index})" title="削除">
              &times;
            </button>
          </div>
        </div>
      </div>
    `;
  });

  bodyElem.innerHTML = html;
}

// アイテムテキストの直接編集保存
window.updateItemText = function(cat, index, newText) {
  if (state.parsedItems[cat][index]) {
    state.parsedItems[cat][index].text = newText.trim();
  }
};

// カテゴリの手動移動
window.moveItemCategory = function(fromCat, index, toCat) {
  if (fromCat === toCat) return;
  const item = state.parsedItems[fromCat].splice(index, 1)[0];
  item.category = toCat;
  state.parsedItems[toCat].push(item);
  renderAllCards();
  showToast(`項目を ${toCat} に移動しました`);
};

// アイテムの削除
window.deleteItem = function(cat, index) {
  state.parsedItems[cat].splice(index, 1);
  renderAllCards();
  showToast('項目を削除しました');
};

// 項目を手動で追加
window.addItemToSection = function(cat) {
  const text = prompt(`${cat} セクションに追加する内容を入力してください：`);
  if (!text || !text.trim()) return;

  state.parsedItems[cat].push({
    id: 'manual_' + Date.now(),
    text: text.trim(),
    matchedKeywords: ['手動追加'],
    category: cat
  });
  renderAllCards();
  showToast(`${cat} に項目を追加しました`);
};

// 特定セクションのみコピー
window.copySection = function(cat) {
  const items = state.parsedItems[cat];
  const catNames = { S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan', U: '未分類' };
  if (items.length === 0) {
    showToast(`${cat} セクションにはコピーする項目がありません`);
    return;
  }

  const text = `【${cat} : ${catNames[cat]}】\n` + items.map(item => `・${item.text}`).join('\n');
  copyToClipboard(text, `${cat} セクションをコピーしました`);
};

// 全SOAPをカルテ形式でコピー
function copyAllFormatted() {
  const { S, O, A, P, U } = state.parsedItems;
  if (S.length === 0 && O.length === 0 && A.length === 0 && P.length === 0 && U.length === 0) {
    alert('コピーするSOAP項目がありません。まず「SOAP形式に変換」を行ってください。');
    return;
  }

  let result = [];

  result.push('【S（主観的情報）】');
  if (S.length > 0) {
    S.forEach(i => result.push(`・${i.text}`));
  } else {
    result.push('（特記事項なし）');
  }
  result.push('');

  result.push('【O（客観的情報）】');
  if (O.length > 0) {
    O.forEach(i => result.push(`・${i.text}`));
  } else {
    result.push('（特記事項なし）');
  }
  result.push('');

  result.push('【A（評価・分析）】');
  if (A.length > 0) {
    A.forEach(i => result.push(`・${i.text}`));
  } else {
    result.push('（特記事項なし）');
  }
  result.push('');

  result.push('【P（治療計画）】');
  if (P.length > 0) {
    P.forEach(i => result.push(`・${i.text}`));
  } else {
    result.push('（特記事項なし）');
  }

  if (U.length > 0) {
    result.push('');
    result.push('【未分類】');
    U.forEach(i => result.push(`・${i.text}`));
  }

  copyToClipboard(result.join('\n'), '全SOAPテキストをクリップボードにコピーしました（電子カルテ貼り付け用）');
}

// クリップボード書き込みヘルパー
function copyToClipboard(text, message) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message);
    }).catch(() => {
      fallbackCopy(text, message);
    });
  } else {
    fallbackCopy(text, message);
  }
}

function fallbackCopy(text, message) {
  const tempInput = document.createElement('textarea');
  tempInput.value = text;
  tempInput.style.position = 'fixed';
  tempInput.style.opacity = '0';
  document.body.appendChild(tempInput);
  tempInput.focus();
  tempInput.select();
  try {
    document.execCommand('copy');
    showToast(message);
  } catch (e) {
    alert('コピーに失敗しました。お手数ですが手動で選択してコピーしてください。');
  }
  document.body.removeChild(tempInput);
}

// トースト表示
let toastTimer = null;
function showToast(msg) {
  toastMessage.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// HTMLエスケープヘルパー
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
