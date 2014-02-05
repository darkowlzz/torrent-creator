exports.main = function () {
    const { filePicker, createTorrent, isDirectory, getTemplate } = require('./creator');
    const { Item: ContextMenu, SelectorContext } = require('sdk/context-menu');
    const { setTimeout } = require('sdk/timers');
    const { setMenuAction } = require('./menu');
    const { Hotkey } = require('sdk/hotkeys');
    const { Sidebar } = require('sdk/ui/sidebar');
    const { data } = require('sdk/self');
    const { Panel } = require('sdk/panel');
    const { Widget } = require('sdk/widget');
    const prefSvc = require('sdk/preferences/service');

    const { Cc, Ci } = require('chrome'); // Currently only for nsIPromptService

    const promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                              getService(Ci.nsIPromptService);

    const prefBranch = 'extensions.firebit.modules.torrentcreator';

    const getPref = (name, defaultValue) =>
            prefSvc.get(name ? (prefBranch + '.' + name) : prefBranch, defaultValue);

    const setPref = (name, value) =>
            prefSvc.set(name ? (prefBranch + '.' + name) : prefBranch, value);

    ContextMenu({
        label: 'Create Torrent',
        context: SelectorContext('a'),
        contentScript: 'self.on(\'click\', anchor => self.postMessage(anchor.href));',
        onMessage: function (url) {
            createTorrent({
                source: url,
                prototype: {
                    'comment': 'This is an example torrent comment.'
                },
                onprogress: function (status, statusArg, progress, progressMax) {
                    console.debug(statusArg + ': ' + progress + ' of ' + progressMax);
                },
                onload: (torrent) => {
                    torrent.finish();
                    let file = torrent.saveToDisk();
                    console.log('\n\nSaved torrent: "' + file.path + '"\n');
                    console.log('Opening torrent: ' + torrent.getHash());
                    file.launch();
                },
                onerror: (error) => console.exception(error)
            });
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
            'get-prototype': () => {
                let prototype, sObj = getPref('prototype');
                if (sObj)
                    prototype = JSON.parse(sObj);
                else {
                    sObj = JSON.stringify(prototype = getTemplate());
                    setPref('prototype', sObj);
                }
                worker.port.emit('prototype', prototype);
            },
            'set-prototype': prototype => {
                if (prototype)
                    setPref('prototype', JSON.stringify(prototype));
            },
            'create': (url, prototype, path, name) => {
                    let torrent = createTorrent({
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
                    let title = name.replace(/$\.torrent/i, '');
                    download.port.emit('create', torrent.id, title);
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
