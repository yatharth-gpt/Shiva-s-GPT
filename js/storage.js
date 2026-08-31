export class StorageManager {
    constructor() {
        this.storageKey = 'nova_chats';
    }

    getAllChats() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    saveChat(id, title, messages) {
        let chats = this.getAllChats();
        const existingIndex = chats.findIndex(c => c.id === id);
        let isPinned = false;
        
        if (existingIndex > -1) {
            isPinned = chats[existingIndex].pinned || false; // पुरानी पिन स्टेटस बचाए रखें
            chats[existingIndex] = { id, title: title || "New Conversation", messages, updatedAt: Date.now(), pinned: isPinned };
        } else {
            chats.unshift({ id, title: title || "New Conversation", messages, updatedAt: Date.now(), pinned: false });
        }
        localStorage.setItem(this.storageKey, JSON.stringify(chats));
    }

    getChat(id) {
        return this.getAllChats().find(c => c.id === id);
    }

    deleteChat(id) {
        let chats = this.getAllChats().filter(c => c.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(chats));
    }

    // NEW: Pin/Unpin Toggle Logic
    togglePin(id) {
        let chats = this.getAllChats();
        const index = chats.findIndex(c => c.id === id);
        if (index > -1) {
            chats[index].pinned = !chats[index].pinned;
            localStorage.setItem(this.storageKey, JSON.stringify(chats));
        }
    }

    clearAll() {
        localStorage.removeItem(this.storageKey);
    }
}
