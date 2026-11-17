'use strict';
// Images are stored as blobs, not oversized localStorage strings. Transactions
// resolve only after commit so disk-full failures are reported without data loss.
window.EbruGallery = (() => {
    let opening;
    function open() {
        if (opening) return opening;
        opening = new Promise((resolve, reject) => {
            const request = indexedDB.open('ebrusim-artworks', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('artworks', { keyPath: 'id' });
            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => { db.close(); opening = null; };
                resolve(db);
            };
            request.onerror = () => { opening = null; reject(request.error); };
            request.onblocked = () => { opening = null; reject(new Error('Gallery database is busy')); };
        });
        return opening;
    }
    async function transaction(mode, operation) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('artworks', mode);
            let request;
            try { request = operation(tx.objectStore('artworks')); }
            catch (error) { reject(error); return; }
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = tx.onabort = () => reject(tx.error || new Error('Gallery write failed'));
        });
    }
    return {
        async save(blob) {
            const item = { id: crypto.randomUUID(), createdAt: Date.now(), blob };
            await transaction('readwrite', store => store.add(item));
            return item;
        },
        async list() {
            const items = await transaction('readonly', store => store.getAll());
            return items.sort((a, b) => b.createdAt - a.createdAt);
        },
        remove(id) { return transaction('readwrite', store => store.delete(id)); }
    };
})();
