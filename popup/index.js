document.getElementById('show-btn').onclick = function () {
    changeVisibility('show');
}

document.getElementById('hide-btn').onclick = function () {
    changeVisibility('hide');
}


function changeVisibility(msg) {
    sendMessage({command: msg}, { active: true, currentWindow: true, });
}

function sendMessage(msg, params) {
    browser.tabs.query(params)
        .then(tabs => {
            tabs.forEach(tab => {
                browser.tabs.sendMessage(tab.id, msg);
            })
        })
        .catch(reportExecuteScriptError);
}

function reportExecuteScriptError() {
    console.error("Error loading script");
}