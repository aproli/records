class TimerDatabase {
    constructor() {
        this.db = null;
        this.currentPage = 1;
        this.recordsPerPage = 10;
        this.totalPages = 0;
        this.init();
    }

    init() {
        const request = indexedDB.open('TimerDB', 1);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.loadRecords();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('records')) {
                const objectStore = db.createObjectStore('records', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                objectStore.createIndex('time', 'time', { unique: false });
            }
        };
    }

    async addRecord(time) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readwrite');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.add({ time });

            request.onsuccess = () => {
                this.loadRecords();
                resolve();
            };

            request.onerror = () => {
                reject('Error adding record: ' + request.error);
            };
        });
    }

    async getAllRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readonly');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject('Error getting records: ' + request.error);
            };
        });
    }

    async updateRecord(id, time) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readwrite');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.put({ id, time });

            request.onsuccess = () => {
                this.loadRecords();
                resolve();
            };

            request.onerror = () => {
                reject('Error updating record: ' + request.error);
            };
        });
    }

    async deleteRecordFromDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readwrite');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                this.loadRecords();
                resolve();
            };

            request.onerror = () => {
                reject('Error deleting record: ' + request.error);
            };
        });
    }

    async loadRecords() {
        const records = await this.getAllRecords();
        this.displayRecords(records);
        this.updateStats(records);
        this.updatePagination(records.length);
    }

    displayRecords(records) {
        this.records = records; // Store records for editing
        const recordsList = document.getElementById('recordsList');
        recordsList.innerHTML = '';

        // 按时间降序排序（最新的在前）
        const sortedRecords = records.sort((a, b) => b.time - a.time);

        // 计算当前页的起始和结束索引
        const start = (this.currentPage - 1) * this.recordsPerPage;
        const end = start + this.recordsPerPage;

        // 显示当前页的记录
        sortedRecords.slice(start, end).forEach((record, index) => {
            const recordItem = document.createElement('div');
            recordItem.className = 'record-item';
            recordItem.innerHTML = `
                <div class="record-display">
                    <span>${record.time.toLocaleDateString()} ${record.time.toLocaleTimeString()}</span>
                    <button onclick="timerDatabase.editRecord(${record.id})">编辑</button>
                    <button onclick="timerDatabase.showDeleteConfirmation(${record.id})">删除</button>
                </div>
            `;
            recordsList.appendChild(recordItem);
        });
    }

    updateStats(records) {
        const totalRecords = document.getElementById('totalRecords');
        const earliestRecord = document.getElementById('earliestRecord');
        const latestRecord = document.getElementById('latestRecord');

        totalRecords.textContent = records.length;
        if (records.length > 0) {
            earliestRecord.textContent = `${records[0].time.toLocaleDateString()} ${records[0].time.toLocaleTimeString()}`;
            latestRecord.textContent = `${records[records.length - 1].time.toLocaleDateString()} ${records[records.length - 1].time.toLocaleTimeString()}`;
        } else {
            earliestRecord.textContent = '无';
            latestRecord.textContent = '无';
        }
    }

    async exportRecords() {
        const records = await this.getAllRecords();
        const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timer_records_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    showEditModal(recordId) {
        const modal = document.getElementById('editModal');
        modal.style.display = 'block';
        this.currentEditId = recordId;

        const record = this.records.find(r => r.id === recordId);
        if (record) {
            document.getElementById('editDate').value = record.time.toISOString().split('T')[0];
            document.getElementById('editTime').value = record.time.toISOString().split('T')[1].slice(0, 8);
        }
    }

    hideEditModal() {
        const modal = document.getElementById('editModal');
        modal.style.display = 'none';
        this.currentEditId = null;
    }

    async saveEdit() {
        const date = document.getElementById('editDate').value;
        const time = document.getElementById('editTime').value;
        const newTime = new Date(date + 'T' + time);

        await this.updateRecord(this.currentEditId, newTime);
        this.hideEditModal();
    }

    async editRecord(recordId) {
        this.showEditModal(recordId);
    }

    showDeleteConfirmation(recordId) {
        if (confirm('确定要删除这条记录吗？')) {
            this.deleteRecord(recordId);
        }
    }

    async deleteRecord(recordId) {
        await this.deleteRecordFromDB(recordId);
    }

    updatePagination(totalRecords) {
        this.totalPages = Math.ceil(totalRecords / this.recordsPerPage);
        const pagination = document.getElementById('pagination');
        
        // 清除现有分页按钮
        pagination.innerHTML = '';
        
        // 添加上一页按钮
        const prevButton = document.createElement('button');
        prevButton.textContent = '上一页';
        prevButton.disabled = this.currentPage === 1;
        prevButton.onclick = () => this.changePage(this.currentPage - 1);
        pagination.appendChild(prevButton);
        
        // 添加数字分页按钮
        for (let i = 1; i <= this.totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = i === this.currentPage ? 'active' : '';
            pageButton.onclick = () => this.changePage(i);
            pagination.appendChild(pageButton);
        }
        
        // 添加下一页按钮
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一页';
        nextButton.disabled = this.currentPage === this.totalPages;
        nextButton.onclick = () => this.changePage(this.currentPage + 1);
        pagination.appendChild(nextButton);
    }

    changePage(pageNumber) {
        if (pageNumber >= 1 && pageNumber <= this.totalPages) {
            this.currentPage = pageNumber;
            this.loadRecords();
        }
    }
}

// Initialize the database
const timerDatabase = new TimerDatabase();

// Add event listeners
document.getElementById('addRecord').addEventListener('click', () => {
    timerDatabase.addRecord(new Date());
});

document.getElementById('exportRecords').addEventListener('click', () => {
    timerDatabase.exportRecords();
});

document.getElementById('saveEdit').addEventListener('click', () => {
    timerDatabase.saveEdit();
});

document.getElementById('cancelEdit').addEventListener('click', () => {
    timerDatabase.hideEditModal();
});

document.querySelector('.close').addEventListener('click', () => {
    timerDatabase.hideEditModal();
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        timerDatabase.hideEditModal();
    }
});
