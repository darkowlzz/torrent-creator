exports.main = function () {
    const { filePicker, createTorrent } = require('./creator');
    const { Item: ContextMenu, SelectorContext } = require('sdk/context-menu');

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
        }
    });

    filePicker('Select File').then(fileURL => {
        createTorrent({
            source: fileURL,
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
    }, error => console.exception(error));

    filePicker('Select Directory', true).then(fileURL => {
        createTorrent({
            source: fileURL,
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
    }, error => console.exception(error));
};