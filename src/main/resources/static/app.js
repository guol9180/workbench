/* 工作台 · 在线文档系统 前端逻辑 */
(function () {
    'use strict';

    const state = {
        path: null,          // 当前打开文档的相对路径
        dirty: false,
        savedContent: '',    // 最近一次保存/打开时的内容，用于内容比对判断脏状态
        vditor: null,
        vditorReady: false,
        expanded: new Set(), // 展开的目录路径
        localFile: null,     // 当前预览的本地文件 {name, content}
        authed: false,
    };

    const $ = (id) => document.getElementById(id);

    /* ---------------- 通用 ---------------- */

    let toastTimer = null;
    function toast(msg, isError) {
        const el = $('toast');
        el.textContent = msg;
        el.classList.toggle('error', !!isError);
        el.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
    }

    async function api(url, options) {
        options = options || {};
        options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers);
        const res = await fetch(url, options);
        if (res.status === 401) {
            showLogin();
            throw new Error('未登录');
        }
        const body = await res.json();
        if (!body.success) {
            throw new Error(body.message || '操作失败');
        }
        return body.data;
    }

    function extAllowed(name) {
        return /\.(md|markdown|txt)$/i.test(name);
    }

    /* ---------------- 通用对话框 ---------------- */

    /**
     * 显示对话框。opts: {title, message, input, value, placeholder, confirmText, danger}
     * input=true 时返回输入值（取消返回 null），否则返回 true/false。
     */
    function showDialog(opts) {
        return new Promise((resolve) => {
            const dlg = $('dialog');
            $('dialog-title').textContent = opts.title || '';
            const msg = $('dialog-message');
            const input = $('dialog-input');
            const ok = $('dialog-ok');

            if (opts.message) {
                msg.textContent = opts.message;
                msg.classList.remove('hidden');
            } else {
                msg.classList.add('hidden');
            }
            if (opts.input) {
                input.classList.remove('hidden');
                input.value = opts.value || '';
                input.placeholder = opts.placeholder || '';
            } else {
                input.classList.add('hidden');
            }
            ok.textContent = opts.confirmText || '确定';
            ok.classList.toggle('danger', !!opts.danger);

            function done(val) {
                dlg.classList.add('hidden');
                input.onkeydown = null;
                document.removeEventListener('keydown', onKey);
                ok.removeEventListener('click', onOk);
                $('dialog-cancel').removeEventListener('click', onCancel);
                resolve(val);
            }
            function onOk() {
                if (opts.input && !input.value.trim()) {
                    toast('名称不能为空', true);
                    return;
                }
                done(opts.input ? input.value.trim() : true);
            }
            function onCancel() { done(null); }
            function onKey(e) {
                if (e.key === 'Escape') done(null);
                if (e.key === 'Enter' && !opts.input) { e.preventDefault(); onOk(); }
            }

            ok.addEventListener('click', onOk);
            $('dialog-cancel').addEventListener('click', onCancel);
            document.addEventListener('keydown', onKey);
            input.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); onOk(); }
            };

            dlg.classList.remove('hidden');
            if (opts.input) {
                input.focus();
                const dot = input.value.lastIndexOf('.');
                input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
            }
        });
    }

    async function showConfirm(opts) {
        return !!(await showDialog({
            title: opts.title,
            message: opts.message,
            confirmText: opts.confirmText || '确定',
            danger: opts.danger,
        }));
    }

    function parentOf(path) {
        const i = path.lastIndexOf('/');
        return i < 0 ? '' : path.substring(0, i);
    }

    function baseName(path) {
        const i = path.lastIndexOf('/');
        return i < 0 ? path : path.substring(i + 1);
    }

    /* ---------------- 登录 ---------------- */

    function showLogin() {
        state.authed = false;
        $('app-view').classList.add('hidden');
        $('login-view').classList.remove('hidden');
        $('login-error').textContent = '';
        $('login-password').value = '';
        setTimeout(() => $('login-password').focus(), 50);
    }

    async function checkStatus() {
        try {
            const data = await api('/api/status');
            if (data && data.authed) {
                enterApp();
            } else {
                showLogin();
            }
        } catch (e) {
            showLogin();
        }
    }

    async function doLogin(e) {
        e.preventDefault();
        const password = $('login-password').value;
        if (!password) return;
        $('login-btn').disabled = true;
        try {
            await api('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
            enterApp();
        } catch (err) {
            $('login-error').textContent = err.message;
        } finally {
            $('login-btn').disabled = false;
        }
    }

    function enterApp() {
        state.authed = true;
        $('login-view').classList.add('hidden');
        $('app-view').classList.remove('hidden');
        initVditor();
        loadTree();
    }

    async function doLogout() {
        try { await api('/api/logout', { method: 'POST' }); } catch (e) { /* 忽略 */ }
        location.reload();
    }

    /* ---------------- 编辑器 ---------------- */

    function initVditor() {
        if (state.vditor) return;
        state.vditor = new Vditor('editor', {
            cdn: 'vendor/vditor',
            lang: 'zh_CN',
            mode: 'ir',
            height: '100%',
            cache: { enable: false },
            placeholder: '选择左侧文档开始编辑，或点击「今日工作」新建日志…',
            preview: { hljs: { lineNumber: false, style: 'github' } },
            toolbar: [
                'headings', 'bold', 'italic', 'strike', '|',
                'list', 'ordered-list', 'check', 'quote', 'code', 'inline-code', 'link', 'table', '|',
                'undo', 'redo', '|', 'edit-mode', 'preview', 'outline', 'fullscreen',
            ],
            toolbarConfig: { pin: true },
            input: () => {
                if (suppressDirty) return;
                clearTimeout(dirtyTimer);
                dirtyTimer = setTimeout(refreshDirty, 250);
            },
            after: () => {
                state.vditorReady = true;
            },
        });
    }

    let suppressDirty = false;
    let dirtyTimer = null;

    function setEditorValue(text) {
        suppressDirty = true;
        try {
            state.vditor.setValue(text == null ? '' : text);
        } finally {
            suppressDirty = false;
        }
        state.savedContent = text == null ? '' : text;
        state.dirty = false;
        updateTitle();
    }

    function refreshDirty() {
        state.dirty = state.vditor.getValue() !== state.savedContent;
        updateTitle();
    }

    function updateTitle() {
        const el = $('doc-title');
        el.textContent = state.path ? state.path + (state.dirty ? '' : '') : '未打开文档';
        el.classList.toggle('dirty', state.dirty);
    }

    /* ---------------- 文件树 ---------------- */

    function loadExpanded() {
        try {
            const arr = JSON.parse(localStorage.getItem('wb-expanded') || '[]');
            state.expanded = new Set(arr);
        } catch (e) {
            state.expanded = new Set();
        }
    }

    function saveExpanded() {
        localStorage.setItem('wb-expanded', JSON.stringify([...state.expanded]));
    }

    async function loadTree() {
        try {
            const root = await api('/api/tree');
            renderTree(root);
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    function renderTree(root) {
        const container = $('tree-container');
        container.textContent = '';
        if (!root.children || root.children.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'tree-empty';
            empty.textContent = '文档库为空，点击「新文档」开始';
            container.appendChild(empty);
            return;
        }
        const ul = document.createElement('div');
        root.children.forEach((node) => ul.appendChild(buildTreeNode(node, 0)));
        container.appendChild(ul);
    }

    function buildTreeNode(node, depth) {
        const wrap = document.createElement('div');
        wrap.className = 'tree-item';

        const row = document.createElement('div');
        row.className = 'tree-row' + (node.path === state.path ? ' active' : '');
        row.title = node.path;

        const isDir = node.type === 'dir';
        const expanded = state.expanded.has(node.path);

        // 展开箭头（仅目录）
        const caret = document.createElement('span');
        caret.className = 'tree-caret' + (isDir && expanded ? ' open' : '');
        caret.textContent = isDir ? '▶' : '';
        row.appendChild(caret);

        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        icon.textContent = isDir ? (expanded ? '📂' : '📁') : '📄';
        row.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'tree-name';
        name.textContent = node.name;
        row.appendChild(name);

        // 行内操作
        const ops = document.createElement('span');
        ops.className = 'tree-ops';
        if (isDir) {
            ops.appendChild(opBtn('📄+', '在此新建文档', (e) => { e.stopPropagation(); newFile(node.path); }));
            ops.appendChild(opBtn('📁+', '在此新建文件夹', (e) => { e.stopPropagation(); newDir(node.path); }));
        }
        ops.appendChild(opBtn('✏️', '重命名', (e) => { e.stopPropagation(); renameNode(node); }));
        ops.appendChild(opBtn('🗑', '删除', (e) => { e.stopPropagation(); deleteNode(node); }, true));
        row.appendChild(ops);

        row.addEventListener('click', () => {
            if (isDir) {
                toggleDir(node);
            } else {
                openDoc(node.path);
            }
        });

        wrap.appendChild(row);

        if (isDir) {
            const children = document.createElement('div');
            children.className = 'tree-children';
            if (expanded && node.children) {
                node.children.forEach((c) => children.appendChild(buildTreeNode(c, depth + 1)));
            }
            wrap.appendChild(children);
        }
        return wrap;
    }

    function opBtn(label, title, onClick, danger) {
        const b = document.createElement('button');
        b.className = 'tree-op' + (danger ? ' danger' : '');
        b.textContent = label;
        b.title = title;
        b.addEventListener('click', onClick);
        return b;
    }

    function toggleDir(node) {
        if (state.expanded.has(node.path)) {
            state.expanded.delete(node.path);
        } else {
            state.expanded.add(node.path);
        }
        saveExpanded();
        loadTree();
    }

    function refreshTree() {
        loadTree();
    }

    /* ---------------- 文档操作 ---------------- */

    async function openDoc(path) {
        try {
            const doc = await api('/api/doc?path=' + encodeURIComponent(path));
            state.path = doc.path;
            setEditorValue(doc.content);
            hideLocalPreview();
            highlightActive();
            closeSidebarOnMobile();
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    function highlightActive() {
        document.querySelectorAll('.tree-row.active').forEach((el) => el.classList.remove('active'));
        document.querySelectorAll('.tree-row').forEach((el) => {
            if (el.title === state.path) el.classList.add('active');
        });
    }

    function currentContent() {
        return state.vditor ? state.vditor.getValue() : '';
    }

    async function saveDoc() {
        if (!state.vditorReady) return;
        try {
            const content = currentContent();
            if (!state.path) {
                const name = await showDialog({
                    title: '保存文档',
                    input: true,
                    value: suggestNewName(),
                    placeholder: '可含子目录，如：笔记/idea.md',
                    confirmText: '保存',
                });
                if (!name) return;
                const fixed = /\.(md|markdown|txt)$/i.test(name) ? name : name + '.md';
                await api('/api/doc', {
                    method: 'POST',
                    body: JSON.stringify({ path: fixed, content }),
                });
                state.path = fixed;
            } else {
                await api('/api/doc', {
                    method: 'PUT',
                    body: JSON.stringify({ path: state.path, content }),
                });
            }
            state.savedContent = content;
            state.dirty = false;
            updateTitle();
            refreshTree();
            toast('已保存');
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    function suggestNewName() {
        const dir = state.path ? parentOf(state.path) : '';
        return dir ? dir + '/未命名.md' : '未命名.md';
    }

    async function newFile(dirPath) {
        const base = await showDialog({
            title: dirPath ? '在「' + dirPath + '」中新建文档' : '新建文档',
            input: true,
            value: '未命名.md',
            placeholder: '文档名，可含子目录',
            confirmText: '创建',
        });
        if (!base) return;
        const fixed = /\.(md|markdown|txt)$/i.test(base) ? base : base + '.md';
        const path = dirPath ? dirPath.replace(/\/$/, '') + '/' + fixed : fixed;
        try {
            await api('/api/doc', { method: 'POST', body: JSON.stringify({ path, content: '# ' + baseName(fixed).replace(/\.(md|markdown|txt)$/i, '') + '\n\n' }) });
            if (dirPath) { state.expanded.add(dirPath); saveExpanded(); }
            refreshTree();
            openDoc(path);
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    async function newDir(dirPath) {
        const base = await showDialog({
            title: dirPath ? '在「' + dirPath + '」中新建文件夹' : '新建文件夹',
            input: true,
            value: '新建文件夹',
            placeholder: '文件夹名称',
            confirmText: '创建',
        });
        if (!base) return;
        const path = dirPath ? dirPath.replace(/\/$/, '') + '/' + base : base;
        try {
            await api('/api/dir', { method: 'POST', body: JSON.stringify({ path }) });
            if (dirPath) { state.expanded.add(dirPath); saveExpanded(); }
            state.expanded.add(path);
            saveExpanded();
            refreshTree();
            toast('文件夹已创建');
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    async function renameNode(node) {
        const newName = await showDialog({
            title: '重命名「' + node.name + '」',
            input: true,
            value: node.name,
            placeholder: '新名称',
            confirmText: '重命名',
        });
        if (!newName || newName === node.name) return;
        const to = parentOf(node.path) ? parentOf(node.path) + '/' + newName : newName;
        try {
            await api('/api/rename', { method: 'POST', body: JSON.stringify({ from: node.path, to }) });
            if (state.path === node.path) {
                state.path = to;
                updateTitle();
            }
            refreshTree();
            toast('已重命名');
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    async function deleteNode(node) {
        const isDir = node.type === 'dir';
        const msg = isDir
            ? '确定删除文件夹「' + node.path + '」及其全部内容？'
            : '确定删除「' + node.path + '」？';
        if (!await showConfirm({ title: '删除确认', message: msg, confirmText: '删除', danger: true })) return;
        try {
            await api('/api/resource?path=' + encodeURIComponent(node.path), { method: 'DELETE' });
            if (state.path === node.path || (isDir && state.path && state.path.startsWith(node.path + '/'))) {
                state.path = null;
                setEditorValue('');
                updateTitle();
            }
            refreshTree();
            toast('已删除');
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    /* ---------------- 今日工作 ---------------- */

    async function openToday() {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const month = now.getFullYear() + '-' + mm;
        const day = mm + '-' + dd;
        const path = '日志/' + month + '/' + now.getFullYear() + '-' + day + '.md';
        try {
            await api('/api/doc?path=' + encodeURIComponent(path));
            openDoc(path);
        } catch (e) {
            if (e.message === '未登录') return;
            // 不存在则创建
            const template = '# ' + now.getFullYear() + '-' + day + ' 工作日志\n\n'
                + '## 今日工作\n\n- \n\n## 问题与备注\n\n- \n';
            try {
                await api('/api/doc', { method: 'POST', body: JSON.stringify({ path, content: template }) });
                state.expanded.add('日志');
                state.expanded.add('日志/' + month);
                saveExpanded();
                refreshTree();
                openDoc(path);
            } catch (err) {
                if (err.message !== '未登录') toast(err.message, true);
            }
        }
    }

    /* ---------------- 搜索 ---------------- */

    async function doSearch() {
        const q = $('search-input').value.trim();
        if (!q) return;
        try {
            const hits = await api('/api/search?q=' + encodeURIComponent(q));
            $('tree-panel').classList.add('hidden');
            $('search-results').classList.remove('hidden');
            $('search-summary').textContent = '找到 ' + hits.length + ' 条结果';
            const list = $('search-list');
            list.textContent = '';
            if (hits.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'tree-empty';
                empty.textContent = '没有匹配的文档';
                list.appendChild(empty);
                return;
            }
            hits.forEach((hit) => {
                const item = document.createElement('div');
                item.className = 'search-hit';
                const p = document.createElement('div');
                p.className = 'search-hit-path';
                p.textContent = hit.path;
                const s = document.createElement('div');
                s.className = 'search-hit-snippet';
                s.textContent = hit.snippet || '';
                item.appendChild(p);
                item.appendChild(s);
                item.addEventListener('click', () => {
                    backToTree();
                    openDoc(hit.path);
                });
                list.appendChild(item);
            });
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    function backToTree() {
        $('search-results').classList.add('hidden');
        $('tree-panel').classList.remove('hidden');
    }

    /* ---------------- 本地文件预览 ---------------- */

    function openLocalFile(file) {
        if (!file) return;
        if (!extAllowed(file.name)) {
            toast('仅支持 .md / .markdown / .txt 文件', true);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            state.localFile = { name: file.name, content: String(reader.result || '') };
            $('lp-title').textContent = file.name;
            $('local-preview').classList.remove('hidden');
            const contentEl = $('lp-content');
            contentEl.textContent = '';
            Vditor.preview(contentEl, state.localFile.content, {
                cdn: 'vendor/vditor',
                lang: 'zh_CN',
                hljs: { lineNumber: false, style: 'github' },
            });
        };
        reader.onerror = () => toast('文件读取失败', true);
        reader.readAsText(file, 'utf-8');
    }

    function hideLocalPreview() {
        state.localFile = null;
        $('local-preview').classList.add('hidden');
    }

    async function importLocalFile() {
        if (!state.localFile) return;
        const target = await showDialog({
            title: '导入到文档库',
            message: '将「' + state.localFile.name + '」保存到：',
            input: true,
            value: '导入/' + state.localFile.name,
            placeholder: '保存路径',
            confirmText: '导入',
        });
        if (!target) return;
        try {
            await api('/api/doc', {
                method: 'POST',
                body: JSON.stringify({ path: target, content: state.localFile.content }),
            });
            state.expanded.add(parentOf(target));
            saveExpanded();
            refreshTree();
            toast('已导入：' + target);
            hideLocalPreview();
            openDoc(target);
        } catch (e) {
            if (e.message !== '未登录') toast(e.message, true);
        }
    }

    /* ---------------- 移动端侧边栏 ---------------- */

    function closeSidebarOnMobile() {
        document.body.classList.remove('sidebar-open');
    }

    /* ---------------- 事件绑定 ---------------- */

    function bindEvents() {
        $('login-form').addEventListener('submit', doLogin);
        $('btn-logout').addEventListener('click', doLogout);
        $('btn-save').addEventListener('click', saveDoc);
        $('btn-today').addEventListener('click', openToday);
        $('btn-new-file').addEventListener('click', () => newFile(''));
        $('btn-new-dir').addEventListener('click', () => newDir(''));
        $('btn-refresh').addEventListener('click', refreshTree);
        $('btn-search').addEventListener('click', doSearch);
        $('search-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });
        $('btn-back-tree').addEventListener('click', backToTree);

        $('btn-menu').addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
        $('sidebar-backdrop').addEventListener('click', closeSidebarOnMobile);

        $('btn-open-local').addEventListener('click', () => $('local-file-input').click());
        $('local-file-input').addEventListener('change', (e) => {
            openLocalFile(e.target.files[0]);
            e.target.value = '';
        });
        $('btn-lp-close').addEventListener('click', hideLocalPreview);
        $('btn-lp-import').addEventListener('click', importLocalFile);

        // 拖拽本地 md 文件到页面
        let dragDepth = 0;
        window.addEventListener('dragenter', (e) => {
            if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
                dragDepth++;
                $('drop-overlay').classList.remove('hidden');
            }
        });
        window.addEventListener('dragleave', () => {
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) $('drop-overlay').classList.add('hidden');
        });
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            $('drop-overlay').classList.add('hidden');
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                openLocalFile(e.dataTransfer.files[0]);
            }
        });

        // Ctrl+S 保存
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (state.authed) saveDoc();
            }
            if (e.key === 'Escape' && state.localFile) {
                hideLocalPreview();
            }
        });

        window.addEventListener('beforeunload', (e) => {
            if (state.dirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    /* ---------------- 启动 ---------------- */

    loadExpanded();
    bindEvents();
    checkStatus();
})();
