exports.main = function () {
    const { filePicker, createTorrent, isDirectory } = require('./creator');
    const { Item: ContextMenu, SelectorContext } = require('sdk/context-menu');
    const { setTimeout } = require('sdk/timers');
    const { setMenuAction } = require('./menu');
    const { Hotkey } = require('sdk/hotkeys');
    const { Sidebar } = require('sdk/ui/sidebar');
    const { data } = require('sdk/self');

    const { Cc, Ci } = require('chrome'); // Currently only for nsIPromptService

    const promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                              getService(Ci.nsIPromptService);

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
                    console.log(statusArg + ': ' + progress + ' of ' + progressMax);
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

    const example = () => {
        filePicker('Select Source').then(picker => {
            let torrent = createTorrent({
                source: picker.fileURL,
                prototype: {
                    'comment': 'This is an example torrent comment.'
                },
                onprogress: function (status, statusArg, progress, progressMax) {
                    console.log(statusArg + ': ' + progress + ' of ' + progressMax);
                },
                onload: function (torrent) {
                    torrent.finish();
                    let file = torrent.saveToDisk();
                    console.log('\n\nSaved torrent: "' + file.path + '"\n');
                    console.log('Opening torrent: ' + torrent.getHash());
                    file.launch();
                },
                onerror: function (error) {
                    console.exception(error);
                }
            });
        });
    };

    const sidebar = Sidebar({
        id: 'torrent-creator',
        title: 'Torrent Creator',
        url: data.url('sidebar.html'),
        onAttach: function (worker) {
            worker.port.on('select-source', modeOpenFolder =>
                    filePicker('Select Source', modeOpenFolder).then(picker =>
                    worker.port.emit('source', picker.fileURL.spec)));
            worker.port.on('get-type', url => worker.port.emit('set-type', isDirectory(url)));
            worker.port.on('create', (url, prototype) => {
                console.log(url);
                let torrent = createTorrent({
                    source: url,
                    prototype: prototype,
                    onprogress: function (status, statusArg, progress, progressMax) {
                        console.log(statusArg + ': ' + progress + ' of ' + progressMax);
                    },
                    onload: function (torrent) {
                        torrent.finish();
                        let file = torrent.saveToDisk();
                        console.log('\n\nSaved torrent: "' + file.path + '"\n');
                        console.log('Opening torrent: ' + torrent.getHash());
                        file.launch();
                    },
                    onerror: error => promptService.alert(null, 'Error', error.message)
                });
            });
            worker.port.on('alert', (title = '', text = '') =>
                    promptService.alert(null, title, text));
        }
    });

    sidebar.show();

    Hotkey({ combo: "accel-shift-t", onPress: () => sidebar.show() });
    setMenuAction(event => sidebar.show());

};