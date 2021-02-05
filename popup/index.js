var homePg = document.querySelector('#home.page');
var savePg = document.querySelector('#save.page');
var restorePg = document.querySelector('#restore.page');
var currentPg = homePg;

var restoreList = restorePg.querySelector('#sessions-list');

var closeOnSaveChk = homePg.querySelector('input#close-chk');
var restoreInNewChk = homePg.querySelector('input#new-session');
var delOnRestoreChk = homePg.querySelector('input#del-session');

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

function saveSession() {
    return getCurrentSession()
        .then(function ({ tabs, folderTitle }) {
            return new Promise(function (resolve, reject) {
                getBaseBookmarkFolderId().then(function (parentId) {
                    resolve({ tabs, parentId, folderTitle });
                }).catch(reject);
            });
        })
        .then(createContainerBookmarkFolder)
        .then(saveTabs)
        .then(closeTabs)
        .catch(function (err) {
            console.error('Error: Could not save sesssion.', err);
        });

    function getCurrentSession() {
        var currTabs = [];
        return new Promise(function (resolve, reject) {
            browser.tabs.query({ windowId: browser.windows.WINDOW_ID_CURRENT })
                .then(function (tabs) {
                    var i = 0;
                    var folderTitle = '';
                    for (i = 0; i < tabs.length; i++) {
                        var title = tabs[i].title
                        if (!title) continue;
                        if (tabs[i].active) folderTitle = title;
                        currTabs.push({
                            title,
                            url: tabs[i].url,
                            id: tabs[i].id,
                        });
                    }
                    resolve({ tabs: currTabs, folderTitle });
                }).catch(reject);
        })
    }

    function createContainerBookmarkFolder({ tabs, parentId, folderTitle = '' }) {
        return new Promise(function (resolve, reject) {
            var lbl = savePg.querySelector('input#sesh-lbl').value || folderTitle;
            lbl += ' (' + new Date().toLocaleString() + ')';
            browser.bookmarks.create({
                title: lbl,
                type: 'folder',
                parentId: parentId,
            }).then(function (p) { resolve({ tabs, parentId: p.id }) })
                .catch(reject);
        })
    }

    function saveTabs({ tabs, parentId }) {
        return new Promise(function (resolve, reject) {
            var i = 0, l = tabs.length;
            var promises = [];
            for (i = 0; i < l; i++) {
                promises.push(browser.bookmarks.create({
                    title: tabs[i].title,
                    type: 'bookmark',
                    url: tabs[i].url,
                    parentId: parentId,
                }));
            }
            Promise.all(promises)
                .then(function () { resolve({ tabs }) })
                .catch(reject);
        })
    }

    function closeTabs({ tabs }) {
        return new Promise(function (resolve, reject) {
            populateRestoreList().then(function () {
                changePage(homePg);
                resolve();
                return;
                var i = 0, l = tabs.length;
                var tabIds = [];
                for (; i < l; i++) {
                    tabIds.push(tabs[i].id);
                }
                browser.tabs.remove(tabIds);
            }).catch(reject);
        });
    }
}



function restoreSession(e) {
    return new Promise(function (resolve, reject) {
        var node = e.target;
        var id = node.getAttribute('data-id');
        browser.bookmarks.getChildren(id).then(function (bookmarks) {
            var i = 0, l = bookmarks.length;
            var title = node.getAttribute('data-title');
            var pr = []
            for (; i < l; i++) {
                pr.push(browser.tabs.create({
                    url: bookmarks[i].url,
                    active: bookmarks[i].title === title,
                }));
            }
            Promise.all(pr).then(function () {
                if(delOnRestoreChk.checked){
                    deleteSession(e, id).then(resolve);
                } else {
                    resolve();
                }
            }).catch(reject);
        }).catch(reject);
    });
}


function deleteSession(e, id) {
    return new Promise(function (resolve, reject) {
        e.stopPropagation();
        var node = e.target.parentElement;
        var id = id || node.getAttribute('data-id');
        browser.bookmarks.removeTree(id)
            .then(populateRestoreList)
            .then(function () {
                changePage(homePg);
                resolve();
            }).catch(reject);
    })
}


function populateRestoreList() {
    return new Promise(function (resolve, reject) {
        getBaseBookmarkFolderId().then(function (id) {
            browser.bookmarks.getChildren(id).then(function (bookmarks) {
                while (restoreList.firstElementChild) {
                    restoreList.removeChild(restoreList.lastElementChild);
                }
                var i = 0, l = bookmarks.length;
                for (; i < l; i++) {
                    restoreList.appendChild(getRestoreEl(bookmarks[i]));
                }
                resolve();
            });
        }).catch(reject);
    });

    function getRestoreEl(folder) {
        var node = document.createElement('div');
        node.className = 'restore-item';
        node.setAttribute('data-id', folder.id);
        node.setAttribute('data-title', folder.title);
        var txt = document.createElement('span');
        txt.textContent = folder.title;
        var btn = document.createElement('button');
        btn.className = 'mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--icon';
        btn.id = 'del-restore';
        var icon = document.createElement('i');
        icon.className = 'material-icons';
        icon.textContent = 'delete';
        btn.appendChild(icon);
        btn.addEventListener('click', deleteSession);
        node.appendChild(txt);
        node.appendChild(btn);
        node.addEventListener('click', restoreSession);
        return node;
    }
}




function getBaseBookmarkFolderId() {
    var id = 0x28912 << 0x21 // Should be unique per user
    var folder = 'session-hold#' + id;

    return new Promise(function (resolve, reject) {
        browser.bookmarks.search(folder).then(function (bookmarks) {
            if (!bookmarks[0]) {
                browser.bookmarks.create({
                    title: folder,
                    type: 'folder',
                }).then(function (p) { resolve(p.id) });
            } else {
                browser.bookmarks.get(bookmarks[0].id)
                    .then(function (bookmarks) {
                        resolve(bookmarks[0].id);
                    }).catch(reject);
            }
        }).catch(reject);
    })
}

