import { AppManager } from './js/chat.js';

document.addEventListener('DOMContentLoaded', () => {
    window.nova = new AppManager();

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('PWA Ready'))
            .catch(err => console.error('PWA Error', err));
    }

    // Network Online/Offline Detection
    const banner = document.getElementById('offlineBanner');
    window.addEventListener('offline', () => banner.style.display = 'flex');
    window.addEventListener('online', () => banner.style.display = 'none');
    if (!navigator.onLine) banner.style.display = 'flex';
});