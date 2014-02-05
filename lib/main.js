exports.main = function () {
    const { filePicker, createTorrent, isDirectory, getPrototype } = require('./creator');
    const { Item: ContextMenu, SelectorContext } = require('sdk/context-menu');
    const { setTimeout } = require('sdk/timers');
    const { setMenuAction } = require('./menu');
    const { Hotkey } = require('sdk/hotkeys');
    const { Sidebar } = require('sdk/ui/sidebar');
    const { data } = require('sdk/self');
    const { Panel } = require('sdk/panel');
    const { Widget } = require('sdk/widget');
    const { prefs } = require('./utils');
    
    const { Cc, Ci } = require('chrome'); // Currently only for nsIPromptService

    const promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                              getService(Ci.nsIPromptService);

    ContextMenu({
        label: 'Create Torrent',
        context: SelectorContext('a'),
        contentScript: 'self.on(\'click\', anchor => self.postMessage(anchor.href));',
        onMessage: function (url) {
            let torrent = createTorrent({
                source: url,
                prototype: getPrototype(),
                onprogress: (status, statusArg, progress, progressMax) =>
                    download.port.emit('progress', torrent.id, status, statusArg, progress, progressMax),
                onload: (torrent) => {
                    torrent.finish();
                    let file = torrent.saveToDisk();
                    console.log('\n\nSaved torrent: "' + file.path + '"\n');
                },
                onerror: (error) => console.exception(error)
            });
            download.port.emit('create', torrent.id, torrent.title);
        }
    });

    // Download panel.
    const download = Panel({
      width: 450,
      height: 190,
      contentURL: data.url("download.html"),
      contentScriptFile: data.url("download.js")
    });

    const giveMethods = (worker) => {
        let methods = {
            'select-source': modeOpenFolder =>
                    filePicker('Select Source', modeOpenFolder).then(picker =>
                    worker.port.emit('source', picker.fileURL.spec)),
            'get-type': url =>
                    worker.port.emit('type', isDirectory(url)),
            'get-prototype': () =>
                worker.port.emit('prototype', getPrototype()),
            'set-prototype': prototype => {
                if (prototype)
                    prefs.set('prototype', JSON.stringify(prototype));
            },
            'create': (url, prototype, path, name) => {
                    let torrent = createTorrent({
                        title: name.replace(/$\.torrent/i, ''),
                        source: url,
                        prototype: prototype,
                        onprogress: (status, statusArg, progress, progressMax) =>
                            download.port.emit('progress', torrent.id, status, statusArg, progress, progressMax),
                        onload: torrent => {
                            torrent.finish();
                            let file = torrent.saveToDisk(path);
                            console.log('\n\nSaved torrent: "' + file.path + '"\n');
                        },
                        onerror: error => promptService.alert(null, 'Error', error.message)
                    });
                    download.port.emit('create', torrent.id, torrent.title);
            },
            'save-as': url =>
                    filePicker('Torrent - Save As', 'modeSave', url).then(picker =>
                    worker.port.emit('path', picker.file.path, picker.file.leafName)),
            'alert': (title = '', text = '') =>
                    promptService.alert(null, title, text)
        };
        Object.keys(methods).forEach(event =>
                worker.port.on(event, methods[event]));
    };

    const sidebar = Sidebar({
        id: 'torrent-creator',
        title: 'Torrent Creator',
        url: data.url('sidebar.html'),
        onAttach: worker => giveMethods(worker)
    });

    sidebar.show();

    Hotkey({ combo: "accel-shift-t", onPress: () => sidebar.show() });
    setMenuAction(event => sidebar.show());

    // Download widget.
    const widget = Widget({
      id: "torrent-creator",
      label: "Torrent Creator",
      contentURL: "http://www.mozilla.org/favicon.ico",
      panel: download 
    });

};
