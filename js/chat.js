import { GeminiProvider } from './api.js';
import { StorageManager } from './storage.js';
import { ToolRegistry } from './toolRegistry.js';

export class AppManager {
    constructor() {
        this.api = new GeminiProvider();
        this.storage = new StorageManager();
        this.tools = new ToolRegistry();
        
        this.history = [];
        this.currentChatId = null;
        this.currentAttachment = null;
        this.speech = window.speechSynthesis;
        this.abortController = null;
        this.deferredPrompt = null;
        this.isProcessing = false;
        
        this.initDOM();
        this.initNotifications();
        this.checkLoginStatus();
        this.bindEvents();
        this.setupHardwareAndFiles();
        this.initPWA();
        this.loadChats();
        
        if(window.lucide) lucide.createIcons();
    }

    initDOM() {
        this.input = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.wrapper = document.getElementById('messagesWrapper');
        this.toast = document.getElementById('toastNotification');
        
        this.attachBtn = document.getElementById('attachBtn');
        this.attachMenu = document.getElementById('attachMenu');
        this.photoInput = document.getElementById('photoInput');
        this.docInput = document.getElementById('docInput');
        
        this.cameraBtn = document.getElementById('cameraBtn');
        this.voiceBtn = document.getElementById('voiceBtn');
        this.attachmentPreview = document.getElementById('attachmentPreview');
    }

    showToast(msg) {
        this.toast.innerText = msg;
        this.toast.classList.add('show');
        setTimeout(() => this.toast.classList.remove('show'), 2000);
    }

    initNotifications() {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }

    sendNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification(title, { body: body, icon: 'icon.png' });
        }
    }

    initPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('installPwaBtn');
            if (installBtn) installBtn.style.display = 'block';
        });

        const installBtn = document.getElementById('installPwaBtn');
        if (installBtn) {
            installBtn.onclick = async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    if (outcome === 'accepted') { installBtn.style.display = 'none'; }
                    this.deferredPrompt = null;
                }
            };
        }
    }

    checkLoginStatus() {
        const storedUser = localStorage.getItem('nova_user');
        const greeting = document.getElementById('greetingName');
        if (storedUser) {
            document.getElementById('authContainer').style.display = 'none';
            document.getElementById('userProfile').style.display = 'block';
            if (greeting) greeting.innerText = `Hello, Shiva`;
        } else {
            if (greeting) greeting.innerText = `Hello!`; 
        }
    }

    bindEvents() {
        const mockLoginBtn = document.getElementById('mockLoginBtn');
        if (mockLoginBtn) {
            mockLoginBtn.onclick = () => {
                localStorage.setItem('nova_user', 'true');
                window.location.reload();
            };
        }

        this.sendBtn.onclick = (e) => {
            e.preventDefault();
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = null;
                return;
            }
            if (this.isProcessing) return; 
            
            this.isProcessing = true;
            this.sendBtn.style.pointerEvents = 'none';
            setTimeout(() => {
                this.sendBtn.style.pointerEvents = 'auto';
                this.isProcessing = false;
            }, 300); 
            
            this.handleSend();
        };

        this.input.oninput = () => {
            this.input.style.height = 'auto';
            this.input.style.height = Math.min(this.input.scrollHeight, 200) + 'px';
        };
        this.input.onkeydown = (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                if (!this.abortController && !this.isProcessing) {
                    this.isProcessing = true;
                    setTimeout(() => this.isProcessing = false, 300);
                    this.handleSend(); 
                }
            } 
        };
        
        document.getElementById('newChatBtn').onclick = () => {
            this.startNew();
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('show');
        };
        
        document.getElementById('themeToggle').onclick = () => {
            const root = document.documentElement;
            root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        };

        document.getElementById('menuToggle').onclick = () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebarOverlay').classList.toggle('show');
        };
        
        document.getElementById('sidebarOverlay').onclick = () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('show');
        };
        
        const menuBtn = document.getElementById('mainMenuBtn');
        const dropdown = document.getElementById('headerDropdown');
        if (menuBtn && dropdown) {
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            };
        }

        document.getElementById('exportPdfBtn').onclick = () => {
            const opt = { margin: 10, filename: `Nova_Report_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
            html2pdf().set(opt).from(this.wrapper).save();
            this.showToast("Exporting PDF...");
        };

        document.getElementById('shareChatBtn').onclick = () => {
            if (navigator.share) {
                navigator.share({ title: 'Nova AI Chat', text: 'Check out this conversation!' });
            } else {
                this.showToast("Share not supported.");
            }
        };

        const userAvatar = document.getElementById('userAvatar');
        if(userAvatar) {
            userAvatar.onclick = () => {
                if(confirm("Do you want to logout?")) {
                    localStorage.removeItem('nova_user');
                    window.location.reload();
                }
            };
        }

        document.getElementById('researchBtn').onclick = () => document.getElementById('trainModal').style.display = 'flex';
        document.getElementById('checkTrainBtn').onclick = () => {
            document.getElementById('trainModal').style.display = 'none';
            const num = document.getElementById('trainNumber').value;
            const date = document.getElementById('trainDate').value;
            this.input.value = `Train status for ${num} on ${date}`;
            this.handleSend();
        };
        document.querySelectorAll('.closeModal').forEach(btn => btn.onclick = (e) => e.target.closest('.modal').style.display = 'none');
        document.querySelectorAll('.suggestion-card').forEach(c => {
            c.onclick = () => { this.input.value = c.innerText; this.handleSend(); };
        });

        document.getElementById('chatList').onclick = (e) => {
            const moreBtn = e.target.closest('.chat-more-btn');
            if(moreBtn) {
                e.stopPropagation();
                document.querySelectorAll('.chat-dropdown.show').forEach(d => d.classList.remove('show'));
                moreBtn.nextElementSibling.classList.toggle('show');
                return;
            }
            const pinBtn = e.target.closest('.pin-chat-btn');
            if(pinBtn) {
                e.stopPropagation();
                this.storage.togglePin(pinBtn.dataset.id);
                this.loadChats(); 
                this.showToast("Pin Updated");
                return;
            }
            const deleteBtn = e.target.closest('.delete-chat-btn');
            if(deleteBtn) {
                e.stopPropagation();
                if(confirm("Delete this chat?")) {
                    this.storage.deleteChat(deleteBtn.dataset.id);
                    this.loadChats();
                    if(this.currentChatId === deleteBtn.dataset.id) this.startNew();
                    this.showToast("Chat Deleted");
                }
                return;
            }
        };

        document.addEventListener('click', (e) => {
            if(!e.target.closest('.chat-item-container')) {
                document.querySelectorAll('.chat-dropdown.show').forEach(d => d.classList.remove('show'));
            }
            if(dropdown && !e.target.closest('.header-actions')) {
                dropdown.classList.remove('show');
            }
            if(this.attachMenu && !e.target.closest('.attachment-wrapper')) {
                this.attachMenu.classList.remove('show');
            }
        });
    }

    setupHardwareAndFiles() {
        this.attachBtn.onclick = (e) => {
            e.stopPropagation();
            this.attachMenu.classList.toggle('show');
        };

        document.getElementById('attachPhotoBtn').onclick = () => {
            this.photoInput.click();
            this.attachMenu.classList.remove('show');
        };
        document.getElementById('attachDocBtn').onclick = () => {
            this.docInput.click();
            this.attachMenu.classList.remove('show');
        };

        const handleFile = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.showToast("Reading file...");
            if (file.type === 'application/pdf' && window.pdfjsLib) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const typedarray = new Uint8Array(ev.target.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let text = '';
                    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        text += content.items.map(item => item.str).join(' ') + '\n';
                    }
                    this.setAttachment({ type: 'application/pdf', name: file.name, data: text });
                };
                reader.readAsArrayBuffer(file);
            } else {
                const reader = new FileReader();
                reader.onload = (ev) => this.setAttachment({ type: file.type || 'text/plain', name: file.name, data: ev.target.result });
                file.type.startsWith('image/') ? reader.readAsDataURL(file) : reader.readAsText(file);
            }
        };

        this.photoInput.onchange = handleFile;
        this.docInput.onchange = handleFile;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.onresult = (e) => {
                this.input.value += e.results[0][0].transcript;
                this.voiceBtn.style.color = 'var(--text-secondary)';
            };
            this.voiceBtn.onclick = () => {
                this.voiceBtn.style.color = 'red';
                recognition.start();
                this.showToast("Listening...");
            };
        } else {
            this.voiceBtn.style.display = 'none';
        }

        const modal = document.getElementById('cameraModal');
        const video = document.getElementById('cameraVideo');
        const canvas = document.getElementById('cameraCanvas');
        let stream = null;

        if (this.cameraBtn) {
            this.cameraBtn.onclick = async () => {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if(video) video.srcObject = stream;
                    if(modal) modal.style.display = 'flex';
                } catch (err) { alert("Camera permission denied."); }
            };
        }
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.onclick = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg');
                this.setAttachment({ type: 'image/jpeg', name: 'Camera_Capture.jpg', data: dataUrl });
                modal.style.display = 'none';
                if (stream) stream.getTracks().forEach(t => t.stop());
            };
        }
    }

    setAttachment(fileObj) {
        this.currentAttachment = fileObj;
        this.attachmentPreview.style.display = 'flex';
        this.attachmentPreview.innerHTML = `
            <div style="background:var(--bg-secondary); padding:4px 8px; border-radius:16px; font-size:0.8rem; display:flex; align-items:center; gap:8px; border: 1px solid var(--border);">
                <i data-lucide="file" style="width:14px;"></i> ${fileObj.name} 
                <i data-lucide="x" style="cursor:pointer; width:14px;" id="removeAttach"></i>
            </div>`;
        if (window.lucide) lucide.createIcons();
        document.getElementById('removeAttach').onclick = () => {
            this.currentAttachment = null;
            this.attachmentPreview.style.display = 'none';
            this.photoInput.value = '';
            this.docInput.value = '';
        };
    }

    startNew() {
        this.currentChatId = Date.now().toString();
        this.history = [];
        this.wrapper.innerHTML = '';
        document.getElementById('welcomeScreen').style.display = 'block';
    }

    loadChats() {
        const list = document.getElementById('chatList');
        if(!list) return;
        list.innerHTML = '';
        let chats = this.storage.getAllChats();
        
        chats.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.updatedAt - a.updatedAt;
        });

        chats.forEach(c => {
            const li = document.createElement('div');
            li.className = 'chat-item-container';
            const pinIcon = c.pinned ? `<i data-lucide="pin" style="width:14px; color:var(--accent); margin-right:8px;"></i>` : '';
            const pinText = c.pinned ? 'Unpin chat' : 'Pin chat';

            li.innerHTML = `
                <div class="chat-item" onclick="window.nova.loadChat('${c.id}')">${pinIcon}${c.title}</div>
                <button class="icon-btn chat-more-btn" title="Options"><i data-lucide="more-horizontal"></i></button>
                <div class="chat-dropdown">
                    <button class="pin-chat-btn" data-id="${c.id}"><i data-lucide="pin"></i> ${pinText}</button>
                    <button class="delete-chat-btn" data-id="${c.id}"><i data-lucide="trash-2"></i> Delete chat</button>
                </div>
            `;
            list.appendChild(li);
        });
        if(window.lucide) lucide.createIcons();
    }

    loadChat(id) {
        const chat = this.storage.getChat(id);
        if(!chat) return;
        this.currentChatId = id;
        this.history = chat.messages;
        document.getElementById('welcomeScreen').style.display = 'none';
        this.wrapper.innerHTML = '';
        
        chat.messages.forEach(m => this.appendMsg(m.role, m.content, m.attachment));
        
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
    }

    async handleSend() {
        const text = this.input.value.trim();
        if(!text && !this.currentAttachment) return;
        if(this.abortController) return; 
        
        if(!this.currentChatId) this.currentChatId = Date.now().toString();
        document.getElementById('welcomeScreen').style.display = 'none';
        
        const attachCopy = this.currentAttachment ? { ...this.currentAttachment } : null;
        this.appendMsg('user', text, attachCopy);
        this.history.push({role: 'user', content: text, attachment: attachCopy});
        
        this.input.value = '';
        this.input.style.height = 'auto'; 
        this.currentAttachment = null;
        this.attachmentPreview.style.display = 'none';

        if (text) {
            const toolRes = await this.tools.intercept(text);
            if(toolRes) {
                this.appendMsg('model', toolRes.content);
                this.history.push({role: 'model', content: toolRes.content});
                this.saveChat();
                this.sendNotification('Nova AI', 'Your tool request is ready!');
                return;
            }
        }

        // Initially show typing indicator
        const msgObj = this.appendMsg('model', '<span class="typing-indicator">Thinking...</span>');
        let isFirstChunk = true;

        this.abortController = new AbortController();
        this.sendBtn.innerHTML = '<i data-lucide="square"></i>'; 
        if(window.lucide) lucide.createIcons();

        try {
            const fullText = await this.api.streamResponse(
                text || "Please deeply analyze this image.", 
                this.history.slice(0, -1),
                attachCopy,
                (cumulativeText, newChunk) => {
                    // 🔥 REAL-TIME STREAMING LOGIC 🔥
                    if (isFirstChunk) {
                        msgObj.div.innerHTML = ''; // Clear "Thinking..." immediately
                        isFirstChunk = false;
                    }
                    
                    // Render markdown progressively
                    msgObj.div.innerHTML = DOMPurify.sanitize(marked.parse(cumulativeText));
                    
                    this.addCodeCopy(msgObj.div);
                    this.processImages(msgObj.div); 
                    
                    // Smart auto-scroll: Only force scroll if user is near the bottom
                    const chatCont = document.getElementById('chatContainer');
                    const isNearBottom = chatCont.scrollHeight - chatCont.scrollTop <= chatCont.clientHeight + 100;
                    if (isNearBottom) {
                        chatCont.scrollTop = chatCont.scrollHeight;
                    }
                },
                this.abortController.signal
            );
            
            this.history.push({role: 'model', content: fullText});
            this.saveChat();
            this.sendNotification('Nova AI', 'Your response is ready!');
            
        } catch (error) {
            if (error.name === 'AbortError') {
                msgObj.div.innerHTML += "<br><br><em style='color:var(--text-secondary)'>[Generation Stopped]</em>";
                this.history.push({role: 'model', content: msgObj.div.innerText});
                this.saveChat();
            } else if (error.message === "API_CONNECTION_ERROR") {
                msgObj.div.innerHTML = `<strong>Network Error:</strong> Connection failed. Please try again.`;
            } else {
                msgObj.div.innerHTML = `<strong>Error:</strong> ${error.message}`;
            }
        } finally {
            this.abortController = null;
            this.sendBtn.innerHTML = '<i data-lucide="send"></i>'; 
            if(window.lucide) lucide.createIcons();
        }
    }

    addCodeCopy(container) {
        container.querySelectorAll('pre').forEach(pre => {
            if(!pre.querySelector('.copy-code-btn')) {
                const btn = document.createElement('button');
                btn.className = 'copy-code-btn';
                btn.innerText = 'Copy';
                btn.onclick = () => {
                    navigator.clipboard.writeText(pre.innerText.replace('Copy',''));
                    this.showToast('Code Copied!');
                };
                pre.appendChild(btn);
            }
        });
    }

    processImages(container) {
        container.querySelectorAll('img').forEach(img => {
            if (img.closest('.ai-image-container')) return; 
            
            const wrapper = document.createElement('div');
            wrapper.className = 'ai-image-container';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'image-overlay-btns';
            overlay.innerHTML = `
                <button class="img-btn download-img" title="Download Image"><i data-lucide="download" style="width:16px;"></i></button>
                <button class="img-btn edit-img" title="Edit Image"><i data-lucide="edit-3" style="width:16px;"></i></button>
            `;
            wrapper.appendChild(overlay);

            overlay.querySelector('.download-img').onclick = async () => {
                try {
                    const res = await fetch(img.src);
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = 'Nova_Image_' + Date.now() + '.png';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    this.showToast('Image Downloaded!');
                } catch(e) {
                    this.showToast("Cannot download directly due to browser security.");
                }
            };
            
            overlay.querySelector('.edit-img').onclick = () => {
                this.input.value = "Please modify this image: ";
                this.input.focus();
                fetch(img.src).then(r => r.blob()).then(b => {
                    const reader = new FileReader();
                    reader.onload = (ev) => this.setAttachment({ type: b.type, name: 'Edit_Image.jpg', data: ev.target.result });
                    reader.readAsDataURL(b);
                });
            };
        });
        if(window.lucide) lucide.createIcons();
    }

    appendMsg(role, text, attachment = null) {
        const div = document.createElement('div');
        div.className = `message ${role}-message`;
        
        let attachHTML = '';
        if (attachment) {
            if (attachment.type.startsWith('image/')) {
                attachHTML = `<img src="${attachment.data}" style="max-height:200px; border-radius:8px; margin-bottom:8px; display:block; border: 1px solid var(--border);">`;
            } else {
                attachHTML = `<div style="background:var(--bg-secondary); padding:8px 12px; border-radius:8px; font-size:0.8rem; display:inline-block; margin-bottom:8px; border: 1px solid var(--border);"><i data-lucide="file" style="width:14px;"></i> ${attachment.name}</div><br>`;
            }
        }

        const isModel = role === 'model';
        const iconHTML = isModel ? `<div class="message-icon"><i data-lucide="sparkles"></i></div>` : '';
        
        const actionBarHTML = `
            <div class="action-bar">
                <button class="action-btn copy-msg-btn" title="Copy Text"><i data-lucide="copy" style="width:16px"></i></button>
                <button class="action-btn listen-msg-btn" title="Listen"><i data-lucide="volume-2" style="width:16px"></i></button>
            </div>
        `;

        div.innerHTML = `
            ${iconHTML}
            <div class="message-content markdown-body" ${isModel ? 'style="width: 100%;"' : ''}>
                ${attachHTML}
                <div class="text-wrapper"></div>
                ${actionBarHTML}
            </div>
        `;
        
        const textWrapper = div.querySelector('.text-wrapper');
        
        // Handle initial text insertion
        if (role === 'user') {
            textWrapper.innerText = text;
        } else {
            if (text.includes('Thinking...')) {
                textWrapper.innerHTML = text; // Just text for typing indicator
            } else {
                textWrapper.innerHTML = DOMPurify.sanitize(marked.parse(text));
                this.addCodeCopy(textWrapper); 
                this.processImages(textWrapper); 
            }
        }

        const copyBtn = div.querySelector('.copy-msg-btn');
        const listenBtn = div.querySelector('.listen-msg-btn');
        
        copyBtn.onclick = () => { 
            navigator.clipboard.writeText(textWrapper.innerText); 
            this.showToast('Text Copied!'); 
        };
        listenBtn.onclick = () => {
            if(this.speech.speaking) { this.speech.cancel(); return; }
            const u = new SpeechSynthesisUtterance(textWrapper.innerText.replace(/[*#`]/g, ''));
            this.speech.speak(u);
        };

        this.wrapper.appendChild(div);
        if(window.lucide) lucide.createIcons();
        this.scrollToBottom();
        
        return { wrapper: div, div: textWrapper };
    }

    saveChat() {
        const title = this.history[0].content ? this.history[0].content.substring(0, 30) : "Media Chat";
        this.storage.saveChat(this.currentChatId, title, this.history);
        this.loadChats();
    }
    
    scrollToBottom() { document.getElementById('chatContainer').scrollTop = document.getElementById('chatContainer').scrollHeight; }
}