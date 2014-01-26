exports.main = function () {

    const { Torrent, promptUser, createWebTorrent } = require('./creator');
    function progress(aStatus, aProgress, aProgressMax) {
        console.log(aProgress + ' of ' + aProgressMax, 'Status: ' + aStatus);
    }
    
    function callback(torrent, error) {
        if (error) {
            console.log(error.message);
            console.log('Torrent creation failed.');
        } else {
            console.log('Torrent created successfully!');
            let file = torrent.saveToFile();
            console.log('\n\nSaved torrent: "' + file.path + '"\n', torrent);
            console.log('Opening torrent: ' + torrent.getHash());
            file.launch();
        }
    }
    promptUser('Select File', callback, progress, false, true);
    promptUser('Select Directory', callback, progress, true, true);

    let url = 'http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/10.0.12esr-candidates/build1/jsshell-win32.zip';
    createWebTorrent(url, callback);
};