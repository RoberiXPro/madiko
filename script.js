const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3');

var firebaseConfig = {
  apiKey: "AIzaSyAN7IrOQfHYJAeO49I1EZxDfupv62Ew9XI",
  authDomain: "madiko-rs.firebaseapp.com",
  databaseURL: "https://madiko-rs-default-rtdb.firebaseio.com",
  projectId: "madiko-rs",
  storageBucket: "madiko-rs.appspot.com",
  messagingSenderId: "746083664475",
  appId: "1:746083664475:web:fe2d5628d20e385d06b57e",
  measurementId: "G-EBWFWCMWFT"
};
firebase.initializeApp(firebaseConfig);

let db;              // rooms/{roomName}
let username;
let roomName;
let messageListener = null;
let childRemovedListenerSet = false;
let replyMessageId = null;
let replyMessageText = "";

let mediaRecorder;
let audioChunks = [];
let recordedBlob;
let microAccessGranted = false;

// Thèmes (couleurs de bulles)
const themes = {
  default:  { '--message-color-user1': 'linear-gradient(135deg,#4e54c8,#8f94fb)', '--message-color-user2': '#3a3a3a' },
  ocean:    { '--message-color-user1': 'linear-gradient(135deg,#2193b0,#6dd5ed)', '--message-color-user2': '#145374' },
  forest:   { '--message-color-user1': 'linear-gradient(135deg,#388e3c,#a5d6a7)', '--message-color-user2': '#2e7d32' },
  rosewood: { '--message-color-user1': 'linear-gradient(135deg,#a83279,#d38312)', '--message-color-user2': '#502336' },
  noir:     { '--message-color-user1': 'linear-gradient(135deg,#434343,#000000)', '--message-color-user2': '#1e1e1e' },
  midnight: { '--message-color-user1': 'linear-gradient(135deg,#1c92d2,#f2fcfe)', '--message-color-user2': '#172d51' },
  sepia:    { '--message-color-user1': 'linear-gradient(135deg,#a2836e,#e6ccb2)', '--message-color-user2': '#5a463b' },
  galaxy:   { '--message-color-user1': 'linear-gradient(135deg,#4a00e0,#8e2de2)', '--message-color-user2': '#2a2438' },
};

// Dark/Light set
const lightTheme = {
  '--bg-color': '#ffffff', '--text-color': '#1a1a1a', '--accent-color': '#0055ff',
  '--button-bg': '#dddddd', '--button-hover-bg': '#cccccc',
  '--message-color-user1': 'linear-gradient(135deg,#1976d2,#90caf9)',
  '--message-color-user2': '#e0e0e0',
};
const darkTheme  = {
  '--bg-color': '#1f1f1f', '--text-color': '#ffffff', '--accent-color': '#ffd700',
  '--button-bg': '#5a5a5a', '--button-hover-bg': '#4c4c4c',
  '--message-color-user1': 'linear-gradient(135deg,#4e54c8,#8f94fb)',
  '--message-color-user2': '#3a3a3a',
};
let isDark = true;

// Utils
function showNotification() {
  const n = document.getElementById('notification');
  if (!n) return;
  n.style.display = 'block';
  setTimeout(() => { n.style.display = 'none'; }, 4000);
}
function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;
  Object.entries(theme).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
}
function loadUserTheme() {
  if (!username || !roomName) return;
  const userRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`);
  userRef.once('value').then(s => {
    const data = s.val();
    const t = (data && data.theme) || 'default';
    applyTheme(t);
    const select = document.getElementById('theme-select'); if (select) select.value = t;
  });
}
function handleThemeChange(e) {
  const selectedTheme = e.target.value;
  applyTheme(selectedTheme);
  if (!username || !roomName) return;
  const userRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`);
  userRef.update({ theme: selectedTheme });
}
function formatTime(ts) {
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '🕓 invalide';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function scrollToBottom() {
  const m = document.getElementById('messages');
  if (m) m.scrollTop = m.scrollHeight;
}
function joinRoom() {
  username = document.getElementById('username').value.trim();
  roomName = document.getElementById('room-name-input').value.trim();
  const password = document.getElementById('password-input').value;

  if (!username || !roomName || !password) {
    alert('Tous les champs sont obligatoires.');
    return;
  }

  const userCheckRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`);
  userCheckRef.once('value').then(s => {
    if (s.exists()) { alert('Ce pseudo est déjà utilisé dans cette villa !'); return; }

    db = firebase.database().ref(`rooms/${roomName}`);
    db.once('value').then(snap => {
      if (snap.exists()) {
        const dbPassword = snap.child('password').val();
        if (dbPassword !== password) { alert('Mot de passe incorrect !'); return; }
        document.getElementById('room-name-display').textContent = 'Villa : ' + roomName;
        switchToChat(); initializeUserListeners(); setOnlineStatus(); loadUserTheme();
      } else {
        db.set({ password, messages: {} }).then(() => {
          document.getElementById('room-name-display').textContent = 'Villa : ' + roomName;
          switchToChat(); initializeUserListeners(); setOnlineStatus(); loadUserTheme();
        });
      }
    });
  });
}

function initializeUserListeners() {
  const usersRef = firebase.database().ref(`rooms/${roomName}/onlineUsers`);
  usersRef.on('child_added', snap => updateUserStatusUI(snap.key, (snap.val()||{}).status));
  usersRef.on('child_changed', snap => updateUserStatusUI(snap.key, (snap.val()||{}).status));
  usersRef.on('child_removed', snap => removeUserFromUI(snap.key));
}
function updateUserStatusUI(user, status) {
  const list = document.getElementById('online-users'); if (!list) return;
  let li = document.getElementById('user-status-' + user);
  if (!li) {
    li = document.createElement('li'); li.id = 'user-status-' + user;
    const dot = document.createElement('span'); dot.className = 'status-indicator'; li.appendChild(dot);
    const name = document.createElement('span'); name.className = 'user-status'; name.textContent = `${user} - ${status||'?'}`; li.appendChild(name);
    list.appendChild(li);
  } else {
    li.classList.toggle('status-offline', status !== 'en ligne');
    li.querySelector('.user-status').textContent = `${user} - ${status||'?'}`;
  }
}
function removeUserFromUI(user) { const li = document.getElementById('user-status-' + user); if (li) li.remove(); }
function setOnlineStatus() {
  if (!username || !roomName) return;
  const userRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`);
  firebase.database().ref('.info/connected').on('value', snap => {
    if (snap.val() === true) {
      userRef.set({ status: 'en ligne', lastSeen: new Date().toISOString() });
      userRef.onDisconnect().remove();
      setInterval(() => userRef.update({ lastSeen: new Date().toISOString() }), 5000);
    }
  });
}
function switchToChat() {
  document.getElementById('login-container').style.display = 'none';
  document.querySelector('.container-chat').style.display = 'flex';
  const chat = document.getElementById('chat-container');
  chat.style.display = 'flex'; // important: flex, pas block
  loadMessages();

  if (callListener) firebase.database().ref(`rooms/${roomName}/call`).off('value', callListener);
  attachCallListeners();
}

function sendMessage() {
  const input = document.getElementById('message-input');
  const message = (input.value||'').trim();
  if (!message) return;

  const data = { user: username, message, timestamp: Date.now(), reactions: {} };
  if (replyMessageId) { data.replyTo = replyMessageText; cancelReply(); }

  db.child('messages').push().set(data);
  input.value = '';
}

function loadMessages() {
  if (!messageListener) {
    messageListener = snap => displayMessage(snap.key, snap.val());
    db.child('messages').on('child_added', messageListener);
  }
  if (!childRemovedListenerSet) {
    db.child('messages').on('child_removed', snap => { const el = document.getElementById(snap.key); if (el) el.remove(); });
    childRemovedListenerSet = true;
  }
  db.child('messages').on('child_changed', snap => {
    const data = snap.val();
    const msgDiv = document.getElementById(snap.key);
    if (msgDiv && data.seen && data.user === username && !msgDiv.querySelector('.seen-check')) {
      const seenCheck = document.createElement('span');
      seenCheck.className = 'seen-check';
      seenCheck.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 13l4 4L23 3M10 14l4 4"/></svg>';
      msgDiv.appendChild(seenCheck);
    }
  });
}
function addReactionEmoji(messageId, emoji) {
  db.child(`messages/${messageId}/reactions/${username}`).set(emoji);
}

function displayMessage(key, data) {
  const msgDiv = document.createElement('div');
  msgDiv.id = key;
  msgDiv.className = 'message ' + (data.user === username ? 'user1' : 'user2');

  if (data.replyTo) {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'citation';
    replyDiv.textContent = 'Réponse du : ' + data.replyTo;
    msgDiv.appendChild(replyDiv);
  }

  let content;
  if (data.type === 'audio') {
    content = document.createElement('audio');
    content.controls = true;
    content.src = data.audioBase64;
    content.className = 'audio-message';
  } else if (data.type === 'image') {
    content = document.createElement('img');
    content.src = data.imageBase64;
    content.className = 'image-message';
    content.style.maxWidth = '220px';
    content.onclick = () => openImagePopup(data.imageBase64);
  } else {
    content = document.createElement('div');
    content.className = 'msg-text';
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const msg = (data.message||'').replace(urlRegex, u => `<a href="${u}" target="_blank" style="color:#ffd700">${u}</a>`);
    content.innerHTML = msg;
  }

  const userTag = document.createElement('div'); userTag.className = 'username-tag'; userTag.textContent = data.user;
  const time = document.createElement('div'); time.className = 'timestamp'; time.textContent = formatTime(data.timestamp);
  msgDiv.dataset.timestamp = data.timestamp;

  msgDiv.appendChild(userTag);
  msgDiv.appendChild(content);
  msgDiv.appendChild(time);

  // réactions dynamiques
  const reactionContainer = document.createElement('div');
  reactionContainer.className = 'reaction-container';
  db.child(`messages/${key}/reactions`).on('value', snap => {
    reactionContainer.innerHTML = '';
    if (snap.exists()) {
      const label = document.createElement('span'); label.className = 'reaction-label'; label.textContent = 'Réaction :';
      reactionContainer.appendChild(label);
      snap.forEach(child => {
        const e = document.createElement('span'); e.textContent = child.val(); e.className = 'reaction-emoji';
        reactionContainer.appendChild(e);
      });
    }
  });
  msgDiv.appendChild(reactionContainer);

  // actions
  const actions = document.createElement('div'); actions.className = 'action-buttons';
  const emojiBtn = document.createElement('button'); emojiBtn.className = 'emoji-btn icon-button'; emojiBtn.textContent = '😀';
  emojiBtn.onclick = () => toggleEmojiPickerMessage(key);
  actions.appendChild(emojiBtn);

  const btnGroup = document.createElement('div'); btnGroup.style.display = 'flex'; btnGroup.style.gap = '6px';
  const replyBtn = document.createElement('button'); replyBtn.className = 'icon-button';
  replyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.88 1.45 8.95 4.1-.5-5.04-3.95-10-8.95-10z"/></svg>';
  replyBtn.onclick = () => prepareReply(key, data.message); btnGroup.appendChild(replyBtn);

  if (data.user === username) {
    const delBtn = document.createElement('button'); delBtn.className = 'icon-button';
    delBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"/></svg>';
    delBtn.onclick = () => db.child('messages').child(key).remove();
    btnGroup.appendChild(delBtn);
  }
  actions.appendChild(btnGroup);
  msgDiv.appendChild(actions);

  updateSeenStatus(msgDiv, data, key);

  document.getElementById('messages').appendChild(msgDiv);
  scrollToBottom();
}

function prepareReply(key, message) {
  replyMessageId = key;
  replyMessageText = message;
  document.getElementById('reply-message').textContent = 'Réponse du : ' + (message || '');
  document.getElementById('reply-container').style.display = 'block';
}
function cancelReply() {
  replyMessageId = null; replyMessageText = '';
  document.getElementById('reply-message').textContent = '';
  document.getElementById('reply-container').style.display = 'none';
}
const emojis = ['😀','😂','😍','😎','😊','😢','😡','👍','👎','🎉','❤️','🔥'];
function loadEmojis() {
  const picker = document.getElementById('emoji-picker'); if (!picker) return;
  picker.innerHTML = '';
  emojis.forEach(e => {
    const s = document.createElement('span'); s.textContent = e; s.className = 'emoji';
    s.onclick = () => { insertEmoji(e); };
    picker.appendChild(s);
  });
}
function insertEmoji(e) {
  const input = document.getElementById('message-input');
  input.value += e;
  document.getElementById('emoji-picker').style.display = 'none';
}
function toggleEmojiPicker() {
  const button = document.getElementById('emoji-toggle-btn');
  const picker = document.getElementById('emoji-picker');
  if (!picker || !button) return;
  if (picker.style.display !== 'flex') {
    picker.style.display = 'flex';
    picker.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const rect = button.getBoundingClientRect();
      const y = window.scrollY || window.pageYOffset;
      const x = window.scrollX || window.pageXOffset;
      picker.style.top = (rect.top + y - picker.offsetHeight - 10) + 'px';
      picker.style.left = (rect.left + x) + 'px';
      picker.style.visibility = 'visible';
    });
  } else {
    picker.style.display = 'none';
  }
}
document.addEventListener('click', (ev) => {
  const picker = document.getElementById('emoji-picker');
  const btn = document.getElementById('emoji-toggle-btn');
  if (!picker) return;
  if (picker.style.display === 'flex' && !picker.contains(ev.target) && ev.target !== btn && !ev.target.classList.contains('emoji')) {
    picker.style.display = 'none';
  }
});
function toggleEmojiPickerMessage(key) {
  document.querySelectorAll('.emoji-picker-message').forEach(p => { if (p.id !== 'emoji-picker-'+key) p.style.display='none'; });
  let picker = document.getElementById('emoji-picker-'+key);
  if (!picker) {
    picker = document.createElement('div');
    picker.className = 'emoji-picker-message'; picker.id = 'emoji-picker-'+key;
    emojis.forEach(e => {
      const s = document.createElement('span'); s.className='emoji'; s.textContent = e;
      s.onclick = () => { addReactionEmoji(key, e); picker.style.display='none'; };
      picker.appendChild(s);
    });
    document.getElementById(key).appendChild(picker);
  }
  picker.style.display = (picker.style.display === 'flex') ? 'none' : 'flex';
}
function openImagePopup(src) {
  const pop = document.getElementById('image-popup'); const img = document.getElementById('popup-img');
  img.src = src; pop.style.display = 'flex';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const p = document.getElementById('image-popup'); if (p) p.style.display='none'; }});
document.getElementById('image-popup')?.addEventListener('click', (e) => {
  const img = document.getElementById('popup-img'); const btn = document.getElementById('close-popup-btn');
  if (!img.contains(e.target) && !btn.contains(e.target)) document.getElementById('image-popup').style.display = 'none';
});

function handleImageUpload(ev) {
  const files = ev.target.files; if (!files || !files.length) return;
  Array.from(files).forEach(file => {
    const r = new FileReader();
    r.onloadend = () => db.child('messages').push({ user: username, type:'image', imageBase64: r.result, timestamp: Date.now() });
    r.readAsDataURL(file);
  });
  ev.target.value = '';
}

function toggleRecording() {
  const btn = document.getElementById('record-btn');
  if (!microAccessGranted && !mediaRecorder) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      microAccessGranted = true; startRecording(stream, btn);
    }).catch(() => alert('Erreur : accès au micro refusé !'));
  } else if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  } else {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => startRecording(stream, btn)).catch(() => alert('Impossible de relancer l’enregistrement.'));
  }
}
function startRecording(stream, btn) {
  mediaRecorder = new MediaRecorder(stream); audioChunks = [];
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
    document.getElementById('audio-player').src = URL.createObjectURL(recordedBlob);
    document.getElementById('audio-preview').style.display = 'block';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0H4a8 8 0 0016 0h-2zm-6 8c2.21 0 4-1.79 4-4h-2a2 2 0 01-4 0H8c0 2.21 1.79 4 4 4z"/></svg>';
    btn.classList.remove('recording'); mediaRecorder = null;
  };
  mediaRecorder.start(); btn.textContent = '⏹️ Stop'; btn.classList.add('recording');
  setTimeout(() => { if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); alert('Durée maximale atteinte (30s)'); } }, 30000);
}
function uploadAudio() {
  if (!recordedBlob) { alert('Aucun enregistrement à envoyer.'); return; }
  const reader = new FileReader();
  reader.onloadend = function () {
    const base64 = reader.result;
    if (base64.length > 400000) { alert('Message trop long/lourd. Réenregistre plus court (max 30s).'); return; }
    db.child('messages').push({ user: username, type: 'audio', audioBase64: base64, timestamp: Date.now() });
    document.getElementById('audio-preview').style.display = 'none'; document.getElementById('audio-player').src=''; recordedBlob=null;
  };
  reader.readAsDataURL(recordedBlob);
}
function cancelAudio() { recordedBlob = null; document.getElementById('audio-preview').style.display = 'none'; document.getElementById('audio-player').src = ''; }
const seenObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const key = el.id;
      const name = el.querySelector('.username-tag')?.textContent;
      if (name && name !== username) {
        db.child('messages').child(key).update({ seen: true });
      }
      seenObserver.unobserve(el);
    }
  });
}, { threshold: 0.6 });

function updateSeenStatus(msgDiv, data, key) {
  if (data.user !== username) {
    seenObserver.observe(msgDiv);
  } else if (data.user === username && data.seen) {
    const seenCheck = document.createElement('span');
    seenCheck.className = 'seen-check';
    seenCheck.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 13l4 4L23 3M10 14l4 4"/></svg>';
    msgDiv.appendChild(seenCheck);
  }
}

function quitRoom() {
  try {
    if (username && roomName) {
      firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`).remove();
    }
  } catch {}
  if (messageListener) { db.child('messages').off('child_added', messageListener); messageListener=null; }
  const callRef = firebase.database().ref(`rooms/${roomName}/call`); callRef.off();
  const candRef = firebase.database().ref(`rooms/${roomName}/candidates`); candRef.off();

  document.querySelector('.container-chat').style.display = 'none';
  document.getElementById('login-container').style.display = 'block';
  location.reload();
}

window.addEventListener('beforeunload', () => {
  try { if (username && roomName) firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`).remove(); } catch {}
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { document.title = 'Votre Chat'; notificationSound.pause(); notificationSound.currentTime = 0; }
});
let peerConnection;
let localStream;
let callListener = null;
let pendingCandidates = [];
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const ringtone = new Audio('https://assets.mixkit.co/active_storage/sfx/2576/2576-preview.mp3'); ringtone.loop = true;

function setupPeerConnectionHandlers() {
  peerConnection.ontrack = ev => { const a = new Audio(); a.srcObject = ev.streams[0]; a.play(); };
  peerConnection.onicecandidate = ev => {
    if (ev.candidate) {
      firebase.database().ref(`rooms/${roomName}/candidates/${username}`).push(ev.candidate.toJSON());
    }
  };
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      document.getElementById('outgoing-call-popup').style.display = 'none';
      document.getElementById('incoming-call-popup').style.display = 'none';
      ringtone.pause(); ringtone.currentTime = 0;
    }
  };
}

function startCall() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream;
    peerConnection = new RTCPeerConnection(servers);
    setupPeerConnectionHandlers();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    peerConnection.createOffer().then(offer => peerConnection.setLocalDescription(offer)).then(() => {
      firebase.database().ref(`rooms/${roomName}/call`).set({ type:'offer', offer: peerConnection.localDescription, from: username, status:'calling' });
    });

    ringtone.play().catch(()=>{});
    document.getElementById('outgoing-call-popup').style.display = 'block';
  }).catch(() => alert('Erreur d\'accès au micro !'));
}

function acceptCall() {
  document.getElementById('incoming-call-popup').style.display = 'none';
  ringtone.pause(); ringtone.currentTime = 0;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream;
    peerConnection = new RTCPeerConnection(servers);
    setupPeerConnectionHandlers();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    firebase.database().ref(`rooms/${roomName}/call`).once('value').then(snap => {
      const data = snap.val();
      if (data && data.offer) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer)).then(() => peerConnection.createAnswer()).then(answer => {
          return peerConnection.setLocalDescription(answer);
        }).then(() => {
          firebase.database().ref(`rooms/${roomName}/call`).update({ type:'answer', answer: peerConnection.localDescription, from: username, status:'accepted' });
        });
      }
    });
  }).catch(() => alert('Erreur d\'accès au micro !'));
}

function declineCall() {
  document.getElementById('incoming-call-popup').style.display = 'none';
  ringtone.pause(); ringtone.currentTime = 0;
  firebase.database().ref(`rooms/${roomName}/call`).update({ status: 'refused' });
}
function cancelOutgoingCall() {
  document.getElementById('outgoing-call-popup').style.display = 'none';
  ringtone.pause(); ringtone.currentTime = 0;
  firebase.database().ref(`rooms/${roomName}/call`).remove();
}
function hangupCall() {
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
  ringtone.pause(); ringtone.currentTime = 0;
  firebase.database().ref(`rooms/${roomName}/call`).remove();
  firebase.database().ref(`rooms/${roomName}/candidates`).remove();
  document.getElementById('outgoing-call-popup').style.display = 'none';
  document.getElementById('incoming-call-popup').style.display = 'none';
}

function attachCallListeners() {
  // écoute principale "call"
  callListener = (snapshot) => {
    const data = snapshot.val(); if (!data) return;

    if (data.status === 'refused') {
      document.getElementById('outgoing-call-popup').style.display = 'none';
      ringtone.pause(); ringtone.currentTime = 0;
      firebase.database().ref(`rooms/${roomName}/call`).remove();
      return;
    }

    if (data.status === 'accepted' && peerConnection && data.answer) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)).then(() => {
        pendingCandidates.forEach(c => peerConnection.addIceCandidate(new RTCIceCandidate(c))); pendingCandidates = [];
      });
    }

    if (data.type === 'offer' && data.from !== username) {
      document.getElementById('incoming-call-popup').style.display = 'block';
      ringtone.play().catch(()=>{});
    }

    // compat single-candidate
    if (data.type === 'candidate' && peerConnection && data.candidate) {
      if (peerConnection.remoteDescription) peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      else pendingCandidates.push(data.candidate);
    }
  };
  firebase.database().ref(`rooms/${roomName}/call`).on('value', callListener);

  // écoute par utilisateur pour les ICE
  const candidatesRoot = firebase.database().ref(`rooms/${roomName}/candidates`);
  candidatesRoot.on('child_added', userNodeSnap => {
    const userId = userNodeSnap.key;
    if (userId === username) return;
    firebase.database().ref(`rooms/${roomName}/candidates/${userId}`).on('child_added', candSnap => {
      const candidate = candSnap.val();
      if (!peerConnection) return;
      if (peerConnection.remoteDescription) peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      else pendingCandidates.push(candidate);
    });
  });
}
function panicWipe() {
  if (!roomName) return;
  firebase.database().ref('rooms/' + roomName).remove().catch(()=>{});
  window.location.href = 'https://www.google.com';
}
function activateStealth() {
  document.querySelectorAll('body > *:not(#stealth-screen)').forEach(el => el.style.display = 'none');
  const s = document.getElementById('stealth-screen'); s.style.display = 'flex';
  const input = document.getElementById('stealth-code');
  input.value=''; input.focus();
  input.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter') {
      const pwd = document.getElementById('password-input')?.value;
      if (input.value === pwd) {
        s.style.display='none';
        document.querySelectorAll('body > *:not(#stealth-screen)').forEach(el => el.style.display = '');
      } else { input.value = ''; input.placeholder = 'Erreur. Réessaye.'; }
      input.removeEventListener('keydown', onKey);
    }
  });
}
function quitStealthSafely() { window.location.href = 'https://www.google.com'; }

document.addEventListener('DOMContentLoaded', () => {
  showNotification();
  document.getElementById('login-container')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.querySelector('.login-button')?.click(); });
  document.getElementById('message-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }});
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const set = isDark ? lightTheme : darkTheme;
    Object.entries(set).forEach(([k,v]) => document.documentElement.style.setProperty(k, v));
    document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
    isDark = !isDark;
  });
  document.getElementById('theme-select')?.addEventListener('change', handleThemeChange);
  loadEmojis();
  setInterval(() => {
    document.querySelectorAll('.message').forEach(msg => {
      const ts = msg.dataset.timestamp;
      const t = msg.querySelector('.timestamp');
      if (ts && t) t.textContent = formatTime(Number(ts));
    });
  }, 60000);
});
