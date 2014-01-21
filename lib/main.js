exports.main = function () {
    const { promptUser } = require('./creator');
    function progress(aStatus, aProgress, aProgressMax) {
        console.log(aProgress + ' of ' + aProgressMax, 'Status: ' + aStatus);
    }
    function callback(torrent, error) {
        if (error) {
            console.log(error.message);
            console.log('Torrent creation failed.');
        } else {
            console.log('Torrent created successfully!');
            torrent.saveToFile((file, errorStatus) => {
                if (!errorStatus) {
                    console.log('Saved torrent to ' + file.path);
                    console.log('Opening torrent...');
                    file.launch();
                }
                else console.log('Operation failed with status: ' + errorStatus);
            });
        }
        console.log(torrent);
    }
    promptUser('Select Source', callback, progress, false, true);
};
