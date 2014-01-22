Torrent Creator
=============
Torrent creation module for FireBit that can be ran as a separate extension.

###Run torrent creator as an add-on
```code
git clone git@github.com:DecipherCode/torrent-creator.git torrent-creator
cd torrent-creator
cfx run // use cfx xpi to create torrent-creator.xpi package.
```

Module Installation
-----------

There must be a _packages_ directory located at the root of your add-on's package. This package should be stored in the package's directory.

### Directory Structure

```code
Relative: /packages/torrent-creator

- some-addon.xpi

    /packages
        /torrent-creator
            /lib
                /...
        /another-package
            /...
    /lib
        /main.js
    /data
        /...

```


### Modify "package.json"
You will need to list _torrent-creator_ as a dependency. Below is an example add-on's package.json.

```json
{
    "license": "MPL 2.0",
    "version": "1.0",
    "description": "Some Addon",
    "contributors": [],
    "keywords": [ "some addon extension" ],
    "author": "Author Name <author@site.com",
    "homepage": "https://someaddon.org",
    "repository": {
        "type": "git",
        "url": "https://github.com/author/someaddon.git",
        "web": "https://github.com/author/someaddon"
    },
    "bugs": "https://github.com/author/someaddon/issues",
    "dependencies": ["api-utils", "addon-kit", "torrent-creator"],
    "packages": "packages",
    "version": "1.0",
    "lib": "lib",
    "fullName": "Some Addon",
    "main": "main",
    "id": "someaddon@site.com",
    "name": "some-addon"
}
```

###Require Library
```javascript
    const { Torrent, promptUser } = require('torrent-creator/creator');

    function progress(aStatus, aProgress, aProgressMax) {
        console.log(aProgress + ' of ' + aProgressMax, 'Status: ' + aStatus);
    }

    function callback(torrent, error) {
        if (error) {
            console.log(error.message);
            console.log('Torrent creation failed.');
        } else {
            console.log('Torrent created successfully!');
            // torrent.saveToFile(); || torrent.saveToFile('C:\\test.torrent'); || torrent.saveToFile(nsIFile);
            let file = torrent.saveToFile('C:\\');
            // file.path === 'C:\\' + torrent.info.name + '.torrent'
            console.log('\n\nSaved torrent: "' + file.path + '"\n', torrent);
            console.log('Opening torrent: ' + torrent.getHash());
            file.launch();
        }
    }

    /*
     * Syntax:
     *
     *  All arguments are optional. Use of one does not require another.
     *
     *  promptUser(title, callback, progress, notifyOnAbort);
     *  promptUser(title, modeGetFolder, callback, progress, notifyOnAbort);
     *  promptUser(title, callback, modeGetFolder, progress, notifyOnAbort);
     *  promptUser(title, callback, progress, modeGetFolder, notifyOnAbort);
     *
     *  Warning: If progress(Function) argument is listed before the callback(Function)
     *  argument then their roles will be reversed.
     *  |
     *  v
     *  Do not do this: promptUser(title, progress, callback);
     *
     *  @Param: modeGetFolder(Boolean)
     *  @Param: notifyOnAbort(Boolean)
     */

    promptUser('Select File', callback, progress, false, true);
    //promptUser('Select Directory', callback, progress, true, true);

    /*
     * Syntax:
     *
     *  All arguments except path are optional. Use of one does not require another.
     *  The "file" argument may be a file path or nsIFile instance.
     *
     *  createTorrent(file, callback, progress);
     *  createTorrent(file, pieceSize, callback, progress);
     *  createTorrent(file, callback, pieceSize, progress);
     *  createTorrent(file, callback, progress, pieceSize);
     *
     *  Warning: If progress(Function) argument is listed before the callback(Function)
     *  argument then their roles will be reversed.
     *  |
     *  v
     *  Do not do this: createTorrent(file, progress, callback);
     *
     *  @Param: pieceLength(Number)
     */
     createTorrent('C:\\video.mp4', pieceSize, callback, progress);
     createTorrent('C:\\Documents and Settings\\New Folder', callback, progress);


     // For more examples see lib/creator.js

     let torrent = new Torrent({ // You can specify 'piece length', etc. here
        'announce-list': ['http://torrenttracker:8080'],
        'info': {
            'name': 'archive.7z'
        }
     });

     torrent.info.length = 54654561;
     //torrent.info.files = [...]
     torrent.updateFromFile(path, callback, progress);

     // bencoded torrent meta data === torrent.toString()


```


License
------

MPL 2.0