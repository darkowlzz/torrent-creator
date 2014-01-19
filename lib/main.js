exports.main = function () {
    const { Torrent } = require('./creator');
    console.log(Object.getOwnPropertyNames(new Torrent()));
    let torrent = new Torrent();
    torrent.createFromFile('E:\\Elementary.S01E22.HDTV.x264-LOL.mp4', 0, true);

};
