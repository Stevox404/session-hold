var homePg = document.querySelector('#home.page');
var savePg = document.querySelector('#save.page');
var restorePg = document.querySelector('#restore.page');
var currentPg = homePg;

var restoreList = restorePg.querySelector('#sessions-list');

var closeOnSaveChk = savePg.querySelector('input#close-chk');
var restoreInNewChk = restorePg.querySelector('input#new-session');
var delOnRestoreChk = restorePg.querySelector('input#del-session');

populateRestoreList().then(function () {
}).catch(console.error);
homePg.querySelector('#save-btn').addEventListener('click', function () {
    changePage(savePg);
});
homePg.querySelector('#restore-btn').addEventListener('click', function () {
    changePage(restorePg);
});
document.querySelectorAll('#back-btn').forEach(function (el) {
    el.addEventListener('click', function () {
        changePage(homePg);
    });
});
savePg.querySelector('#do-save-btn').addEventListener('click', function () {
    saveSession();
});


function changePage(newEl) {
    currentPg.style.display = 'none';
    newEl.style.display = 'flex';
    currentPg = newEl;
}

async function saveSession() {
    try {
        const { tabs, folderTitle } = await getCurrentSession();
        let parentId = await getBaseBookmarkFolderId();
        parentId = await createContainerBookmarkFolder({ parentId, folderTitle });
        await saveTabs({ tabs, parentId });
        if (closeOnSaveChk.checked) {
            await closeTabs({ tabs });
        }
        changePage(homePg);
    } catch (err) {
        console.error('Error: Could not save sesssion.', err);
    }


    async function getCurrentSession() {
        const currTabs = [];
        let tabs = await browser.tabs.query({ windowId: browser.windows.WINDOW_ID_CURRENT })
        let folderTitle = '';
        for (let i = 0, l = tabs.length; i < l; i++) {
            const title = tabs[i].title
            if (!title) continue;
            if (tabs[i].active) folderTitle = title;
            currTabs.push({
                title,
                url: tabs[i].url,
                id: tabs[i].id,
            });
        }
        return ({ tabs: currTabs, folderTitle });
    }

    async function createContainerBookmarkFolder({ parentId, folderTitle = '' }) {
        let lbl = savePg.querySelector('input#sesh-lbl').value || folderTitle;
        lbl += ' (' + new Date().toLocaleString() + ')';
        const { id } = await browser.bookmarks.create({
            title: lbl,
            type: 'folder',
            parentId: parentId,
        });
        return id;
    }

    async function saveTabs({ tabs, parentId }) {
        const promises = [];
        for (let i = 0, l = tabs.length; i < l; i++) {
            promises.push(browser.bookmarks.create({
                title: tabs[i].title,
                type: 'bookmark',
                url: tabs[i].url,
                parentId: parentId,
            }));
        }
        await Promise.all(promises);
    }

    async function closeTabs({ tabs }) {
        await populateRestoreList()
        const tabIds = [];
        for (let i = 0, l = tabs.length; i < l; i++) {
            tabIds.push(tabs[i].id);
        }
        await browser.tabs.create({})
        await browser.tabs.remove(tabIds)
    }
}



async function restoreSession(e) {
    try {
        const node = e.target;
        const id = node.getAttribute('data-id');
        const bookmarks = await browser.bookmarks.getChildren(id)
        const title = node.getAttribute('data-title');
        const promises = [];
        let win;
        if (restoreInNewChk.checked) {
            win = await browser.windows.create({
                state: 'maximized',
            });
        }
        for (let i = 0, l = bookmarks.length; i < l; i++) {
            const tabOpts = {
                url: bookmarks[i].url,
                active: bookmarks[i].title === title,
            }
            if (win) tabOpts.windowId = win.id
            promises.push(browser.tabs.create(tabOpts).catch(console.error));
        }
        await Promise.all(promises);
    
        if (delOnRestoreChk.checked) {
            await deleteSession(e, id)
        }
    } catch (err) {
        console.error('Error: Could not restore session. ', err);
    }
}


async function deleteSession(e, id) {
    e.stopPropagation();
    const node = e.target.parentElement;
    id = id || node.getAttribute('data-id');
    await browser.bookmarks.removeTree(id);
    await populateRestoreList()
    changePage(homePg);
}


async function populateRestoreList() {
    const id = await getBaseBookmarkFolderId();
    const bookmarks = await browser.bookmarks.getChildren(id);
    while (restoreList.firstElementChild) {
        restoreList.removeChild(restoreList.lastElementChild);
    }
    for (let i = 0, l = bookmarks.length; i < l; i++) {
        restoreList.appendChild(getRestoreEl(bookmarks[i]));
    }

    function getRestoreEl(folder) {
        const node = document.createElement('div');
        node.className = 'restore-item';
        node.setAttribute('data-id', folder.id);
        node.setAttribute('data-title', folder.title);
        const txt = document.createElement('span');
        txt.textContent = folder.title;
        const btn = document.createElement('button');
        btn.className = 'mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--icon';
        btn.id = 'del-restore';
        const icon = document.createElement('i');
        icon.className = 'material-icons';
        icon.textContent = 'delete';
        btn.appendChild(icon);
        btn.addEventListener('click', deleteSession);
        node.appendChild(txt);
        node.appendChild(btn);
        node.addEventListener('click', async function (e) {
            await restoreSession(e)
            changePage(homePg);                
        });
        return node;
    }
}





async function getBaseBookmarkFolderId() {
    var unique = 0x28912 << 0x21 // Should be unique per user
    var folder = 'session-hold#' + unique;

    const bookmarks = await browser.bookmarks.search(folder);
    if (bookmarks[0]) return bookmarks[0].id;

    const { id } = await browser.bookmarks.create({
        title: folder,
        type: 'folder',
    });
    return id;
}
