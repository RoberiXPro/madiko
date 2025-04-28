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

    var db;
    var username;
    var roomName;
    var replyMessageId = null;
    var replyMessageText = "";
    var messageListener = null;
    var passwordValue = "";

    // Fonction pour afficher la notification
    function showNotification() {
      const notification = document.getElementById("notification");
      if (!notification) return; // ✅ évite l’erreur si l’élément n’existe pas
      notification.style.display = "block";

      setTimeout(() => {
        notification.style.display = "none";
      }, 5000);
    }
   
function joinRoom() {
  username = document.getElementById("username").value;
  roomName = document.getElementById("room-name-input").value;
  var password = document.getElementById("password-input").value;
 passwordValue = password;

  if (!username || !roomName || !password) {
    alert("Tous les champs sont obligatoires.");
    return;
  }

  const userCheckRef = firebase.database().ref("rooms/" + roomName + "/onlineUsers/" + username);

  userCheckRef.once("value").then(snapshot => {
    if (snapshot.exists()) {
      alert("Ce pseudo est déjà utilisé dans cette villa !");
      return;
    }

    db = firebase.database().ref("rooms/" + roomName);

    db.once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        var dbPassword = snapshot.child("password").val();
if (dbPassword === password) {
  document.getElementById("room-name-display").textContent = "Villa : " + roomName;
  switchToChat();
  initializeUserListeners();
  setOnlineStatus();
  loadUserTheme(); // ICI
}
 else {
          alert("Mot de passe incorrect !");
        }
      } else {
        // Room inexistante : on la crée
db.set({
  password: password,
  messages: {}
}).then(() => {
  document.getElementById("room-name-display").textContent = "Villa : " + roomName;
  switchToChat();
  initializeUserListeners();
  setOnlineStatus();
  loadUserTheme(); // ICI AUSSI
});
      }
    });
  });
}
document.getElementById("theme-select").addEventListener("change", handleThemeChange);


firebase.database().ref("users").on("child_changed", function(snapshot) {
    var user = snapshot.key;
    var data = snapshot.val();

    // Mettre à jour l'interface utilisateur pour afficher uniquement le statut de l'utilisateur
    updateUserStatusUI(user, data.status);
});

function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;
  Object.entries(theme).forEach(([varName, value]) => {
    document.documentElement.style.setProperty(varName, value);
  });
}


function initializeUserListeners() {
    var usersRef = firebase.database().ref("rooms/" + roomName + "/onlineUsers");

    usersRef.on("child_added", function(snapshot) {
        const user = snapshot.key;
        const status = snapshot.val().status;
        updateUserStatusUI(user, status);
    });

    // Écoute les changements de statut d'utilisateur
    usersRef.on("child_changed", function(snapshot) {
        const user = snapshot.key;
        const status = snapshot.val().status;
        updateUserStatusUI(user, status);
    });

 // Écoute les suppressions d'utilisateurs
  usersRef.on("child_removed", function(snapshot) {
        const user = snapshot.key;
        removeUserFromUI(user);
    });
}


// Fonction pour gérer le statut en ligne et hors ligne de l'utilisateur
function setOnlineStatus() {
    if (!username || !roomName) return;

    var userRef = firebase.database().ref("rooms/" + roomName + "/onlineUsers/" + username);

    firebase.database().ref(".info/connected").on("value", function(snapshot) {
        if (snapshot.val() === true) {
            userRef.set({
                status: "en ligne",
                lastSeen: new Date().toISOString()
            });
            userRef.onDisconnect().remove();
            setInterval(() => {
                userRef.update({ lastSeen: new Date().toISOString() });
            }, 5000);
        }
    });
}

//Fonction pour Supprimer un Utilisateur de l’Interface (removeUserFromUI)    
function updateUserStatusUI(user, status) {
    let userElement = document.getElementById("user-status-" + user);

    if (!userElement) {
        userElement = document.createElement("li");
        userElement.id = "user-status-" + user;
        userElement.classList.add(status === "en ligne" ? "status-online" : "status-offline");

        const statusIndicator = document.createElement("span");
        statusIndicator.classList.add("status-indicator");
        userElement.appendChild(statusIndicator);

        const userNameText = document.createElement("span");
        userNameText.classList.add("user-status");
        userNameText.textContent = user + " - " + status;
        userElement.appendChild(userNameText);

        document.getElementById("online-users").appendChild(userElement);
    } else {
        userElement.classList.toggle("status-online", status === "en ligne");
        userElement.classList.toggle("status-offline", status !== "en ligne");
        userElement.querySelector(".user-status").textContent = user + " - " + status;
    }
}
    
function removeUserFromUI(user) {
    const userElement = document.getElementById("user-status-" + user);
    if (userElement) {
        userElement.remove();
    }
}

    function switchToChat() {
        document.getElementById("login-container").style.display = "none";
        document.getElementById("chat-container").style.display = "block";
        loadMessages();
    }
// 🔥 Détection de changement d'onglet pour changer seulement la couleur du rond
document.addEventListener("visibilitychange", function () {
  const userElement = document.getElementById("user-status-" + username);
  if (!userElement) return;

  const indicator = userElement.querySelector(".status-indicator");
  if (!indicator) return;

  if (document.visibilityState === "visible") {
    // 🟢 Actif sur l'onglet
    indicator.style.backgroundColor = "#00c853"; // Vert
    indicator.style.boxShadow = "0 0 8px #00c85399";
  } else {
    // 🟠 L'onglet est ouvert mais pas actif
    indicator.style.backgroundColor = "#ff9800"; // Orange
    indicator.style.boxShadow = "0 0 8px #ff980099";
  }
});

function sendMessage() {
    var messageInput = document.getElementById("message-input");
    var message = messageInput.value;

    if (message.trim() === "") {
        return;
    }

    var timestamp = Date.now();

    var msgData = { 
        user: username, 
        message: message, 
        timestamp: timestamp,
        reactions: {}
    };
    
    if (replyMessageId) {
        msgData.replyTo = replyMessageText;
        cancelReply();
    }

    // ✅ CORRECTION ICI : utilise le `db` déjà défini
    var msgRef = db.child("messages").push();
    msgRef.set(msgData);

    messageInput.value = '';
}


var childRemovedListenerSet = false;
//message vu ajouté ici
function loadMessages() {
  if (!messageListener) {
    messageListener = function(snapshot) {
      displayMessage(snapshot.key, snapshot.val());
    };
    db.child("messages").on("child_added", messageListener);
  }

  if (!childRemovedListenerSet) {
    db.child("messages").on("child_removed", function(snapshot) {
      const removedMessage = document.getElementById(snapshot.key);
      if (removedMessage) {
        removedMessage.remove();
        console.log("Message supprimé de l'interface après suppression dans Firebase.");
      }
    });
    childRemovedListenerSet = true;
  }

  // ✅ Ajoute ce bloc pour mettre à jour le DOM si le message est "vu"
  db.child("messages").on("child_changed", function(snapshot) {
    const key = snapshot.key;
    const data = snapshot.val();
    const msgDiv = document.getElementById(key);

    if (msgDiv && data.seen && data.user === username) {
      // Vérifie si le ✓✓ n'est pas déjà là
      if (!msgDiv.querySelector(".seen-check")) {
        const seenCheck = document.createElement("span");
        seenCheck.className = "seen-check";
        seenCheck.textContent = "✓";
        msgDiv.appendChild(seenCheck);
      }
    }
  });
}

   
    //fonction pour les réactions dans les messages 
    function addReactionEmoji(messageId, emoji) {
    db.child("rooms/" + roomName + "/messages/" + messageId + "/reactions/" + username).set(emoji);
}

    // Liste d'émojis de base
    const emojis = ["😀", "😂", "😍", "😎", "😊", "😢", "😡", "👍", "👎", "🎉", "❤️", "🔥"];

function loadEmojis() {
  const picker = document.getElementById("emoji-picker");
  picker.innerHTML = "";
  emojis.forEach(emoji => {
    const emojiSpan = document.createElement("span");
    emojiSpan.textContent = emoji;
    emojiSpan.className = "emoji";
    emojiSpan.onclick = function () {
      insertEmoji(emoji);
    };
    picker.appendChild(emojiSpan);
  });
}

function insertEmoji(emoji) {
  const messageInput = document.getElementById("message-input");
  messageInput.value += emoji;
  document.getElementById("emoji-picker").style.display = "none";
}


function toggleEmojiPicker() {
  const button = document.querySelector("button[onclick='toggleEmojiPicker()']");
  const picker = document.getElementById("emoji-picker");

  if (!picker || !button) return;

   if (picker.style.display !== "flex") {
    picker.style.display = "flex";
    picker.style.visibility = "hidden";
    requestAnimationFrame(() => {
      const rect = button.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      picker.style.top = `${rect.top + scrollY - picker.offsetHeight - 10}px`;
      picker.style.left = `${rect.left + scrollX}px`;
      picker.style.visibility = "visible";
    });
  } else {
    picker.style.display = "none";
  }
}


// ✅ Gère la fermeture de l'emoji picker global
document.addEventListener("click", function(event) {
  const picker = document.getElementById("emoji-picker");
  const emojiButton = document.querySelector("button[onclick='toggleEmojiPicker()']");
  if (!picker.contains(event.target) && event.target !== emojiButton && !event.target.classList.contains("emoji")) {
    picker.style.display = "none";
  }
});

    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            document.querySelectorAll(".emoji-picker-message").forEach(function(picker) {
                picker.style.display = "none";
            });
        }
    });

    //Bouton Quitter
function quitRoom() {
    // Supprime l'utilisateur de Firebase
    firebase.database().ref("users/" + username).remove();

    // Supprime le listener de messages pour éviter les doublons
    if (messageListener) {
        db.child("rooms/" + roomName + "/messages").off("child_added", messageListener);
        messageListener = null;
    }

    // Cache la section de chat et affiche la section de connexion
    document.getElementById("chat-container").style.display = "none";
    document.getElementById("login-container").style.display = "block";

    // Force l'actualisation de l'onglet
    location.reload();
}
// Pour les messages gauche à droite
   function displayMessage(key, data) {
      const msgDiv = document.createElement("div");
      msgDiv.id = key;
      msgDiv.className = "message " + (data.user === username ? "user1" : "user2");

      if (data.replyTo) {
        const replyDiv = document.createElement("div");
        replyDiv.className = "citation flou";
        replyDiv.textContent = "Réponse du : " + data.replyTo;
        msgDiv.appendChild(replyDiv);
      }

      let content;
      if (data.type === "audio") {
        content = document.createElement("audio");
        content.controls = true;
        content.src = data.audioBase64;
        content.className = "audio-message";
      } else if (data.type === "image") {
        content = document.createElement("img");
        content.src = data.imageBase64;
        content.className = "image-message";
        content.style.maxWidth = "220px";
        content.onclick = () => openImagePopup(data.imageBase64);
      } else {
      content = document.createElement("div");
content.className = "msg-text";

if (data.user !== username) {
  content.classList.add("flou");

  msgDiv.addEventListener("mouseenter", function () {
    content.classList.remove("flou");
    if (!msgDiv.dataset.timerStarted) {
      msgDiv.dataset.timerStarted = "true";
      startDeletionTimer(msgDiv, key);
    }
  });
}
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const msg = (data.message || "").replace(urlRegex, url => `<a href="${url}" target="_blank" style="color:#ffd700">${url}</a>`);
  content.innerHTML = msg;
}

      const userTag = document.createElement("div");
      userTag.className = "username-tag";
      userTag.textContent = data.user;
      msgDiv.appendChild(userTag);
      msgDiv.appendChild(content);

      const time = document.createElement("div");
      time.className = "timestamp";
      time.textContent = formatTime(data.timestamp);
      msgDiv.dataset.timestamp = data.timestamp;
      msgDiv.appendChild(time);

      const reactionContainer = document.createElement("div");
      reactionContainer.className = "reaction-container";
      db.child(`rooms/${roomName}/messages/${key}/reactions`).on("value", snap => {
        reactionContainer.innerHTML = "";
        if (snap.exists()) {
          const label = document.createElement("span");
          label.className = "reaction-label";
          label.textContent = "Réaction :";
          reactionContainer.appendChild(label);
          snap.forEach(child => {
            const emoji = document.createElement("span");
            emoji.textContent = child.val();
            emoji.className = "reaction-emoji";
            reactionContainer.appendChild(emoji);
          });
        }
      });
      msgDiv.appendChild(reactionContainer);

      const actions = document.createElement("div");
      actions.className = "action-buttons";

      const emojiBtn = document.createElement("button");
      emojiBtn.className = "emoji-btn";
      emojiBtn.textContent = "😀";
      emojiBtn.onclick = () => toggleEmojiPickerMessage(key);
      actions.appendChild(emojiBtn);

      const emojiPicker = document.createElement("div");
      emojiPicker.className = "emoji-picker-message";
      emojiPicker.id = `emoji-picker-${key}`;
      emojis.forEach(emoji => {
        const span = document.createElement("span");
        span.className = "emoji";
        span.textContent = emoji;
        span.onclick = () => {
          addReactionEmoji(key, emoji);
          emojiPicker.style.display = "none";
        };
        emojiPicker.appendChild(span);
      });
      msgDiv.appendChild(emojiPicker);

const btnGroup = document.createElement("div");
btnGroup.style.display = "flex";
btnGroup.style.gap = "5px";

const replyBtn = document.createElement("button");
replyBtn.className = "icon-button";
replyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c4.28 0 6.88 1.45 8.95 4.1-.5-5.04-3.95-10-8.95-10z"/></svg>';
replyBtn.onclick = () => prepareReply(key, data.message);
btnGroup.appendChild(replyBtn);

if (data.user === username) {
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "icon-button";
  deleteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-4.5l-1-1z"/></svg>';
  deleteBtn.onclick = () => db.child("messages").child(key).remove();
  btnGroup.appendChild(deleteBtn);
}

actions.appendChild(btnGroup);     // ✅ Affiche le groupe dans actions
msgDiv.appendChild(actions);       // ✅ Affiche tout dans le message
//message vu
       updateSeenStatus(msgDiv, data, key); // ✅ C’est ce qui déclenche l’apparition de la coche

       document.getElementById("messages").appendChild(msgDiv);
      scrollToBottom();

      if (data.user !== username && document.visibilityState === 'hidden') {
        document.title = "💬 Nouveau message !";
        notificationSound.play().catch(() => {});
      }
    }
function startDeletionTimer(msgDiv, key) {
  msgDiv.classList.add("deletion-pending");
    setTimeout(() => {
    deleteMessage(msgDiv, key);
  }, 600000); // 10 minutes
}

function deleteMessage(msgDiv, key) {
  if (msgDiv.classList.contains("deleting")) return; // 🧱 Stop si déjà lancé
  msgDiv.classList.add("deleting");

  msgDiv.classList.add("fondu");
  setTimeout(() => {
    msgDiv.remove();
    db.child("messages").child(key).remove();
  }, 1000);
}


   
// Fonction toggleEmojiPickerMessage pour afficher/masquer l'emoji picker spécifique à chaque message
function toggleEmojiPickerMessage(key) {
    document.querySelectorAll(".emoji-picker-message").forEach(picker => {
        if (picker.id !== `emoji-picker-${key}`) {
            picker.style.display = "none";
        }
    });

    const picker = document.getElementById(`emoji-picker-${key}`);
    if (picker) {
        picker.style.display = picker.style.display === "flex" ? "none" : "flex";
    }
}

    function prepareReply(key, message) {
    replyMessageId = key; // Enregistre l'ID du message auquel on répond
    replyMessageText = message; // Enregistre le texte du message pour la citation
    document.getElementById("reply-message").textContent = "Réponse du : " + message; // Affiche la citation
    document.getElementById("reply-container").style.display = "block"; // Affiche le conteneur de réponse
}

   function cancelReply() {
    replyMessageId = null; // Réinitialise l'ID de réponse
    replyMessageText = ""; // Réinitialise le texte de la citation
    document.getElementById("reply-message").textContent = ""; // Efface la citation affichée
    document.getElementById("reply-container").style.display = "none"; // Cache le conteneur de réponse
}

   function scrollToBottom() {
        var messagesDiv = document.getElementById("messages");
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
        // Supprime l'utilisateur de Firebase
    window.addEventListener("beforeunload", function() {
    firebase.database().ref("users/" + username).remove();
});
 document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    document.title = "Votre Chat";
    notificationSound.pause();
    notificationSound.currentTime = 0;
  }
});

let mediaRecorder;
let audioChunks = [];
let recordedBlob;
let microAccessGranted = false;

function toggleRecording() {
    const recordBtn = document.getElementById('record-btn');

    if (!microAccessGranted && !mediaRecorder) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            microAccessGranted = true;
            startRecording(stream, recordBtn);
        }).catch(error => {
            console.error("Erreur micro :", error);
            alert("Erreur : accès au micro refusé !");
        });
    } else if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    } else {
        // ✅ Re-demande le micro et recommence un nouvel enregistrement
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            startRecording(stream, recordBtn);
        }).catch(error => {
            console.error("Erreur lors de la reprise de l’enregistrement :", error);
            alert("Impossible de relancer l’enregistrement.");
        });
    }
}

function startRecording(stream, recordBtn) {
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioURL = URL.createObjectURL(recordedBlob);

        document.getElementById('audio-player').src = audioURL;
        document.getElementById('audio-preview').style.display = "block";

        // Remet le bouton à l’état initial
        recordBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0H4a8 8 0 0016 0h-2zm-6 8c2.21 0 4-1.79 4-4h-2a2 2 0 01-4 0H8c0 2.21 1.79 4 4 4z"/>
            </svg>`;
        recordBtn.classList.remove("recording");

        // 🔁 Reset pour pouvoir relancer un autre enregistrement
        mediaRecorder = null;
    };

    // Lancement
    mediaRecorder.start();
    recordBtn.innerHTML = "⏹️ Stop";
    recordBtn.classList.add("recording");

    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            alert("Durée maximale atteinte (30s)");
        }
    }, 30000);
}

function uploadAudio() {
    if (!recordedBlob) {
        alert("Aucun enregistrement à envoyer.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = function () {
        const base64Audio = reader.result;

        // Limite de poids (environ 300Ko)
        if (base64Audio.length > 400000) {
            alert("Message trop long ou lourd. Réenregistre un message plus court (max 30s).");
            return;
        }

        const audioMessage = {
            user: username,
            type: "audio",
            audioBase64: base64Audio,
            timestamp: Date.now()
        };

      db.child("messages").push(audioMessage);

        // Réinitialiser l’interface
        document.getElementById('audio-preview').style.display = "none";
        document.getElementById('audio-player').src = "";
        recordedBlob = null;
    };

    reader.readAsDataURL(recordedBlob); // transforme le blob en base64
}

function cancelAudio() {
    recordedBlob = null;
    document.getElementById('audio-preview').style.display = "none";
    document.getElementById('audio-player').src = "";
}

function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = function () {
            const base64Image = reader.result;

            const imageMessage = {
                user: username,
                type: "image",
                imageBase64: base64Image,
                timestamp: Date.now()
            };

            db.child("messages").push(imageMessage);
        };
        reader.readAsDataURL(file);
    });

    event.target.value = ""; // Pour pouvoir renvoyer la même image ensuite si besoin
}

function openImagePopup(src) {
    const popup = document.getElementById("image-popup");
    const img = document.getElementById("popup-img");
    img.src = src;
    popup.style.display = "flex";
}

//message vu, domcontentloaded fusionné 
// ✅ Version nettoyée du DOMContentLoaded fusionné et patché

document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOMContentLoaded exécuté");

  // ✅ Notification d'entrée
  showNotification();

  // ✅ Login par touche Enter
  const loginContainer = document.getElementById("login-container");
  if (loginContainer) {
    loginContainer.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        console.log("⏎ Entrée détectée dans login-container");
        const loginBtn = document.querySelector(".login-button");
        if (loginBtn) {
          console.log("🚪 Clic simulé sur bouton login");
          loginBtn.click();
        }
      }
    });
  }

  // ✅ Bouton de login (fonction joinRoom déjà définie)
  const loginBtn = document.querySelector(".login-button");
  if (loginBtn) {
    console.log("🎯 Bouton login trouvé et listener attaché");
    loginBtn.onclick = () => {
      console.log("⚡ joinRoom() déclenché par clic");
      joinRoom();
    };
  }

  // ✅ Chargement des emojis
  console.log("😀 Chargement des emojis...");
  loadEmojis();

  // ✅ Envoi du message avec Enter
  const messageInput = document.getElementById("message-input");
  if (messageInput) {
    messageInput.addEventListener("keydown", function(event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        console.log("✉️ Message envoyé via Entrée");
        sendMessage();
      }
    });
  }

  // ✅ Theme toggle 🌙/☀️
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const theme = isDark ? lightTheme : darkTheme;
      Object.entries(theme).forEach(([key, val]) => {
        document.documentElement.style.setProperty(key, val);
      });
      toggle.textContent = isDark ? '☀️' : '🌙';
      isDark = !isDark;
    });
  }

  // ✅ Gestion du popup d'image (ouvrir, fermer, échap)
  const popup = document.getElementById("image-popup");
  const popupImg = document.getElementById("popup-img");
  const closeBtn = document.getElementById("close-popup-btn");
  const popupInner = document.getElementById("popup-inner");

  if (popup && popupImg && closeBtn) {
    closeBtn.addEventListener("click", () => {
      popup.style.display = "none";
    });

    popup.addEventListener("click", (e) => {
      if (!popupImg.contains(e.target) && !closeBtn.contains(e.target)) {
        popup.style.display = "none";
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        popup.style.display = "none";
      }
    });
  }
});


setInterval(() => {
  document.querySelectorAll('.message').forEach(msg => {
    const ts = msg.dataset.timestamp;
    if (ts) {
      const time = msg.querySelector('.timestamp');
      if (time) {
        time.textContent = formatTime(Number(ts));
      }
    }
  });
}, 60000); // toutes les 60 secondes

function formatTime(ts) {
  const date = new Date(Number(ts));
  if (isNaN(date.getTime())) {
    return typeof ts === 'string' ? ts : "🕓 invalide";
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
// Application des thèmes
const themes = {
  default: {
    '--message-color-user1': 'linear-gradient(135deg, #4e54c8, #8f94fb)',
    '--message-color-user2': '#3a3a3a'
  },
  ocean: {
    '--message-color-user1': 'linear-gradient(135deg, #2193b0, #6dd5ed)',
    '--message-color-user2': '#145374'
  },
  forest: {
    '--message-color-user1': 'linear-gradient(135deg, #388e3c, #a5d6a7)',
    '--message-color-user2': '#2e7d32'
  },

  // 💖 Nouveaux thèmes
rosewood: {
    '--message-color-user1': 'linear-gradient(135deg, #a83279, #d38312)',
    '--message-color-user2': '#502336',

  },
  noir: {
    '--message-color-user1': 'linear-gradient(135deg, #434343, #000000)',
    '--message-color-user2': '#1e1e1e',

  },
  midnight: {
    '--message-color-user1': 'linear-gradient(135deg, #1c92d2, #f2fcfe)',
    '--message-color-user2': '#172d51',

  },
  sepia: {
    '--message-color-user1': 'linear-gradient(135deg, #a2836e, #e6ccb2)',
    '--message-color-user2': '#5a463b',

  },
  galaxy: {
    '--message-color-user1': 'linear-gradient(135deg, #4a00e0, #8e2de2)',
    '--message-color-user2': '#2a2438',
  }
};


// ✅ Applique un thème donné
function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;

  Object.keys(theme).forEach(variable => {
    document.documentElement.style.setProperty(variable, theme[variable]);
  });
}

// ✅ Charge le thème de l'utilisateur depuis Firebase
function loadUserTheme() {
  if (!username || !roomName) return;
  const userRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`);
  userRef.once("value").then(snapshot => {
    const data = snapshot.val();
    if (data && data.theme) {
      applyTheme(data.theme);
      document.getElementById("theme-select").value = data.theme;
    } else {
      applyTheme("default");
      document.getElementById("theme-select").value = "default";
    }
  });
}

// ✅ Gère le changement de thème et enregistre dans Firebase
function handleThemeChange(e) {
  const selectedTheme = e.target.value;
  applyTheme(selectedTheme);

  if (!username || !roomName) return;

  const userRef = firebase.database().ref(`rooms/${roomName}/onlineUsers/${username}`);
  userRef.update({ theme: selectedTheme });
}
//bouton d'urgence
function panicWipe() {
  if (!roomName) return;
  firebase.database().ref("rooms/" + roomName).remove().catch(() => {});
  window.location.href = "https://www.google.com";
}

function activateStealth() {
  document.body.querySelectorAll("body > *:not(#stealth-screen)").forEach(el => el.style.display = "none");
  document.getElementById("stealth-screen").style.display = "flex";

  const input = document.getElementById("stealth-code");
  input.value = "";
  input.focus();

  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      const passwordValue = document.getElementById("password-input")?.value;
      if (input.value === passwordValue) {
        document.getElementById("stealth-screen").style.display = "none";
        document.body.querySelectorAll("body > *:not(#stealth-screen)").forEach(el => el.style.display = "");
      } else {
        input.value = "";
        input.placeholder = "Erreur. Réessaye.";
      }
    }
  }, { once: true });
}

function quitStealthSafely() {
  window.location.href = "https://www.google.com";
}
// 🎨 Système de Dark/Light mode
const lightTheme = {
  '--bg-color': '#ffffff',
  '--text-color': '#1a1a1a',
  '--accent-color': '#0055ff',
  '--button-bg': '#dddddd',
  '--button-hover-bg': '#cccccc',
  '--message-color-user1': 'linear-gradient(135deg, #1976d2, #90caf9)',
  '--message-color-user2': '#e0e0e0'
};

const darkTheme = {
  '--bg-color': '#1f1f1f',
  '--text-color': '#ffffff',
  '--accent-color': '#ffd700',
  '--button-bg': '#5a5a5a',
  '--button-hover-bg': '#4c4c4c',
  '--message-color-user1': 'linear-gradient(135deg, #4e54c8, #8f94fb)',
  '--message-color-user2': '#3a3a3a'
};

let isDark = true; // Thème par défaut : sombre

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const theme = isDark ? lightTheme : darkTheme;
    Object.entries(theme).forEach(([key, val]) => {
      document.documentElement.style.setProperty(key, val);
    });

    toggle.textContent = isDark ? '☀️' : '🌙';
    isDark = !isDark;
  });
});
//message vu function
function updateSeenStatus(msgDiv, data, key) {
  if (data.user !== username) {
    msgDiv.addEventListener("mouseenter", () => {
      if (!data.seen) {
        db.child("messages").child(key).update({ seen: true });
      }
    });
  } else if (data.user === username && data.seen) {
    // ✅ Si c'est ton message et qu'il a été vu : afficher la coche
    const seenCheck = document.createElement("span");
    seenCheck.className = "seen-check";

    // ✅ Petite icône SVG (WhatsApp-style)
seenCheck.innerHTML = `
  <svg viewBox="0 0 24 24">
    <path d="M1 13l4 4L23 3M10 14l4 4" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;
// WebRTC Variables
let peerConnection;
let localStream;
let remoteStream;
const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// Sonnerie d'appel entrant
const ringtone = new Audio('https://assets.mixkit.co/active_storage/sfx/2576/2576-preview.mp3');

function startCall() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream;
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        db.child("rooms/" + roomName + "/call").set({
          type: "offer",
          candidate: event.candidate,
          from: username
        });
      }
    };

    peerConnection.createOffer().then(offer => {
      return peerConnection.setLocalDescription(offer);
    }).then(() => {
      db.child("rooms/" + roomName + "/call").set({
        type: "offer",
        offer: peerConnection.localDescription,
        from: username
      });
    });
  });
}

db.child("call").on("value", snapshot => {
  const data = snapshot.val();
  if (!data || data.from === username) return;

  if (data.type === "offer") {
    showIncomingCall(data.from);
  } else if (data.type === "answer" && peerConnection) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } else if (data.type === "candidate" && peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

function showIncomingCall(fromUser) {
  document.getElementById("caller-name").textContent = `📞 Appel de ${fromUser}`;
  document.getElementById("incoming-call-popup").style.display = "block";
  ringtone.loop = true;
  ringtone.play().catch(() => {});
}

function acceptCall() {
  document.getElementById("incoming-call-popup").style.display = "none";
  ringtone.pause();
  ringtone.currentTime = 0;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    localStream = stream;
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = event => {
      const remoteAudio = new Audio();
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play();
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        db.child("rooms/" + roomName + "/call").set({
          type: "candidate",
          candidate: event.candidate,
          from: username
        });
      }
    };

    db.child("rooms/" + roomName + "/call").once("value").then(snapshot => {
      const callData = snapshot.val();
      if (callData.offer) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer)).then(() => {
          return peerConnection.createAnswer();
        }).then(answer => {
          return peerConnection.setLocalDescription(answer);
        }).then(() => {
          db.child("rooms/" + roomName + "/call").set({
            type: "answer",
            answer: peerConnection.localDescription,
            from: username
          });
        });
      }
    });
  });
}

function declineCall() {
  document.getElementById("incoming-call-popup").style.display = "none";
  ringtone.pause();
  ringtone.currentTime = 0;
  db.child("rooms/" + roomName + "/call").remove();
}


    msgDiv.appendChild(seenCheck);
  }
}
